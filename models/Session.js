import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: 'New Conversation',
      trim: true,
    },
    // Useful for future auth features or guest tracking
    userId: {
      type: String,
      default: 'guest_user', 
      index: true,
    },
  },
  { timestamps: true }
);

export const Session = mongoose.model('Session', sessionSchema);