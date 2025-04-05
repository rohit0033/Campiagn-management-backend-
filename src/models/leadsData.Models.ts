import mongoose, { Document, Schema } from 'mongoose';

export interface ILeadData extends Document {
  linkedInUrl: string;  // Primary key - matches URLs in campaign.leads
  name: string | null;
  description: string | null;
  jobTitle: string | null;
  currentCompany: string | null;
  location: string | null;
  summary: string | null;
  email?: string;
  createdAt: Date;
  updatedAt: Date;
}

const leadDataSchema = new Schema<ILeadData>(
  {
    linkedInUrl: { 
      type: String, 
      required: true, 
      unique: true,
      index: true  // Index for faster lookups
    },
    name: { type: String },
    description: { type: String },
    jobTitle: { type: String },
    currentCompany: { type: String },
    location: { type: String },
    summary: { type: String },
    email: { type: String }
  },
  { timestamps: true }
);

// Static method to find leads for a campaign
leadDataSchema.statics.findForCampaign = async function(campaignId: string | mongoose.Types.ObjectId) {
  const Campaign = mongoose.model('Campaign');
  
  // Get the campaign
  const campaign = await Campaign.findById(campaignId);
  if (!campaign) return [];
  
  // Find lead data for the campaign's URLs
  return await this.find({ linkedInUrl: { $in: campaign.leads } });
};
leadDataSchema.virtual('id').get(function() {
  const id = this._id;
  return id ? id.toString() : null;
});

leadDataSchema.set('toJSON', { 
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

export default mongoose.model<ILeadData>('LeadData', leadDataSchema);