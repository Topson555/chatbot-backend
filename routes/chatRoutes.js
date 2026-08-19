import express from 'express';
import multer from 'multer';
import fs from 'fs';
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

// File Upload for RAG Knowledge Base with Cleanup
router.post('/knowledge/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    // Perform your document processing / embedding generation here
    const originalName = req.file.originalname;
    const tempPath = req.file.path;

    // Remove file from disk after processing
    fs.unlink(tempPath, (err) => {
      if (err) console.error('Failed to delete temporary file:', err);
    });

    res.json({
      success: true,
      filename: originalName,
      message: 'File uploaded and parsed successfully',
    });
  } catch (err) {
    // Ensure file is deleted even if processing fails
    if (req.file?.path) {
      fs.unlink(req.file.path, () => {});
    }
    res.status(500).json({ error: 'Failed to process document' });
  }
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

// Load single session thread messages
router.get('/session/:sessionId', async (req, res) => {
  try {
    const messages = await Message.find({ sessionId: req.params.sessionId }).sort({ createdAt: 1 });
    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Rename session endpoint
const handleRenameSession = async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }

    const updatedSession = await Session.findByIdAndUpdate(
      req.params.id,
      { title, updatedAt: Date.now() },
      { new: true }
    );

    if (!updatedSession) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    res.json({ success: true, message: 'Session renamed successfully', session: updatedSession });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

router.patch('/session/:id', handleRenameSession);
router.patch('/sessions/:id', handleRenameSession);

// Delete session endpoint with 404 validation
const handleDeleteSession = async (req, res) => {
  try {
    const deletedSession = await Session.findByIdAndDelete(req.params.id);

    if (!deletedSession) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    await Message.deleteMany({ sessionId: req.params.id });

    res.json({ success: true, message: 'Session deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

router.delete('/session/:id', handleDeleteSession);
router.delete('/sessions/:id', handleDeleteSession);

export default router;