import mongoose from 'mongoose';

const trendingOfferSchema = new mongoose.Schema({
  brand: {
    type: String,
    required: true,
    trim: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  discount: {
    type: String,
    required: true,
    trim: true
  },
  image: {
    type: String,
    required: true
  },
  link: {
    type: String,
    required: true
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

const TrendingOffer = mongoose.model('TrendingOffer', trendingOfferSchema);

export default TrendingOffer;