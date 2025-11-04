// controllers/adminCouponController.js
import Coupon from "../models/Coupon.js";
import CouponUsage from "../models/CouponUsage.js";
import User from "../models/User.js";
import Order from "../models/Order.js";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../utils/appError.js";

// Get dashboard statistics
export const getCouponDashboardStats = catchAsync(async (req, res, next) => {
  const totalCoupons = await Coupon.countDocuments();
  const activeCoupons = await Coupon.countDocuments({ isActive: true });
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

// Create coupon with advanced validation
export const createAdminCoupon = catchAsync(async (req, res, next) => {
  const {
    code,
    name,
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
    isActive = true,
    applicableCategories = [],
    excludedProducts = [],
    customerGroups = []
  } = req.body;

  // Validate coupon code format
  if (!/^[A-Z0-9]+$/.test(code)) {
    return next(new AppError("Coupon code should contain only uppercase letters and numbers", 400));
  }

  // Check if coupon code already exists
  const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
  if (existingCoupon) {
    return next(new AppError("Coupon code already exists", 400));
  }

  // Validate discount values
  if (discountType === 'percentage' && (value <= 0 || value > 100)) {
    return next(new AppError("Percentage discount must be between 1 and 100", 400));
  }

  if (discountType === 'fixed' && value <= 0) {
    return next(new AppError("Fixed discount amount must be greater than 0", 400));
  }

  const coupon = new Coupon({
    code: code.toUpperCase(),
    name,
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
    isActive,
    applicableCategories,
    excludedProducts,
    customerGroups,
    createdBy: req.user._id
  });

  await coupon.save();
  
  res.status(201).json({
    success: true,
    message: "Coupon created successfully",
    data: coupon
  });
});

// Bulk create coupons
export const bulkCreateCoupons = catchAsync(async (req, res, next) => {
  const { coupons } = req.body;

  if (!Array.isArray(coupons) || coupons.length === 0) {
    return next(new AppError("Please provide an array of coupons", 400));
  }

  if (coupons.length > 100) {
    return next(new AppError("Cannot create more than 100 coupons at once", 400));
  }

  const results = {
    successful: [],
    failed: []
  };

  for (const couponData of coupons) {
    try {
      // Check if coupon code already exists
      const existingCoupon = await Coupon.findOne({ 
        code: couponData.code.toUpperCase() 
      });
      
      if (existingCoupon) {
        results.failed.push({
          code: couponData.code,
          error: "Coupon code already exists"
        });
        continue;
      }

      const coupon = new Coupon({
        ...couponData,
        code: couponData.code.toUpperCase(),
        createdBy: req.user._id
      });

      await coupon.save();
      results.successful.push(coupon);
    } catch (error) {
      results.failed.push({
        code: couponData.code,
        error: error.message
      });
    }
  }

  res.status(201).json({
    success: true,
    message: `Created ${results.successful.length} coupons, ${results.failed.length} failed`,
    data: results
  });
});

// Get coupons with advanced filtering
export const getAdminCoupons = catchAsync(async (req, res, next) => {
  const {
    page = 1,
    limit = 10,
    search = "",
    type = "",
    discountType = "",
    status = "",
    channel = "",
    startDate = "",
    endDate = ""
  } = req.query;

  const query = {};

  // Search in code and name
  if (search) {
    query.$or = [
      { code: { $regex: search, $options: 'i' } },
      { name: { $regex: search, $options: 'i' } }
    ];
  }

  // Filter by type
  if (type) {
    query.type = type;
  }

  // Filter by discount type
  if (discountType) {
    query.discountType = discountType;
  }

  // Filter by status
  if (status === 'active') {
    query.isActive = true;
    query.expiryDate = { $gte: new Date() };
  } else if (status === 'expired') {
    query.expiryDate = { $lt: new Date() };
  } else if (status === 'inactive') {
    query.isActive = false;
  }

  // Filter by channel
  if (channel) {
    query.channels = channel;
  }

  // Filter by date range
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const options = {
    page: parseInt(page),
    limit: parseInt(limit),
    sort: { createdAt: -1 }
  };

  const coupons = await Coupon.find(query)
    .populate('createdBy', 'name email')
    .limit(options.limit * 1)
    .skip((options.page - 1) * options.limit)
    .sort(options.sort);

  const total = await Coupon.countDocuments(query);

  // Calculate usage statistics
  const usageStats = await CouponUsage.aggregate([
    {
      $group: {
        _id: '$coupon',
        totalOrders: { $sum: 1 },
        totalDiscount: { $sum: '$discountAmount' }
      }
    }
  ]);

  const couponsWithStats = coupons.map(coupon => {
    const stats = usageStats.find(stat => stat._id.toString() === coupon._id.toString());
    return {
      ...coupon.toObject(),
      usageStats: stats || { totalOrders: 0, totalDiscount: 0 }
    };
  });

  res.json({
    success: true,
    data: couponsWithStats,
    pagination: {
      current: options.page,
      totalPages: Math.ceil(total / options.limit),
      totalItems: total,
      itemsPerPage: options.limit
    }
  });
});

// Get coupon analytics
export const getCouponAnalytics = catchAsync(async (req, res, next) => {
  const { couponId } = req.params;
  const { period = '30d' } = req.query;

  const coupon = await Coupon.findById(couponId);
  if (!coupon) {
    return next(new AppError("Coupon not found", 404));
  }

  // Calculate date range based on period
  let startDate = new Date();
  switch (period) {
    case '7d':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(startDate.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(startDate.getDate() - 90);
      break;
    case '1y':
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
    default:
      startDate.setDate(startDate.getDate() - 30);
  }

  // Daily usage statistics
  const dailyUsage = await CouponUsage.aggregate([
    {
      $match: {
        coupon: coupon._id,
        appliedAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          date: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$appliedAt"
            }
          }
        },
        usageCount: { $sum: 1 },
        totalDiscount: { $sum: "$discountAmount" },
        averageOrderValue: { $avg: "$order.totalAmount" }
      }
    },
    {
      $sort: { "_id.date": 1 }
    }
  ]);

  // User demographics
  const userDemographics = await CouponUsage.aggregate([
    {
      $match: {
        coupon: coupon._id,
        appliedAt: { $gte: startDate }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'user'
      }
    },
    {
      $unwind: '$user'
    },
    {
      $group: {
        _id: '$user.role',
        count: { $sum: 1 }
      }
    }
  ]);

  // Top users
  const topUsers = await CouponUsage.aggregate([
    {
      $match: {
        coupon: coupon._id,
        appliedAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$user',
        usageCount: { $sum: 1 },
        totalSavings: { $sum: '$discountAmount' }
      }
    },
    {
      $sort: { usageCount: -1 }
    },
    {
      $limit: 10
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    {
      $unwind: '$user'
    }
  ]);

  // Conversion rate (coupon usage vs total orders)
  const totalOrdersInPeriod = await Order.countDocuments({
    createdAt: { $gte: startDate }
  });

  const conversionRate = totalOrdersInPeriod > 0 
    ? (dailyUsage.reduce((sum, day) => sum + day.usageCount, 0) / totalOrdersInPeriod) * 100 
    : 0;

  res.json({
    success: true,
    data: {
      coupon,
      analytics: {
        period,
        dailyUsage,
        userDemographics,
        topUsers,
        conversionRate: Math.round(conversionRate * 100) / 100,
        totalUsage: dailyUsage.reduce((sum, day) => sum + day.usageCount, 0),
        totalDiscount: dailyUsage.reduce((sum, day) => sum + day.totalDiscount, 0)
      }
    }
  });
});

// Bulk update coupons
export const bulkUpdateCoupons = catchAsync(async (req, res, next) => {
  const { couponIds, updates } = req.body;

  if (!Array.isArray(couponIds) || couponIds.length === 0) {
    return next(new AppError("Please provide coupon IDs", 400));
  }

  const allowedUpdates = [
    'isActive', 'expiryDate', 'usageLimit', 'perUserLimit', 
    'minOrderAmount', 'maxDiscountAmount'
  ];

  const updateFields = {};
  Object.keys(updates).forEach(key => {
    if (allowedUpdates.includes(key)) {
      updateFields[key] = updates[key];
    }
  });

  if (Object.keys(updateFields).length === 0) {
    return next(new AppError("No valid fields to update", 400));
  }

  const result = await Coupon.updateMany(
    { _id: { $in: couponIds } },
    { $set: updateFields }
  );

  res.json({
    success: true,
    message: `Updated ${result.modifiedCount} coupons`,
    data: {
      matched: result.matchedCount,
      modified: result.modifiedCount
    }
  });
});

// Export coupons
export const exportCoupons = catchAsync(async (req, res, next) => {
  const { format = 'json' } = req.query;

  const coupons = await Coupon.find()
    .populate('createdBy', 'name email')
    .sort({ createdAt: -1 });

  if (format === 'csv') {
    // Simple CSV export
    const csvHeaders = 'Code,Name,Type,Discount Type,Value,Expiry Date,Usage Limit,Used Count,Status\n';
    const csvData = coupons.map(coupon => 
      `"${coupon.code}","${coupon.name}","${coupon.type}","${coupon.discountType}",${coupon.value},"${coupon.expiryDate}",${coupon.usageLimit || 'Unlimited'},${coupon.usedCount},"${coupon.isActive ? 'Active' : 'Inactive'}"`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=coupons.csv');
    res.send(csvHeaders + csvData);
  } else {
    res.json({
      success: true,
      data: coupons,
      exportedAt: new Date(),
      total: coupons.length
    });
  }
});

// Duplicate coupon
export const duplicateCoupon = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { newCode } = req.body;

  if (!newCode) {
    return next(new AppError("New coupon code is required", 400));
  }

  const originalCoupon = await Coupon.findById(id);
  if (!originalCoupon) {
    return next(new AppError("Coupon not found", 404));
  }

  // Check if new code already exists
  const existingCoupon = await Coupon.findOne({ code: newCode.toUpperCase() });
  if (existingCoupon) {
    return next(new AppError("Coupon code already exists", 400));
  }

  const duplicatedCoupon = new Coupon({
    ...originalCoupon.toObject(),
    _id: undefined,
    code: newCode.toUpperCase(),
    usedCount: 0,
    usersUsed: [],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  await duplicatedCoupon.save();

  res.json({
    success: true,
    message: "Coupon duplicated successfully",
    data: duplicatedCoupon
  });
});