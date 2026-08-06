import mongoose from 'mongoose';

const knowledgeSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  content: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now }
});

export const Knowledge = mongoose.model('Knowledge', knowledgeSchema);