import mongoose from 'mongoose';

export const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI || process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/topson_ai';

  const isLocal = mongoUri.startsWith('mongodb://127.0.0.1') || mongoUri.startsWith('mongodb://localhost');
  const options = {
    serverSelectionTimeoutMS: 10000,
  };

  const maxAttempts = isLocal ? 1 : 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const conn = await mongoose.connect(mongoUri, options);
      console.log(`✅ Connected to MongoDB (${isLocal ? 'Local DB' : 'Atlas Cluster: ' + conn.connection.host})`);
      return;
    } catch (err) {
      console.error(`MongoDB connect attempt ${attempt} failed:`, err.message);
      if (attempt === maxAttempts) {
        console.error('❌ MongoDB Connection Error:', err);
        break;
      }
      const delay = Math.min(5000 * attempt, 15000);
      await new Promise((res) => setTimeout(res, delay));
      console.log(`Retrying MongoDB connection (attempt ${attempt + 1}/${maxAttempts})...`);
    }
  }
};