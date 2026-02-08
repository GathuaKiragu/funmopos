import axios from 'axios';
import { TwitterApi } from 'twitter-api-v2';

// X (Twitter) Config
const X_API_KEY = process.env.X_API_KEY;
const X_API_SECRET = process.env.X_API_SECRET;
const X_ACCESS_TOKEN = process.env.X_ACCESS_TOKEN;
const X_ACCESS_TOKEN_SECRET = process.env.X_ACCESS_TOKEN_SECRET;

// Facebook Config
const FB_PAGE_ID = process.env.FB_PAGE_ID;
const FB_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;

/**
 * Post a message to X (Twitter)
 */
export async function postToX(message: string): Promise<{ success: boolean; error?: string }> {
    if (!X_ACCESS_TOKEN || !X_ACCESS_TOKEN_SECRET || !X_API_KEY || !X_API_SECRET) {
        return { success: false, error: 'X credentials missing' };
    }

    try {
        const client = new TwitterApi({
            appKey: X_API_KEY,
            appSecret: X_API_SECRET,
            accessToken: X_ACCESS_TOKEN,
            accessSecret: X_ACCESS_TOKEN_SECRET,
        });

        const v2Client = client.v2;
        const result = await v2Client.tweet(message);

        if (result.data.id) {
            console.log('[X/Twitter] Posted successfully:', result.data.id);
            return { success: true };
        } else {
            return { success: false, error: 'Failed to get Tweet ID' };
        }
    } catch (error: any) {
        console.error('X Posting Error:', error.data || error.message);
        return { success: false, error: error.data?.detail || error.message };
    }
}

/**
 * Post a message to Facebook Page
 */
export async function postToFacebook(message: string): Promise<{ success: boolean; error?: string }> {
    if (!FB_PAGE_ID || !FB_PAGE_ACCESS_TOKEN) {
        return { success: false, error: 'Facebook credentials missing' };
    }

    try {
        // Use the standard /{page-id}/feed endpoint. 
        // Page Access Token is required for this to work.
        const url = `https://graph.facebook.com/${FB_PAGE_ID}/feed`;
        const response = await axios.post(url, null, {
            params: {
                message: message,
                access_token: FB_PAGE_ACCESS_TOKEN
            }
        });

        if (response.data.id) {
            console.log('[Facebook] Posted successfully:', response.data.id);
            return { success: true };
        } else {
            return { success: false, error: 'Failed to get post ID from Facebook' };
        }
    } catch (error: any) {
        const errorData = error.response?.data?.error;
        console.error('Facebook Posting Error Detail:', errorData || error.message);

        let errorMsg = errorData?.message || error.message;

        // Specific hint for the "global id" error
        if (errorMsg.includes('global id')) {
            errorMsg = "Facebook Page ID Error: Please ensure you are using the 'Page ID' from your Page Settings, not a Business ID.";
        }

        return { success: false, error: errorMsg };
    }
}
