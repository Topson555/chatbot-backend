import { Session } from '../models/Session.js';
import { Message } from '../models/Message.js';
import { generateSessionTitle } from '../utils/generateTitle.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const handleChatStream = async (req, res) => {
  const message = req.body?.message || req.query?.prompt || req.query?.message;
  let sessionId = req.body?.sessionId || req.query?.sessionId;

  // Track client connection status
  let isClientConnected = true;
  req.on('close', () => {
    if (isClientConnected) {
      isClientConnected = false;
      console.log('Client aborted request. Halting Gemini response generation.');
    }
  });

  // Set SSE Headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  if (!message) {
    res.write(`data: ${JSON.stringify({ type: 'error', error: 'Message is required.' })}\n\n`);
    return res.end();
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is missing in environment variables.');
    }

    // 1. Instantly notify frontend that request was received
    if (isClientConnected) {
      res.write(`data: ${JSON.stringify({ type: 'status', text: 'Analyzing request...' })}\n\n`);
    }

    let session;
    let isNewSession = false;

    if (sessionId) {
      session = await Session.findById(sessionId);
      if (session) {
        await Session.findByIdAndUpdate(sessionId, { updatedAt: new Date() });
      }
    }

    if (!session) {
      session = await Session.create({ title: 'New Conversation' });
      sessionId = session._id;
      isNewSession = true;
    }

    // Retrieve context history
    const historyDocs = await Message.find({ sessionId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const formattedHistory = historyDocs.reverse().map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    // Save user query
    await Message.create({ sessionId, role: 'user', content: message });

    if (isClientConnected) {
      res.write(`data: ${JSON.stringify({ type: 'session_meta', sessionId })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'status', text: 'Generating response...' })}\n\n`);
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const chat = model.startChat({ history: formattedHistory });

    const resultStream = await chat.sendMessageStream(message);

    let fullResponseText = '';
    let isFirstChunk = true;

    for await (const chunk of resultStream.stream) {
      // Abort streaming loop immediately if client disconnected
      if (!isClientConnected) {
        break;
      }

      const chunkText = chunk.text();
      if (chunkText) {
        if (isFirstChunk) {
          res.write(`data: ${JSON.stringify({ type: 'status', text: '' })}\n\n`);
          isFirstChunk = false;
        }

        fullResponseText += chunkText;
        res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunkText })}\n\n`);
      }
    }

    // Save whatever message content was generated before completion or disconnect
    if (fullResponseText.trim()) {
      await Message.create({ sessionId, role: 'model', content: fullResponseText });
    }

    // Handle Title Generation for new sessions if still connected
    if (isNewSession && isClientConnected) {
      try {
        const newTitle = await generateSessionTitle(message);
        await Session.findByIdAndUpdate(sessionId, { title: newTitle });
        res.write(`data: ${JSON.stringify({ type: 'title_update', title: newTitle })}\n\n`);
      } catch (titleErr) {
        console.error('Title generation failed:', titleErr.message || titleErr);
      }
    }

    if (isClientConnected) {
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } catch (err) {
    console.error('Streaming Chat Error:', err.message || err);
    if (isClientConnected) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: err.message || 'Streaming failed.' })}\n\n`);
      res.end();
    }
  }
};

// Fetch all sidebar sessions
export const getChatHistory = async (req, res) => {
  try {
    const sessions = await Session.find().sort({ updatedAt: -1 }).lean();
    res.status(200).json({ success: true, sessions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Fetch messages for a specific session ID
export const getSessionMessages = async (req, res) => {
  try {
    const sessionId = req.params.sessionId || req.params.id;
    const messages = await Message.find({ sessionId }).sort({ createdAt: 1 }).lean();
    res.status(200).json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};