import { Router, Request, Response } from 'express';
import twilio from 'twilio';
import { leads, activeCalls, pendingVoicemails, PendingVoicemailData } from '../store';
import axios from 'axios';
import { fetchLeadsFromNotion } from '../services/notionService';


const router = Router();

// 1. Get Leads
router.get('/', (req: Request, res: Response) => {
    res.json(leads);
});

// 1.5. Sync Leads from Notion
router.post('/sync-notion', async (req: Request, res: Response) => {
    if (!process.env.NOTION_API_KEY) {
        return res.status(500).json({ error: 'NOTION_API_KEY not configured on server' });
    }

    try {
        console.log('[NotionSync] Fetching leads from Notion...');
        const notionLeads = await fetchLeadsFromNotion();

        if (notionLeads.length === 0) {
            return res.status(404).json({
                error: 'No leads found. Make sure your database has Name and Phone columns with data.'
            });
        }

        // Add fetched leads to in-memory store (avoiding duplicates by phone)
        const existingPhones = new Set(leads.map(l => l.phone));
        let addedCount = 0;

        for (const lead of notionLeads) {
            if (!existingPhones.has(lead.phone)) {
                leads.push(lead);
                existingPhones.add(lead.phone);
                addedCount++;
            }
        }

        console.log(`[NotionSync] Added ${addedCount} new leads (${notionLeads.length - addedCount} duplicates skipped)`);

        res.json({
            success: true,
            leads: notionLeads,
            addedCount,
            totalFetched: notionLeads.length,
            message: `Synced ${addedCount} new leads from Notion`
        });
    } catch (error: any) {
        console.error('[NotionSync] Error:', error);

        // Provide helpful error messages
        if (error.code === 'unauthorized') {
            return res.status(401).json({ error: 'Invalid Notion API key' });
        }
        if (error.code === 'object_not_found') {
            return res.status(404).json({
                error: 'Database not found. Make sure your integration has access.'
            });
        }

        res.status(500).json({ error: error.message || 'Failed to sync from Notion' });
    }
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

        // NOTE: Voiceflow variable injection moved to voiceflow-proxy
        // This prevents session conflicts when making rapid sequential calls
        // The proxy sets variables RIGHT before forwarding each call to Voiceflow

        console.log(`[DropVM] Found CallSid to redirect: ${callSid}`);
        console.log(`[DropVM] Redirecting to Voiceflow Number: ${voiceflowNumber}`);

        // Store lead data in queue for the Proxy to use later
        // Using a queue (array) so sequential calls don't overwrite each other
        const voicemailData: PendingVoicemailData = {
            name: leadName || 'Unknown',
            phone: leadPhone || 'Unknown',
            callSid: callSid,
            timestamp: Date.now()
        };

        const existingQueue = pendingVoicemails.get(callerId) || [];
        existingQueue.push(voicemailData);
        pendingVoicemails.set(callerId, existingQueue);
        console.log(`[DropVM] Queued voicemail data for ${callerId} (queue size: ${existingQueue.length})`);

        // Construct TwiML for the redirect
        const response = new twilio.twiml.VoiceResponse();
        // REMOVED: response.say() - this was being recorded by the lead's voicemail!
        // Don't speak anything on the lead's leg, go straight to dialing Voiceflow

        // Pass callSid in action URL so dial-status and proxy can look up the mapping
        const actionUrl = `${serverUrl}/leads/dial-status?name=${encodeURIComponent(leadName || '')}&callSid=${encodeURIComponent(callSid)}`;

        const dial = response.dial({
            action: actionUrl,
            method: 'POST',
            callerId: callerId
        });

        dial.number(voiceflowNumber);

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

// 3. VOICEFLOW PROXY ROUTE (The "Interceptor")
// Point your Twilio Number to THIS route: https://your-render-url.com/leads/voiceflow-proxy
router.get('/voiceflow-proxy', (req, res) => {
    res.send('Voiceflow Proxy is Active. Please configure Twilio to use POST.');
});

router.post('/voiceflow-proxy', async (req: Request, res: Response) => {
    console.log('[VoiceflowProxy] Incoming call intercepted.');

    // 1. Capture the CallSid (This is the INBOUND leg to Voiceflow)
    const callSid = req.body.CallSid;
    const fromNumber = req.body.From; // This is the CallerID we used to dial out

    console.log(`[VoiceflowProxy] Captured Inbound CallSid: ${callSid}`);
    console.log(`[VoiceflowProxy] CallerID (From): ${fromNumber}`);

    // 2. Retrieve the Lead Data from our queue (FIFO - first in, first out)
    const queue = pendingVoicemails.get(fromNumber);
    const leadData = queue && queue.length > 0 ? queue.shift() : null;

    // Update or cleanup the queue
    if (queue && queue.length === 0) {
        pendingVoicemails.delete(fromNumber);
    }

    if (leadData) {
        console.log(`[VoiceflowProxy] Retrieved Lead Data: Name=${leadData.name}, Phone=${leadData.phone}`);
        console.log(`[VoiceflowProxy] Remaining queue size: ${queue?.length || 0}`);

        // 3. Inject Voiceflow variables RIGHT NOW, before forwarding
        // This ensures the correct lead data is set for THIS specific call
        if (process.env.VOICEFLOW_API_KEY) {
            try {
                await axios.patch(
                    `https://general-runtime.voiceflow.com/state/user/${encodeURIComponent(fromNumber)}/variables`,
                    {
                        name: leadData.name,
                        phone_number: leadData.phone
                    },
                    {
                        headers: {
                            Authorization: process.env.VOICEFLOW_API_KEY,
                            'versionID': 'production'
                        }
                    }
                );
                console.log(`[VoiceflowProxy] Voiceflow variables injected successfully for this call.`);
            } catch (vfError: any) {
                console.error(`[VoiceflowProxy] Failed to inject Voiceflow variables:`, vfError.message);
            }
        }

        // 4. Trigger Webhook with Inbound SID + Correct Lead Phone
        try {
            await axios.post('https://lovoiceagent.app.n8n.cloud/webhook/f48c5702-1f17-445c-a0d2-d487985c23e8', {
                call_sid: callSid,
                Phone_number: leadData.phone
            });
            console.log(`[VoiceflowProxy] Webhook triggered successfully with Inbound SID.`);
        } catch (webhookError: any) {
            console.error(`[VoiceflowProxy] Failed to trigger webhook:`, webhookError.message);
        }
    } else {
        console.warn(`[VoiceflowProxy] Warning: No pending lead data found for CallerID ${fromNumber}`);
    }

    // 4. Forward the call to the REAL Voiceflow URL (Transparent Proxy)
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
