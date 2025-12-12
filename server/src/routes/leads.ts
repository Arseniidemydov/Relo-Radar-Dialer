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

        // Webhook Trigger URL: This runs when the Voiceflow number takes the call
        // We embed the Lead Phone here to ensure it's passed correctly to n8n
        const webhookUrl = `${serverUrl}/leads/voiceflow-webhook?leadPhone=${encodeURIComponent(leadPhone || 'Unknown')}`;

        const dial = response.dial({
            action: actionUrl,
            method: 'POST',
            callerId: callerId
        });

        // The 'url' attribute triggers when the called party answers (Screening)
        // We use it to fire our webhook with the child leg SID + Lead Phone
        dial.number({
            url: webhookUrl
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

// 3. VOICEFLOW WEBHOOK TRIGGER (The "Notifier")
// Triggered by <Number url="..."> when the call connects
router.post('/voiceflow-webhook', async (req: Request, res: Response) => {
    const { CallSid } = req.body; // Child Call SID
    const { leadPhone } = req.query;

    console.log(`[VoiceflowWebhook] Triggered. Leg SID: ${CallSid}, Lead Phone: ${leadPhone}`);

    try {
        await axios.post('https://lovoiceagent.app.n8n.cloud/webhook/f48c5702-1f17-445c-a0d2-d487985c23e8', {
            call_sid: CallSid,
            Phone_number: leadPhone || 'Unknown'
        });
        console.log(`[VoiceflowWebhook] N8N Webhook sent successfully.`);
    } catch (webhookError: any) {
        console.error(`[VoiceflowWebhook] Failed to send webhook:`, webhookError.message);
    }

    // Return empty TwiML to continue the call connection
    res.type('text/xml').send('<Response></Response>');
});

// 4. VOICEFLOW PROXY ROUTE (The "Interceptor")
// Point your Twilio Number to THIS route: https://your-render-url.com/leads/voiceflow-proxy
router.get('/voiceflow-proxy', (req, res) => {
    res.send('Voiceflow Proxy is Active. Please configure Twilio to use POST.');
});

router.post('/voiceflow-proxy', async (req: Request, res: Response) => {
    console.log('[VoiceflowProxy] Incoming call intercepted.');

    // 1. Capture the CallSid (Debug only)
    const callSid = req.body.CallSid;
    console.log(`[VoiceflowProxy] Proxying CallSid: ${callSid}`);

    // NOTE: We do NOT trigger the webhook here anymore, because req.body.From is the CallerID.
    // We rely on /voiceflow-webhook (above) to do it with the correct Lead Phone.

    // 2. Forward the call to the REAL Voiceflow URL (Transparent Proxy)
    const voiceflowUrl = process.env.VOICEFLOW_FORWARDING_URL ? process.env.VOICEFLOW_FORWARDING_URL.trim() : '';

    if (!voiceflowUrl) {
        console.error('[VoiceflowProxy] VOICEFLOW_FORWARDING_URL not set or empty!');
        const twiml = new twilio.twiml.VoiceResponse();
        twiml.say('System configuration error. Forwarding URL missing.');
        return res.type('text/xml').send(twiml.toString());
    }

    try {
        console.log(`[VoiceflowProxy] Forwarding body keys: ${Object.keys(req.body).join(', ')}`);
        console.log(`[VoiceflowProxy] Forwarding to Voiceflow (GET): ${voiceflowUrl}`);

        // Voiceflow apparently expects GET for this endpoint (based on "Cannot POST" error)
        // We map the Twilio POST body to Query Parameters
        const response = await axios.get(voiceflowUrl, {
            params: req.body,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        console.log('[VoiceflowProxy] Received response from Voiceflow.');
        // Return the TwiML directly
        res.set('Content-Type', 'text/xml');
        res.send(response.data);

    } catch (proxyError: any) {
        console.error(`[VoiceflowProxy] Error forwarding to Voiceflow:`, proxyError.message);
        if (proxyError.response) {
            console.error(`[VoiceflowProxy] Voiceflow Status: ${proxyError.response.status}`);
            console.error(`[VoiceflowProxy] Voiceflow Data:`, proxyError.response.data);
        }

        // Fallback TwiML
        const twiml = new twilio.twiml.VoiceResponse();
        twiml.say('Sorry, could not connect to the voice agent.');
        res.type('text/xml').send(twiml.toString());
    }
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
