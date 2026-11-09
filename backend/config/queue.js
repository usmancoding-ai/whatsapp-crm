import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import axios from 'axios';
import Contact from '../models/Contact.js';
import Message from '../models/Message.js';
import { downloadMetaMedia } from '../utils/mediaHandler.js';
import User from '../models/User.js';
const redisConnection = new IORedis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: null,
});

export const messageQueue = new Queue('whatsapp-messages', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
    removeOnFail: 1000,
  },
});

export const initMessageWorker = (io) => {
  const worker = new Worker(
    'whatsapp-messages',
    async (job) => {
      const { type, data } = job.data;

      if (type === 'INCOMING_MESSAGE') {
        const {
          senderPhone,
          senderName,
          messageId,
          messageText,
          messageType,
          mediaId,
          caption,
          fileName,
          myPhoneNumber
        } = data;

        const cleanSender = String(senderPhone).replace(/\D/g, '').trim();
        const cleanMyNumber = String(myPhoneNumber || '').replace(/\D/g, '').trim();

        let targetUserId = null;

        if (cleanMyNumber) {
          const allClients = await User.find({ role: { $ne: 'admin' } });
          const ownerUser = allClients.find((u) => {
            const cleanUserPhone = String(u.businessPhoneNumber || '').replace(/\D/g, '');
            const cleanUserPhoneId = String(u.phoneNumberId || '').replace(/\D/g, '');
            return cleanUserPhone === cleanMyNumber || cleanUserPhoneId === cleanMyNumber;
          });

          if (ownerUser) {
            targetUserId = ownerUser._id;
          }
        }

        const existingContact = await Contact.findOne({
          phoneNumber: { $in: [cleanSender, `+${cleanSender}`] },
          userId: targetUserId
        });

        if (existingContact && existingContact.isBlocked) {
          console.log(`Ignored message from blocked contact ${cleanSender}.`);
          return;
        }

        let localMediaUrl = '';
        if (mediaId && ['image', 'audio', 'video', 'document'].includes(messageType)) {
          localMediaUrl = await downloadMetaMedia(mediaId);
        }

        let lastMsgPreview = messageText;
        if (!lastMsgPreview) {
          if (messageType === 'image') lastMsgPreview = '📷 Photo';
          else if (messageType === 'audio') lastMsgPreview = '🎤 Voice Note';
          else if (messageType === 'document') lastMsgPreview = '📄 Document';
          else if (messageType === 'video') lastMsgPreview = '🎥 Video';
          else lastMsgPreview = 'Media';
        }

        const updatedContact = await Contact.findOneAndUpdate(
          {
            phoneNumber: { $in: [cleanSender, `+${cleanSender}`] },
            userId: targetUserId
          },
          {
            $set: {
              phoneNumber: cleanSender,
              userId: targetUserId,
              lastMessage: lastMsgPreview,
              lastInteractionAt: new Date(),
            },
            $inc: { unreadCount: 1 },
            $setOnInsert: {
              clientName: senderName || `+${cleanSender}`,
              tag: 'General',
              isPinned: false,
            }
          },
          { upsert: true, returnDocument: 'after' }
        );

        const savedMessage = await Message.create({
          userId: targetUserId,
          whatsappMessageId: messageId,
          senderNumber: cleanSender,
          receiverNumber: myPhoneNumber,
          text: messageText || '',
          caption: caption || '',
          mediaUrl: (localMediaUrl?.mediaUrl || localMediaUrl) || '',
          mimeType: localMediaUrl?.mimeType || '',
          fileName: fileName || '',
          messageType: messageType || 'text',
          direction: 'inbound',
          status: 'delivered',
        });

        if (io) {
          io.emit('new_message', savedMessage);
          io.emit('contact_updated');
        }

        console.log(`Incoming ${messageType} from ${senderPhone} processed successfully.`);
      }

      if (type === 'STATUS_UPDATE') {
        const { statusMessageId, newStatus, errorMessage } = data;

        const updateFields = { status: newStatus };
        if (errorMessage) {
          updateFields.errorMessage = errorMessage;
        }

        const updatedMessage = await Message.findOneAndUpdate(
          { whatsappMessageId: statusMessageId },
          { $set: updateFields },
          { returnDocument: 'after' }
        );

        if (io && updatedMessage) {
          io.emit('message_status_updated', {
            messageId: statusMessageId,
            status: newStatus,
            errorMessage: updatedMessage.errorMessage || '',
          });
        }
      }

      if (type === 'SEND_TEMPLATE') {
        const { recipientPhone, clientName, templateName, languageCode, phoneNumberId, accessToken } = data;

        try {
          const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;
          const trimmedTemplate = (templateName || '').trim();
          const cleanPhone = String(recipientPhone).replace(/\D/g, '').trim();

          const templateObject = {
            name: trimmedTemplate,
            language: { code: languageCode || 'en' },
          };

          const imageTemplates = ['visit_website', 'freight_status', 'dispatch_templete', 'dispatch_update'];

          if (imageTemplates.includes(trimmedTemplate.toLowerCase())) {
            templateObject.components = [
              {
                type: 'header',
                parameters: [
                  {
                    type: 'image',
                    image: {
                      link: 'https://res.cloudinary.com/dmiacxpbp/image/upload/v1792091793/images_2_d0nguc.jpg',
                    },
                  },
                ],
              },
            ];
          }

          const metaPayload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: cleanPhone,
            type: 'template',
            template: templateObject,
          };

          const response = await axios.post(url, metaPayload, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          });

          const whatsappMessageId = response.data?.messages?.[0]?.id;

          let templateBody = `[Template: ${trimmedTemplate}]`;
          let templateImageUrl = '';

          if (trimmedTemplate === 'freight_status' || trimmedTemplate === 'visit_website') {
            templateImageUrl = 'https://res.cloudinary.com/dmiacxpbp/image/upload/v1792091793/images_2_d0nguc.jpg';
            templateBody = `🚛 Freight Dispatch Notice – Carrier Operations\n\nHello, this is an operational dispatch update from IT GeniusX regarding active freight schedules across the United States.\n\nPlease reply with your truck type to connect with dispatch.`;
          }

          const savedMessage = await Message.create({
            userId: data.userId || null,
            whatsappMessageId: whatsappMessageId || `local-${Date.now()}`,
            senderNumber: process.env.MY_BUSINESS_NUMBER || 'ME',
            receiverNumber: cleanPhone,
            text: templateBody,
            caption: templateBody,
            mediaUrl: templateImageUrl,
            messageType: 'template',
            direction: 'outbound',
            status: 'sent',
          });

          await Contact.findOneAndUpdate(
            { phoneNumber: { $in: [cleanPhone, `+${cleanPhone}`] } },
            {
              lastMessage: `[Template: ${trimmedTemplate}]`,
              lastInteractionAt: new Date(),
              lastTemplateSentAt: new Date(),
            },
            { returnDocument: 'after' }
          );

          if (io) {
            io.emit('new_message', savedMessage);
          }

          console.log(`Template [${trimmedTemplate}] sent successfully to ${cleanPhone}.`);
        } catch (err) {
          console.error(`Unable to send template to ${recipientPhone}:`, err.response?.data || err.message);
        }
      }
    },
    { connection: redisConnection }
  );

  worker.on('failed', (job, err) => {
    console.error(`Queue job ${job.id} failed:`, err.message);
  });

  return worker;
};