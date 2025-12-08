import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import twilioRoutes from './routes/twilio';
import leadsRoutes from './routes/leads';
import logger from './utils/logger';
import { validateEnv, env } from './config/env';

// Validate environment variables
validateEnv();

const app = express();
const PORT = env.PORT;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.urlencoded({ extended: false })); // Twilio sends webhooks as form-urlencoded
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

// Logging
const morganFormat = ':method :url :status :response-time ms';
app.use(morgan(morganFormat, {
    stream: {
        write: (message: string) => {
            const logObject = {
                method: message.split(' ')[0],
                url: message.split(' ')[1],
                status: message.split(' ')[2],
                responseTime: message.split(' ')[3],
            };
            logger.info(JSON.stringify(logObject));
        },
    },
}));

// Routes
app.use('/twilio', twilioRoutes);
app.use('/leads', leadsRoutes);

app.get('/', (req, res) => {
    res.send('Twilio Dialer Backend Running');
});

// Start Server
app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
    if (!env.SERVER_URL) {
        logger.warn('WARNING: SERVER_URL not set. Twilio Voice status callbacks may fail locally without ngrok.');
    }
});
