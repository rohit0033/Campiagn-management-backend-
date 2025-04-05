"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCampaign = exports.updateCampaign = exports.getCampaignById = exports.getCampaigns = exports.createCampaign = void 0;
const campaign_model_1 = __importDefault(require("../models/campaign.model"));
const mongoose_1 = __importDefault(require("mongoose"));
// Create a campaign
const createCampaign = async (req, res) => {
    try {
        const { name, description, status, leads, accountIDs } = req.body;
        const campaign = new campaign_model_1.default({
            name,
            description,
            status,
            leads,
            accountIDs: accountIDs.map((id) => new mongoose_1.default.Types.ObjectId(id))
        });
        const savedCampaign = await campaign.save();
        res.status(201).json(savedCampaign);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
exports.createCampaign = createCampaign;
// Get all campaigns (excluding deleted ones)
const getCampaigns = async (_req, res) => {
    try {
        const campaigns = await campaign_model_1.default.find({ status: { $ne: 'deleted' } });
        res.status(200).json(campaigns);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
exports.getCampaigns = getCampaigns;
// Get campaign by ID
const getCampaignById = async (req, res) => {
    try {
        const campaign = await campaign_model_1.default.findOne({
            _id: req.params.id,
            status: { $ne: 'deleted' }
        });
        if (!campaign) {
            res.status(404).json({ message: 'Campaign not found' });
            return;
        }
        res.status(200).json(campaign);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
exports.getCampaignById = getCampaignById;
// Update campaign
const updateCampaign = async (req, res) => {
    try {
        const campaign = await campaign_model_1.default.findOneAndUpdate({ _id: req.params.id, status: { $ne: 'deleted' } }, req.body, { new: true });
        if (!campaign) {
            res.status(404).json({ message: 'Campaign not found' });
            return;
        }
        res.status(200).json(campaign);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
exports.updateCampaign = updateCampaign;
// Soft delete campaign
const deleteCampaign = async (req, res) => {
    try {
        const campaign = await campaign_model_1.default.findOneAndUpdate({ _id: req.params.id, status: { $ne: 'deleted' } }, { status: 'deleted' }, { new: true });
        if (!campaign) {
            res.status(404).json({ message: 'Campaign not found' });
            return;
        }
        res.status(200).json({ message: 'Campaign deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
exports.deleteCampaign = deleteCampaign;
