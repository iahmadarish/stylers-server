// models/PromotionalCampaign.js
import mongoose from 'mongoose';

const promotionalCampaignSchema = new mongoose.Schema({
  targetCategory: {
    type: String,
    required: true,
    enum: ['men', 'women', 'kids'],
    trim: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  altText: {
    type: String,
    required: true,
    trim: true
  },
  imageUrl: {
    type: String,
    required: true,
    trim: true
  },
  categorySlug: {
    type: String,
    required: true,
    trim: true
  },
  gradient: {
    type: String,
    default: 'from-blue-50 to-indigo-50',
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    default: 0
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: false
  }
}, {
  timestamps: true
});

// Index for better query performance
promotionalCampaignSchema.index({ targetCategory: 1, isActive: 1, order: 1 });

const PromotionalCampaign = mongoose.model('PromotionalCampaign', promotionalCampaignSchema);

export default PromotionalCampaign;