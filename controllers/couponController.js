// controllers/couponController.js
import Coupon from "../models/Coupon.js";
import CouponUsage from "../models/CouponUsage.js";
import { validateCouponLogic, validateTotalDiscount } from "../utils/couponValidator.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/appError.js";

// Create new coupon
export const createCoupon = catchAsync(async (req, res, next) => {
  const {
    code,
    name,
    description,
    type,
    discountType,
    value,
    expiryDate,
    usageLimit,
    perUserLimit = 1,
    validationTime,
    channels = ['web'],
    customOption = null,
    maxDiscountAmount,
    minOrderAmount,
    isActive = true
  } = req.body;

  console.log('🔄 Creating coupon with data:', req.body);

  try {
    // Check if coupon code already exists
    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (existingCoupon) {
      console.log('❌ Coupon code already exists:', code);
      return res.status(400).json({
        success: false,
        message: "Coupon code already exists"
      });
    }

    // Validate discount value
    if (discountType === 'percentage' && (value < 0 || value > 100)) {
      return res.status(400).json({
        success: false,
        message: "Percentage discount must be between 0 and 100"
      });
    }

    if (discountType === 'fixed' && value < 0) {
      return res.status(400).json({
        success: false,
        message: "Fixed discount amount must be positive"
      });
    }

    const coupon = new Coupon({
      code: code.toUpperCase(),
      name,
      description,
      type,
      discountType,
      value,
      expiryDate: new Date(expiryDate),
      usageLimit,
      perUserLimit,
      validationTime,
      channels,
      customOption,
      maxDiscountAmount,
      minOrderAmount,
      isActive,
      createdBy: req.user._id
    });

    console.log('💾 Saving coupon to database...');
    await coupon.save();
    console.log('✅ Coupon saved successfully:', coupon._id);
    
    res.status(201).json({
      success: true,
      message: "Coupon created successfully",
      data: coupon
    });
    
  } catch (error) {
    console.error('❌ Error creating coupon:', error);
    res.status(500).json({
      success: false,
      message: "Error creating coupon: " + error.message
    });
  }
});

// Get all coupons with pagination and filtering
export const getCoupons = catchAsync(async (req, res, next) => {
  const {
    page = 1,
    limit = 10,
    search = "",
    type = "",
    isActive = ""
  } = req.query;

  const query = {};

  if (search) {
    query.$or = [
      { code: { $regex: search, $options: 'i' } },
      { name: { $regex: search, $options: 'i' } }
    ];
  }

  if (type) {
    query.type = type;
  }

  if (isActive !== '') {
    query.isActive = isActive === 'true';
  }

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    sort: { createdAt: -1 }
  };

  const coupons = await Coupon.find(query)
    .limit(options.limit * 1)
    .skip((options.page - 1) * options.limit)
    .sort(options.sort);

  const total = await Coupon.countDocuments(query);

  res.json({
    success: true,
    data: coupons,
    pagination: {
      current: options.page,
      totalPages: Math.ceil(total / options.limit),
      totalItems: total,
      itemsPerPage: options.limit
    }
  });
});

// Get single coupon by ID
export const getCouponById = catchAsync(async (req, res, next) => {
  const coupon = await Coupon.findById(req.params.id);

  if (!coupon) {
    return next(new AppError("Coupon not found", 404));
  }

  res.json({
    success: true,
    data: coupon
  });
});

// Get coupon by code
export const getCouponByCode = catchAsync(async (req, res, next) => {
  const { code } = req.params;

  const coupon = await Coupon.findOne({ code: code.toUpperCase() });

  if (!coupon) {
    return next(new AppError("Coupon not found", 404));
  }

  res.json({
    success: true,
    data: coupon
  });
});

// Update coupon
export const updateCoupon = catchAsync(async (req, res, next) => {
  const {
    code,
    name,
    description,
    type,
    discountType,
    value,
    expiryDate,
    usageLimit,
    perUserLimit,
    validationTime,
    channels,
    customOption,
    maxDiscountAmount,
    minOrderAmount,
    isActive
  } = req.body;

  console.log('🔄 Updating coupon with ID:', req.params.id);
  console.log('📦 Update data:', req.body);

  try {
    // Check if code already exists (excluding current coupon)
    if (code) {
      const existingCoupon = await Coupon.findOne({ 
        code: code.toUpperCase(), 
        _id: { $ne: req.params.id } 
      });
      
      if (existingCoupon) {
        console.log('❌ Coupon code already exists:', code);
        return res.status(400).json({
          success: false,
          message: "Coupon code already exists"
        });
      }
    }

    // Validate discount value
    if (discountType === 'percentage' && (value < 0 || value > 100)) {
      return res.status(400).json({
        success: false,
        message: "Percentage discount must be between 0 and 100"
      });
    }

    if (discountType === 'fixed' && value < 0) {
      return res.status(400).json({
        success: false,
        message: "Fixed discount amount must be positive"
      });
    }

    const updateData = {
      ...(code && { code: code.toUpperCase() }),
      name,
      description,
      type,
      discountType,
      value,
      expiryDate: new Date(expiryDate),
      usageLimit,
      perUserLimit,
      validationTime,
      channels,
      customOption,
      maxDiscountAmount,
      minOrderAmount,
      isActive
    };

    console.log('💾 Update data to save:', updateData);

    const coupon = await Coupon.findByIdAndUpdate(
      req.params.id,
      updateData,
      { 
        new: true, 
        runValidators: true 
      }
    );

    if (!coupon) {
      console.log('❌ Coupon not found with ID:', req.params.id);
      return res.status(404).json({
        success: false,
        message: "Coupon not found"
      });
    }

    console.log('✅ Coupon updated successfully:', coupon._id);
    
    res.status(200).json({
      success: true,
      message: "Coupon updated successfully",
      data: coupon
    });

  } catch (error) {
    console.error('❌ Error updating coupon:', error);
    res.status(500).json({
      success: false,
      message: "Error updating coupon: " + error.message
    });
  }
});

// Delete coupon
export const deleteCoupon = catchAsync(async (req, res, next) => {
  const coupon = await Coupon.findByIdAndDelete(req.params.id);

  if (!coupon) {
    return next(new AppError("Coupon not found", 404));
  }

  // Also delete related coupon usage records
  await CouponUsage.deleteMany({ coupon: req.params.id });

  res.json({
    success: true,
    message: "Coupon deleted successfully"
  });
});

// Validate coupon
// export const validateCoupon = catchAsync(async (req, res, next) => {
//   const { code, userId, orderAmount, channel = 'web', existingDiscount = 0 } = req.body;
  
//   const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });
  
//   if (!coupon) {
//     return next(new AppError("Invalid coupon code", 404));
//   }

//   // Validation logic
//   const validation = await validateCouponLogic(coupon, userId, orderAmount, channel);
  
//   if (!validation.valid) {
//     return next(new AppError(validation.message, 400));
//   }

//   // ✅ IMPORTANT FIX: Check total discount limit (50% rule) with existing discount
//   if (coupon.discountType === 'percentage') {
//     const totalDiscount = existingDiscount + coupon.value;
//     if (totalDiscount > 50) {
//       // Calculate maximum allowed coupon discount
//       const maxCouponDiscount = 50 - existingDiscount;
//       return next(new AppError(`Total discount cannot exceed 50%. You can get maximum ${maxCouponDiscount}% coupon discount`, 400));
//     }
//   }

//   res.json({ 
//     success: true, 
//     data: {
//       coupon,
//       discountAmount: validation.discountAmount,
//       finalAmount: validation.finalAmount,
//       // ✅ Additional info for frontend
//       totalDiscountPercentage: coupon.discountType === 'percentage' ? existingDiscount + coupon.value : existingDiscount
//     }
//   });
// });


// couponController.js - validateCoupon ফাংশনে
// couponController.js - validateCoupon ফাংশন
// export const validateCoupon = catchAsync(async (req, res, next) => {
//   const { code, userId, orderAmount, channel = 'web', existingDiscount = 0 } = req.body;
  
//   console.log('🎫 Coupon validation request:', {
//     code,
//     userId,
//     orderAmount,
//     channel,
//     existingDiscount
//   });

//   const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });
  
//   if (!coupon) {
//     console.log('❌ Coupon not found or inactive:', code);
//     return next(new AppError("Invalid coupon code", 404));
//   }

//   console.log('✅ Coupon found:', {
//     code: coupon.code,
//     minOrderAmount: coupon.minOrderAmount,
//     discountType: coupon.discountType,
//     value: coupon.value
//   });

//   // Validation logic
//   const validation = await validateCouponLogic(coupon, userId, orderAmount, channel);
  
//   if (!validation.valid) {
//     console.log('❌ Coupon validation failed:', validation.message);
//     return next(new AppError(validation.message, 400));
//   }

//   console.log('✅ Coupon validation passed');

//   // ✅ IMPORTANT FIX: Check total discount limit (50% rule) with existing discount
//   if (coupon.discountType === 'percentage') {
//     const totalDiscount = existingDiscount + coupon.value;
//     if (totalDiscount > 50) {
//       // Calculate maximum allowed coupon discount
//       const maxCouponDiscount = 50 - existingDiscount;
//       console.log('❌ Total discount exceeds 50% limit');
//       return next(new AppError(`Total discount cannot exceed 50%. You can get maximum ${maxCouponDiscount}% coupon discount`, 400));
//     }
//   }

//   console.log('🎉 Coupon validation successful, returning response');

//   res.json({ 
//     success: true, 
//     data: {
//       coupon,
//       discountAmount: validation.discountAmount,
//       finalAmount: validation.finalAmount,
//       // ✅ Additional info for frontend
//       totalDiscountPercentage: coupon.discountType === 'percentage' ? existingDiscount + coupon.value : existingDiscount
//     }
//   });
// });


// export const validateCoupon = catchAsync(async (req, res, next) => {
//   const { code, userId, orderAmount, channel = 'web', existingDiscount = 0 } = req.body;
  
//   console.log('🎫 Coupon validation request:', {
//     code,
//     userId,
//     orderAmount,
//     channel,
//     existingDiscount
//   });

//   const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });
  
//   if (!coupon) {
//     console.log('❌ Coupon not found or inactive:', code);
//     // 🛑 FIX: Use direct res.status().json() instead of AppError for validation
//     return res.status(404).json({
//         success: false,
//         message: "Invalid coupon code"
//     });
//   }

// if (!coupon.isActive) {
//     console.log('❌ Coupon found but not active:', code);
//     return res.status(400).json({
//         success: false,
//         message: "Coupon is not activated yet. Please try again later."
//     });
//   }

//   console.log('✅ Coupon found:', {
//     code: coupon.code,
//     minOrderAmount: coupon.minOrderAmount,
//     discountType: coupon.discountType,
//     value: coupon.value
//   });

//   // Validation logic
//   const validation = await validateCouponLogic(coupon, userId, orderAmount, channel);
  
//   if (!validation.valid) {
//     console.log('❌ Coupon validation failed:', validation.message);
//     // ✅ মূল FIX: MinOrderAmount-এর মেসেজটি সরাসরি 400 JSON Response-এ পাঠানো হলো।
//     // এটি গ্লোবাল এরর হ্যান্ডলার বাইপাস করে Hang হওয়া থেকে বাঁচাবে।
//     return res.status(400).json({
//         success: false,
//         message: validation.message 
//     });
//   }

//   console.log('✅ Coupon validation passed');

//   // Check total discount limit (50% rule)
//   if (coupon.discountType === 'percentage') {
//     const totalDiscount = existingDiscount + coupon.value;
//     if (totalDiscount > 50) {
//       const maxCouponDiscount = 50 - existingDiscount;
//       console.log('❌ Total discount exceeds 50% limit');
//       // 🛑 FIX: Use direct res.status().json()
//       return res.status(400).json({
//           success: false,
//           message: `Total discount cannot exceed 50%. You can get maximum ${maxCouponDiscount}% coupon discount`
//       });
//     }
//   }

//   console.log('🎉 Coupon validation successful, returning response');

//   res.json({ 
//     success: true, 
//     data: {
//       coupon,
//       discountAmount: validation.discountAmount,
//       finalAmount: validation.finalAmount,
//       totalDiscountPercentage: coupon.discountType === 'percentage' ? existingDiscount + coupon.value : existingDiscount
//     }
//   });
// });



export const validateCoupon = catchAsync(async (req, res, next) => {
  const { code, userId, orderAmount, channel = 'web', existingDiscount = 0 } = req.body;
  
  console.log('🎫 Coupon validation request:', {
    code,
    userId,
    orderAmount,
    channel,
    existingDiscount
  });


  const coupon = await Coupon.findOne({ code: code.toUpperCase() });
  if (!coupon) {
    console.log('❌ Coupon not found:', code);
    return res.status(404).json({
        success: false,
        message: "Invalid coupon code"
    });
  }


  if (!coupon.isActive) {
    console.log('Coupon found but not active:', code);

    return res.status(400).json({
        success: false,
        message: "Coupon is not activated yet. Please try again later."
    });
  }
    
  console.log('Coupon found and active:', {
    code: coupon.code,
    minOrderAmount: coupon.minOrderAmount,
    discountType: coupon.discountType,
    value: coupon.value
  });


  const validation = await validateCouponLogic(coupon, userId, orderAmount, channel);

  if (!validation.valid) {
    console.log('Coupon validation failed:', validation.message);
    return res.status(400).json({
        success: false,
        message: validation.message 
    });
  }

  console.log('Coupon validation passed');

  if (coupon.discountType === 'percentage') {
    const totalDiscount = existingDiscount + coupon.value;
    if (totalDiscount > 50) {
      const maxCouponDiscount = 50 - existingDiscount;
      console.log('Total discount exceeds 50% limit');
      return res.status(400).json({
          success: false,
          message: `Total discount cannot exceed 50%. You can get maximum ${maxCouponDiscount}% coupon discount`
      });
    }
  }

  console.log('🎉 Coupon validation successful, returning response');

  res.json({ 
    success: true, 
    data: {
      coupon,
      discountAmount: validation.discountAmount,
      finalAmount: validation.finalAmount,
      totalDiscountPercentage: coupon.discountType === 'percentage' ? existingDiscount + coupon.value : existingDiscount
    }
  });
});

// Apply coupon to order
export const applyCoupon = catchAsync(async (req, res, next) => {
  const { orderId, couponCode, userId, orderAmount, existingDiscount = 0 } = req.body;
  
  const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
  
  if (!coupon) {
    return next(new AppError("Invalid coupon code", 404));
  }

  // Validate coupon
  const validation = await validateCouponLogic(coupon, userId, orderAmount, 'web');
  
  if (!validation.valid) {
    return next(new AppError(validation.message, 400));
  }

  // Check total discount limit (50% rule)
  if (coupon.discountType === 'percentage') {
    const totalDiscount = existingDiscount + coupon.value;
    if (totalDiscount > 50) {
      return next(new AppError("Total discount cannot exceed 50%", 400));
    }
  }

  // Record coupon usage
  const couponUsage = new CouponUsage({
    coupon: coupon._id,
    user: userId,
    order: orderId,
    discountAmount: validation.discountAmount
  });
  await couponUsage.save();

  // Update coupon used count
  await Coupon.findByIdAndUpdate(coupon._id, {
    $inc: { usedCount: 1 },
    $addToSet: { usersUsed: userId }
  });

  res.json({ 
    success: true, 
    data: {
      coupon,
      discountAmount: validation.discountAmount,
      finalAmount: validation.finalAmount,
      usageRecord: couponUsage
    }
  });
});

// Get coupon usage history
export const getCouponUsage = catchAsync(async (req, res, next) => {
  const { couponId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  const coupon = await Coupon.findById(couponId);
  if (!coupon) {
    return next(new AppError("Coupon not found", 404));
  }

  const usage = await CouponUsage.find({ coupon: couponId })
    .populate('user', 'name email')
    .populate('order')
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ appliedAt: -1 });

  const total = await CouponUsage.countDocuments({ coupon: couponId });

  res.json({
    success: true,
    data: usage,
    pagination: {
      current: parseInt(page),
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      itemsPerPage: parseInt(limit)
    }
  });
});

// Toggle coupon active status
export const toggleCouponStatus = catchAsync(async (req, res, next) => {
  const coupon = await Coupon.findById(req.params.id);

  if (!coupon) {
    return next(new AppError("Coupon not found", 404));
  }

  coupon.isActive = !coupon.isActive;
  await coupon.save();

  res.json({
    success: true,
    message: `Coupon ${coupon.isActive ? 'activated' : 'deactivated'} successfully`,
    data: coupon
  });
});

// Get coupon statistics
export const getCouponStats = catchAsync(async (req, res, next) => {
  const totalCoupons = await Coupon.countDocuments();
  const activeCoupons = await Coupon.countDocuments({ 
    isActive: true,
    expiryDate: { $gte: new Date() }
  });
  const expiredCoupons = await Coupon.countDocuments({ 
    expiryDate: { $lt: new Date() } 
  });
  
  const totalUsage = await CouponUsage.countDocuments();
  const totalDiscountGiven = await CouponUsage.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: '$discountAmount' }
      }
    }
  ]);

  const recentUsage = await CouponUsage.find()
    .populate('user', 'name email')
    .populate('coupon', 'code name')
    .populate('order')
    .sort({ appliedAt: -1 })
    .limit(10);

  const couponTypeStats = await Coupon.aggregate([
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        totalUsage: { $sum: '$usedCount' }
      }
    }
  ]);

  const monthlyUsage = await CouponUsage.aggregate([
    {
      $match: {
        appliedAt: {
          $gte: new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1)
        }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$appliedAt' },
          month: { $month: '$appliedAt' }
        },
        usageCount: { $sum: 1 },
        totalDiscount: { $sum: '$discountAmount' }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1 }
    }
  ]);

  res.json({
    success: true,
    data: {
      overview: {
        totalCoupons,
        activeCoupons,
        expiredCoupons,
        totalUsage,
        totalDiscountGiven: totalDiscountGiven[0]?.total || 0
      },
      recentUsage,
      typeStats: couponTypeStats,
      monthlyUsage
    }
  });
});


export const getCouponDashboardStats = catchAsync(async (req, res, next) => {
  try {
    const totalCoupons = await Coupon.countDocuments();
    const activeCoupons = await Coupon.countDocuments({ 
      isActive: true,
      expiryDate: { $gte: new Date() }
    });
    const expiredCoupons = await Coupon.countDocuments({ 
      expiryDate: { $lt: new Date() } 
    });
    
    const totalUsage = await CouponUsage.countDocuments();
    
    const totalDiscountGiven = await CouponUsage.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: '$discountAmount' }
        }
      }
    ]);

    const recentUsage = await CouponUsage.find()
      .populate('user', 'name email')
      .populate('coupon', 'code name')
      .populate('order')
      .sort({ appliedAt: -1 })
      .limit(10);

    const couponTypeStats = await Coupon.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalUsage: { $sum: '$usedCount' }
        }
      }
    ]);

    const monthlyUsage = await CouponUsage.aggregate([
      {
        $match: {
          appliedAt: {
            $gte: new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1)
          }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$appliedAt' },
            month: { $month: '$appliedAt' }
          },
          usageCount: { $sum: 1 },
          totalDiscount: { $sum: '$discountAmount' }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalCoupons,
          activeCoupons,
          expiredCoupons,
          totalUsage,
          totalDiscountGiven: totalDiscountGiven[0]?.total || 0
        },
        recentUsage,
        typeStats: couponTypeStats,
        monthlyUsage
      }
    });
  } catch (error) {
    console.error('Error in getCouponDashboardStats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard statistics'
    });
  }
});