import mongoose from "mongoose";

const featureSchema = new mongoose.Schema({
  subtitle: {
    type: String,
    required: true
  },
  points: [{
    type: String
  }]
}, { _id: false });

const productHighlightSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  details: {
    type: String,
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  productLink: {
    type: String,
    default: ''
  },
  highlightFeatures: [featureSchema]
}, { _id: false });

const blogSchema = new mongoose.Schema({
  metaTitle: {
    type: String,
    required: true,
    trim: true,
    maxlength: 60
  },
  metaDescription: {
    type: String,
    required: true,
    trim: true,
    maxlength: 160
  },
  blogTitle: {
    type: String,
    required: true,
    trim: true
  },
  blogContent: [{
    type: String
  }],
  productsHighlight: [productHighlightSchema],
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true
  },
  category: {
    type: String,
    default: 'Fashion'
  },
  tags: [String],
  author: {
    type: String,
    default: 'Admin'
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  featuredImage: {
    type: String,
    default: ''
  },
  views: {
    type: Number,
    default: 0
  },
  faq: [{
    question: String,
    answer: String
  }]
}, {
  timestamps: true
});

blogSchema.pre('save', function(next) {
  if (this.isModified('blogTitle')) {
    this.slug = this.blogTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

export default mongoose.model('Blog', blogSchema);