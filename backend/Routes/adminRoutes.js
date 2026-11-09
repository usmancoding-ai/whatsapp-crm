import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Contact from '../models/Contact.js';
import Message from '../models/Message.js';

const router = express.Router();

const adminAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authorization token is missing.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id || decoded.userId || decoded._id;

    const user = await User.findById(userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Super administrator access is required.' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'The token is invalid or has expired.' });
  }
};

router.use(adminAuth);


router.get('/stats', async (req, res) => {
  try {
    const now = new Date();

    const totalClients = await User.countDocuments({ role: { $ne: 'admin' } });

    const activeClients = await User.countDocuments({
      role: { $ne: 'admin' },
      isBlocked: { $ne: true },
      $or: [{ planExpiry: { $exists: false } }, { planExpiry: { $gt: now } }],
    });

    const blockedClients = await User.countDocuments({
      role: { $ne: 'admin' },
      isBlocked: true,
    });

    const expiredClients = await User.countDocuments({
      role: { $ne: 'admin' },
      isBlocked: { $ne: true },
      planExpiry: { $lte: now },
    });

    const usageAggregate = await User.aggregate([
      { $match: { role: { $ne: 'admin' } } },
      { $group: { _id: null, totalSentToday: { $sum: '$sentToday' } } },
    ]);
    const platformSentToday = usageAggregate[0]?.totalSentToday || 0;

    const clientUsers = await User.find({ role: { $ne: 'admin' } }, '_id');
    const clientIds = clientUsers.map((u) => u._id);

    const totalContacts = await Contact.countDocuments({ userId: { $in: clientIds } });
    const totalMessages = await Message.countDocuments({ userId: { $in: clientIds } });

    const connectedWhatsAppCount = await User.countDocuments({
      role: { $ne: 'admin' },
      isWhatsAppConnected: true,
    });

    res.status(200).json({
      success: true,
      stats: {
        totalClients,
        activeClients,
        blockedClients,
        expiredClients,
        platformSentToday,
        totalContacts,
        totalMessages,
        connectedWhatsAppCount,
      },
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});
router.get('/clients', async (req, res) => {
  try {
    const { search = '', status = 'all' } = req.query;
    const now = new Date();

    const query = { role: { $ne: 'admin' } };

    if (status === 'active') {
      query.isBlocked = { $ne: true };
      query.$or = [{ planExpiry: { $exists: false } }, { planExpiry: { $gt: now } }];
    } else if (status === 'blocked') {
      query.isBlocked = true;
    } else if (status === 'expired') {
      query.isBlocked = { $ne: true };
      query.planExpiry = { $lte: now };
    }

    if (search.trim()) {
      const cleanSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { name: { $regex: cleanSearch, $options: 'i' } },
        { email: { $regex: cleanSearch, $options: 'i' } },
        { businessPhoneNumber: { $regex: cleanSearch, $options: 'i' } },
      ];
    }

    const clients = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 });

    const clientsWithDetails = await Promise.all(
      clients.map(async (client) => {
        const contactCount = await Contact.countDocuments({ userId: client._id });
        
        let daysRemaining = null;
        if (client.planExpiry) {
          const diffMs = new Date(client.planExpiry) - now;
          daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        }

        return {
          ...client.toObject(),
          totalContacts: contactCount,
          daysRemaining,
        };
      })
    );

    res.status(200).json({ success: true, clients: clientsWithDetails });
  } catch (error) {
    console.error('Admin clients error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/create-client', async (req, res) => {
  try {
    const { name, email, password, planLimit = 250, planDurationDays = 30, businessPhoneNumber } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email address, and password are required.' });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'This email address is already registered.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const planExpiry = new Date();
    planExpiry.setDate(planExpiry.getDate() + Number(planDurationDays));

    const newClient = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: password,
      role: 'user',
      planLimit: Number(planLimit),
      sentToday: 0,
      lastResetDate: new Date(),
      planExpiry,
      isBlocked: false,
      businessPhoneNumber: businessPhoneNumber ? businessPhoneNumber.trim() : '',
      isWhatsAppConnected: false,
    });

    res.status(201).json({
      success: true,
      message: 'Client account created successfully.',
      client: {
        _id: newClient._id,
        name: newClient.name,
        email: newClient.email,
        planLimit: newClient.planLimit,
        planExpiry: newClient.planExpiry,
      },
    });
  } catch (error) {
    console.error('Create client error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/clients/:id/toggle-block', async (req, res) => {
  try {
    const client = await User.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found.' });
    }

    client.isBlocked = !client.isBlocked;
    await client.save();

    // Immediately log out the user when their account is blocked.
    if (client.isBlocked) {
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${client._id}`).emit('user_blocked', { userId: client._id });
        io.emit('user_blocked', { userId: client._id });
      }
    }

    res.status(200).json({
      success: true,
      message: `Client ${client.isBlocked ? 'blocked' : 'unblocked'} successfully.`,
      isBlocked: client.isBlocked,
    });
  } catch (error) {
    console.error('Toggle block error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/clients/:id/renew', async (req, res) => {
  try {
    const { additionalDays = 30, planLimit } = req.body;

    const client = await User.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found.' });
    }

    const now = new Date();
    let currentExpiry = client.planExpiry && new Date(client.planExpiry) > now 
      ? new Date(client.planExpiry) 
      : now;

    currentExpiry.setDate(currentExpiry.getDate() + Number(additionalDays));
    client.planExpiry = currentExpiry;
    client.sentToday = 0;

    if (planLimit) {
      client.planLimit = Number(planLimit);
    }

    await client.save();

    res.status(200).json({
      success: true,
      message: `Plan renewed successfully for ${additionalDays} days.`,
      planExpiry: client.planExpiry,
      planLimit: client.planLimit,
    });
  } catch (error) {
    console.error('Renew error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/clients/:id/reset-limit', async (req, res) => {
  try {
    const client = await User.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found.' });
    }

    client.sentToday = 0;
    client.lastResetDate = new Date();
    await client.save();

    res.status(200).json({ success: true, message: 'Client daily limit counter reset successfully.' });
  } catch (error) {
    console.error('Reset limit error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/clients/:id', async (req, res) => {
  try {
    const client = await User.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found.' });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`user:${client._id}`).emit('user_blocked', { userId: client._id });
      io.emit('user_blocked', { userId: client._id });
    }

    await User.findByIdAndDelete(req.params.id);

    res.status(200).json({ success: true, message: 'Client account permanently deleted.' });
  } catch (error) {
    console.error('Delete client error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/clients/:id/whatsapp', async (req, res) => {
  try {
    const { phoneNumberId, wabaId, whatsappAccessToken, businessPhoneNumber } = req.body;

    const client = await User.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found.' });
    }

    if (phoneNumberId) client.phoneNumberId = phoneNumberId.trim();
    if (wabaId) client.wabaId = wabaId.trim();
    if (whatsappAccessToken) client.whatsappAccessToken = whatsappAccessToken.trim();
    if (businessPhoneNumber) client.businessPhoneNumber = businessPhoneNumber.trim();

    client.isWhatsAppConnected = Boolean(client.phoneNumberId && client.whatsappAccessToken);
    await client.save();

    res.status(200).json({
      success: true,
      message: 'Client WhatsApp credentials updated successfully.',
      isWhatsAppConnected: client.isWhatsAppConnected,
    });
  } catch (error) {
    console.error('WhatsApp config error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;