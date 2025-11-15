// utils/couponValidator.js
import CouponUsage from "../models/CouponUsage.js";

// utils/couponValidator.js
export const validateCouponLogic = async (coupon, userId, orderAmount, channel) => {
  const now = new Date();

  // Check expiry
  if (now > new Date(coupon.expiryDate)) {
    return { valid: false, message: "Coupon has expired" };
  }

  // Check validation time range
  if (coupon.validationTime && coupon.validationTime.startDate && coupon.validationTime.endDate) {
    if (now < new Date(coupon.validationTime.startDate) || now > new Date(coupon.validationTime.endDate)) {
      return { valid: false, message: "Coupon is not valid at this time" };
    }
  }

  // Check usage limit
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
    return { valid: false, message: "Coupon usage limit reached" };
  }

  // Check channel
  if (coupon.channels && coupon.channels.length > 0 && !coupon.channels.includes(channel)) {
    return { valid: false, message: "Coupon not valid for this channel" };
  }

  // Check per user limit
  if (userId && coupon.perUserLimit) {
    const userUsageCount = await CouponUsage.countDocuments({
      coupon: coupon._id,
      user: userId
    });
    if (userUsageCount >= coupon.perUserLimit) {
      return { valid: false, message: "You have already used this coupon" };
    }
  }

  // ✅ IMPROVED: Check minimum order amount with better message
  if (coupon.minOrderAmount && orderAmount < coupon.minOrderAmount) {
    return { 
      valid: false, 
      message: `Minimum order amount ৳${coupon.minOrderAmount} required. Your current order amount is ৳${orderAmount.toFixed(2)}` 
    };
  }

  // Calculate discount
  let discountAmount = 0;
  let finalAmount = orderAmount;
  
  if (coupon.discountType === 'percentage') {
    discountAmount = (orderAmount * coupon.value) / 100;
    if (coupon.maxDiscountAmount) {
      discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
    }
  } else {
    discountAmount = Math.min(coupon.value, orderAmount);
  }

  // Apply custom options
  if (coupon.customOption === 'free-delivery') {
    // This will be handled in order calculation
    discountAmount += 0; // Delivery charge will be subtracted separately
  } else if (coupon.customOption === 'round-total') {
    finalAmount = Math.round(orderAmount - discountAmount);
    discountAmount = orderAmount - finalAmount;
  } else {
    finalAmount = orderAmount - discountAmount;
  }

  return {
    valid: true,
    discountAmount,
    finalAmount,
    coupon
  };
};

export const validateTotalDiscount = (existingDiscountPercent, couponDiscountPercent) => {
  const totalDiscount = existingDiscountPercent + couponDiscountPercent;
  return totalDiscount <= 50;
};