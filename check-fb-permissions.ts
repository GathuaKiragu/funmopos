/**
 * Check what permissions the Facebook token has
 * Run: npx tsx --env-file=.env.local check-fb-permissions.ts
 */

import 'dotenv/config';
import axios from 'axios';

const FB_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;

async function checkPermissions() {
    console.log('🔍 Checking Facebook Token Permissions...\n');

    if (!FB_PAGE_ACCESS_TOKEN) {
        console.error('❌ FB_PAGE_ACCESS_TOKEN not found in .env.local');
        return;
    }

    try {
        // Debug the token
        const debugUrl = `https://graph.facebook.com/debug_token`;
        const debugResponse = await axios.get(debugUrl, {
            params: {
                input_token: FB_PAGE_ACCESS_TOKEN,
                access_token: FB_PAGE_ACCESS_TOKEN
            }
        });

        const tokenData = debugResponse.data.data;

        console.log('📋 TOKEN INFORMATION:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('Type:', tokenData.type);
        console.log('App ID:', tokenData.app_id);
        console.log('User ID:', tokenData.user_id);
        console.log('Valid:', tokenData.is_valid ? '✅ Yes' : '❌ No');
        console.log('Expires:', tokenData.expires_at ? new Date(tokenData.expires_at * 1000).toLocaleString() : '✅ Never');
        console.log('');

        console.log('🔐 GRANTED PERMISSIONS:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        if (tokenData.scopes && tokenData.scopes.length > 0) {
            tokenData.scopes.forEach((scope: string) => {
                const isRequired = ['pages_manage_posts', 'pages_read_engagement', 'pages_show_list'].includes(scope);
                console.log(isRequired ? `✅ ${scope}` : `   ${scope}`);
            });
        } else {
            console.log('❌ No permissions found!');
        }
        console.log('');

        console.log('📊 REQUIRED PERMISSIONS CHECK:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        const required = ['pages_manage_posts', 'pages_read_engagement', 'pages_show_list'];
        const granted = tokenData.scopes || [];

        required.forEach(perm => {
            const has = granted.includes(perm);
            console.log(`${has ? '✅' : '❌'} ${perm}`);
        });
        console.log('');

        const allGranted = required.every(perm => granted.includes(perm));

        if (!allGranted) {
            console.log('⚠️  MISSING REQUIRED PERMISSIONS!');
            console.log('');
            console.log('HOW TO FIX:');
            console.log('1. Go to: https://developers.facebook.com/tools/explorer/');
            console.log('2. Select your app');
            console.log('3. Click "Get Token" → "Get Page Access Token"');
            console.log('4. Select your page');
            console.log('5. Make sure these permissions are checked:');
            required.forEach(perm => {
                if (!granted.includes(perm)) {
                    console.log(`   - ${perm}`);
                }
            });
            console.log('6. Generate token and update .env.local');
        } else {
            console.log('✅ All required permissions are granted!');
            console.log('');
            console.log('⚠️  But posting still failed. This might mean:');
            console.log('1. This is a USER token, not a PAGE token');
            console.log('2. The Page ID is incorrect');
            console.log('3. You need to select the page in Graph Explorer');
        }

    } catch (error: any) {
        console.error('❌ Error checking token:', error.response?.data || error.message);
    }
}

checkPermissions();
