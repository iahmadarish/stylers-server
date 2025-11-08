// models/Quote.js
import mongoose from 'mongoose';

const quoteSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    maxlength: 100
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    match: [/^[0-9+]{11,14}$/, 'Please enter a valid phone number']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  company: {
    type: String,
    trim: true,
    maxlength: 100
  },
  address: {
    type: String,
    trim: true,
    maxlength: 500
  },
  productType: {
    type: String,
    required: [true, 'Product type is required'],
    trim: true,
    maxlength: 100
  },
  deliveryDate: {
    type: Date
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: 1
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: 2000
  },
  status: {
    type: String,
    enum: ['new', 'reviewed', 'quoted', 'accepted', 'rejected'],
    default: 'new'
  }
}, {
  timestamps: true
});

// Create indexes
quoteSchema.index({ email: 1, createdAt: -1 });
quoteSchema.index({ status: 1 });

const Quote = mongoose.model('Quote', quoteSchema);
export default Quote;