import express from 'express';
import axios from 'axios';
import User from '../models/User.js';

const router = express.Router();

// POST /api/whatsapp/embedded-callback
router.post('/embedded-callback', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, message: 'Authorization code is missing.' });
    }

    const APP_ID = process.env.META_APP_ID || '2849467472091250';
    const APP_SECRET = process.env.META_APP_SECRET;

    if (!APP_SECRET) {
      return res.status(500).json({
        success: false,
        message: 'META_APP_SECRET is missing from the server configuration.',
      });
    }

    // Exchange the temporary authorization code for a permanent access token.
    const tokenResponse = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
      params: {
        client_id: APP_ID,
        client_secret: APP_SECRET,
        code: code,
      },
    });

    const clientAccessToken = tokenResponse.data.access_token;

    // Retrieve the client's WABA ID from the debug_token API.
    const debugResponse = await axios.get('https://graph.facebook.com/v19.0/debug_token', {
      params: {
        input_token: clientAccessToken,
        access_token: `${APP_ID}|${APP_SECRET}`,
      },
    });

    const granularScopes = debugResponse.data.data?.granular_scopes || [];
    const wabaScope = granularScopes.find((s) => s.scope === 'whatsapp_business_management');
    const wabaId = wabaScope?.target_ids?.[0];

    if (!wabaId) {
      return res.status(400).json({
        success: false,
        message: 'Unable to detect the WABA ID. Complete the WhatsApp Business setup and try again.',
      });
    }

    // Retrieve the client's phone number ID and display number.
    const phoneRes = await axios.get(`https://graph.facebook.com/v19.0/${wabaId}/phone_numbers`, {
      headers: { Authorization: `Bearer ${clientAccessToken}` },
    });

    const phoneData = phoneRes.data?.data?.[0];
    const phoneNumberId = phoneData?.id;
    const displayPhoneNumber = phoneData?.display_phone_number;

    // Subscribe the client's WABA to this webhook to receive incoming messages.
    await axios.post(
      `https://graph.facebook.com/v19.0/${wabaId}/subscribed_apps`,
      {},
      { headers: { Authorization: `Bearer ${clientAccessToken}` } }
    );

    // Save these IDs to the authenticated user's account when available.
    if (req.user?.id) {
      await User.findByIdAndUpdate(req.user.id, {
        wabaId,
        phoneNumberId,
        whatsappAccessToken: clientAccessToken,
        businessPhoneNumber: displayPhoneNumber,
        isWhatsAppConnected: true,
      });
    }

    console.log(`Successfully connected WABA: ${wabaId}, Phone ID: ${phoneNumberId}`);

    return res.status(200).json({
      success: true,
      message: 'WhatsApp Business account connected successfully.',
      data: {
        wabaId,
        phoneNumberId,
        displayPhoneNumber,
      },
    });
  } catch (err) {
    console.error('Embedded callback error:', err.response?.data || err.message);
    const metaError = err.response?.data?.error?.message || err.message;
    return res.status(500).json({
      success: false,
      message: `Meta Connection Error: ${metaError}`,
    });
  }
});

export default router;