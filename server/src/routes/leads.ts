import { Router, Request, Response } from 'express';
import twilio from 'twilio';
import { leads, activeCalls } from '../store';
import axios from 'axios';

const router = Router();

// 1. Get Leads
router.get('/', (req: Request, res: Response) => {
    res.json(leads);
});

// 2. Drop Voicemail
router.post('/drop-voicemail', async (req: Request, res: Response) => {
    // Initialize client lazily to ensure env vars are loaded
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const voiceflowNumber = process.env.TWILIO_VOICEFLOW_NUMBER;

    const { leadId, leadName, leadPhone } = req.body;

    if (!leadId) {
        return res.status(400).json({ error: 'Missing leadId' });
    }

    const callSid = activeCalls.get(leadId);

    if (!callSid) {
        return res.status(404).json({ error: 'No active call found for this lead' });
    }

    if (!voiceflowNumber) {
        return res.status(500).json({ error: 'Voiceflow number not configured' });
    }

    // Use SERVER_URL for creating the callback path
    const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';
    const callerId = process.env.TWILIO_CALLER_ID;

    if (!callerId) {
        return res.status(500).json({ error: 'TWILIO_CALLER_ID not configured' });
    }

    try {
        console.log(`[DropVM] LeadID: ${leadId}, Name: ${leadName || 'Unknown'}, Phone: ${leadPhone || 'Unknown'}`);

        // --- VOICEFLOW VARIABLE INJECTION ---
        if (process.env.VOICEFLOW_API_KEY) {
            console.log(`[DropVM] Updating Voiceflow State for UserID (CallerID): ${callerId}`);
            try {
                await axios.patch(
                    `https://general-runtime.voiceflow.com/state/user/${encodeURIComponent(callerId)}/variables`,
                    {
                        name: leadName || 'Unknown',
                        phone_number: leadPhone || 'Unknown'
                    },
                    {
                        headers: {
                            Authorization: process.env.VOICEFLOW_API_KEY,
                            'versionID': 'production'
                        }
                    }
                );
                console.log(`[DropVM] Voiceflow variables updated successfully.`);
            } catch (vfError: any) {
                console.error(`[DropVM] Failed to update Voiceflow variables:`, vfError.message);
            }
        } else {
            console.warn('[DropVM] VOICEFLOW_API_KEY missing. Skipping variable injection.');
        }
        // ------------------------------------

        console.log(`[DropVM] Found CallSid to redirect: ${callSid}`);
        console.log(`[DropVM] Redirecting to Voiceflow Number: ${voiceflowNumber}`);

        // Construct TwiML for the redirect
        const response = new twilio.twiml.VoiceResponse();
        response.say(`Redirecting ${leadName || 'the lead'} to voicemail now.`);

        // Append name to the action URL so we get it back in the webhook
        const actionUrl = `${serverUrl}/leads/dial-status?name=${encodeURIComponent(leadName || '')}`;

        // Status callback for the CHILD call leg (Voiceflow connection)
        // We trigger this on 'initiated' to get the SID immediately
        const voiceflowStatusUrl = `${serverUrl}/leads/voiceflow-status?leadPhone=${encodeURIComponent(leadPhone || 'Unknown')}`;

        const dial = response.dial({
            action: actionUrl,
            method: 'POST',
            callerId: callerId
        });

        dial.number({
            statusCallback: voiceflowStatusUrl,
            statusCallbackEvent: ['initiated'], // Trigger as soon as the leg starts
            statusCallbackMethod: 'POST'
        }, voiceflowNumber);

        console.log('[DropVM] Generated TwiML:', response.toString());

        await client.calls(callSid).update({
            twiml: response.toString()
        });

        // Cleanup store
        activeCalls.delete(leadId);

        res.json({ success: true, message: 'Voicemail drop triggered' });
    } catch (error: any) {
        console.error('Error dropping voicemail:', error);
        res.status(500).json({ error: error.message });
    }
});

// 3. New Route: Handle Voiceflow Leg Status
// This triggers the webhook with the CORRECT child CallSid
router.post('/voiceflow-status', async (req: Request, res: Response) => {
    const { CallSid, CallStatus } = req.body;
    const { leadPhone } = req.query;

    console.log(`[VoiceflowStatus] CallSid: ${CallSid}, Status: ${CallStatus}, Phone: ${leadPhone}`);

    if (CallStatus === 'initiated') {
        try {
            console.log(`[VoiceflowStatus] Triggering Webhook for Child SID: ${CallSid}`);
            await axios.post('https://lovoiceagent.app.n8n.cloud/webhook/f48c5702-1f17-445c-a0d2-d487985c23e8', {
                call_sid: CallSid,
                Phone_number: leadPhone || 'Unknown'
            });
            console.log(`[VoiceflowStatus] Webhook triggered successfully.`);
        } catch (webhookError: any) {
            console.error(`[VoiceflowStatus] Failed to trigger webhook:`, webhookError.message);
        }
    }

    res.sendStatus(200);
});

router.post('/dial-status', (req: Request, res: Response) => {
    console.log('[DialStatus] Callback received:', req.body);
    const dialStatus = req.body.DialCallStatus;
    const name = req.query.name;

    console.log(`[DialStatus] Status of call to Voiceflow: ${dialStatus}`);
    console.log(`[DialStatus] Lead Name: ${name}`);

    res.type('text/xml').send('<Response><Hangup/></Response>');
});

export default router;
