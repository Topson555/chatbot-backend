import express from 'express';
import mongoose from 'mongoose';
import { Chat } from '../models/Chat.js';
import { Knowledge } from '../models/Knowledge.js';
import { getAiClient } from '../utils/aiClient.js';

const router = express.Router();

// Send message & generate response
router.post('/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required.' });

    const ai = getAiClient();

    const docs = await Knowledge.find().select('content filename');
    let systemContext = "You are TOPSON AI Assistant, a helpful AI built to assist developers and engineers.\n";

    if (docs.length > 0) {
      systemContext += "\nReference Knowledge Base Context:\n";
      docs.forEach(doc => {
        systemContext += `--- Document (${doc.filename}) ---\n${doc.content.substring(0, 1500)}\n`;
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: message,
      config: { systemInstruction: systemContext }
    });

    const replyText = response.text || "No response generated.";

    let chatSession = null;
    if (sessionId && mongoose.Types.ObjectId.isValid(sessionId)) {
      chatSession = await Chat.findById(sessionId);
    }

    if (!chatSession) {
      const generatedTitle = message.length > 30 ? message.substring(0, 30) + '...' : message;
      chatSession = new Chat({ title: generatedTitle, messages: [] });
    }

    chatSession.messages.push({ role: 'user', text: message });
    chatSession.messages.push({ role: 'bot', text: replyText });
    chatSession.updatedAt = Date.now();
    await chatSession.save();

    return res.json({ success: true, reply: replyText, sessionId: chatSession._id });
  } catch (error) {
    console.error('TOPSON AI Error:', error?.message || error);
    return res.status(500).json({ success: false, reply: `⚠️ AI Error: ${error.message || 'Failed to process request.'}` });
  }
});

// Get chat history list
router.get('/history', async (req, res) => {
  try {
    const history = await Chat.find().sort({ updatedAt: -1 }).select('title updatedAt messages');
    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get specific session
router.get('/history/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Invalid Session ID' });
    }
    const session = await Chat.findById(req.params.id);
    if (!session) return res.status(404).json({ success: false, error: 'Session not found' });
    res.json({ success: true, session });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;