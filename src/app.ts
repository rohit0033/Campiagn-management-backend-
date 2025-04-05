import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import connectDB from './config/database';
import campaignRoutes from './routes/campaign.routes';
import personalizedMessageRoutes from './routes/personalized-message.routes';
import { errorHandler, notFound } from './middleware/error.middleware';
import { apiLimiter, scrapingLimiter } from './middleware/rate-limit.middleware';
import leadsRoutes from './routes/leads.routes';
// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app: Express = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply rate limiting
app.use('/api', apiLimiter);
app.use('/api/personalized-message/from-url', scrapingLimiter);


// Routes
app.use('/api/campaigns', campaignRoutes);
app.use('/api/personalized-message', personalizedMessageRoutes);
app.use('/api/leads', leadsRoutes);

// Provide a simple health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).send('OK');
});

// 404 handler
app.use(notFound);

// Error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;