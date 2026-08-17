import express from 'express';
import { handleChatStream } from '../controllers/chatController.js';
import { Session } from '../models/Session.js';
import { Message } from '../models/Message.js';

const router = express.Router();

// Stream Chat Endpoint (supports both GET and POST)
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

// Fetch messages for a specific session (RESTful path)
router.get('/sessions/:id/messages', async (req, res) => {
  try {
    const messages = await Message.find({ sessionId: req.params.id }).sort({ createdAt: 1 });
    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Alias endpoint to support frontend history loader (/api/chat/session/:sessionId)
router.get('/session/:sessionId', async (req, res) => {
  try {
    const messages = await Message.find({ sessionId: req.params.sessionId }).sort({ createdAt: 1 });
    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete a session and its corresponding messages
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