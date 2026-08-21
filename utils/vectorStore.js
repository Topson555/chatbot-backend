import { GoogleGenerativeAI } from '@google/generative-ai';
import { VectorChunk } from '../models/VectorChunk.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });

export function chunkText(text, chunkSize = 800, overlap = 150) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + chunkSize));
    i += chunkSize - overlap;
  }
  return chunks;
}

export async function generateEmbedding(text) {
  const result = await embeddingModel.embedContent(text);
  return result.embedding.values;
}

// Persist document chunks directly into MongoDB
export async function indexDocument(filename, text) {
  const chunks = chunkText(text);
  
  // Clean up any previously uploaded chunks with the same filename
  await VectorChunk.deleteMany({ filename });

  const chunkDocs = [];
  for (let i = 0; i < chunks.length; i++) {
    const embedding = await generateEmbedding(chunks[i]);
    chunkDocs.push({
      filename,
      text: chunks[i],
      embedding,
      chunkIndex: i,
    });
  }

  await VectorChunk.insertMany(chunkDocs);
  return chunks.length;
}

function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Retrieve relevant context along with preview metadata
export async function queryRelevantContext(prompt, topK = 3) {
  const allChunks = await VectorChunk.find().lean();
  if (!allChunks.length) return { contextString: '', sources: [] };

  const promptEmbedding = await generateEmbedding(prompt);

  const scored = allChunks.map((item) => ({
    ...item,
    score: cosineSimilarity(promptEmbedding, item.embedding),
  }));

  scored.sort((a, b) => b.score - a.score);
  const topMatches = scored.slice(0, topK);

  const contextString = topMatches
    .map((item) => `[Source: ${item.filename} (Chunk ${item.chunkIndex + 1})]\n${item.text}`)
    .join('\n\n');

  const sources = topMatches.map((item) => ({
    filename: item.filename,
    chunkIndex: item.chunkIndex,
    preview: item.text.slice(0, 150) + '...',
    score: item.score.toFixed(3),
  }));

  return { contextString, sources };
}