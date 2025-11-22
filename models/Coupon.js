// models/Coupon.js
import mongoose from "mongoose";

const couponSchema = new mongoose.Schema({
  // Basic Information
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^[A-Z0-9]+$/.test(v);
      },
      message: 'Coupon code should contain only uppercase letters and numbers'
    }
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  
  // Coupon Type & Discount
  type: {
    type: String,
    enum: ['Management', 'Employee', 'Influencer', 'Custom'],
    required: true
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true
  },
  value: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: function(v) {
        if (this.discountType === 'percentage') {
          return v >= 0 && v <= 100;
        }
        return v >= 0;
      },
      message: 'Percentage discount must be between 0-100, fixed discount must be positive'
    }
  },
  
  // Validity & Limits
  expiryDate: {
    type: Date,
    required: true,
    validate: {
      validator: function(v) {
        return v > new Date();
      },
      message: 'Expiry date must be in the future'
    }
  },
  usageLimit: {
    type: Number,
    default: null,
    min: 1
  },
  usedCount: {
    type: Number,
    default: 0,
    min: 0
  },
  perUserLimit: {
    type: Number,
    default: 1,
    min: 1
  },
  
  // Validation Rules
  validationTime: {
  startDate: {
    type: Date,
    validate: {
      validator: function(v) {
        if (!v) return true;
        // Get expiry date from the document or update data
        const expiryDate = this.expiryDate || (this._update && this._update.$set && this._update.$set.expiryDate);
        if (!expiryDate) return true;
        return v < new Date(expiryDate);
      },
      message: 'Validation start date must be before expiry date'
    }
  },
  endDate: {
    type: Date,
    validate: {
      validator: function(v) {
        if (!v) return true;
        
        // Get dates from various possible sources
        const expiryDate = this.expiryDate || (this._update && this._update.$set && this._update.$set.expiryDate);
        const startDate = this.validationTime?.startDate || 
                         (this._update && this._update.$set && this._update.$set['validationTime.startDate']);
        
        if (!expiryDate) return true;
        
        const isBeforeExpiry = v <= new Date(expiryDate);
        const isAfterStart = !startDate || v >= new Date(startDate);
        
        return isBeforeExpiry && isAfterStart;
      },
      message: 'Validation end date must be between start date and expiry date'
    }
  }
},
  
  // Channels & Custom Options
  channels: [{
    type: String,
    enum: ['web', 'in-store', 'f-commerce'],
    default: ['web']
  }],
  customOption: {
    type: String,
    enum: ['free-delivery', 'round-total', null],
    default: null
  },
  
  // Discount Limits
  maxDiscountAmount: {
    type: Number,
    min: 0,
    validate: {
      validator: function(v) {
        if (this.discountType === 'fixed' && v) {
          return v <= this.value;
        }
        return true;
      },
      message: 'Max discount amount cannot exceed fixed discount value'
    }
  },
  minOrderAmount: {
    type: Number,
    min: 0,
    default: 0
  },
  
  // Usage Tracking
  usersUsed: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Admin Management Fields
  applicableCategories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }],
  
  excludedProducts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  
  customerGroups: [{
    type: String,
    enum: ['new_customers', 'existing_customers', 'vip', 'all'],
    default: ['all']
  }],
  
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  notes: {
    type: String,
    maxlength: 500
  },
  
  // Auto-expire feature
  autoExpire: {
    type: Boolean,
    default: false
  },
  
  // Notification settings
  notifyOnExpiry: {
    type: Boolean,
    default: false
  },
  
  notifyOnLimit: {
    type: Boolean,
    default: false
  },
  
  limitThreshold: {
    type: Number,
    default: 10
  },

  // Campaign association
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign'
  },

  // Priority level for multiple coupons
  priority: {
    type: Number,
    default: 1,
    min: 1,
    max: 10
  }

}, { 
  timestamps: true 
});

// Indexes for better performance
couponSchema.index({ code: 1 });
couponSchema.index({ type: 1 });
couponSchema.index({ expiryDate: 1 });
couponSchema.index({ isActive: 1 });
couponSchema.index({ createdBy: 1 });
couponSchema.index({ campaignId: 1 });

// Pre-save middleware to ensure channels array is not empty
couponSchema.pre('save', function(next) {
  if (this.channels.length === 0) {
    this.channels = ['web'];
  }
  next();
});

// Virtual for remaining usage
couponSchema.virtual('remainingUsage').get(function() {
  if (!this.usageLimit) return 'Unlimited';
  return Math.max(0, this.usageLimit - this.usedCount);
});

// Virtual for isExpired
couponSchema.virtual('isExpired').get(function() {
  return new Date() > this.expiryDate;
});

// Virtual for canUse (combines multiple checks)
couponSchema.virtual('canUse').get(function() {
  if (!this.isActive) return false;
  if (this.isExpired) return false;
  if (this.usageLimit && this.usedCount >= this.usageLimit) return false;
  if (this.validationTime.startDate && new Date() < this.validationTime.startDate) return false;
  if (this.validationTime.endDate && new Date() > this.validationTime.endDate) return false;
  return true;
});

// Method to check if user can use this coupon
couponSchema.methods.canUserUse = function(userId) {
  if (!this.canUse) return false;
  
  // Check per user limit - Removed the redundant/faulty 'includes' check
  if (this.perUserLimit) { 
    // ✅ FIX: .filter() ব্যবহার করে নির্দিষ্ট userId কতবার আছে তা গণনা করা হচ্ছে।
    // id && id.equals(userId) চেকটি নিশ্চিত করে যে id ভ্যালুটি null নয় এবং এটি Mongoose ObjectId-এর সাথে সঠিকভাবে তুলনা করছে।
    const userUsageCount = this.usersUsed.filter(id => 
        id && id.equals(userId)
    ).length;
    
    console.log(`User ${userId} usage count: ${userUsageCount}. Limit: ${this.perUserLimit}`);
    
    if (userUsageCount >= this.perUserLimit) {
        // যদি ব্যবহারের সীমা অতিক্রম করে
        return false;
    }
  }
  
  return true;
};

couponSchema.methods.applyCoupon = async function(userId, orderAmount) {
  if (!this.canUserUse(userId)) {
    throw new Error('Coupon cannot be used');
  }
  let discountAmount = 0;
  
  if (this.discountType === 'percentage') {
    discountAmount = (orderAmount * this.value) / 100;
    if (this.maxDiscountAmount) {
      discountAmount = Math.min(discountAmount, this.maxDiscountAmount);
    }
  } else {
    discountAmount = Math.min(this.value, orderAmount);
  }
  if (this.customOption === 'round-total') {
    const finalAmount = orderAmount - discountAmount;
    discountAmount = orderAmount - Math.round(finalAmount);
  }
  this.usedCount += 1;
  this.usersUsed.push(userId);
  await this.save();

  return {
    discountAmount,
    finalAmount: orderAmount - discountAmount,
    applied: true
  };
};

// Static method to find valid coupons
couponSchema.statics.findValidCoupons = function() {
  return this.find({
    isActive: true,
    expiryDate: { $gt: new Date() },
    $or: [
      { usageLimit: null },
      { usageLimit: { $gt: 0 } }
    ]
  });
};

// Static method to cleanup expired coupons
couponSchema.statics.cleanupExpired = function() {
  return this.updateMany(
    { 
      expiryDate: { $lt: new Date() },
      isActive: true 
    },
    { 
      isActive: false 
    }
  );
};

export default mongoose.model('Coupon', couponSchema);