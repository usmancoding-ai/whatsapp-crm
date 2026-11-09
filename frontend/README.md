WhatsApp CRM & Broadcast Dashboard
A full-stack WhatsApp Customer Relationship Management (CRM) and marketing broadcast platform powered by the official Meta WhatsApp Cloud API. It allows businesses to manage real-time customer conversations, run template campaigns, and handle media messaging from a centralized web dashboard.

Core Features
Real-Time Two-Way Chat: Instant text, media, and voice messaging powered by WebSockets.

Message Status Tracking: Live delivery receipts (Sent, Delivered, Read) and error alerts.

Broadcast Campaigns: Bulk template messaging with tag filters and contact segmentation.

Template Management: Create, preview, and submit Meta-approved message templates with variables and action buttons.

Voice Notes & Media: In-browser audio recording with native WhatsApp voice note conversion, plus image, video, and PDF sharing.

Multi-Tenant Architecture: Clean data isolation for multiple business accounts, phone numbers, and contact lists.

Contact Management: Infinite scroll contact list, optimistic chat pinning, and status filters.

Technologies Used
Frontend: React 18, Vite, Tailwind CSS, Lucide React, Axios, Socket.io-client

Backend: Node.js, Express.js, Socket.io, BullMQ, Redis, Multer, ffmpeg

Database & Storage: MongoDB Atlas, Cloudinary

External Integration: Meta WhatsApp Cloud API (Graph API)

Installation & Setup
1. Clone Repository
Bash
git clone https://github.com/usmancoding-ai/whatsapp-crm.git
cd whatsapp-crm
2. Backend Setup
Bash
cd backend
npm install
npm run dev
3. Frontend Setup
Bash
cd ../frontend
npm install
npm run dev
License
This project is licensed under the MIT License.