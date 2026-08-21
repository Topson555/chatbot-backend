import mongoose from 'mongoose';

const vectorChunkSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  text: { type: String, required: true },
  embedding: { type: [Number], required: true },
  chunkIndex: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

export const VectorChunk = mongoose.model('VectorChunk', vectorChunkSchema);