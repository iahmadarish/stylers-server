// models/CouponUsage.js
import mongoose from "mongoose";

const couponUsageSchema = new mongoose.Schema({
  coupon: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coupon',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },
  discountAmount: {
    type: Number,
    required: true
  },
  appliedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

export default mongoose.model('CouponUsage', couponUsageSchema);