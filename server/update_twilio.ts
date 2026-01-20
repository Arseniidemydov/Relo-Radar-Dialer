
import twilio from 'twilio';
import dotenv from 'dotenv';
dotenv.config();

const accountSid = process.env.TWILIO_ACCOUNT_SID as string;
const authToken = process.env.TWILIO_AUTH_TOKEN as string;
const appSid = process.env.TWILIO_TWIML_APP_SID as string;
const serverUrl = process.env.SERVER_URL as string;

if (!accountSid || !authToken || !appSid || !serverUrl) {
    console.error("Missing env vars");
    process.exit(1);
}

const client = twilio(accountSid, authToken);

async function updateApp() {
    try {
        const app = await client.applications(appSid).fetch();
        console.log(`Current VoiceUrl: ${app.voiceUrl}`);

        const newUrl = `${serverUrl}/twilio/voice`;

        if (app.voiceUrl !== newUrl) {
            console.log(`Updating to: ${newUrl}`);
            await client.applications(appSid).update({
                voiceUrl: newUrl
            });
            console.log("Updated successfully!");
        } else {
            console.log("URL is already up to date.");
        }
    } catch (err) {
        console.error("Failed to update app:", err);
    }
}

updateApp();
