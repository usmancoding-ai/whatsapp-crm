WhatsApp CRM & Broadcast Dashboard

A full-stack WhatsApp Customer Relationship Management (CRM) and broadcast messaging platform powered by the official Meta WhatsApp Cloud API (Graph API v19.0). It enables businesses to manage customer conversations in real-time, send bulk template campaigns, and handle media messaging from a centralized web dashboard.

Features

Real-Time Two-Way Chat: Send and receive WhatsApp text, media, and voice notes instantly via WebSockets (Socket.io).

Delivery Tracking: Live status indicators for Sent, Delivered, and Read, including error alerts with Meta failure codes.

Broadcast Campaigns: Send bulk template messages with tag-based filtering (General, VIP), automatic 3-day cooldown to avoid spamming, and an anti-ban 5-second pacing delay between messages via Redis/BullMQ.

Template Management: Create, preview, submit, and delete Meta-approved message templates (with variables, header images, and action buttons) directly from the CRM.

Voice Notes (PTT): Record audio directly in the browser and automatically convert it to WhatsApp's native Push-to-Talk format (audio/ogg; codecs=opus).

Media Uploads: Send and preview images, videos, and PDF documents backed by Cloudinary CDN storage.

Multi-Tenant Support: Clean data isolation allowing multiple business accounts to manage their own WhatsApp numbers, contacts, and message history independently.

Smart Contact Management: Infinite scroll contact list, optimistic chat pinning, unread count tracking, and WhatsApp Web-style filters (All, Unread, Excluded).

Tech Stack

Frontend: React 18, Vite, Tailwind CSS, Lucide React, Axios, Socket.io-client

Backend: Node.js, Express.js, Socket.io, BullMQ, Redis, Multer, fluent-ffmpeg

Database & Storage: MongoDB Atlas (Mongoose), Cloudinary

API: Meta WhatsApp Cloud API (Graph API v19.0)

Prerequisites

Node.js: v18 or higher

Redis Server: Running locally or hosted (required for campaign queue)

MongoDB Atlas: Database connection string

ffmpeg: Installed on your server/machine (required for voice note audio conversion)

Meta Developer Account: WhatsApp Cloud API App credentials

Environment Variables

Create a .env file in the server directory:

# Server
PORT=5000
JWT_SECRET=your_jwt_secret

# Database & Queue
MONGO_URL=your_mongodb_connection_string
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Meta WhatsApp Cloud API
WHATSAPP_VERIFY_TOKEN=your_webhook_verify_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_BUSINESS_ACCOUNT_ID=your_waba_id
WHATSAPP_ACCESS_TOKEN=your_meta_access_token
MY_BUSINESS_NUMBER=your_business_phone_number

# Meta App
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret


Installation & Setup

1. Clone the repository

git clone https://github.com/your-username/whatsapp-crm.git
cd whatsapp-crm


2. Backend Setup

cd server
npm install
npm run dev


3. Frontend Setup

cd ../client
npm install
npm run dev


Open http://localhost:5173 in your browser to access the dashboard.

License

This project is licensed under the MIT License.