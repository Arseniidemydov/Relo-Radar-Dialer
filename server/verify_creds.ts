
import dotenv from 'dotenv';
import twilio from 'twilio';

dotenv.config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const apiKey = process.env.TWILIO_API_KEY;
const apiSecret = process.env.TWILIO_API_SECRET;

console.log('Checking credentials...');
console.log(`Account SID: ${accountSid}`);
console.log(`API Key: ${apiKey}`);
console.log(`API Secret: ${apiSecret ? '******' : 'MISSING'}`);

if (!accountSid || !apiKey || !apiSecret) {
    console.error('Missing credentials in .env');
    process.exit(1);
}

const client = twilio(apiKey, apiSecret, { accountSid });

async function verify() {
    try {
        console.log('Attempting to fetch Account details...');
        const account = await client.api.accounts(accountSid!).fetch();
        console.log('SUCCESS! Credentials are valid.');
        console.log(`Account Name: ${account.friendlyName}`);
        console.log(`Account Status: ${account.status}`);
        console.log(`Account Type: ${account.type}`);
    } catch (error: any) {
        console.error('FAILURE! Credentials rejected.');
        console.error(`Error Code: ${error.code}`);
        console.error(`Message: ${error.message}`);
        console.error(`More Info: ${error.moreInfo}`);
    }
}

verify();
