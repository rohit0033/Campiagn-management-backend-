"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLeadsByUrl = exports.getLeadById = exports.getLeads = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
// import { errorHandler } from '../middleware/error.middleware';
// Assuming LeadData is your model name based on your file structure
const LeadData = mongoose_1.default.model('LeadData');
const getLeads = async (req, res, next) => {
    try {
        const leads = await LeadData.find();
        res.status(200).json(leads);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
exports.getLeads = getLeads;
const getLeadById = async (req, res, next) => {
    try {
        const lead = await LeadData.findById(req.params.id);
        if (!lead) {
            res.status(404).json({ message: 'Lead not found' });
            return;
        }
        res.status(200).json(lead);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
exports.getLeadById = getLeadById;
const getLeadsByUrl = async (req, res, next) => {
    try {
        const { url } = req.params;
        const lead = await LeadData.findOne({ linkedInUrl: url });
        if (!lead) {
            res.status(404).json({ message: 'Lead not found' });
            return;
        }
        res.status(200).json(lead);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
exports.getLeadsByUrl = getLeadsByUrl;
