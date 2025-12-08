
import { Router, Request, Response } from 'express';
import twilio from 'twilio';
import { activeCalls } from '../store';

const router = Router();

// Environment variables are read inside routes to ensure dotenv is loaded

// 1. Generate Access Token for the Browser Client
router.get('/token', (req: Request, res: Response) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const apiKey = process.env.TWILIO_API_KEY;
    const apiSecret = process.env.TWILIO_API_SECRET;
    const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

    if (!accountSid || !apiKey || !apiSecret || !twimlAppSid) {
        return res.status(500).json({ error: 'Missing Twilio configuration' });
    }

    const identity = 'agent'; // Single agent for this demo
    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const voiceGrant = new VoiceGrant({
        outgoingApplicationSid: twimlAppSid,
        incomingAllow: true, // Allow incoming calls if needed
    });

    const token = new AccessToken(accountSid, apiKey, apiSecret, { identity });
    token.addGrant(voiceGrant);

    res.json({ token: token.toJwt() });
});

// 2. Voice Webhook - Handles the initial call from Browser -> Twilio
// The browser SDK sends parameters, including custom ones passed to device.connect(params)
router.post('/voice', (req: Request, res: Response) => {
    // 'To' comes from the client params (the lead's phone number)
    const { To, leadId } = req.body;

    const twiml = new twilio.twiml.VoiceResponse();

    if (!To) {
        twiml.say('No phone number provided.');
        return res.type('text/xml').send(twiml.toString());
    }

    const callerId = process.env.TWILIO_CALLER_ID;
    const dial = twiml.dial({ callerId });

    // Create a status callback URL that includes the leadId
    // This helps us associate the *Child CallLeg* (created by <Number>) with the Lead
    // We point to the public URL of this server (must be ngrok or deployed) usually, 
    // but for local dev, user configures the 'To' URL.
    // Actually, we set the callback on the <Number> noun.

    // NOTE: 'Referer' or Host header might allow determining the callback domain loosely, 
    // but usually we rely on a configured BASE_URL env var or relative path if Twilio App config handles it?
    // No, Twilio needs absolute URLs for status callbacks.
    // We will assume the user sets SERVER_URL or we construct it.
    const serverUrl = process.env.SERVER_URL || req.protocol + '://' + req.get('host');
    const statusCallbackUrl = `${serverUrl}/twilio/status?leadId=${leadId}`;

    // We want to track the 'answered' or 'in-progress' state to get the CallSid
    dial.number({
        statusCallback: statusCallbackUrl,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST'
    }, To);

    res.type('text/xml').send(twiml.toString());
});

// 3. Status Callback - Captures the Child Leg CallSid
router.post('/status', (req: Request, res: Response) => {
    const { CallSid, leadId } = req.query as { CallSid?: string, leadId?: string }; // Or req.body depending on Twilio
    // Twilio sends data in BODY, but we put leadId in QUERY param above.

    const childCallSid = req.body.CallSid; // The CallSid of the <Number> leg
    const queryLeadId = req.query.leadId as string;

    if (queryLeadId && childCallSid) {
        console.log(`[Status] Mapping Lead ${queryLeadId} to CallSid ${childCallSid} (Status: ${req.body.CallStatus})`);

        if (req.body.CallStatus === 'completed' || req.body.CallStatus === 'failed' || req.body.CallStatus === 'busy') {
            activeCalls.delete(queryLeadId);
            console.log(`[Status] Removed Lead ${queryLeadId} from activeCalls. Store size: ${activeCalls.size}`);
        } else {
            activeCalls.set(queryLeadId, childCallSid);
            console.log(`[Status] Stored Lead ${queryLeadId} with CallSid ${childCallSid}. Store size: ${activeCalls.size}`);
        }
    }

    res.sendStatus(200);
});

export default router;
