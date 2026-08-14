import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { connectDB } from './config/db.js';
import chatRoutes from './routes/chatRoutes.js';
import knowledgeRoutes from './routes/knowledgeRoutes.js';
import systemRoutes from './routes/systemRoutes.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Connect Database
connectDB();

// Express route for SSE streaming
app.get('/api/chat/stream', async (req, res) => {
  const { prompt } = req.query;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt parameter is required' });
  }

  // Set mandatory SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  try {
    // 💡 Using gemini-flash-latest
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    const result = await model.generateContentStream(prompt);

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Gemini Stream Error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

// Mount Modular Routes
app.use('/api', chatRoutes);
app.use('/api', knowledgeRoutes);
app.use('/api', systemRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 TOPSON AI Assistant Backend running on port ${PORT}`));