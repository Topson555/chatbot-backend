// import express from 'express';
// import cors from 'cors';
// import dotenv from 'dotenv';
// import { GoogleGenerativeAI } from '@google/generative-ai';

// dotenv.config();

// const app = express();
// app.use(cors());
// app.use(express.json());

// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Use gemini-2.5-flash or gemini-3.5-flash
// const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

// app.post('/api/chat', async (req, res) => {
//   try {
//     const { message } = req.body;
//     if (!message) return res.status(400).json({ error: 'Message is required.' });

//     const result = await model.generateContent(message);
//     const response = await result.response;

//     return res.json({ reply: response.text() });
//   } catch (error) {
//     console.error('AI Error:', error?.message || error);
//     return res.status(500).json({ error: 'Failed to process request.' });
//   }
// });

// const PORT = process.env.PORT || 5000;
// app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
