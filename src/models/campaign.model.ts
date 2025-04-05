import mongoose, { Document, Schema } from 'mongoose';

export interface ICampaign extends Document {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive' | 'deleted';
  leads: string[];  // Array of LinkedIn URLs
  accountIDs: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
  // Helper method for getting enriched leads
  getEnrichedLeads(): Promise<any[]>;
}

const campaignSchema = new Schema<ICampaign>(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    status: { 
      type: String, 
      enum: ['active', 'inactive', 'deleted'], 
      default: 'active' 
    },
    leads: { type: [String], default: [] },  // LinkedIn URLs
    accountIDs: { type: [Schema.Types.ObjectId], default: [] },
  },
  { timestamps: true }
);

// Method to get leads with their enriched data
campaignSchema.methods.getEnrichedLeads = async function() {
  // This method will be available on Campaign document instances
  const LeadData = mongoose.model('LeadData');
  
  // No need to process if no leads
  if (this.leads.length === 0) return [];
  
  // Get lead data for all URLs in this campaign
  const leadsData = await LeadData.find({ 
    linkedInUrl: { $in: this.leads } 
  });
  
  // Create a map for quick lookups
  const leadDataMap = new Map();
  leadsData.forEach(leadData => {
    leadDataMap.set(leadData.linkedInUrl, leadData);
  });
  
  // Return all leads with their data (if available)
  // Define an interface for enriched lead data
  interface EnrichedLead {
    linkedInUrl: string;
    enriched: boolean;
    data: any | null;
  }

  return this.leads.map((url: string): EnrichedLead => {
    const data = leadDataMap.get(url);
    return {
      linkedInUrl: url,
      enriched: !!data,
      data: data || null
    };
  });
};
campaignSchema.virtual('id').get(function() {
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

export default mongoose.model<ICampaign>('Campaign', campaignSchema);