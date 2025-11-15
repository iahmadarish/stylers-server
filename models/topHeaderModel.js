// models/topHeaderModel.js
import mongoose from 'mongoose';

const topHeaderSchema = new mongoose.Schema({
  scrollingTexts: [{
    text: {
      type: String,
      required: true
    },
    emoji: {
      type: String,
      default: ''
    },
    isActive: {
      type: Boolean,
      default: true
    },
    order: {
      type: Number,
      default: 0
    }
  }],
  contactInfo: {
    phone: {
      type: String,
      required: true,
      default: '+8809613002024'
    },
    email: {
      type: String,
      required: true,
      default: 'support@paarel.com'
    },
    bulkOrderLink: {
      type: String,
      default: '/stylers-outfit-corporate-sales'
    }
  },
  country: {
    flag: {
      type: String,
      default: 'https://cdn.countryflags.com/thumbs/bangladesh/flag-wave-250.png'
    },
    code: {
      type: String,
      default: 'BD'
    },
    name: {
      type: String,
      default: 'Bangladesh'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const TopHeader = mongoose.model('TopHeader', topHeaderSchema);

export default TopHeader;