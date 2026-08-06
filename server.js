import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import chatRoutes from './routes/chatRoutes.js';
import knowledgeRoutes from './routes/knowledgeRoutes.js';
import systemRoutes from './routes/systemRoutes.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Connect Database
connectDB();

// Mount Modular Routes
app.use('/api', chatRoutes);
app.use('/api', knowledgeRoutes);
app.use('/api', systemRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 TOPSON AI Assistant Backend running on port ${PORT}`));