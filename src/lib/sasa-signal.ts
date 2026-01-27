import crypto from 'crypto';

const SASASIGNAL_EMAIL = process.env.SASASIGNAL_EMAIL;
const SASASIGNAL_PASSWORD = process.env.SASASIGNAL_PASSWORD;
const SASASIGNAL_URL = 'https://sasasignal.com/api/v1';

let cachedToken: string | null = null;
let tokenExpiry: number | null = null;

export async function getSasaSignalToken(): Promise<string> {
    if (cachedToken && tokenExpiry && Date.now() < (tokenExpiry - 60000)) {
        return cachedToken;
    }

    try {
        if (!SASASIGNAL_EMAIL || !SASASIGNAL_PASSWORD) {
            throw new Error("Missing Sasa Signal Credentials in Env");
        }

        const response = await fetch(`${SASASIGNAL_URL}/authenticate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: SASASIGNAL_EMAIL,
                password: SASASIGNAL_PASSWORD
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Sasa Signal Auth Failed (${response.status}):`, errorText);
            throw new Error(`Auth failed: ${response.status}`);
        }

        const data = await response.json();
        const token = data.token || data.access_token;

        if (!token) {
            throw new Error("No token returned from authentication.");
        }

        cachedToken = token;
        tokenExpiry = Date.now() + (50 * 60 * 1000);
        return token;
    } catch (error: any) {
        console.error("Error in getSasaSignalToken:", error.message);
        throw error;
    }
}

export async function sendSasaSMS(to: string, message: string) {
    try {
        const token = await getSasaSignalToken();
        const senderId = process.env.SASASIGNAL_SENDER_ID || "SMSBiashara";

        // Generate Idempotency Key
        const idempotencyKey = crypto.randomUUID();

        const formData = new FormData();
        formData.append('sender_id', senderId);
        formData.append('message', message);
        formData.append('recipient', to);

        // Exact params from user CURL command
        formData.append('callback_url', 'https://localhost:3000'); // As provided in curl example, though void URL is safer in prod
        formData.append('scheduled_send_unix', ''); // Empty string as requested

        console.log(`Debug: Sending SMS to ${to} with SenderID: ${senderId}`);

        const response = await fetch(`${SASASIGNAL_URL}/sms/transactional/send`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Idempotency-Key': idempotencyKey,
            },
            body: formData
        });

        const responseText = await response.text();

        if (!response.ok) {
            console.error(`Sasa Signal SMS Failed (${response.status}):`, responseText.substring(0, 500));
            throw new Error(`Sasa Signal API Error (${response.status}): ${responseText.substring(0, 200)}...`);
        }

        try {
            return JSON.parse(responseText);
        } catch (e) {
            return { success: true, text: responseText };
        }

    } catch (error: any) {
        console.error("Error in sendSasaSMS:", error.message);
        throw error;
    }
}
