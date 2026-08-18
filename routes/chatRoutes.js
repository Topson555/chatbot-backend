import express from 'express';
import multer from 'multer';
import { handleChatStream } from '../controllers/chatController.js';
import { Session } from '../models/Session.js';
import { Message } from '../models/Message.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// System Health Check Endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    geminiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

// File Upload for RAG Knowledge Base
router.post('/knowledge/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  // File processing and vector embedding pipeline hooks in here
  res.json({
    success: true,
    filename: req.file.originalname,
    message: 'File uploaded and parsed successfully',
  });
});

// SSE Streaming
router.post('/stream', handleChatStream);
router.get('/stream', handleChatStream);

// Fetch all sidebar sessions
router.get('/sessions', async (req, res) => {
  try {
    const sessions = await Session.find().sort({ updatedAt: -1 });
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Alias endpoint for loading single session thread
router.get('/session/:sessionId', async (req, res) => {
  try {
    const messages = await Message.find({ sessionId: req.params.sessionId }).sort({ createdAt: 1 });
    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete session endpoint
router.delete('/sessions/:id', async (req, res) => {
  try {
    await Session.findByIdAndDelete(req.params.id);
    await Message.deleteMany({ sessionId: req.params.id });
    res.json({ success: true, message: 'Session deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;