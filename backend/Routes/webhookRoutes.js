import express from 'express';
import { messageQueue } from '../config/queue.js';

const router = express.Router();

router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('Webhook successfully verified by Meta!');
      return res.status(200).send(challenge);
    } else {
      return res.sendStatus(403);
    }
  }

  res.sendStatus(400);
});

router.post('/', async (req, res) => {
  const body = req.body;

  if (body.object === 'whatsapp_business_account') {
    try {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0]?.value;

      if (changes?.messages && changes.messages.length > 0) {
        const messageData = changes.messages[0];
        const contactData = changes.contacts?.[0];

        const msgType = messageData.type;
        let msgText = '';
        let mediaId = '';
        let caption = '';
        let fileName = '';

        if (msgType === 'text') {
          msgText = messageData.text?.body || '';
        } else if (msgType === 'image') {
          mediaId = messageData.image?.id;
          caption = messageData.image?.caption || '';
        } else if (msgType === 'audio') {
          mediaId = messageData.audio?.id;
        } else if (msgType === 'video') {
          mediaId = messageData.video?.id;
          caption = messageData.video?.caption || '';
        } else if (msgType === 'document') {
          mediaId = messageData.document?.id;
          caption = messageData.document?.caption || '';
          fileName = messageData.document?.filename || 'document.pdf';
        }

        await messageQueue.add('process-message', {
          type: 'INCOMING_MESSAGE',
          data: {
            senderPhone: messageData.from,
            senderName: contactData?.profile?.name || '',
            messageId: messageData.id,
            messageText: msgText,
            messageType: msgType,
            mediaId,
            caption,
            fileName,
            myPhoneNumber: changes.metadata?.display_phone_number,
          },
        });

        console.log('Pushed message to queue from ' + messageData.from);
      }

      if (changes?.statuses && changes.statuses.length > 0) {
        const statusData = changes.statuses[0];

        // Capture the error details provided by Meta when message delivery fails.
        let errorReason = '';
        if (statusData.errors && statusData.errors.length > 0) {
          const err = statusData.errors[0];
          errorReason = err.error_data?.details || err.title || err.message || ('Meta Error ' + err.code);
        }

        await messageQueue.add('process-status', {
          type: 'STATUS_UPDATE',
          data: {
            statusMessageId: statusData.id,
            newStatus: statusData.status,
            errorMessage: errorReason,
          },
        });
      }

      // Acknowledge the webhook only after the event has been queued.
      return res.status(200).send('EVENT_RECEIVED');
    } catch (error) {
      console.error('Error adding to message queue:', error);
      // Return an error so Meta retries if the queue is unavailable.
      return res.status(500).send('QUEUE_FAILED_RETRY');
    }
  } else {
    res.sendStatus(404);
  }
});

export default router;