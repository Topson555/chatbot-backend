import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { createRequire } from 'module';
import { handleChatStream } from '../controllers/chatController.js';
import { Session } from '../models/Session.js';
import { Message } from '../models/Message.js';
import { indexDocument } from '../utils/vectorStore.js';

// Setup CommonJS require for pdf-parse compatibility in ES Modules
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const router = express.Router();

// Production Rate Limiter: Max 60 requests per minute
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  message: { success: false, error: 'Too many requests, please slow down.' },
});

router.use(apiLimiter);

// Secure Multer Configuration: 10MB Limit & Multimodal File Filtering (.pdf, .txt, .md, images)
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.pdf', '.txt', '.md', '.png', '.jpg', '.jpeg', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: PDF, TXT, MD, PNG, JPG, JPEG, WEBP.'));
    }
  },
});

// Helper Wrapper Middleware to Catch Multer Validation Errors Cleanly
const uploadMiddleware = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    next();
  });
};

// System Health Check Endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    geminiKeyConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

// Multimodal File Handling & RAG Vector Indexing Route
router.post('/knowledge/upload', uploadMiddleware, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No file uploaded' });
  }

  const tempPath = req.file.path;
  const originalName = req.file.originalname;
  const ext = path.extname(originalName).toLowerCase();
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp'];

  try {
    const dataBuffer = await fs.promises.readFile(tempPath);

    // 1. Handle Multimodal Image Uploads (Base64 conversion for Gemini Vision)
    if (imageExtensions.includes(ext)) {
      const base64Data = dataBuffer.toString('base64');
      const mimeType = req.file.mimetype;

      await fs.promises.unlink(tempPath).catch((err) =>
        console.error('Failed to delete temporary file:', err)
      );

      return res.json({
        success: true,
        type: 'image',
        filename: originalName,
        message: 'Image uploaded successfully for vision processing',
        inlineData: { data: base64Data, mimeType },
      });
    }

    // 2. Handle Text & PDF Documents for Vector RAG Indexing
    let extractedText = '';
    let numPages = 0;

    if (ext === '.pdf') {
      const parsedData = await pdfParse(dataBuffer);
      extractedText = parsedData.text;
      numPages = parsedData.numpages;
    } else {
      extractedText = dataBuffer.toString('utf-8');
    }

    // Index document chunks into persistent vector store
    const chunkCount = await indexDocument(originalName, extractedText);

    await fs.promises.unlink(tempPath).catch((err) =>
      console.error('Failed to delete temporary file:', err)
    );

    res.json({
      success: true,
      type: 'document',
      filename: originalName,
      message: 'File processed and indexed successfully for RAG',
      pages: numPages,
      chunksIndexed: chunkCount,
      textLength: extractedText.length,
      preview: extractedText.slice(0, 300),
      extractedText,
    });
  } catch (err) {
    console.error('Error processing uploaded file:', err);

    if (fs.existsSync(tempPath)) {
      await fs.promises.unlink(tempPath).catch(() => {});
    }

    res.status(500).json({ success: false, error: 'Failed to process upload', details: err.message });
  }
});

// SSE Streaming
router.post('/stream', handleChatStream);
router.get('/stream', handleChatStream);

// Fetch all sidebar sessions (Optimized with .lean())
router.get('/sessions', async (req, res) => {
  try {
    const sessions = await Session.find().sort({ updatedAt: -1 }).lean();
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Load single session thread messages (Optimized with .lean())
router.get('/session/:sessionId', async (req, res) => {
  try {
    const messages = await Message.find({ sessionId: req.params.sessionId }).sort({ createdAt: 1 }).lean();
    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Rename session handler
const handleRenameSession = async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }

    const updatedSession = await Session.findByIdAndUpdate(
      req.params.id,
      { title, updatedAt: Date.now() },
      { returnDocument: 'after' }
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

// Delete session handler with cascade cleanup
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