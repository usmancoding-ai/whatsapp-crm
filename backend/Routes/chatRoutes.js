import express from 'express';
import axios from 'axios';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import Contact from '../models/Contact.js';
import Message from '../models/Message.js';
import { messageQueue } from '../config/queue.js';
import { uploadLocalFileToCloudinary } from '../utils/mediaHandler.js';
import { convertToWhatsAppVoiceNote } from '../utils/audioConverter.js';
import User from '../models/User.js';
import xlsx from 'xlsx';
const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({ storage });

router.get('/contacts', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;
    const skip = (page - 1) * limit;
    const { userId, role, search } = req.query; // 👈 search shamil kiya

    let filter = {};

    if (role === 'admin') {
      filter = { $or: [{ userId: userId }, { userId: null }, { userId: { $exists: false } }] };
    } else if (userId) {
      const clientUser = await User.findById(userId);
      if (!clientUser || clientUser.isBlocked) {
        return res.status(403).json({ success: false, message: 'Account blocked!' });
      }
      filter = { userId: userId };
    } else {
      return res.status(200).json({ success: true, data: [], hasMore: false, total: 0 });
    }

    if (search && search.trim()) {
      const escapedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escapedSearch, 'i');

      const cleanDigits = search.replace(/\D/g, '').trim();

      const searchConditions = [
        { clientName: searchRegex },
        { phoneNumber: searchRegex },
      ];

      if (cleanDigits) {
        searchConditions.push({ phoneNumber: new RegExp(cleanDigits, 'i') });
      }

      filter = {
        $and: [
          filter,
          {
            $or: searchConditions,
          },
        ],
      };
    }
    const contacts = await Contact.find(filter)
      .sort({ isPinned: -1, lastInteractionAt: -1, updatedAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Contact.countDocuments(filter);
    const hasMore = skip + contacts.length < total;

    res.status(200).json({
      success: true,
      data: contacts,
      hasMore,
      total,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
router.get('/messages/:phoneNumber', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const { userId, role } = req.query;

    const cleanPhone = String(phoneNumber).replace(/\D/g, '').trim();

const userFilter =
      role === 'admin'
        ? { $or: [{ userId: null }, { userId: { $exists: false } }] }
        : { userId: userId };

    const query = {
      $and: [
        userFilter,
        {
          $or: [
            { senderNumber: { $in: [cleanPhone, `+${cleanPhone}`] } },
            { receiverNumber: { $in: [cleanPhone, `+${cleanPhone}`] } },
          ],
        },
      ],
    };

    const messages = await Message.find(query)
      .populate('replyToMessage', 'text caption messageType senderNumber whatsappMessageId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      data: messages.reverse(),
      page,
      hasMore: messages.length === limit,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/send', async (req, res) => {
  try {
    const { recipientPhone, text, replyToMessageId, replyToWamid, userId, role } = req.body;

    if (!recipientPhone || !text) {
      return res.status(400).json({ success: false, message: 'Phone number and message text are required.' });
    }

    let PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
    let ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
    let mySenderNumber = process.env.MY_BUSINESS_NUMBER || 'ME';

    if (role !== 'admin' && userId) {
      const clientUser = await User.findById(userId);
      if (clientUser && clientUser.phoneNumberId && clientUser.whatsappAccessToken) {
        PHONE_NUMBER_ID = clientUser.phoneNumberId;
        ACCESS_TOKEN = clientUser.whatsappAccessToken;
        if (clientUser.businessPhoneNumber) mySenderNumber = clientUser.businessPhoneNumber;
      }
    }

    const url = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;

    const cleanPhone = String(recipientPhone).replace(/\D/g, '').trim();

    const metaPayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanPhone,
      type: 'text',
      text: { body: text },
      ...(replyToWamid ? { context: { message_id: replyToWamid } } : {}),
    };

    const response = await axios.post(url, metaPayload, {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    const whatsappMessageId = response.data.messages[0].id;
    const targetUserId = role === 'admin' ? null : (userId || null);

    let savedMessage = await Message.create({
      userId: targetUserId,
      whatsappMessageId,
      senderNumber: mySenderNumber,
      receiverNumber: cleanPhone,
      text,
      replyToMessage: replyToMessageId || null,
      messageType: 'text',
      direction: 'outbound',
      status: 'sent',
    });

    if (replyToMessageId) {
      savedMessage = await savedMessage.populate(
        'replyToMessage',
        'text caption messageType senderNumber whatsappMessageId'
      );
    }

    await Contact.findOneAndUpdate(
      { phoneNumber: { $in: [cleanPhone, `+${cleanPhone}`] }, userId: targetUserId },
      { lastMessage: text, lastInteractionAt: new Date() },
      { returnDocument: 'after' }
    );

    const io = req.app.get('io');
    if (io) io.emit('new_message', savedMessage);

    res.status(200).json({ success: true, data: savedMessage });
  } catch (error) {
    console.error('Send text error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Message send failed',
      error: error.response?.data || error.message,
    });
  }
});




router.post('/send-media', upload.single('file'), async (req, res) => {
  try {
    const { recipientPhone, caption, replyToMessageId, replyToWamid, userId, role } = req.body;
    const file = req.file;

    if (!recipientPhone || !file) {
      return res.status(400).json({ success: false, message: 'Recipient phone number and file are required.' });
    }

    let PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
    let ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
    let clientUser = null;

    if (role !== 'admin') {
      clientUser = userId ? await User.findById(userId) : null;
      if (!clientUser || !clientUser.isWhatsAppConnected || !clientUser.phoneNumberId || !clientUser.whatsappAccessToken) {
        return res.status(400).json({ success: false, message: 'Connect your WhatsApp account before sending media.' });
      }
      PHONE_NUMBER_ID = clientUser.phoneNumberId;
      ACCESS_TOKEN = clientUser.whatsappAccessToken;
    }

    let metaType = 'document';
    let mimeTypeForMeta = file.mimetype;
    let filePathToUpload = file.path;

    if (file.mimetype.startsWith('image/')) {
      metaType = 'image';
    } else if (file.mimetype.startsWith('video/')) {
      metaType = 'video';
    } else if (file.mimetype.startsWith('audio/') || file.originalname.includes('voice_')) {
      metaType = 'audio';
      mimeTypeForMeta = 'audio/ogg; codecs=opus';
      filePathToUpload = await convertToWhatsAppVoiceNote(file.path);
    }

    const FormData = (await import('form-data')).default;
    const formData = new FormData();
    formData.append('messaging_product', 'whatsapp');
    formData.append('file', fs.createReadStream(filePathToUpload), {
      filename: metaType === 'audio' ? 'voice_note.ogg' : file.originalname,
      contentType: mimeTypeForMeta,
    });
    formData.append('type', mimeTypeForMeta);

    const uploadRes = await axios.post(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/media`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          ...formData.getHeaders(),
        },
      }
    );

    const mediaId = uploadRes.data.id;
    const cloudinaryUrl = await uploadLocalFileToCloudinary(filePathToUpload);

    const mediaObject = { id: mediaId };
    if (caption && metaType !== 'audio') mediaObject.caption = caption;
    if (metaType === 'document') mediaObject.filename = file.originalname;

    const metaPayload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientPhone,
      type: metaType,
      ...(replyToWamid ? { context: { message_id: replyToWamid } } : {}),
      [metaType]: mediaObject,
    };

    const sendRes = await axios.post(
      `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`,
      metaPayload,
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const whatsappMessageId = sendRes.data.messages[0].id;
    const dbMessageType = file.mimetype.startsWith('audio/') || file.originalname.includes('voice_')
      ? 'audio'
      : metaType;

    const targetUserId = role === 'admin' ? null : (userId || null);
    const mySenderNumber = (role !== 'admin' && clientUser?.businessPhoneNumber) 
      ? clientUser.businessPhoneNumber 
      : (process.env.MY_BUSINESS_NUMBER || 'ME');

    let savedMessage = await Message.create({
      userId: targetUserId,
      whatsappMessageId,
      senderNumber: mySenderNumber,
      receiverNumber: recipientPhone,
      text: caption || '',
      caption: caption || '',
      mediaUrl: cloudinaryUrl,
      fileName: file.originalname,
      mimeType: file.mimetype,
      messageType: dbMessageType,
      replyToMessage: replyToMessageId || null,
      direction: 'outbound',
      status: 'sent',
    });

    if (replyToMessageId) {
      savedMessage = await savedMessage.populate(
        'replyToMessage',
        'text caption messageType senderNumber whatsappMessageId'
      );
    }

    let previewText = '📄 Document';
    if (metaType === 'image') previewText = '📷 Photo';
    if (metaType === 'audio') previewText = '🎤 Voice Note';

    await Contact.findOneAndUpdate(
      { phoneNumber: recipientPhone, userId: targetUserId },
      { lastMessage: previewText },
      { returnDocument: 'after' }
    );

    const io = req.app.get('io');
    if (io) io.emit('new_message', savedMessage);

    res.status(200).json({ success: true, data: savedMessage });
  } catch (error) {
    console.error('Send media error full:', error.response?.data || error);
    res.status(500).json({
      success: false,
      message: 'Media send failed',
      error: error.response?.data || error.message,
    });
  }
});
router.patch('/messages/:messageId/pin', async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    message.isPinned = !message.isPinned;
    await message.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('message_pin_updated', {
        messageId: message._id,
        isPinned: message.isPinned,
      });
    }

    res.status(200).json({ success: true, data: message });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/contacts/:contactId/pin', async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.contactId);
    if (!contact) return res.status(404).json({ success: false, message: 'Contact not found' });
    contact.isPinned = !contact.isPinned;
    await contact.save();

    const io = req.app.get('io');
    if (io) io.emit('contact_updated', contact);

    res.status(200).json({ success: true, data: contact });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/contacts/:phoneNumber/read', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const { userId, role } = req.body;
    const cleanPhone = String(phoneNumber).replace(/\D/g, '').trim();

    const targetUserId = role === 'admin' ? null : (userId || null);

    // Reset the unread count only for this user's contact.
    await Contact.findOneAndUpdate(
      {
        phoneNumber: { $in: [cleanPhone, `+${cleanPhone}`] },
        userId: targetUserId
      },
      { $set: { unreadCount: 0 } }
    );

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
router.patch('/contacts/:contactId/tag', async (req, res) => {
  try {
    const { tag } = req.body;
    const contact = await Contact.findByIdAndUpdate(
      req.params.contactId,
      { tag: tag || 'General' },
      { new: true }
    );
    if (!contact) return res.status(404).json({ success: false, message: 'Contact not found' });

    const io = req.app.get('io');
    if (io) io.emit('contact_updated', contact);

    res.status(200).json({ success: true, data: contact });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/tags/rename', async (req, res) => {
  try {
    const { oldTag, newTag } = req.body;
    if (!oldTag || !newTag) {
      return res.status(400).json({ success: false, message: 'Both the current and new tag are required.' });
    }

    await Contact.updateMany({ tag: oldTag }, { tag: newTag });

    const io = req.app.get('io');
    if (io) io.emit('contact_updated');

    res.status(200).json({ success: true, message: 'Group renamed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/campaign/preview', async (req, res) => {
  try {
    const { targetTag, excludeTag, userId, role } = req.query;
    if (!targetTag) return res.status(400).json({ success: false, message: 'A target tag is required.' });

    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    // Restrict each customer to their own contacts.
    let userFilter = {};
    if (role === 'admin') {
      userFilter = { $or: [{ userId: userId }, { userId: null }, { userId: { $exists: false } }] };
    } else if (userId) {
      userFilter = { userId: userId };
    } else {
      return res.status(200).json({ success: true, count: 0 });
    }

    const tagCondition =
      excludeTag && excludeTag !== 'None'
        ? { tag: { $ne: excludeTag, $eq: targetTag } }
        : { tag: targetTag };

    const query = {
      $and: [
        userFilter,
        tagCondition,
        // Exclude contacts that have already received a campaign template.
        {
          $or: [
            { lastTemplateSentAt: { $exists: false } },
            { lastTemplateSentAt: null }
          ],
        },
        // Include only contacts with no previous conversation or individual message.
        {
          $or: [
            { lastMessage: { $exists: false } },
            { lastMessage: null },
            { lastMessage: '' }
          ],
        },
      ],
    };

    const count = await Contact.countDocuments(query);
    res.status(200).json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 11. POST /api/chat/campaign (WABA ID Strict Verification)
router.post('/campaign', async (req, res) => {
  try {
    const { targetTag, excludeTag, limit = 50, templateName, languageCode = 'en', userId, role } = req.body;

    if (!targetTag || !templateName) {
      return res.status(400).json({ success: false, message: 'A target tag and template name are required.' });
    }

    let WABA_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
    let PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
    let ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

    // Enforce the customer's WhatsApp connection and daily plan limit.
    let clientUser = null;
    if (role !== 'admin') {
      clientUser = userId ? await User.findById(userId) : null;
      if (
        !clientUser ||
        !clientUser.isWhatsAppConnected ||
        !clientUser.wabaId ||
        !clientUser.phoneNumberId ||
        !clientUser.whatsappAccessToken
      ) {
        return res.status(400).json({
          success: false,
          message: 'Connect your WhatsApp Business account before starting a campaign.',
        });
      }

      // Reset the daily sent-message count when a new day begins.
      const todayStr = new Date().toDateString();
      const lastResetStr = clientUser.lastResetDate ? new Date(clientUser.lastResetDate).toDateString() : '';
      if (todayStr !== lastResetStr) {
        clientUser.sentToday = 0;
        clientUser.lastResetDate = new Date();
      }

      const remainingLimit = (clientUser.planLimit || 250) - (clientUser.sentToday || 0);
      if (remainingLimit <= 0) {
        return res.status(400).json({
          success: false,
          message: `You have reached your daily limit of ${clientUser.planLimit} messages.`,
        });
      }

      WABA_ID = clientUser.wabaId;
      PHONE_NUMBER_ID = clientUser.phoneNumberId;
      ACCESS_TOKEN = clientUser.whatsappAccessToken;
    }

    if (!WABA_ID) {
      return res.status(400).json({
        success: false,
        message: 'WHATSAPP_BUSINESS_ACCOUNT_ID is missing from the server configuration.',
      });
    }

    // Verify the template against the client's WABA.
    try {
      const metaTplCheck = await axios.get(
        `https://graph.facebook.com/v19.0/${WABA_ID}/message_templates`,
        {
          headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
          params: { name: templateName.trim() },
        }
      );

      const found = metaTplCheck.data.data?.find(
        (t) => t.name.toLowerCase() === templateName.trim().toLowerCase()
      );

      if (!found) {
        return res.status(400).json({
          success: false,
          message: `Template "${templateName}" was not found in your Meta account.`,
        });
      }

      if (found.status !== 'APPROVED') {
        return res.status(400).json({
          success: false,
          message: `Template "${templateName}" is currently "${found.status}" in Meta. Messages can only be sent after it is approved.`,
        });
      }
    } catch (metaErr) {
      const errDetail = metaErr.response?.data?.error?.message || metaErr.message;
      return res.status(400).json({
        success: false,
        message: `Meta Verification Error: ${errDetail}`,
      });
    }

    // Apply the three-day cooldown and restrict each user to their own contacts.
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    let userFilter = {};
    if (role === 'admin') {
      userFilter = { $or: [{ userId: userId }, { userId: null }, { userId: { $exists: false } }] };
    } else if (userId) {
      userFilter = { userId: userId };
    } else {
      return res.status(400).json({ success: false, message: 'User ID is missing.' });
    }

    const tagCondition =
      excludeTag && excludeTag !== 'None' && excludeTag !== targetTag
        ? { tag: { $ne: excludeTag, $eq: targetTag } }
        : { tag: targetTag };
    const query = {
      $and: [
        userFilter,
        tagCondition,
        // Exclude contacts that have already received a campaign template.
        {
          $or: [
            { lastTemplateSentAt: { $exists: false } },
            { lastTemplateSentAt: null }
          ],
        },
        // Include only contacts with no previous conversation or individual message.
        {
          $or: [
            { lastMessage: { $exists: false } },
            { lastMessage: null },
            { lastMessage: '' }
          ],
        },
      ],
    };
    const maxAllowed = clientUser
      ? Math.min(parseInt(limit), (clientUser.planLimit || 250) - (clientUser.sentToday || 0))
      : parseInt(limit);

    const eligibleContacts = await Contact.find(query).limit(maxAllowed);

    if (eligibleContacts.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No eligible contacts were found. They may have already received a message within the past three days.',
        queuedCount: 0,
      });
    }

    const now = new Date();

    for (let i = 0; i < eligibleContacts.length; i++) {
      const contact = eligibleContacts[i];

      const cleanPhone = String(contact.phoneNumber).replace(/\D/g, '').trim();

      // Mark the contact before queueing so it is not selected again.
      contact.lastTemplateSentAt = now;
      await contact.save();

      await messageQueue.add(
        'send-broadcast-template',
        {
          type: 'SEND_TEMPLATE',
          data: {
            recipientPhone: cleanPhone,
            clientName: contact.clientName,
            templateName: templateName.trim(),
            languageCode,
            phoneNumberId: PHONE_NUMBER_ID,
            accessToken: ACCESS_TOKEN,
          },
        },
        { delay: i * 5000 }
      );
    }

    if (clientUser) {
      clientUser.sentToday = (clientUser.sentToday || 0) + eligibleContacts.length;
      await clientUser.save();
    }

    res.status(200).json({
      success: true,
      message: `Template "${templateName}" verified. Messages are being sent to ${eligibleContacts.length} contacts.`,
      queuedCount: eligibleContacts.length,
    });
  } catch (error) {
    console.error('Campaign error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/contacts/:contactId/name', async (req, res) => {
  try {
    const { clientName } = req.body;
    if (!clientName || !clientName.trim()) {
      return res.status(400).json({ success: false, message: 'A name is required.' });
    }

    const contact = await Contact.findByIdAndUpdate(
      req.params.contactId,
      { clientName: clientName.trim() },
      { new: true }
    );

    if (!contact) {
      return res.status(404).json({ success: false, message: 'Contact not found.' });
    }

    const io = req.app.get('io');
    if (io) io.emit('contact_updated', contact);

    res.status(200).json({ success: true, data: contact });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});




router.post('/import-contacts', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Upload a plain text (.txt) file.' });
    }

    const { userId } = req.body;

    const fileContent = fs.readFileSync(req.file.path, 'utf-8');

    try {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    } catch (e) { }

    const lines = fileContent.split(/\r?\n/);

    let importedCount = 0;
    let skippedCount = 0;

    for (const line of lines) {
      const cleanPhone = line.replace(/\D/g, '').trim();

      if (cleanPhone.length < 10) {
        if (line.trim().length > 0) skippedCount++;
        continue;
      }

      const existing = await Contact.findOne({
        phoneNumber: cleanPhone,
        userId: userId || null,
      });

      if (!existing) {
        try {
          await Contact.create({
            userId: userId || null,
            phoneNumber: cleanPhone,
            clientName: `+${cleanPhone}`,
            tag: 'General',
            isPinned: false,
            unreadCount: 0,
            lastTemplateSentAt: null,
          });
          importedCount++;
        } catch (dupErr) {
          skippedCount++;
        }
      } else {
        skippedCount++;
      }
    }

    const io = req.app.get('io');
    if (io) io.emit('contact_updated');

    res.status(200).json({
      success: true,
      message: `Imported ${importedCount} new numbers. Skipped ${skippedCount} duplicates or invalid entries.`,
      importedCount,
      skippedCount,
    });
  } catch (error) {
    console.error('Import text file error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});






router.post('/start-new-chat', async (req, res) => {
  try {
    const { phoneNumber, clientName, templateName = 'visit_website', userId, role } = req.body;

    if (!phoneNumber) return res.status(400).json({ success: false, message: 'A phone number is required.' });

    const cleanPhone = String(phoneNumber).replace(/\D/g, '').trim();
    if (cleanPhone.length < 10) return res.status(400).json({ success: false, message: 'Invalid phone number!' });

    let PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
    let ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
    let mySenderNumber = process.env.MY_BUSINESS_NUMBER || 'ME';
    let clientUser = null;

    if (role !== 'admin') {
      clientUser = userId ? await User.findById(userId) : null;
      if (!clientUser || !clientUser.isWhatsAppConnected || !clientUser.phoneNumberId || !clientUser.whatsappAccessToken) {
        return res.status(400).json({ success: false, message: 'Connect your WhatsApp Business account before starting a chat.' });
      }
      PHONE_NUMBER_ID = clientUser.phoneNumberId;
      ACCESS_TOKEN = clientUser.whatsappAccessToken;
      if (clientUser.businessPhoneNumber) mySenderNumber = clientUser.businessPhoneNumber;
    }

    const url = `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`;
    const trimmedTemplate = templateName.trim();
    let targetLang = 'en';
    let components = undefined;

    // Include the truck photo only for administrator dispatch messages.
    if (role === 'admin' && (trimmedTemplate === 'visit_website' || trimmedTemplate === 'freight_status')) {
      targetLang = 'en';
      components = [
        {
          type: 'header',
          parameters: [
            {
              type: 'image',
              image: { link: 'https://res.cloudinary.com/dmiacxpbp/image/upload/v1792091793/images_2_d0nguc.jpg' },
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
      template: {
        name: trimmedTemplate,
        language: { code: targetLang },
        ...(components ? { components } : {}),
      },
    };

    const metaRes = await axios.post(url, metaPayload, {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    const whatsappMessageId = metaRes.data.messages[0].id;
    const targetUserId = role === 'admin' ? null : (userId || null);

    const contact = await Contact.findOneAndUpdate(
      { phoneNumber: { $in: [cleanPhone, `+${cleanPhone}`] }, userId: targetUserId },
      {
        $set: {
          phoneNumber: cleanPhone,
          userId: targetUserId,
          clientName: clientName && clientName.trim() ? clientName.trim() : `+${cleanPhone}`,
          lastMessage: `[Template: ${trimmedTemplate}]`,
          lastTemplateSentAt: new Date(),
          lastInteractionAt: new Date(),
        },
        $setOnInsert: {
          tag: 'General',
          isPinned: false,
          unreadCount: 0,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    let templateBody = `[Template: ${trimmedTemplate}]`;
    let templateImageUrl = '';

    // Set the truck body text only for administrator dispatch messages.
    if (role === 'admin' && (trimmedTemplate === 'freight_status' || trimmedTemplate === 'visit_website')) {
      templateImageUrl = 'https://res.cloudinary.com/dmiacxpbp/image/upload/v1792091793/images_2_d0nguc.jpg';
      templateBody = `🚛 Freight Dispatch Notice – Carrier Operations\n\nHello, this is an operational dispatch update from IT GeniusX regarding active freight schedules across the United States.\n\nPlease reply with your truck type to connect with dispatch.`;
    }

    const savedMessage = await Message.create({
      userId: targetUserId,
      whatsappMessageId,
      senderNumber: mySenderNumber,
      receiverNumber: cleanPhone,
      text: templateBody,
      caption: templateBody,
      mediaUrl: templateImageUrl,
      messageType: 'template',
      direction: 'outbound',
      status: 'sent',
    });

    if (targetUserId) {
      await User.findByIdAndUpdate(targetUserId, { $inc: { sentToday: 1 } });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('new_message', savedMessage);
      io.emit('contact_updated', contact);
    }

    res.status(200).json({
      success: true,
      message: 'The new chat has been started and the template was delivered.',
      contact,
      messageData: savedMessage,
    });
  } catch (error) {
    console.error('Start new chat error:', error.response?.data || error.message);
    const errMsg = error.response?.data?.error?.message || error.message;
    res.status(400).json({ success: false, message: `Error: ${errMsg}` });
  }
});


router.delete('/contacts/:contactId', async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.contactId);
    if (!contact) {
      return res.status(404).json({ success: false, message: 'Contact not found.' });
    }

    await Message.deleteMany({
  $or: [
    { senderNumber: { $in: [contact.phoneNumber, `+${contact.phoneNumber}`] } },
    { receiverNumber: { $in: [contact.phoneNumber, `+${contact.phoneNumber}`] } },
  ],
  userId: contact.userId
});

    await Contact.findByIdAndDelete(req.params.contactId);

    const io = req.app.get('io');
    if (io) io.emit('contact_deleted', { contactId: req.params.contactId });

    res.status(200).json({ success: true, message: 'The chat and its messages have been deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


router.patch('/contacts/:contactId/block', async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.contactId);
    if (!contact) return res.status(404).json({ success: false, message: 'Contact not found.' });

    contact.isBlocked = !contact.isBlocked;
    await contact.save();

    const io = req.app.get('io');
    if (io) io.emit('contact_updated', contact);

    res.status(200).json({
      success: true,
      message: contact.isBlocked ? 'Contact blocked.' : 'Contact unblocked.',
      isBlocked: contact.isBlocked,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});





// 📋 IN-APP TEMPLATE MANAGEMENT ROUTES

router.get('/templates', async (req, res) => {
  try {
    const { userId, role } = req.query;

    let WABA_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
    let ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

    if (role !== 'admin') {
      const clientUser = userId ? await User.findById(userId) : null;
      if (!clientUser || !clientUser.isWhatsAppConnected || !clientUser.wabaId || !clientUser.whatsappAccessToken) {
        return res.status(400).json({
          success: false,
          message: 'Connect your WhatsApp Business account before creating a template.',
        });
      }
      WABA_ID = clientUser.wabaId;
      ACCESS_TOKEN = clientUser.whatsappAccessToken;
    }

    const metaRes = await axios.get(
      `https://graph.facebook.com/v19.0/${WABA_ID}/message_templates`,
      {
        headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
        params: { limit: 100 },
      }
    );

    res.status(200).json({
      success: true,
      data: metaRes.data.data || [],
    });
  } catch (error) {
    console.error('Fetch templates error:', error.response?.data || error.message);
    // Return an empty list if the account has no templates.
    res.status(200).json({
      success: true,
      data: [],
    });
  }
});


router.post('/templates', upload.single('image'), async (req, res) => {
  try {
    const {
      name,
      category = 'UTILITY',
      bodyText,
      hasHeaderImage,
      buttonType = 'NONE',
      buttonText,
      buttonValue,
      userId,
      role,
    } = req.body;

    if (!name || !bodyText) {
      return res.status(400).json({ success: false, message: 'A template name and body text are required.' });
    }

    let WABA_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
    let ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
    const APP_ID = process.env.META_APP_ID || '2849467472091250';

    if (role !== 'admin') {
      const clientUser = userId ? await User.findById(userId) : null;
      if (!clientUser || !clientUser.isWhatsAppConnected || !clientUser.wabaId || !clientUser.whatsappAccessToken) {
        return res.status(400).json({
          success: false,
          message: 'Connect your WhatsApp Business account before creating a template.',
        });
      }
      WABA_ID = clientUser.wabaId;
      ACCESS_TOKEN = clientUser.whatsappAccessToken;
    }

    const cleanTemplateName = name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const components = [];

    // Upload the header image to Meta and retrieve its official handle.
    if ((hasHeaderImage === 'true' || hasHeaderImage === true) && req.file) {
      try {
        const fileBuffer = fs.readFileSync(req.file.path);
        const fileLength = req.file.size;
        const fileType = req.file.mimetype || 'image/jpeg';

        // Create an upload session with Meta.
        const sessionRes = await axios.post(
          `https://graph.facebook.com/v19.0/${APP_ID}/uploads`,
          null,
          {
            params: {
              file_length: fileLength,
              file_type: fileType,
              access_token: ACCESS_TOKEN,
            },
          }
        );

        const uploadSessionId = sessionRes.data.id;

        // Upload the file contents to Meta.
        const fileUploadRes = await axios.post(
          `https://graph.facebook.com/v19.0/${uploadSessionId}`,
          fileBuffer,
          {
            headers: {
              Authorization: `OAuth ${ACCESS_TOKEN}`,
              'Content-Type': fileType,
            },
          }
        );

        const metaFileHandle = fileUploadRes.data.h;

        // Pass the handle in the format expected by Meta.
        components.push({
          type: 'HEADER',
          format: 'IMAGE',
          example: {
            header_handle: [metaFileHandle],
          },
        });

        // Remove the temporary file.
        try {
          if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        } catch (e) { }
      } catch (uploadErr) {
        console.error('Meta Image upload error:', uploadErr.response?.data || uploadErr.message);
      }
    }

    // 2. Body Text + Variables ({{1}}, {{2}})
    const matches = bodyText.match(/\{\{(\d+)\}\}/g);
    const bodyComponent = {
      type: 'BODY',
      text: bodyText.trim(),
    };

    if (matches && matches.length > 0) {
      const samples = matches.map((_, i) => `Sample${i + 1}`);
      bodyComponent.example = {
        body_text: [samples],
      };
    }
    components.push(bodyComponent);

    if (buttonType === 'URL' && buttonValue) {
      components.push({
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: buttonText?.trim() || 'Visit Website',
            url: buttonValue.trim(),
          },
        ],
      });
    } else if (buttonType === 'QUICK_REPLY') {
      components.push({
        type: 'BUTTONS',
        buttons: [
          {
            type: 'QUICK_REPLY',
            text: buttonText?.trim() || 'Stop Promotions',
          },
        ],
      });
    } else if (buttonType === 'PHONE_NUMBER' && buttonValue) {
      components.push({
        type: 'BUTTONS',
        buttons: [
          {
            type: 'PHONE_NUMBER',
            text: buttonText?.trim() || 'Call Us',
            phone_number: buttonValue.replace(/\D/g, '').trim(),
          },
        ],
      });
    }

    const metaPayload = {
      name: cleanTemplateName,
      category: category.toUpperCase(),
      language: 'en',
      components,
    };

    const response = await axios.post(
      `https://graph.facebook.com/v19.0/${WABA_ID}/message_templates`,
      metaPayload,
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const newTemplateData = {
      name: cleanTemplateName,
      category: category.toUpperCase(),
      language: 'en',
      status: response.data?.status || 'PENDING',
    };

    const io = req.app.get('io');
    if (io) {
      io.emit('template_created', newTemplateData);
    }

    res.status(201).json({
      success: true,
      message: `Template "${cleanTemplateName}" was submitted to Meta. Review usually takes 1–2 minutes.`,
      data: newTemplateData,
    });
  } catch (error) {
    console.error('Create template meta error full:', error.response?.data || error.message);
    const errData = error.response?.data?.error;
    const errMsg = errData?.error_user_msg || errData?.error_data?.details || errData?.message || error.message;
    res.status(400).json({ success: false, message: `Meta Error: ${errMsg}` });
  }
});




router.delete('/templates/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const { userId, role } = req.query;

    let WABA_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
    let ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

    if (role !== 'admin') {
      const clientUser = userId ? await User.findById(userId) : null;
      if (!clientUser || !clientUser.isWhatsAppConnected || !clientUser.wabaId || !clientUser.whatsappAccessToken) {
        return res.status(400).json({ success: false, message: 'WhatsApp account is not connected.' });
      }
      WABA_ID = clientUser.wabaId;
      ACCESS_TOKEN = clientUser.whatsappAccessToken;
    }

    // Delete the template through the Meta Graph API.
    await axios.delete(`https://graph.facebook.com/v19.0/${WABA_ID}/message_templates`, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
      params: { name: name.trim() },
    });

    res.status(200).json({ success: true, message: `Template "${name}" was deleted from Meta.` });
  } catch (error) {
    console.error('Delete template error:', error.response?.data || error.message);
    const errMsg = error.response?.data?.error?.message || error.message;
    res.status(400).json({ success: false, message: `Meta Delete Error: ${errMsg}` });
  }
});






router.get('/kpi-stats', async (req, res) => {
  try {
    const { userId, role } = req.query;

    let isWhatsAppConnected = false;
    let sentToday = 0;
    let planLimit = '250';

    const userFilter =
      role === 'admin'
        ? { $or: [{ userId: userId }, { userId: null }, { userId: { $exists: false } }] }
        : { userId: userId };

    const totalConversations = await Contact.countDocuments(userFilter);
    const unreadCount = await Contact.countDocuments({
      ...userFilter,
      unreadCount: { $gt: 0 },
    });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    if (role === 'admin') {
      sentToday = await Message.countDocuments({
        direction: 'outbound',
        messageType: 'template',
        status: { $ne: 'failed' },
        createdAt: { $gte: todayStart },
      });
      planLimit = '∞ Unlimited';
      isWhatsAppConnected = true;
    } else if (userId) {
      const user = await User.findById(userId);

      // Read the quota from the user profile so deleting a contact does not reset it.
      sentToday = user?.sentToday || 0;
      planLimit = String(user?.planLimit || 250);
      isWhatsAppConnected = Boolean(user?.isWhatsAppConnected);
    }

    const messageFilter = role === 'admin' ? {} : (userId ? { userId } : {});
    const totalOutbound = await Message.countDocuments({ ...messageFilter, direction: 'outbound' });
    const failedMessages = await Message.countDocuments({ ...messageFilter, direction: 'outbound', status: 'failed' });

    let deliveryRate = '100%';
    if (totalOutbound > 0) {
      const successPercent = ((totalOutbound - failedMessages) / totalOutbound) * 100;
      deliveryRate = `${successPercent.toFixed(1)}%`;
    }

    res.status(200).json({
      success: true,
      stats: {
        totalConversations,
        unreadCount,
        sentToday,
        planLimit,
        deliveryRate,
        isWhatsAppConnected,
      },
    });
  } catch (error) {
    console.error('KPI stats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/contacts/:id/details', async (req, res) => {
  try {
    const {
      mcNumber,
      dotNumber,
      equipmentType,
      route,
      activeLoadId,
      customTags,
      internalNotes,
      companyName,
      location,
      leadStatus,
      websiteOrEmail
    } = req.body;

    const updatedContact = await Contact.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          mcNumber: mcNumber || '',
          dotNumber: dotNumber || '',
          equipmentType: equipmentType || '', // 'Dry Van' default khatam kar diya
          route: route || '',
          activeLoadId: activeLoadId || '',
          customTags: Array.isArray(customTags) ? customTags : [],
          internalNotes: internalNotes || '',
          companyName: companyName || '',
          location: location || '',
          leadStatus: leadStatus || 'New Lead',
          websiteOrEmail: websiteOrEmail || '',
        },
      },
      { returnDocument: 'after' }
    );

    if (!updatedContact) {
      return res.status(404).json({ success: false, message: 'Contact not found.' });
    }

    res.status(200).json({
      success: true,
      message: 'Contact details updated successfully.',
      contact: updatedContact,
    });
  } catch (error) {
    console.error('Contact details update error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});
export default router;