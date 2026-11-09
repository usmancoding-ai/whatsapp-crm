import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

import connectDB from './config/db.js';
import webhookRoutes from './Routes/webhookRoutes.js';
import chatRoutes from './Routes/chatRoutes.js';
import { initMessageWorker } from './config/queue.js';
import authRoutes from './Routes/authRoutes.js';
import whatsappRoutes from './Routes/whatsappRoutes.js';
import adminRoutes from './Routes/adminRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));
app.use('/api/auth', authRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/admin', adminRoutes);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.set('io', io);
initMessageWorker(io);

io.on('connection', (socket) => {
  console.log('Client connected to Socket.io:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Drop the obsolete contact index after connecting to the database.
connectDB();

mongoose.connection.on('connected', async () => {
  try {
    await mongoose.connection.db.collection('contacts').dropIndex('phoneNumber_1');
    console.log('✅ Removed the obsolete phoneNumber_1 duplicate index.');
  } catch (e) {
    // Ignore errors if the index has already been removed.
  }
});

app.use('/webhook', webhookRoutes);
app.use('/api/chat', chatRoutes);

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});