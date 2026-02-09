/**
 * Verify the Page ID is correct and accessible
 * Run: npx tsx --env-file=.env.local verify-page-id.ts
 */

import 'dotenv/config';
import axios from 'axios';

const FB_PAGE_ID = process.env.FB_PAGE_ID;
const FB_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;

async function verifyPageId() {
    console.log('🔍 Verifying Facebook Page ID...\n');

    if (!FB_PAGE_ID || !FB_PAGE_ACCESS_TOKEN) {
        console.error('❌ Missing credentials');
        return;
    }

    console.log('Page ID:', FB_PAGE_ID);
    console.log('');

    try {
        // Try to get page info
        const url = `https://graph.facebook.com/${FB_PAGE_ID}`;
        const response = await axios.get(url, {
            params: {
                fields: 'id,name,username,category,fan_count,access_token',
                access_token: FB_PAGE_ACCESS_TOKEN
            }
        });

        console.log('✅ PAGE FOUND!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('ID:', response.data.id);
        console.log('Name:', response.data.name);
        console.log('Username:', response.data.username || 'N/A');
        console.log('Category:', response.data.category);
        console.log('Followers:', response.data.fan_count || 'N/A');
        console.log('');

        // Check if we can access the feed
        console.log('🔍 Checking feed access...');
        const feedUrl = `https://graph.facebook.com/${FB_PAGE_ID}/feed`;
        const feedResponse = await axios.get(feedUrl, {
            params: {
                limit: 1,
                access_token: FB_PAGE_ACCESS_TOKEN
            }
        });

        console.log('✅ Can read feed!');
        console.log('Recent posts:', feedResponse.data.data?.length || 0);
        console.log('');

        // Now try to post
        console.log('🔍 Testing post permission...');
        const postUrl = `https://graph.facebook.com/${FB_PAGE_ID}/feed`;
        const postResponse = await axios.post(postUrl, null, {
            params: {
                message: '🧪 Test post from API - ' + new Date().toISOString(),
                access_token: FB_PAGE_ACCESS_TOKEN
            }
        });

        console.log('✅ POST SUCCESSFUL!');
        console.log('Post ID:', postResponse.data.id);
        console.log('View at: https://facebook.com/' + postResponse.data.id);

    } catch (error: any) {
        const errorData = error.response?.data?.error;
        console.log('❌ ERROR:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('Message:', errorData?.message || error.message);
        console.log('Type:', errorData?.type);
        console.log('Code:', errorData?.code);
        console.log('Subcode:', errorData?.error_subcode);
        console.log('');

        if (errorData?.code === 100 && errorData?.error_subcode === 33) {
            console.log('💡 This error means:');
            console.log('- The Page ID might be wrong');
            console.log('- OR the token doesn\'t have permission to access this page');
            console.log('- OR this is a User token pretending to be a Page token');
            console.log('');
            console.log('Try this:');
            console.log('1. Go to your Facebook Page');
            console.log('2. Click "About" → Find the Page ID');
            console.log('3. Make sure it matches:', FB_PAGE_ID);
            console.log('4. In Graph Explorer, make sure you selected THIS page from the dropdown');
        }
    }
}

verifyPageId();
