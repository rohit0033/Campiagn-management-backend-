"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const campaignSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    status: {
        type: String,
        enum: ['active', 'inactive', 'deleted'],
        default: 'active'
    },
    leads: { type: [String], default: [] }, // LinkedIn URLs
    accountIDs: { type: [mongoose_1.Schema.Types.ObjectId], default: [] },
}, { timestamps: true });
// Method to get leads with their enriched data
campaignSchema.methods.getEnrichedLeads = async function () {
    // This method will be available on Campaign document instances
    const LeadData = mongoose_1.default.model('LeadData');
    // No need to process if no leads
    if (this.leads.length === 0)
        return [];
    // Get lead data for all URLs in this campaign
    const leadsData = await LeadData.find({
        linkedInUrl: { $in: this.leads }
    });
    // Create a map for quick lookups
    const leadDataMap = new Map();
    leadsData.forEach(leadData => {
        leadDataMap.set(leadData.linkedInUrl, leadData);
    });
    return this.leads.map((url) => {
        const data = leadDataMap.get(url);
        return {
            linkedInUrl: url,
            enriched: !!data,
            data: data || null
        };
    });
};
campaignSchema.virtual('id').get(function () {
    const id = this._id;
    return id ? id.toString() : null;
});
campaignSchema.set('toJSON', {
    virtuals: true,
    transform: (doc, ret) => {
        if (ret._id) {
            ret.id = ret._id.toString();
        }
        delete ret._id;
        delete ret.__v;
        return ret;
    }
});
exports.default = mongoose_1.default.model('Campaign', campaignSchema);
