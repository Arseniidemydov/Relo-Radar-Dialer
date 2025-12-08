
const twilio = require('twilio');
const dotenv = require('dotenv');
dotenv.config();

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

async function listApps() {
    try {
        const apps = await client.applications.list({ limit: 20 });
        console.log('--- FOUND TWIML APPS ---');
        if (apps.length === 0) {
            console.log('No apps found.');
        } else {
            apps.forEach(app => {
                console.log(`FriendlyName: ${app.friendlyName} | Sid: ${app.sid} | VoiceUrl: ${app.voiceUrl}`);
            });
        }
        console.log('------------------------');
    } catch (error) {
        console.error('Error fetching apps:', error);
    }
}

listApps();
