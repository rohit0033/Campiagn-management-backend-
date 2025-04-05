import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
// import { errorHandler } from '../middleware/error.middleware';

// Assuming LeadData is your model name based on your file structure
const LeadData = mongoose.model('LeadData');

export const getLeads = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const leads = await LeadData.find();
    res.status(200).json(leads);
  } catch (error:any) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const getLeadById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const lead = await LeadData.findById(req.params.id);
    if (!lead) {
        res.status(404).json({ message: 'Lead not found' });
        return;
    }
    res.status(200).json(lead);
  } catch (error:any) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const getLeadsByUrl = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url } = req.params;
    const lead = await LeadData.findOne({ linkedInUrl: url });
    if (!lead) {
        res.status(404).json({ message: 'Lead not found' });
        return;
    }
    res.status(200).json(lead);
  } catch (error:any) {
    res.status(500).json({ message: 'Server error', error: error.message });
    }
};