import mongoose from 'mongoose';

const contactSchema = new mongoose.Schema(
  {
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },  
    clientName: {
      type: String,
      default: '',
      trim: true,
    },
    lastMessage: {
      type: String,
      default: '',
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    unreadCount: {
      type: Number,
      default: 0,
    },
    tag: {
      type: String,
      default: 'General',
      trim: true,
    },
    lastTemplateSentAt: {
      type: Date,
      default: null,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    lastInteractionAt: {
      type: Date,
      default: null,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    mcNumber: {
      type: String,
      default: '',
      trim: true,
    },
    dotNumber: {
      type: String,
      default: '',
      trim: true,
    },
    equipmentType: {
      type: String,
      default: '',
      trim: true,
    },
    route: {
      type: String,
      default: '',
      trim: true,
    },
    activeLoadId: {
      type: String,
      default: '',
      trim: true,
    },
    customTags: {
      type: [String],
      default: [],
    },
    internalNotes: {
      type: String,
      default: '',
      trim: true,
    },

    companyName: {
      type: String,
      default: '',
      trim: true,
    },
    location: {
      type: String,
      default: '',
      trim: true,
    },
    leadStatus: {
      type: String,
      default: 'New Lead',
      trim: true,
    },
    websiteOrEmail: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true }
);

contactSchema.index({ isPinned: -1, updatedAt: -1 });
contactSchema.index({ tag: 1 });
contactSchema.index({ lastTemplateSentAt: 1 });
contactSchema.index({ userId: 1 });
contactSchema.index({ leadStatus: 1 });

const Contact = mongoose.model('Contact', contactSchema);
export default Contact;