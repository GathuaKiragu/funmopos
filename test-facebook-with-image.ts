/**
 * Test Facebook posting with image
 * Run: npx tsx --env-file=.env.local test-facebook-with-image.ts
 */

import 'dotenv/config';
import axios from 'axios';

const FB_PAGE_ID = process.env.FB_PAGE_ID;
const FB_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;

async function testFacebookWithImage() {
    console.log('🔍 Testing Facebook Post with Image...\n');

    if (!FB_PAGE_ID || !FB_PAGE_ACCESS_TOKEN) {
        console.error('❌ Missing credentials');
        return;
    }

    try {
        // Use a sample image URL (you can replace with your actual image)
        const imageUrl = 'https://odds.funmo.africa/og-picks.png'; // Your OG image
        const message = `🔥 Today's Top Betting Picks are Live! 🔥

⚽ Check out our AI-powered predictions
💰 High-confidence picks ready
📊 Detailed analysis available

Visit: https://odds.funmo.africa

#BettingTips #Football #FunmoTips`;

        console.log('📤 Posting to Facebook with image...');
        console.log('Image URL:', imageUrl);
        console.log('');

        const url = `https://graph.facebook.com/${FB_PAGE_ID}/photos`;
        const response = await axios.post(url, null, {
            params: {
                url: imageUrl,
                caption: message,
                access_token: FB_PAGE_ACCESS_TOKEN
            }
        });

        if (response.data.id || response.data.post_id) {
            console.log('✅ SUCCESS! Posted with image!');
            console.log('Post ID:', response.data.id || response.data.post_id);
            console.log('View at: https://facebook.com/' + (response.data.id || response.data.post_id));
        }

    } catch (error: any) {
        const errorData = error.response?.data?.error;
        console.log('❌ ERROR:');
        console.log('Message:', errorData?.message || error.message);
        console.log('Type:', errorData?.type);
        console.log('Code:', errorData?.code);
        console.log('');
        console.log('Full error:', JSON.stringify(errorData, null, 2));
    }
}

testFacebookWithImage();
