import mongoose from 'mongoose';

export const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI || process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/topson_ai';
  try {
    await mongoose.connect(mongoUri);
    console.log(`✅ Connected to MongoDB (${mongoUri.startsWith('mongodb://127.0.0.1') ? 'local' : 'configured'})`);
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err);
  }
};