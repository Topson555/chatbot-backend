import express from 'express';
import mongoose from 'mongoose';
import { setCustomApiKey, hasApiKey } from '../utils/aiClient.js';

const router = express.Router();

router.post('/keys', (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey || !apiKey.startsWith('AIza')) {
    return res.status(400).json({ success: false, error: 'Invalid Google Gemini API key format' });
  }

  setCustomApiKey(apiKey);
  res.json({ success: true, message: 'API key configured successfully' });
});

router.get('/health', (req, res) => {
  res.json({
    status: 'Operational',
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    geminiKeySet: hasApiKey()
  });
});

export default router;