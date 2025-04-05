import { Request, Response } from 'express';
import Campaign, { ICampaign } from '../models/campaign.model';
import mongoose from 'mongoose';

// Create a campaign
export const createCampaign = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, status, leads, accountIDs } = req.body;
    
    const campaign = new Campaign({
      name,
      description,
      status,
      leads,
      accountIDs: accountIDs.map((id: string) => new mongoose.Types.ObjectId(id))
    });
    
    const savedCampaign = await campaign.save();
    
    res.status(201).json(savedCampaign);
  } catch (error:any) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get all campaigns (excluding deleted ones)
export const getCampaigns = async (_req: Request, res: Response): Promise<void> => {
  try {
    const campaigns = await Campaign.find({ status: { $ne: 'deleted' } });
    res.status(200).json(campaigns);
  } catch (error:any) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get campaign by ID
export const getCampaignById = async (req: Request, res: Response): Promise<void> => {
  try {
    const campaign = await Campaign.findOne({ 
      _id: req.params.id,
      status: { $ne: 'deleted' }
    });
    
    if (!campaign) {
      res.status(404).json({ message: 'Campaign not found' });
      return;
    }
    
    res.status(200).json(campaign);
  } catch (error:any) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update campaign
export const updateCampaign = async (req: Request, res: Response): Promise<void> => {
  try {
    const campaign = await Campaign.findOneAndUpdate(
      { _id: req.params.id, status: { $ne: 'deleted' } },
      req.body,
      { new: true }
    );
    
    if (!campaign) {
      res.status(404).json({ message: 'Campaign not found' });
      return;
    }
    
    res.status(200).json(campaign);
  } catch (error:any) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Soft delete campaign
export const deleteCampaign = async (req: Request, res: Response): Promise<void> => {
  try {
    const campaign = await Campaign.findOneAndUpdate(
      { _id: req.params.id, status: { $ne: 'deleted' } },
      { status: 'deleted' },
      { new: true }
    );
    
    if (!campaign) {
      res.status(404).json({ message: 'Campaign not found' });
      return;
    }
    
    res.status(200).json({ message: 'Campaign deleted successfully' });
  } catch (error:any) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};