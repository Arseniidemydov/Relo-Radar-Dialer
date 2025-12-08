
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import twilioRoutes from './routes/twilio';
import leadsRoutes from './routes/leads';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.urlencoded({ extended: false })); // Twilio sends webhooks as form-urlencoded
app.use(express.json());

// Routes
app.use('/twilio', twilioRoutes);
app.use('/leads', leadsRoutes);

app.get('/', (req, res) => {
    res.send('Twilio Dialer Backend Running');
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    if (!process.env.SERVER_URL) {
        console.warn('WARNING: SERVER_URL not set in .env. Twilio Voice status callbacks may fail locally without ngrok.');
    }
});
