import express from 'express';
import multer from 'multer';
import { createRequire } from 'module';
import { Knowledge } from '../models/Knowledge.js';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });

    let extractedText = '';
    if (req.file.mimetype === 'application/pdf') {
      const parsedPdf = await pdfParse(req.file.buffer);
      extractedText = parsedPdf.text;
    } else {
      extractedText = req.file.buffer.toString('utf-8');
    }

    const doc = await Knowledge.create({
      filename: req.file.originalname,
      content: extractedText
    });

    res.json({ success: true, message: 'Document added to Knowledge Base', file: doc.filename });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/knowledge', async (req, res) => {
  try {
    const docs = await Knowledge.find().select('filename uploadedAt');
    res.json({ success: true, docs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;