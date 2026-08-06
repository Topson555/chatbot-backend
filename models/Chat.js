import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'bot'], required: true },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const chatSchema = new mongoose.Schema({
  title: { type: String, required: true, default: 'New Conversation' },
  messages: [messageSchema],
  updatedAt: { type: Date, default: Date.now }
});

export const Chat = mongoose.model('Chat', chatSchema);