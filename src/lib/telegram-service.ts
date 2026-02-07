import axios from 'axios';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;

/**
 * Send a message to the configured Telegram channel.
 * @param message The message to send
 * @returns Object indicating success or failure
 */
export async function sendTelegramMessage(message: string): Promise<{ success: boolean; error?: any }> {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHANNEL_ID) {
        console.error('Missing Telegram configuration: TELEGRAM_BOT_TOKEN or TELEGRAM_CHANNEL_ID');
        return { success: false, error: 'Telegram credentials missing' };
    }

    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        const response = await axios.post(url, {
            chat_id: TELEGRAM_CHANNEL_ID,
            text: message,
            parse_mode: 'HTML',
            disable_web_page_preview: false
        });

        if (response.data.ok) {
            return { success: true };
        } else {
            console.error('Telegram API error:', response.data);
            return { success: false, error: response.data.description };
        }
    } catch (error: any) {
        console.error('Telegram Request error:', error.response?.data || error.message);
        return { success: false, error: error.response?.data?.description || error.message };
    }
}
