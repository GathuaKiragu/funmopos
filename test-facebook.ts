/**
 * Quick script to test Facebook posting and see the exact error
 * Run: npx tsx test-facebook.ts
 */

import 'dotenv/config';
import axios from 'axios';

const FB_PAGE_ID = process.env.FB_PAGE_ID;
const FB_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;

async function testFacebookPost() {
    console.log('🔍 Testing Facebook API...\n');

    // Check credentials
    console.log('Credentials Check:');
    console.log('- FB_PAGE_ID:', FB_PAGE_ID ? '✅ Found' : '❌ Missing');
    console.log('- FB_PAGE_ACCESS_TOKEN:', FB_PAGE_ACCESS_TOKEN ? `✅ Found (${FB_PAGE_ACCESS_TOKEN.substring(0, 20)}...)` : '❌ Missing');
    console.log('');

    if (!FB_PAGE_ID || !FB_PAGE_ACCESS_TOKEN) {
        console.error('❌ Missing Facebook credentials in .env.local');
        return;
    }

    try {
        const url = `https://graph.facebook.com/${FB_PAGE_ID}/feed`;
        const params = {
            message: '🧪 Test post from diagnostic script - ' + new Date().toISOString(),
            access_token: FB_PAGE_ACCESS_TOKEN
        };

        console.log('📤 Attempting to post to Facebook...');
        console.log('URL:', url);
        console.log('');

        const response = await axios.post(url, null, { params });

        if (response.data.id || response.data.post_id) {
            console.log('✅ SUCCESS! Post ID:', response.data.id || response.data.post_id);
            console.log('View at: https://facebook.com/' + (response.data.id || response.data.post_id));
        } else {
            console.log('⚠️ Unexpected response:', response.data);
        }
    } catch (error: any) {
        const errorData = error.response?.data?.error;

        console.log('❌ FACEBOOK ERROR DETAILS:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('Message:', errorData?.message || error.message);
        console.log('Type:', errorData?.type);
        console.log('Code:', errorData?.code);
        console.log('Subcode:', errorData?.error_subcode);
        console.log('Trace ID:', errorData?.fbtrace_id);
        console.log('HTTP Status:', error.response?.status);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('');
        console.log('Full Error Object:', JSON.stringify(errorData, null, 2));
        console.log('');

        // Provide helpful guidance
        console.log('💡 COMMON SOLUTIONS:');
        if (errorData?.message?.includes('OAuthException') || errorData?.message?.includes('access token')) {
            console.log('- Your access token may have expired');
            console.log('- Regenerate at: https://developers.facebook.com/tools/explorer/');
            console.log('- Required permissions: pages_manage_posts, pages_read_engagement');
        } else if (errorData?.message?.includes('Unsupported get request') || errorData?.message?.includes('global id')) {
            console.log('- Check that FB_PAGE_ID is the numeric Page ID, not username');
            console.log('- Find it in: Page Settings → About → Page ID');
        } else if (errorData?.code === 190) {
            console.log('- Error code 190 = Invalid token');
            console.log('- Generate a new long-lived token');
        }
    }
}

testFacebookPost();
