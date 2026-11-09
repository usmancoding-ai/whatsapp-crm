import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    whatsappMessageId: {
      type: String,
      unique: true,
      sparse: true,
    },
    senderNumber: {
      type: String,
      required: true,
      trim: true,
    },
    receiverNumber: {
      type: String,
      required: true,
      trim: true,
    },
    text: {
      type: String,
      default: '',
    },
    caption: {
      type: String,
      default: '',
    },
    mediaUrl: {
      type: String,
      default: '',
    },
    fileName: {
      type: String,
      default: '',
    },
    mimeType: {
      type: String,
      default: '',
    },
    messageType: {
      type: String,
      enum: ['text', 'image', 'audio', 'video', 'document', 'sticker', 'template'],
      default: 'text',
    },
    direction: {
      type: String,
      enum: ['inbound', 'outbound'],
      required: true,
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read', 'failed'],
      default: 'sent',
    },
    errorMessage: {
      type: String,
      default: '',
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    replyToMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    }, isPinned: {
      type: Boolean,
      default: false,
    }
  },



  { timestamps: true }
);

messageSchema.index({ senderNumber: 1, createdAt: 1 });
messageSchema.index({ receiverNumber: 1, createdAt: 1 });

const Message = mongoose.model('Message', messageSchema);
export default Message;