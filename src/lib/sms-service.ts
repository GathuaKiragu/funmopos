import axios from 'axios';

// SasaSignal API Configuration
const SASASIGNAL_API_URL = 'https://api.sasasignal.com/v1/sms';
const SASASIGNAL_API_KEY = process.env.SASASIGNAL_API_KEY || '';
const SASASIGNAL_SENDER_ID = process.env.SASASIGNAL_SENDER_ID || 'FUNMO';

// Cost per SMS in KES (approximate)
const SMS_COST_PER_UNIT = 0.80;

interface SMSResponse {
    success: boolean;
    messageId?: string;
    error?: string;
}

interface BulkSMSResult {
    totalSent: number;
    totalFailed: number;
    successfulNumbers: string[];
    failedNumbers: string[];
    estimatedCost: number;
    errors: string[];
}

/**
 * Format phone number to international format (+254...)
 */
export function formatPhoneNumber(phone: string): string {
    let formatted = phone.replace(/\s+/g, '');

    if (formatted.startsWith('0')) {
        formatted = '+254' + formatted.substring(1);
    } else if (formatted.startsWith('254')) {
        formatted = '+' + formatted;
    } else if (formatted.length === 9 && /^[0-9]+$/.test(formatted)) {
        formatted = '+254' + formatted;
    } else if (!formatted.startsWith('+')) {
        formatted = '+254' + formatted;
    }

    return formatted;
}

/**
 * Calculate number of SMS units based on message length
 * Standard SMS: 160 chars = 1 unit
 * Unicode SMS (with special chars): 70 chars = 1 unit
 */
export function calculateSMSUnits(message: string): number {
    const hasUnicode = /[^\x00-\x7F]/.test(message);
    const maxLength = hasUnicode ? 70 : 160;
    return Math.ceil(message.length / maxLength);
}

/**
 * Estimate cost for sending SMS to multiple recipients
 */
export function estimateCost(recipientCount: number, message: string): number {
    const units = calculateSMSUnits(message);
    return recipientCount * units * SMS_COST_PER_UNIT;
}

/**
 * Send SMS to a single recipient using SasaSignal API
 */
export async function sendSingleSMS(
    phoneNumber: string,
    message: string
): Promise<SMSResponse> {
    try {
        if (!SASASIGNAL_API_KEY) {
            throw new Error('SasaSignal API key not configured');
        }

        const formattedPhone = formatPhoneNumber(phoneNumber);

        const response = await axios.post(
            SASASIGNAL_API_URL,
            {
                to: formattedPhone,
                message: message,
                sender_id: SASASIGNAL_SENDER_ID,
            },
            {
                headers: {
                    'Authorization': `Bearer ${SASASIGNAL_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                timeout: 10000, // 10 second timeout
            }
        );

        if (response.data.status === 'success' || response.data.success) {
            return {
                success: true,
                messageId: response.data.message_id || response.data.id,
            };
        } else {
            return {
                success: false,
                error: response.data.message || 'Unknown error',
            };
        }
    } catch (error: any) {
        console.error('SMS Send Error:', error.message);
        return {
            success: false,
            error: error.response?.data?.message || error.message || 'Failed to send SMS',
        };
    }
}

/**
 * Send SMS to multiple recipients in batches
 * @param phoneNumbers Array of phone numbers
 * @param message SMS message content
 * @param batchSize Number of SMS to send per batch (default: 50)
 */
export async function sendBulkSMS(
    phoneNumbers: string[],
    message: string,
    batchSize: number = 50
): Promise<BulkSMSResult> {
    const result: BulkSMSResult = {
        totalSent: 0,
        totalFailed: 0,
        successfulNumbers: [],
        failedNumbers: [],
        estimatedCost: estimateCost(phoneNumbers.length, message),
        errors: [],
    };

    // Process in batches to avoid overwhelming the API
    for (let i = 0; i < phoneNumbers.length; i += batchSize) {
        const batch = phoneNumbers.slice(i, i + batchSize);

        // Send all SMS in current batch concurrently
        const batchPromises = batch.map(async (phone) => {
            const response = await sendSingleSMS(phone, message);

            if (response.success) {
                result.totalSent++;
                result.successfulNumbers.push(phone);
            } else {
                result.totalFailed++;
                result.failedNumbers.push(phone);
                result.errors.push(`${phone}: ${response.error}`);
            }
        });

        // Wait for current batch to complete before moving to next
        await Promise.all(batchPromises);

        // Small delay between batches to respect rate limits
        if (i + batchSize < phoneNumbers.length) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
        }
    }

    return result;
}

/**
 * Validate message content
 */
export function validateMessage(message: string): { valid: boolean; error?: string } {
    if (!message || message.trim().length === 0) {
        return { valid: false, error: 'Message cannot be empty' };
    }

    if (message.length > 1000) {
        return { valid: false, error: 'Message too long (max 1000 characters)' };
    }

    return { valid: true };
}
