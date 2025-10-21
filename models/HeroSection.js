import mongoose from 'mongoose';

const heroSlideSchema = new mongoose.Schema({
  title: {
    type: String,
    default: ""
  },
  subtitle: {
    type: String,
    required: true,
    default: "Shop Now"
  },
  year: {
    type: String,
    default: ""
  },
  description: {
    type: String,
    default: ""
  },
  desktopImage: {
    type: String,
    required: true
  },
  mobileImage: {
    type: String,
    default: ""
  },
  category: {
    type: String,
    required: true,
    enum: ['men', 'women', 'kids', 'unisex']
  },
  link: {
    type: String,
    required: true
  },
  metaTitle: {
    type: String,
    default: ""
  },
  metaDescription: {
    type: String,
    default: ""
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

const HeroSlide = mongoose.model('HeroSlide', heroSlideSchema);

export default HeroSlide;