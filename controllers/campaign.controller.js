import Campaign from "../models/Campaign.js"
import Product from "../models/Product.js"
import ParentCategory from "../models/ParentCategory.js"
import SubCategory from "../models/SubCategory.js"
import catchAsync from "../utils/catchAsync.js"
import AppError from "../utils/appError.js"
import { deleteImage, getPublicIdFromUrl } from "../utils/cloudinary.js"

// @desc    Create a campaign
// @route   POST /api/campaigns
// @access  Private/Admin
export const createCampaign = catchAsync(async (req, res, next) => {
  // Parse JSON data if needed
  const campaignData = typeof req.body.campaignData === 'string' 
    ? JSON.parse(req.body.campaignData) 
    : req.body;
    
  // Get banner image if uploaded
  const bannerImage = req.file ? req.file.path : undefined;
  
  const { title, type, targetIds, discountType, discountValue, startDate, endDate, couponCode } = campaignData;

  // Validate target IDs based on campaign type
  if (type === "product") {
    // Check if all products exist
    for (const id of targetIds) {
      const product = await Product.findById(id)
      if (!product) {
        return next(new AppError(`Product not found: ${id}`, 404))
      }
    }
  } else if (type === "category") {
    // Check if all categories exist
    for (const id of targetIds) {
      const category = (await ParentCategory.findById(id)) || (await SubCategory.findById(id))
      if (!category) {
        return next(new AppError(`Category not found: ${id}`, 404))
      }
    }
  }

  // Create campaign
  const campaign = await Campaign.create({
    title,
    type,
    targetIds,
    discountType,
    discountValue,
    startDate,
    endDate,
    bannerImage,
    couponCode,
  })

  // If campaign is active, apply discounts to products
  if (new Date(startDate) <= new Date() && new Date(endDate) >= new Date()) {
    await applyDiscounts(campaign)
  }

  res.status(201).json({
    status: "success",
    data: {
      campaign,
    },
  })
})

// @desc    Get all campaigns
// @route   GET /api/campaigns
// @access  Private/Admin
export const getCampaigns = catchAsync(async (req, res, next) => {
  // Build filter object
  const filter = {}

  // Filter by active status
  if (req.query.isActive === "true") {
    filter.isActive = true
  } else if (req.query.isActive === "false") {
    filter.isActive = false
  }

  // Filter by campaign type
  if (req.query.type) {
    filter.type = req.query.type
  }

  // Filter by date range
  if (req.query.startDate || req.query.endDate) {
    if (req.query.startDate) {
      filter.endDate = { $gte: new Date(req.query.startDate) }
    }
    if (req.query.endDate) {
      filter.startDate = { $lte: new Date(req.query.endDate) }
    }
  }

  // Pagination
  const page = Number.parseInt(req.query.page, 10) || 1
  const limit = Number.parseInt(req.query.limit, 10) || 10
  const skip = (page - 1) * limit

  // Sorting
  const sortBy = req.query.sortBy || "startDate"
  const sortOrder = req.query.sortOrder === "asc" ? 1 : -1
  const sort = { [sortBy]: sortOrder }

  // Execute query
  const campaigns = await Campaign.find(filter).sort(sort).skip(skip).limit(limit)

  // Get total count for pagination
  const total = await Campaign.countDocuments(filter)

  res.status(200).json({
    status: "success",
    results: campaigns.length,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
    data: {
      campaigns,
    },
  })
})

// @desc    Get active campaigns
// @route   GET /api/campaigns/active
// @access  Public
export const getActiveCampaigns = catchAsync(async (req, res, next) => {
  const now = new Date()

  const campaigns = await Campaign.find({
    startDate: { $lte: now },
    endDate: { $gte: now },
    isActive: true,
  })

  res.status(200).json({
    status: "success",
    results: campaigns.length,
    data: {
      campaigns,
    },
  })
})

// @desc    Get campaign by ID
// @route   GET /api/campaigns/:id
// @access  Private/Admin
export const getCampaign = catchAsync(async (req, res, next) => {
  const campaign = await Campaign.findById(req.params.id)

  if (!campaign) {
    return next(new AppError("Campaign not found", 404))
  }

  res.status(200).json({
    status: "success",
    data: {
      campaign,
    },
  })
})

// @desc    Update campaign
// @route   PATCH /api/campaigns/:id
// @access  Private/Admin
export const updateCampaign = catchAsync(async (req, res, next) => {
  // Parse JSON data if needed
  const campaignData = typeof req.body.campaignData === 'string' 
    ? JSON.parse(req.body.campaignData) 
    : req.body;
    
  // Get existing campaign
  const existingCampaign = await Campaign.findById(req.params.id);
  if (!existingCampaign) {
    return next(new AppError("Campaign not found", 404));
  }
  
  // Handle banner image
  let bannerImage = existingCampaign.bannerImage;
  if (req.file) {
    // Delete old image if exists
    if (existingCampaign.bannerImage) {
      const publicId = getPublicIdFromUrl(existingCampaign.bannerImage);
      await deleteImage(publicId);
    }
    bannerImage = req.file.path;
  }

  // Validate target IDs if being updated
  if (campaignData.targetIds && campaignData.type) {
    const type = campaignData.type;
    const targetIds = campaignData.targetIds;

    if (type === "product") {
      // Check if all products exist
      for (const id of targetIds) {
        const product = await Product.findById(id);
        if (!product) {
          return next(new AppError(`Product not found: ${id}`, 404));
        }
      }
    } else if (type === "category") {
      // Check if all categories exist
      for (const id of targetIds) {
        const category = (await ParentCategory.findById(id)) || (await SubCategory.findById(id));
        if (!category) {
          return next(new AppError(`Category not found: ${id}`, 404));
        }
      }
    }
  } else if (campaignData.targetIds && !campaignData.type) {
    // If targetIds are being updated but type is not provided, use existing type
    const type = existingCampaign.type;
    const targetIds = campaignData.targetIds;

    if (type === "product") {
      // Check if all products exist
      for (const id of targetIds) {
        const product = await Product.findById(id);
        if (!product) {
          return next(new AppError(`Product not found: ${id}`, 404));
        }
      }
    } else if (type === "category") {
      // Check if all categories exist
      for (const id of targetIds) {
        const category = (await ParentCategory.findById(id)) || (await SubCategory.findById(id));
        if (!category) {
          return next(new AppError(`Category not found: ${id}`, 404));
        }
      }
    }
  }

  // Update campaign
  const updatedCampaign = await Campaign.findByIdAndUpdate(
    req.params.id, 
    { ...campaignData, bannerImage }, 
    {
      new: true,
      runValidators: true,
    })

  // If campaign is active, apply discounts to products
  const now = new Date()
  if (updatedCampaign.isActive && updatedCampaign.startDate <= now && updatedCampaign.endDate >= now) {
    await applyDiscounts(updatedCampaign)
  } else {
    // If campaign is not active or not in date range, remove discounts
    await removeDiscounts(updatedCampaign)
  }

  res.status(200).json({
    status: "success",
    data: {
      campaign: updatedCampaign,
    },
  })
})

// @desc    Delete campaign
// @route   DELETE /api/campaigns/:id
// @access  Private/Admin
export const deleteCampaign = catchAsync(async (req, res, next) => {
  const campaign = await Campaign.findById(req.params.id)

  if (!campaign) {
    return next(new AppError("Campaign not found", 404))
  }

  // Delete banner image if exists
  if (campaign.bannerImage) {
    const publicId = getPublicIdFromUrl(campaign.bannerImage)
    await deleteImage(publicId)
  }

  // Remove discounts before deleting
  await removeDiscounts(campaign)

  // Delete campaign
  await Campaign.findByIdAndDelete(req.params.id)

  res.status(204).json({
    status: "success",
    data: null,
  })
})

// @desc    Apply campaign discounts to products
// @route   POST /api/campaigns/:id/apply
// @access  Private/Admin
export const applyCampaign = catchAsync(async (req, res, next) => {
  const campaign = await Campaign.findById(req.params.id)

  if (!campaign) {
    return next(new AppError("Campaign not found", 404))
  }

  // Check if campaign is active and in date range
  const now = new Date()
  if (campaign.startDate > now || campaign.endDate < now) {
    return next(new AppError("Campaign is not currently active", 400))
  }

  // Apply discounts
  await applyDiscounts(campaign)

  res.status(200).json({
    status: "success",
    message: "Campaign discounts applied successfully",
  })
})

// @desc    Remove campaign discounts from products
// @route   POST /api/campaigns/:id/remove
// @access  Private/Admin
export const removeCampaign = catchAsync(async (req, res, next) => {
  const campaign = await Campaign.findById(req.params.id)

  if (!campaign) {
    return next(new AppError("Campaign not found", 404))
  }

  // Remove discounts
  await removeDiscounts(campaign)

  res.status(200).json({
    status: "success",
    message: "Campaign discounts removed successfully",
  })
})

// Helper function to apply discounts to products
const applyDiscounts = async (campaign) => {
  if (campaign.type === "product") {
    // Apply discounts directly to products
    for (const productId of campaign.targetIds) {
      const product = await Product.findById(productId)

      if (product) {
        // Calculate discount
        let discountPrice
        if (campaign.discountType === "percentage") {
          discountPrice = product.price * (1 - campaign.discountValue / 100)
        } else {
          discountPrice = Math.max(0, product.price - campaign.discountValue)
        }

        // Update product
        product.discountPrice = discountPrice
        await product.save()
      }
    }
  } else if (campaign.type === "category") {
    // Apply discounts to products in categories
    for (const categoryId of campaign.targetIds) {
      // Check if it's a parent category
      const parentCategory = await ParentCategory.findById(categoryId)

      if (parentCategory) {
        // Get all products in this parent category
        const products = await Product.find({ parentCategoryId: categoryId })

        // Apply discounts
        for (const product of products) {
          // Calculate discount
          let discountPrice
          if (campaign.discountType === "percentage") {
            discountPrice = product.price * (1 - campaign.discountValue / 100)
          } else {
            discountPrice = Math.max(0, product.price - campaign.discountValue)
          }

          // Update product
          product.discountPrice = discountPrice
          await product.save()
        }
      } else {
        // Check if it's a sub category
        const subCategory = await SubCategory.findById(categoryId)

        if (subCategory) {
          // Get all products in this sub category
          const products = await Product.find({ subCategoryId: categoryId })

          // Apply discounts
          for (const product of products) {
            // Calculate discount
            let discountPrice
            if (campaign.discountType === "percentage") {
              discountPrice = product.price * (1 - campaign.discountValue / 100)
            } else {
              discountPrice = Math.max(0, product.price - campaign.discountValue)
            }

            // Update product
            product.discountPrice = discountPrice
            await product.save()
          }
        }
      }
    }
  }
}

// Helper function to remove discounts from products
const removeDiscounts = async (campaign) => {
  if (campaign.type === "product") {
    // Remove discounts directly from products
    for (const productId of campaign.targetIds) {
      const product = await Product.findById(productId)

      if (product) {
        // Remove discount
        product.discountPrice = undefined
        await product.save()
      }
    }
  } else if (campaign.type === "category") {
    // Remove discounts from products in categories
    for (const categoryId of campaign.targetIds) {
      // Check if it's a parent category
      const parentCategory = await ParentCategory.findById(categoryId)

      if (parentCategory) {
        // Get all products in this parent category
        const products = await Product.find({ parentCategoryId: categoryId })

        // Remove discounts
        for (const product of products) {
          product.discountPrice = undefined
          await product.save()
        }
      } else {
        // Check if it's a sub category
        const subCategory = await SubCategory.findById(categoryId)

        if (subCategory) {
          // Get all products in this sub category
          const products = await Product.find({ subCategoryId: categoryId })

          // Remove discounts
          for (const product of products) {
            product.discountPrice = undefined
            await product.save()
          }
        }
      }
    }
  }
}
