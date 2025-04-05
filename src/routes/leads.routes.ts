import express from 'express';
import { getLeads, getLeadById, getLeadsByUrl } from '../controllers/leads.controller';

const router = express.Router();

// Get all leads
router.get('/', getLeads);

// Get a lead by ID
router.get('/:id', getLeadById);

// Get a lead by LinkedIn URL
router.get('/url/:url', getLeadsByUrl);

export default router;