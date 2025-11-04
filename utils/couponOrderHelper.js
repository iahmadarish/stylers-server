// utils/couponOrderHelper.js
import Coupon from "../models/Coupon.js";
import CouponUsage from "../models/CouponUsage.js";
import { validateCouponLogic } from "./couponValidator.js";

/**
 * Calculate cart totals with coupon discount
 */
export const calculateCartWithCoupon = async (cart, couponCode, userId) => {
  try {
    let coupon = null;
    let couponDiscount = 0;
    let finalAmount = cart.finalAmount || 0;
    let discountAmount = 0;

    // If coupon code provided, validate and calculate discount
    if (couponCode) {
      coupon = await Coupon.findOne({ 
        code: couponCode.toUpperCase(), 
        isActive: true 
      });

      if (coupon) {
        // Validate coupon logic
        const validation = await validateCouponLogic(
          coupon, 
          userId, 
          finalAmount, 
          'web'
        );

        if (validation.valid) {
          couponDiscount = validation.discountAmount;
          discountAmount = validation.discountAmount;
          finalAmount = validation.finalAmount;
        } else {
          throw new Error(validation.message);
        }
      } else {
        throw new Error("Invalid coupon code");
      }
    }

    return {
      subtotal: cart.totalBaseAmount || 0,
      cartDiscount: cart.totalDiscountAmount || 0,
      couponDiscount,
      discountAmount,
      finalAmount,
      coupon,
      isValid: coupon ? true : false
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Apply coupon to order items and recalculate totals
 */
export const applyCouponToOrderItems = (orderItems, coupon, existingDiscount = 0) => {
  if (!coupon) return orderItems;

  let totalCouponDiscount = 0;
  const updatedItems = orderItems.map(item => {
    let itemCouponDiscount = 0;
    
    if (coupon.discountType === 'percentage') {
      // Apply percentage discount to item's discounted price
      itemCouponDiscount = (item.totalDiscountedPrice * coupon.value) / 100;
    } else if (coupon.discountType === 'fixed') {
      // Distribute fixed discount proportionally across items
      const itemRatio = item.totalDiscountedPrice / orderItems.reduce((sum, i) => sum + i.totalDiscountedPrice, 0);
      itemCouponDiscount = coupon.value * itemRatio;
    }

    // Check total discount limit (50% rule)
    const itemTotalDiscountPercentage = ((item.discountAmount + itemCouponDiscount) / item.totalOriginalPrice) * 100;
    if (itemTotalDiscountPercentage > 50) {
      // Adjust coupon discount to not exceed 50% total discount
      const maxAllowedDiscount = (item.totalOriginalPrice * 0.5) - item.discountAmount;
      itemCouponDiscount = Math.max(0, maxAllowedDiscount);
    }

    itemCouponDiscount = Math.min(itemCouponDiscount, item.totalDiscountedPrice);

    const updatedItem = {
      ...item,
      couponDiscount: itemCouponDiscount,
      finalPrice: item.totalDiscountedPrice - itemCouponDiscount
    };

    totalCouponDiscount += itemCouponDiscount;
    return updatedItem;
  });

  return {
    items: updatedItems,
    totalCouponDiscount
  };
};

/**
 * Record coupon usage
 */
export const recordCouponUsage = async (couponId, userId, orderId, discountAmount) => {
  try {
    const couponUsage = new CouponUsage({
      coupon: couponId,
      user: userId,
      order: orderId,
      discountAmount
    });
    await couponUsage.save();

    // Update coupon used count
    await Coupon.findByIdAndUpdate(couponId, {
      $inc: { usedCount: 1 },
      $addToSet: { usersUsed: userId }
    });

    return couponUsage;
  } catch (error) {
    throw error;
  }
};

/**
 * Validate coupon for order placement
 */
export const validateCouponForOrder = async (couponCode, userId, orderAmount, existingDiscount = 0) => {
  try {
    const coupon = await Coupon.findOne({ 
      code: couponCode.toUpperCase(), 
      isActive: true 
    });

    if (!coupon) {
      throw new Error("Invalid coupon code");
    }

    // Validate coupon logic
    const validation = await validateCouponLogic(coupon, userId, orderAmount, 'web');
    
    if (!validation.valid) {
      throw new Error(validation.message);
    }

    // Check total discount limit (50% rule)
    if (coupon.discountType === 'percentage') {
      const totalDiscount = existingDiscount + coupon.value;
      if (totalDiscount > 50) {
        const maxCouponDiscount = 50 - existingDiscount;
        throw new Error(`Total discount cannot exceed 50%. You can get maximum ${maxCouponDiscount}% coupon discount`);
      }
    }

    return {
      coupon,
      discountAmount: validation.discountAmount,
      finalAmount: validation.finalAmount,
      isValid: true
    };
  } catch (error) {
    throw error;
  }
};