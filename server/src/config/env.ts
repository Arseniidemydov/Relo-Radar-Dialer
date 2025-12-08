import dotenv from 'dotenv';

dotenv.config();

const requiredEnvVars = [
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_API_KEY',
    'TWILIO_API_SECRET',
    'TWILIO_TWIML_APP_SID',
    'TWILIO_CALLER_ID',
    // 'TWILIO_VOICEFLOW_NUMBER' // Optional? Check usage
];

export const validateEnv = () => {
    const missingVars = requiredEnvVars.filter((key) => !process.env[key]);

    if (missingVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    if (!process.env.SERVER_URL && process.env.NODE_ENV === 'production') {
        console.warn('WARNING: SERVER_URL is not set. Twilio callbacks might fail.');
    }
};

export const env = {
    PORT: process.env.PORT || 3001,
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID!,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN!,
    TWILIO_API_KEY: process.env.TWILIO_API_KEY!,
    TWILIO_API_SECRET: process.env.TWILIO_API_SECRET!,
    TWILIO_TWIML_APP_SID: process.env.TWILIO_TWIML_APP_SID!,
    TWILIO_CALLER_ID: process.env.TWILIO_CALLER_ID!,
    TWILIO_VOICEFLOW_NUMBER: process.env.TWILIO_VOICEFLOW_NUMBER,
    SERVER_URL: process.env.SERVER_URL,
    NODE_ENV: process.env.NODE_ENV || 'development'
};
