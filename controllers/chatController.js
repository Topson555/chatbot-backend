import { Session } from '../models/Session.js';
import { Message } from '../models/Message.js';
import { generateSessionTitle } from '../utils/generateTitle.js';
import { queryRelevantContext } from '../utils/vectorStore.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Array of stable, active models for automatic fallback
// Array of active, available models for automatic rate-limit fallback
// Array of active, available models for automatic fallback
const FALLBACK_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.7-flash'
];
export const handleChatStream = async (req, res) => {
  const message = req.body?.message || req.query?.prompt || req.query?.message;
  const image = req.body?.image; // Expected: { data: "base64...", mimeType: "image/png" }
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

  if (!message && !image) {
    res.write(`data: ${JSON.stringify({ type: 'error', error: 'Message or image content is required.' })}\n\n`);
    return res.end();
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is missing in environment variables.');
    }

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

    // Query RAG Persistent Vector Store
    let RAGContext = '';
    let sources = [];
    try {
      if (isClientConnected) {
        res.write(`data: ${JSON.stringify({ type: 'status', text: 'Searching knowledge base...' })}\n\n`);
      }

      const ragResult = await queryRelevantContext(message || '');
      RAGContext = ragResult.contextString || '';
      sources = ragResult.sources || [];

      if (sources.length > 0 && isClientConnected) {
        res.write(`data: ${JSON.stringify({ type: 'sources', sources })}\n\n`);
      }
    } catch (vectorErr) {
      console.warn('RAG Query warning:', vectorErr.message || vectorErr);
    }

    // Retrieve context history (last 10 messages)
    const historyDocs = await Message.find({ sessionId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const formattedHistory = historyDocs.reverse().map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content || '' }],
    }));

    await Message.create({ sessionId, role: 'user', content: message || '[Image Attached]' });

    if (isClientConnected) {
      res.write(`data: ${JSON.stringify({ type: 'session_meta', sessionId })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'status', text: 'Generating response...' })}\n\n`);
    }

    let systemInstruction = 'You are an intelligent full-stack AI Assistant and software engineering copilot.';
    if (RAGContext) {
      systemInstruction += `\n\nUse the following extracted documentation knowledge to assist in your answer when relevant:\n${RAGContext}`;
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const promptParts = [];
    if (image?.data && image?.mimeType) {
      promptParts.push({ inlineData: { data: image.data, mimeType: image.mimeType } });
    }
    if (message) {
      promptParts.push({ text: message });
    }

    // Execute Streaming with Model Fallback
    let resultStream = null;
    let lastError = null;

    for (const modelName of FALLBACK_MODELS) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction,
        });

        const chat = model.startChat({ history: formattedHistory });
        resultStream = await chat.sendMessageStream(promptParts);
        break; // Successfully initialized stream
      } catch (modelErr) {
        lastError = modelErr;
        console.warn(`Model ${modelName} failed. Trying fallback... Error: ${modelErr.message}`);
        continue;
      }
    }

    if (!resultStream) {
      throw lastError || new Error('API quota limit reached for free tier. Please generate a new key at Google AI Studio.');
    }

    let fullResponseText = '';
    let isFirstChunk = true;

    for await (const chunk of resultStream.stream) {
      if (!isClientConnected) break;

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

    if (fullResponseText.trim()) {
      await Message.create({ sessionId, role: 'model', content: fullResponseText });
    }

    if (isNewSession && isClientConnected) {
      try {
        const newTitle = await generateSessionTitle(message || 'Image Query');
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
      const isRateLimit = err.message?.includes('429') || err.status === 429;
      const errorMessage = isRateLimit
        ? 'Daily quota limit reached on Google AI Free Tier. Please update your API key.'
        : err.message || 'Streaming failed.';

      res.write(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`);
      res.end();
    }
  }
};

export const getChatHistory = async (req, res) => {
  try {
    const sessions = await Session.find().sort({ updatedAt: -1 }).lean();
    res.status(200).json({ success: true, sessions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getSessionMessages = async (req, res) => {
  try {
    const sessionId = req.params.sessionId || req.params.id;
    const messages = await Message.find({ sessionId }).sort({ createdAt: 1 }).lean();
    res.status(200).json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};