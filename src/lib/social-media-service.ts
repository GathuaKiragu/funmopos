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
 * Upload media to X and post a tweet with it
 */
export async function postToXWithMedia(message: string, imageUrl: string): Promise<{ success: boolean; error?: string }> {
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

        // 1. Fetch image buffer
        const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(imageResponse.data);

        // 2. Upload media
        const mediaId = await client.v1.uploadMedia(imageBuffer, { mimeType: 'image/png' });

        // 3. Post tweet with media
        const result = await client.v2.tweet(message, { media: { media_ids: [mediaId] } });

        if (result.data.id) {
            console.log('[X/Twitter] Posted with media successfully:', result.data.id);
            return { success: true };
        } else {
            return { success: false, error: 'Failed to get Tweet ID' };
        }
    } catch (error: any) {
        console.error('X Media Posting Error:', error.data || error.message);
        return { success: false, error: error.data?.detail || error.message };
    }
}

/**
 * Post a message to Facebook Page
 */
export async function postToFacebook(message: string, imageUrl?: string): Promise<{ success: boolean; error?: string }> {
    if (!FB_PAGE_ID || !FB_PAGE_ACCESS_TOKEN) {
        return { success: false, error: 'Facebook credentials missing' };
    }

    try {
        // If imageUrl is provided, use current /photos endpoint logic
        // Otherwise use /feed

        let url = `https://graph.facebook.com/${FB_PAGE_ID}/feed`;
        const params: any = {
            message: message,
            access_token: FB_PAGE_ACCESS_TOKEN
        };

        if (imageUrl) {
            url = `https://graph.facebook.com/${FB_PAGE_ID}/photos`;
            params.url = imageUrl;
            // Facebook photos endpoint uses 'caption' instead of 'message' for the text
            params.caption = message;
            delete params.message;
        }

        const response = await axios.post(url, null, { params });

        if (response.data.id || response.data.post_id) {
            console.log('[Facebook] Posted successfully:', response.data.id || response.data.post_id);
            return { success: true };
        } else {
            return { success: false, error: 'Failed to get post ID from Facebook' };
        }
    } catch (error: any) {
        const errorData = error.response?.data?.error;
        console.error('[Facebook] Posting Error Detail:', JSON.stringify({
            message: errorData?.message || error.message,
            type: errorData?.type,
            code: errorData?.code,
            fbtrace_id: errorData?.fbtrace_id,
            status: error.response?.status
        }, null, 2));

        let errorMsg = errorData?.message || error.message;

        // Common Facebook API errors
        if (errorMsg.includes('global id') || errorMsg.includes('Unsupported get request')) {
            errorMsg = "Facebook Page ID Error: Please verify you're using the numeric Page ID from Page Settings, not a username or Business ID.";
        } else if (errorMsg.includes('access token') || errorMsg.includes('OAuthException')) {
            errorMsg = "Facebook Token Error: Your Page Access Token may have expired or lacks required permissions (pages_manage_posts, pages_read_engagement).";
        } else if (errorMsg.includes('permissions')) {
            errorMsg = "Facebook Permissions Error: The token needs 'pages_manage_posts' and 'pages_read_engagement' permissions.";
        } else if (errorMsg.includes('Invalid parameter')) {
            errorMsg = `Facebook Parameter Error: ${errorData?.message}. Check that the image URL is publicly accessible.`;
        }

        return { success: false, error: errorMsg };
    }
}
