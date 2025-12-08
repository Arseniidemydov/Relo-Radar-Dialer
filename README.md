# Twilio Voiceflow Dialer

## Setup

1.  **Environment Variables**:
    Create a `.env` file in `server/` with the following:
    ```env
    TWILIO_ACCOUNT_SID=AC...
    TWILIO_AUTH_TOKEN=...
    TWILIO_API_KEY=SK...
    TWILIO_API_SECRET=...
    TWILIO_TWIML_APP_SID=AP...
    TWILIO_VOICEFLOW_NUMBER=+1...
    TWILIO_CALLER_ID=+1...
    SERVER_URL=https://your-ngrok-url.io 
    # SERVER_URL is needed for Twilio callbacks. Use ngrok locally.
    ```

2.  **Install Dependencies**:
    ```bash
    cd server && npm install
    cd ../client && npm install
    ```

## Running Locally

1.  **Start Backend**:
    ```bash
    cd server
    npm run dev
    ```

2.  **Start Frontend**:
    ```bash
    cd client
    npm run dev
    ```

3.  **Expose Localhost (Important)**:
    Since Twilio needs to hit your `/voice` and `/status` endpoints, you must expose port 3001.
    ```bash
    ngrok http 3001
    ```
    Update `SERVER_URL` in `.env` with the ngrok https URL.

## Usage

1.  Open the frontend (e.g., `http://localhost:5173`).
2.  Click **Call Lead**.
3.  When connected, click **Drop Voicemail**.
4.  The system will redirect the lead's call leg to the Voiceflow number.
