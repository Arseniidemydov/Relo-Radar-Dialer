
import { Router, Request, Response } from 'express';
import twilio from 'twilio';
import { leads, activeCalls } from '../store';

const router = Router();
// Moved client initialization to route handler


// 1. Get Leads
router.get('/', (req: Request, res: Response) => {
    res.json(leads);
});

// 2. Drop Voicemail
router.post('/drop-voicemail', async (req: Request, res: Response) => {
    // Initialize client lazily to ensure env vars are loaded
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const voiceflowNumber = process.env.TWILIO_VOICEFLOW_NUMBER;

    const { leadId } = req.body;

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

    try {
        console.log(`[DropVM] LeadID: ${leadId}`);
        console.log(`[DropVM] Found CallSid to redirect: ${callSid}`);
        console.log(`[DropVM] Redirecting to Voiceflow Number: ${voiceflowNumber}`);

        // Construct TwiML for the redirect
        // We can point 'url' to an XML bin, or provide TwiML directly via 'twiml' param (if library supports) 
        // or point to a new endpoint on our server that returns the TwiML.
        // The Twilio Client .calls(sid).update({ twiml: ... }) IS supported in newer SDKs!
        // Using 'twiml' property directly is cleaner than managing a separate URL.

        const response = new twilio.twiml.VoiceResponse();
        response.say('Redirecting to voicemail now.');
        // Use SERVER_URL for creating the callback path
        const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';
        const callerId = process.env.TWILIO_CALLER_ID; // Use our Twilio number as the callerId for the transfer

        response.dial({
            action: `${serverUrl}/leads/dial-status`,
            method: 'POST',
            callerId: callerId
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

router.post('/dial-status', (req: Request, res: Response) => {
    console.log('[DialStatus] Callback received:', req.body);
    const dialStatus = req.body.DialCallStatus;
    console.log(`[DialStatus] Status of call to Voiceflow: ${dialStatus}`);
    res.type('text/xml').send('<Response><Hangup/></Response>');
});

export default router;
