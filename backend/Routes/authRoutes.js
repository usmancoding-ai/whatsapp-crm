import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = express.Router();

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'fallback_secret_key_123', {
    expiresIn: '30d',
  });
};



router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Enter your email address and password.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (user && (await user.matchPassword(password))) {
      // Make the first account an administrator when no administrator exists.
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount === 0) {
        user.role = 'admin';
        await user.save();
      }

      // Apply customer restrictions without affecting administrators.
      if (user.role !== 'admin') {
        if (user.isBlocked) {
          return res.status(403).json({
            success: false,
            message: 'Your account has been blocked. Please contact an administrator.',
          });
        }

        if (user.planExpiry && new Date() > new Date(user.planExpiry)) {
          return res.status(403).json({
            success: false,
            message: 'Your monthly plan has expired. Please contact an administrator to renew it.',
          });
        }
      }

      res.status(200).json({
        success: true,
        data: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          planLimit: user.planLimit,
          sentToday: user.sentToday,
          planExpiry: user.planExpiry,
          isWhatsAppConnected: user.isWhatsAppConnected,
          businessPhoneNumber: user.businessPhoneNumber,
          token: generateToken(user._id),
        },
      });
    } else {
      res.status(401).json({ success: false, message: 'The email address or password is incorrect.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


router.get('/users', async (req, res) => {
  try {
    const users = await User.find({ role: 'user' }).select('-password').sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/create-user', async (req, res) => {
  try {
    const { name, email, password, planLimit = 250, validityDays = 30 } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email address, and password are required.' });
    }

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) {
      return res.status(400).json({ success: false, message: 'This email address is already registered.' });
    }

    const expiryDate = new Date(Date.now() + Number(validityDays) * 24 * 60 * 60 * 1000);

    const newUser = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: 'user',
      planLimit: Number(planLimit),
      planExpiry: expiryDate,
    });

    res.status(201).json({
      success: true,
      message: `Customer "${newUser.name}" was created successfully (${planLimit} messages per day).`,
      data: {
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        planLimit: newUser.planLimit,
        planExpiry: newUser.planExpiry,
        isBlocked: newUser.isBlocked,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/users/:id/toggle-block', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    user.isBlocked = !user.isBlocked;
    await user.save();
    const io = req.app.get('io');
    if (io && user.isBlocked) {
      io.emit('user_blocked', { userId: String(user._id) });
    }
    res.status(200).json({
      success: true,
      message: user.isBlocked ? 'User blocked successfully.' : 'User unblocked successfully.',
      data: user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/users/:id/plan', async (req, res) => {
  try {
    const { planLimit, renewDays = 30 } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    if (planLimit) user.planLimit = Number(planLimit);
    if (renewDays) {
      user.planExpiry = new Date(Date.now() + Number(renewDays) * 24 * 60 * 60 * 1000);
    }

    await user.save();
    res.status(200).json({
      success: true,
      message: 'Plan and validity updated successfully.',
      data: user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const deletedUserId = String(req.params.id);
    await User.findByIdAndDelete(deletedUserId);

    // Immediately log out the customer after an administrator deletes the account.
    const io = req.app.get('io');
    if (io) {
      io.emit('user_blocked', { userId: deletedUserId });
    }

    res.status(200).json({ success: true, message: 'Customer deleted successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;