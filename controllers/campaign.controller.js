import Campaign from "../models/Campaign.js"
import Product from "../models/Product.js"
import ParentCategory from "../models/ParentCategory.js"
import SubCategory from "../models/SubCategory.js"
import catchAsync from "../utils/catchAsync.js"
import AppError from "../utils/appError.js"
import { deleteImage, getPublicIdFromUrl } from "../utils/cloudinary.js"
import mongoose from "mongoose"
// @desc    Create a campaign
// @route   POST /api/campaigns
// @access  Private/Admin
// @desc    Create a campaign

export const createCampaign = catchAsync(async (req, res, next) => {
  try {
    console.log('[CREATE CAMPAIGN] Request received')
    let campaignData
    try {
      campaignData = typeof req.body.campaignData === "string" ? JSON.parse(req.body.campaignData) : req.body
      console.log('[CREATE CAMPAIGN] Data parsed successfully')
    } catch (parseError) {
      console.error('[CREATE CAMPAIGN] JSON parse error:', parseError)
      // FIX: Direct Response
      return res.status(400).json({ success: false, message: "Invalid JSON data" })
    }

    const bannerImage = req.file ? req.file.path : undefined
    console.log('[CREATE CAMPAIGN] Banner image:', bannerImage ? 'Provided' : 'Not provided')

    console.log('[CREATE CAMPAIGN] Campaign Data:', {
      title: campaignData.title,
      type: campaignData.type,
      discountType: campaignData.discountType,
      discountValue: campaignData.discountValue,
      targetIds: campaignData.targetIds,
      startDate: campaignData.startDate,
      endDate: campaignData.endDate
    })

    const { title, type, targetIds, discountType, discountValue, startDate, endDate, couponCode } = campaignData
    console.log('[CREATE CAMPAIGN] Starting validation...')
    
    // --- Basic Validations (Direct Response Fix) ---
    if (!title || !title.trim()) {
      console.log('[CREATE CAMPAIGN] Title validation failed')
      return res.status(400).json({ success: false, message: "Campaign title is required" })
    }

    if (!type) {
      console.log('[CREATE CAMPAIGN] Type validation failed')
      return res.status(400).json({ success: false, message: "Campaign type is required" })
    }

    if (!discountType) {
      console.log('[CREATE CAMPAIGN] Discount type validation failed')
      return res.status(400).json({ success: false, message: "Discount type is required" })
    }

    if (discountValue === undefined || discountValue === null) {
      console.log('[CREATE CAMPAIGN] Discount value validation failed')
      return res.status(400).json({ success: false, message: "Discount value is required" })
    }

    if (!startDate) {
      console.log('[CREATE CAMPAIGN] Start date validation failed')
      return res.status(400).json({ success: false, message: "Start date is required" })
    }

    if (!endDate) {
      console.log('[CREATE CAMPAIGN] End date validation failed')
      return res.status(400).json({ success: false, message: "End date is required" })
    }

    console.log('[CREATE CAMPAIGN] Basic validation passed')

    // Validation: Target IDs
    if (!targetIds || !Array.isArray(targetIds) || targetIds.length === 0) {
      console.log('[CREATE CAMPAIGN] Target IDs validation failed')
      return res.status(400).json({ success: false, message: "At least one target must be selected" })
    }

    console.log(`[CREATE CAMPAIGN] Validating ${targetIds.length} target IDs`)

    // Convert discountValue to number
    const numericDiscountValue = Number(discountValue)
    if (isNaN(numericDiscountValue)) {
      console.log('[CREATE CAMPAIGN] Discount value is not a number')
      return res.status(400).json({ success: false, message: "Discount value must be a number" })
    }

    console.log(`[CREATE CAMPAIGN] Discount value: ${numericDiscountValue} (${discountType})`)

    // --- Discount Validation (Direct Response Fix) ---
    if (discountType === "percentage") {
      if (numericDiscountValue <= 0 || numericDiscountValue > 100) {
        console.log('[CREATE CAMPAIGN] Percentage discount validation failed')
        // FIX: Direct Response (Expected Error: 'Discount percentage must be between 1 and 100')
        return res.status(400).json({ success: false, message: "Discount percentage must be between 1 and 100" })
      }
    } else if (discountType === "fixed") {
      if (numericDiscountValue <= 0) {
        console.log(' [CREATE CAMPAIGN] Fixed discount validation failed')
        return res.status(400).json({ success: false, message: "Fixed discount amount must be greater than 0" })
      }
    } else {
      console.log('[CREATE CAMPAIGN] Invalid discount type')
      return res.status(400).json({ success: false, message: "Invalid discount type" })
    }

    // --- Time validation (Direct Response Fix) ---
    const now = new Date()
    const campaignStartDate = new Date(startDate)
    const campaignEndDate = new Date(endDate)

    console.log('⏰ [CREATE CAMPAIGN] Date validation:', {
      now: now.toISOString(),
      start: campaignStartDate.toISOString(),
      end: campaignEndDate.toISOString()
    })

    // Check if dates are valid
    if (isNaN(campaignStartDate.getTime()) || isNaN(campaignEndDate.getTime())) {
      console.log('[CREATE CAMPAIGN] Invalid date format')
      return res.status(400).json({ success: false, message: "Invalid date format" })
    }

    // FIX: Start date must be in future (allowing a small buffer, but logic remains the same)
    if (campaignStartDate <= now) {
      console.log('[CREATE CAMPAIGN] Start date must be in future')
      return res.status(400).json({ success: false, message: "Campaign start date must be in the future" })
    }

    if (campaignEndDate <= campaignStartDate) {
      console.log('[CREATE CAMPAIGN] End date must be after start date')
      return res.status(400).json({ success: false, message: "Campaign end date must be after start date" })
    }

    console.log('[CREATE CAMPAIGN] Date validation passed')

    // --- Target validation based on campaign type ---
    if (type === "product") {
      console.log(`[CREATE CAMPAIGN] Validating ${targetIds.length} products`)
      
      // 1. Check if all targetIds are valid Product IDs
      for (const productId of targetIds) {
        try {
          // Check if ID is a valid MongoDB ObjectId
          if (!mongoose.Types.ObjectId.isValid(productId)) {
            console.log(`[CREATE CAMPAIGN] Invalid Product ID format: ${productId}`)
            return res.status(400).json({ success: false, message: `Invalid Product ID format: ${productId}` })
          }

          const product = await Product.findById(productId)
          if (!product) {
            console.log(`[CREATE CAMPAIGN] Product not found: ${productId}`)
            return res.status(404).json({ success: false, message: `Product not found: ${productId}` })
          }
          
          console.log(`[CREATE CAMPAIGN] Product validated: ${product.title}`)
        } catch (dbError) {
          console.error(`[CREATE CAMPAIGN] Database error for product ${productId}:`, dbError)
          return res.status(500).json({ success: false, message: "Error validating products" })
        }
      }
      
      // 2. PRODUCT-TO-PRODUCT CONFLICT CHECK (Direct Response Fix)
      const existingProductCampaigns = await Campaign.find({
        type: 'product',
        // Look for campaigns that include any of the new targetIds
        targetIds: { $in: targetIds },
        // The campaign's end date must be in the future (meaning it's active or pending start)
        endDate: { $gt: now }, 
      }).select('title').lean()

      if (existingProductCampaigns.length > 0) {
        const campaignTitles = existingProductCampaigns.map(c => c.title).join(', ')
        console.log(`[CREATE CAMPAIGN] Conflict found with existing Product campaigns: ${campaignTitles}`)
        
        // FIX: Direct Response for 409 Conflict
        return res.status(409).json({
          success: false,
          message: `Conflict Error: One or more selected products are already targeted by the following active Product Campaign(s): ${campaignTitles}. Please end those campaigns first or use these campaign.`,
        })
      }
      
    } else if (type === "category") {
      console.log(`[CREATE CAMPAIGN] Validating ${targetIds.length} categories`)
      const productsInTargetCategories = []
      
      for (const categoryId of targetIds) {
        try {
          if (!mongoose.Types.ObjectId.isValid(categoryId)) {
            console.log(`[CREATE CAMPAIGN] Invalid Category ID format: ${categoryId}`)
            return res.status(400).json({ success: false, message: `Invalid Category ID format: ${categoryId}` })
          }

          const parentCategory = await ParentCategory.findById(categoryId)
          const subCategory = await SubCategory.findById(categoryId)
          
          if (!parentCategory && !subCategory) {
            console.log(`[CREATE CAMPAIGN] Category not found: ${categoryId}`)
            return res.status(404).json({ success: false, message: `Category not found: ${categoryId}` })
          }
          
          let productQuery = {}
          if (parentCategory) {
            console.log(`[CREATE CAMPAIGN] Parent category validated: ${parentCategory.name}`)
            productQuery.parentCategoryId = categoryId
          } else if (subCategory) {
            console.log(`[CREATE CAMPAIGN] Sub category validated: ${subCategory.name}`)
            productQuery.subCategoryId = categoryId
          }
          // Find all products in this category/subcategory
          const categoryProducts = await Product.find(productQuery).select('_id title')
          productsInTargetCategories.push(...categoryProducts)

        } catch (dbError) {
          console.error(`[CREATE CAMPAIGN] Database error for category ${categoryId}:`, dbError)
          return res.status(500).json({ success: false, message: "Error validating categories" })
        }
      }
      
      // 3. CATEGORY-TO-PRODUCT CONFLICT CHECK (Direct Response Fix)
      if (productsInTargetCategories.length > 0) {
          const productIds = productsInTargetCategories.map(p => p._id)
          // Find existing 'product' campaigns that target any of these products
          const existingProductCampaignsInCategories = await Campaign.find({
              type: 'product',
              targetIds: { $in: productIds },
              endDate: { $gt: now }, 
          }).select('title targetIds').lean()

          if (existingProductCampaignsInCategories.length > 0) {
              const campaignTitles = existingProductCampaignsInCategories.map(c => c.title).join(', ')
              
              const productTitles = existingProductCampaignsInCategories.reduce((acc, campaign) => {
                  campaign.targetIds.forEach(targetId => {
                      const product = productsInTargetCategories.find(p => p._id.toString() === targetId.toString())
                      if (product) acc.add(product.title)
                  })
                  return acc
              }, new Set())
              
              const affectedProducts = Array.from(productTitles).join(', ')

              console.log(`[CREATE CAMPAIGN] Conflict found with existing Product campaigns: ${campaignTitles}. Affected Products: ${affectedProducts}`)
              // FIX: Direct Response for 409 Conflict
              return res.status(409).json({
                  success: false,
                  message: `Validation Error: One or more products in this category already have a conflicting active Product Campaign. Affected Products: ${affectedProducts}. Affected Campaigns: ${campaignTitles}. Please end those campaigns first.`, 
              })
          }
      }
      
    } else {
      console.log('[CREATE CAMPAIGN] Invalid campaign type')
      return res.status(400).json({ success: false, message: "Invalid campaign type" })
    }

    console.log('[CREATE CAMPAIGN] All validations passed')
    console.log(`[CREATE CAMPAIGN] Creating campaign in database...`)
    
    // --- Database Creation ---
    let campaign
    try {
      campaign = await Campaign.create({
        title: title.trim(),
        type,
        targetIds,
        discountType,
        discountValue: numericDiscountValue,
        startDate: campaignStartDate,
        endDate: campaignEndDate,
        bannerImage,
        couponCode: couponCode?.trim(),
        isActive: campaignData.isActive === true,
      })
      console.log(`[CREATE CAMPAIGN] Campaign created successfully: ${campaign.title} (ID: ${campaign._id})`)
    } catch (createError) {
      console.error('[CREATE CAMPAIGN] Database create error:', createError)
      
      // Handle Mongoose Validation Error (if it happens during .create())
      if (createError.name === 'ValidationError') {
        const validationMessage = Object.values(createError.errors).map(val => val.message).join('; ');
        // FIX: Direct Response for Mongoose Validation
        return res.status(400).json({ success: false, message: validationMessage });
      }

      // Handle Duplicate Key Error (if you had unique index on couponCode)
      if (createError.code === 11000) {
        return res.status(400).json({ success: false, message: `Duplicate value found for field: ${Object.keys(createError.keyValue)[0]}.` });
      }

      // For other unexpected database errors, let the global error handler manage it
      return next(createError)
    }

    console.log(`[CREATE CAMPAIGN] Sending success response`)
    res.status(201).json({
      status: "success",
      message: "Campaign created successfully",
      data: {
        campaign: {
          _id: campaign._id,
          title: campaign.title,
          type: campaign.type,
          discountType: campaign.discountType,
          discountValue: campaign.discountValue,
          startDate: campaign.startDate,
          endDate: campaign.endDate,
          isActive: campaign.isActive,
          targetIds: campaign.targetIds,
          bannerImage: campaign.bannerImage,
          couponCode: campaign.couponCode,
          createdAt: campaign.createdAt
        }
      },
    })

    console.log('✅ [CREATE CAMPAIGN] Process completed successfully')

  } catch (error) {
    console.error('💥 [CREATE CAMPAIGN] Unexpected error in outer try/catch:', error)
    // সমস্ত অপ্রত্যাশিত এরর গ্লোবাল এরর হ্যান্ডলারের কাছে পাঠানো হলো
    return next(error)
  }
})
// @desc    Get all campaigns
// @route   GET /api/campaigns
// @access  Private/Admin
export const getCampaigns = catchAsync(async (req, res, next) => {
  // *** ক্রITICAL ফিক্স: সকল ক্যাম্পেইন ডেটাবেস থেকে ফেচ করা হচ্ছে ***
  const campaigns = await Campaign.find().sort({ createdAt: -1 }); // নতুন ক্যাম্পেইনগুলো আগে দেখানোর জন্য sort করা হলো

  res.status(200).json({
    status: "success",
    results: campaigns.length,
    data: {
      campaigns, // এখানে ক্যাম্পেইন তালিকা পাঠানো হলো
    },
  })
})

// @desc    Get active campaigns
// @route   GET /api/campaigns/active
// @access  Public
export const getActiveCampaigns = catchAsync(async (req, res, next) => {
  const now = new Date()
  
  const activeCampaigns = await Campaign.find({
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now }
  }).sort({ createdAt: -1 })

  res.status(200).json({
    status: "success",
    results: activeCampaigns.length,
    data: {
      campaigns: activeCampaigns,
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

  // Optional: Populate target details based on campaign type
  let populatedCampaign = campaign.toObject()
  
  if (campaign.type === "product" && campaign.targetIds.length > 0) {
    const products = await Product.find({ _id: { $in: campaign.targetIds } }).select("title")
    populatedCampaign.targetDetails = products
  } else if (campaign.type === "category" && campaign.targetIds.length > 0) {
    const parentCategories = await ParentCategory.find({ _id: { $in: campaign.targetIds } }).select("name")
    const subCategories = await SubCategory.find({ _id: { $in: campaign.targetIds } }).select("name")
    populatedCampaign.targetDetails = [...parentCategories, ...subCategories]
  }

  res.status(200).json({
    status: "success",
    data: {
      campaign: populatedCampaign,
    },
  })
})

// @desc    Update campaign
// @route   PATCH /api/campaigns/:id
// @access  Private/Admin
export const updateCampaign = catchAsync(async (req, res, next) => {
  // Parse JSON data if needed
  const campaignData = typeof req.body.campaignData === "string" ? JSON.parse(req.body.campaignData) : req.body

  // Get existing campaign
  const existingCampaign = await Campaign.findById(req.params.id)
  if (!existingCampaign) {
    return next(new AppError("Campaign not found", 404))
  }

  // Handle banner image
  let bannerImage = existingCampaign.bannerImage
  if (req.file) {
    // Delete old image if exists
    if (existingCampaign.bannerImage) {
      const publicId = getPublicIdFromUrl(existingCampaign.bannerImage)
      await deleteImage(publicId)
    }
    bannerImage = req.file.path
  }

  // Validate target IDs if being updated
  if (campaignData.targetIds && campaignData.type) {
    const type = campaignData.type
    const targetIds = campaignData.targetIds

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
  } else if (campaignData.targetIds && !campaignData.type) {
    // If targetIds are being updated but type is not provided, use existing type
    const type = existingCampaign.type
    const targetIds = campaignData.targetIds

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
  }

  // Update campaign
  const updatedCampaign = await Campaign.findByIdAndUpdate(
    req.params.id,
    { ...campaignData, bannerImage },
    {
      new: true,
      runValidators: true,
    },
  )

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

const applyDiscounts = async (campaign) => {
  console.log(`[APPLY DISCOUNTS] Starting application for campaign: ${campaign.title} (ID: ${campaign._id})`)
  console.log(`[APPLY DISCOUNTS] Campaign type: ${campaign.type}, Discount: ${campaign.discountValue}${campaign.discountType === 'percentage' ? '%' : ' fixed'}`)

  console.log(`[APPLY DISCOUNTS] Starting application for campaign: ${campaign.title}`)
  console.log(`[APPLY DISCOUNTS] Campaign discount type: ${campaign.discountType}, value: ${campaign.discountValue}`)


  const now = new Date()
  console.log(`[APPLY DISCOUNTS] Current time: ${now.toISOString()}`)

  try {
    if (campaign.type === "product") {
      console.log(`[APPLY DISCOUNTS] Processing product-based campaign`)
      
      for (const productId of campaign.targetIds) {
        console.log(`[APPLY DISCOUNTS] Processing product ID: ${productId}`)
        
        const product = await Product.findById(productId)
        if (!product) {
          console.log(`[APPLY DISCOUNTS] Product not found: ${productId}`)
          continue
        }

        console.log(`[APPLY DISCOUNTS] Applying to product: ${product.title} (ID: ${product._id})`)
        console.log(`[APPLY DISCOUNTS] Before application - CampaignActive: ${product.campaignDiscountActive}, Price: ${product.price}`)
        console.log(`[APPLY DISCOUNTS] Current discount - Type: ${product.discountType}, Percentage: ${product.discountPercentage}, Amount: ${product.discountAmount}`)

        // ✅ ১. Product-level original data backup
        if (!product.campaignDiscountActive) {
          console.log(`[APPLY DISCOUNTS] First time application - backing up current product discount data`)
          
          product.originalDiscountType = product.discountType
          
          // ✅ FIX: Discount type অনুযায়ী correct field backup
          if (product.discountType === "percentage") {
            product.originalDiscountPercentage = product.discountPercentage || 0
            product.originalDiscountAmount = 0
          } else if (product.discountType === "fixed") {
            product.originalDiscountPercentage = 0
            product.originalDiscountAmount = product.discountAmount || 0
          }
          
          product.originalDiscountStartTime = product.discountStartTime
          product.originalDiscountEndTime = product.discountEndTime
          
          console.log(`[APPLY DISCOUNTS] ✅ Product original discount backed up:`, {
            type: product.originalDiscountType,
            percentage: product.originalDiscountPercentage,
            amount: product.originalDiscountAmount
          })
        } else {
          console.log(`[APPLY DISCOUNTS] Campaign already active - checking if product original data needs update`)
          
          // Campaign active থাকলেও যদি product discount change হয়ে থাকে, তাহলে original update করুন
          const hasDiscountChanged = (
            product.originalDiscountType !== product.discountType ||
            product.originalDiscountPercentage !== (product.discountPercentage || 0) ||
            product.originalDiscountAmount !== (product.discountAmount || 0)
          )
          
          if (hasDiscountChanged) {
            console.log(`[APPLY DISCOUNTS] Product discount changed while campaign active - updating original data`)
            product.originalDiscountType = product.discountType
            
            // ✅ FIX: Discount type অনুযায়ী correct field update
            if (product.discountType === "percentage") {
              product.originalDiscountPercentage = product.discountPercentage || 0
              product.originalDiscountAmount = 0
            } else if (product.discountType === "fixed") {
              product.originalDiscountPercentage = 0
              product.originalDiscountAmount = product.discountAmount || 0
            }
            
            product.originalDiscountStartTime = product.discountStartTime
            product.originalDiscountEndTime = product.discountEndTime
          }
        }

        // ✅ ২. Product campaign discount fields set - FIXED
        product.campaignDiscountActive = true
        product.campaignDiscountType = campaign.discountType
        product.campaignDiscountStartTime = campaign.startDate
        product.campaignDiscountEndTime = campaign.endDate

        if (campaign.discountType === "percentage") {
          product.campaignDiscountPercentage = campaign.discountValue
          product.campaignDiscountAmount = 0
        } else if (campaign.discountType === "fixed") {
          product.campaignDiscountPercentage = 0
          product.campaignDiscountAmount = campaign.discountValue
        }

        // ✅ ৩. Product temporary discount fields set - FIXED
        product.discountType = campaign.discountType
        product.discountStartTime = campaign.startDate
        product.discountEndTime = campaign.endDate

        if (campaign.discountType === "percentage") {
          product.discountPercentage = campaign.discountValue
          product.discountAmount = 0
        } else if (campaign.discountType === "fixed") {
          product.discountPercentage = 0
          product.discountAmount = campaign.discountValue
        }

        // ✅ ৪. Product price calculation
        let discountValue = 0
        if (campaign.discountType === "percentage") {
          discountValue = (product.basePrice * campaign.discountValue) / 100
          console.log(`[APPLY DISCOUNTS] Product percentage discount: ${product.basePrice} * ${campaign.discountValue}% = ${discountValue}`)
        } else if (campaign.discountType === "fixed") {
          discountValue = campaign.discountValue
          console.log(`[APPLY DISCOUNTS] Product fixed discount: ${discountValue}`)
        }

        product.price = Math.max(0, product.basePrice - discountValue)
        console.log(`[APPLY DISCOUNTS] Product final price: ${product.basePrice} - ${discountValue} = ${product.price}`)

        // ✅ ৫. ভেরিয়েন্ট ডিসকাউন্ট ডেটা apply - FIXED
        if (product.variants && product.variants.length > 0) {
          console.log(`[APPLY DISCOUNTS] Processing ${product.variants.length} variants`)
          
          for (const variant of product.variants) {
            console.log(`[APPLY DISCOUNTS] Processing variant: ${variant.colorName} - ${variant.size}`)
            console.log(`[APPLY DISCOUNTS] Variant before - Discount: ${variant.discountPercentage}%, CampaignActive: ${variant.campaignDiscountActive}`)

            // ✅ CRITICAL FIX: Variant-এর original data backup - COMPLETE LOGIC
            if (!variant.campaignDiscountActive) {
              console.log(`[APPLY DISCOUNTS] First time application - backing up current variant discount data`)
              
              variant.originalDiscountType = variant.discountType || "percentage"
              
              // ✅ FIX: Discount type অনুযায়ী correct field backup
              if (variant.discountType === "percentage") {
                variant.originalDiscountPercentage = variant.discountPercentage !== undefined ? variant.discountPercentage : 0
                variant.originalDiscountAmount = 0
              } else if (variant.discountType === "fixed") {
                variant.originalDiscountPercentage = 0
                variant.originalDiscountAmount = variant.discountAmount !== undefined ? variant.discountAmount : 0
              }
              
              variant.originalDiscountStartTime = variant.discountStartTime
              variant.originalDiscountEndTime = variant.discountEndTime
              
              console.log(`[APPLY DISCOUNTS] ✅ Variant original backup:`, {
                type: variant.originalDiscountType,
                percentage: variant.originalDiscountPercentage,
                amount: variant.originalDiscountAmount
              })
            } else {
              console.log(`[APPLY DISCOUNTS] Campaign already active - checking if variant original data needs update`)
              
              // Campaign active থাকলেও যদি variant discount change হয়ে থাকে, তাহলে original update করুন
              const hasVariantDiscountChanged = (
                variant.originalDiscountType !== (variant.discountType || "percentage") ||
                variant.originalDiscountPercentage !== (variant.discountPercentage !== undefined ? variant.discountPercentage : 0) ||
                variant.originalDiscountAmount !== (variant.discountAmount !== undefined ? variant.discountAmount : 0)
              )
              
              if (hasVariantDiscountChanged) {
                console.log(`[APPLY DISCOUNTS] 🔄 Variant discount changed while campaign active - updating original data`)
                variant.originalDiscountType = variant.discountType || "percentage"
                
                // ✅ FIX: Discount type অনুযায়ী correct field update
                if (variant.discountType === "percentage") {
                  variant.originalDiscountPercentage = variant.discountPercentage !== undefined ? variant.discountPercentage : 0
                  variant.originalDiscountAmount = 0
                } else if (variant.discountType === "fixed") {
                  variant.originalDiscountPercentage = 0
                  variant.originalDiscountAmount = variant.discountAmount !== undefined ? variant.discountAmount : 0
                }
                
                variant.originalDiscountStartTime = variant.discountStartTime
                variant.originalDiscountEndTime = variant.discountEndTime
              }
            }

            // ✅ Variant campaign discount set - FIXED
            variant.campaignDiscountActive = true
            variant.campaignDiscountType = campaign.discountType
            variant.campaignDiscountStartTime = campaign.startDate
            variant.campaignDiscountEndTime = campaign.endDate

            if (campaign.discountType === "percentage") {
              variant.campaignDiscountPercentage = campaign.discountValue
              variant.campaignDiscountAmount = 0
            } else if (campaign.discountType === "fixed") {
              variant.campaignDiscountPercentage = 0
              variant.campaignDiscountAmount = campaign.discountValue
            }

            // ✅ Variant temporary discount set - FIXED
            variant.discountType = campaign.discountType
            variant.discountStartTime = campaign.startDate
            variant.discountEndTime = campaign.endDate

            if (campaign.discountType === "percentage") {
              variant.discountPercentage = campaign.discountValue
              variant.discountAmount = 0
            } else if (campaign.discountType === "fixed") {
              variant.discountPercentage = 0
              variant.discountAmount = campaign.discountValue
            }

            // ✅ Variant price calculation
            const variantBasePrice = variant.basePrice !== undefined ? variant.basePrice : product.basePrice
            let variantDiscountValue = 0
            
            if (campaign.discountType === "percentage") {
              variantDiscountValue = (variantBasePrice * campaign.discountValue) / 100
            } else if (campaign.discountType === "fixed") {
              variantDiscountValue = campaign.discountValue
            }

            variant.price = Math.max(0, variantBasePrice - variantDiscountValue)
            console.log(`[APPLY DISCOUNTS] Variant price: ${variantBasePrice} - ${variantDiscountValue} = ${variant.price}`)
          }
          
          product.markModified('variants')
          console.log(`[APPLY DISCOUNTS] Variants marked as modified`)
        }

        // ✅ ৬. প্রোডাক্ট সেভ
        await product.save()
        console.log(`[APPLY DISCOUNTS] ✅ Successfully applied campaign to product: ${product.title}`)
      }

    } else if (campaign.type === "category") {
      console.log(`[APPLY DISCOUNTS] Processing category-based campaign`)
      
      for (const categoryId of campaign.targetIds) {
        console.log(`[APPLY DISCOUNTS] Processing category ID: ${categoryId}`)
        
        let products = []
        const parentCategory = await ParentCategory.findById(categoryId)
        
        if (parentCategory) {
          console.log(`[APPLY DISCOUNTS] Found parent category: ${parentCategory.name}`)
          products = await Product.find({ parentCategoryId: categoryId })
        } else {
          const subCategory = await SubCategory.findById(categoryId)
          if (subCategory) {
            console.log(`[APPLY DISCOUNTS] Found sub category: ${subCategory.name}`)
            products = await Product.find({ subCategoryId: categoryId })
          }
        }

        console.log(`[APPLY DISCOUNTS] Found ${products.length} products in category`)

        for (const product of products) {
          console.log(`[APPLY DISCOUNTS] Applying to category product: ${product.title}`)

          // ✅ Category products-এর জন্য একই লজিক apply
          if (!product.campaignDiscountActive) {
            product.originalDiscountType = product.discountType
            product.originalDiscountPercentage = product.discountPercentage || 0
            product.originalDiscountAmount = product.discountAmount || 0
            product.originalDiscountStartTime = product.discountStartTime
            product.originalDiscountEndTime = product.discountEndTime
          }

          product.campaignDiscountActive = true
product.campaignDiscountType = campaign.discountType
product.campaignDiscountStartTime = campaign.startDate
product.campaignDiscountEndTime = campaign.endDate

if (campaign.discountType === "percentage") {
  product.campaignDiscountPercentage = campaign.discountValue
  product.campaignDiscountAmount = 0  // ✅ Percentage হলে amount 0
} else if (campaign.discountType === "fixed") {
  product.campaignDiscountPercentage = 0  // ✅ Fixed হলে percentage 0
  product.campaignDiscountAmount = campaign.discountValue
}

// ✅ Product temporary discount fields set - FIXED
product.discountType = campaign.discountType
product.discountStartTime = campaign.startDate
product.discountEndTime = campaign.endDate

if (campaign.discountType === "percentage") {
  product.discountPercentage = campaign.discountValue
  product.discountAmount = 0  // ✅ Percentage হলে amount 0
} else if (campaign.discountType === "fixed") {
  product.discountPercentage = 0  // ✅ Fixed হলে percentage 0
  product.discountAmount = campaign.discountValue
}

          // Price calculation
          let discountValue = 0
          if (campaign.discountType === "percentage") {
            discountValue = (product.basePrice * campaign.discountValue) / 100
          } else if (campaign.discountType === "fixed") {
            discountValue = campaign.discountValue
          }

          product.price = Math.max(0, product.basePrice - discountValue)

          // Variants processing
          if (product.variants && product.variants.length > 0) {
            for (const variant of product.variants) {
              if (!variant.campaignDiscountActive) {
                variant.originalDiscountType = variant.discountType
                variant.originalDiscountPercentage = variant.discountPercentage || 0
                variant.originalDiscountAmount = variant.discountAmount || 0
                variant.originalDiscountStartTime = variant.discountStartTime
                variant.originalDiscountEndTime = variant.discountEndTime
              }

              variant.campaignDiscountActive = true
              variant.campaignDiscountType = campaign.discountType
              variant.campaignDiscountStartTime = campaign.startDate
              variant.campaignDiscountEndTime = campaign.endDate

              if (campaign.discountType === "percentage") {
                variant.campaignDiscountPercentage = campaign.discountValue
                variant.campaignDiscountAmount = 0
              } else if (campaign.discountType === "fixed") {
                variant.campaignDiscountPercentage = 0
                variant.campaignDiscountAmount = campaign.discountValue
              }

              variant.discountType = campaign.discountType
              variant.discountStartTime = campaign.startDate
              variant.discountEndTime = campaign.endDate

              if (campaign.discountType === "percentage") {
                variant.discountPercentage = campaign.discountValue
                variant.discountAmount = 0
              } else if (campaign.discountType === "fixed") {
                variant.discountPercentage = 0
                variant.discountAmount = campaign.discountValue
              }

              const variantBasePrice = variant.basePrice || product.basePrice
              let variantDiscountValue = 0
              
              if (campaign.discountType === "percentage") {
                variantDiscountValue = (variantBasePrice * campaign.discountValue) / 100
              } else if (campaign.discountType === "fixed") {
                variantDiscountValue = campaign.discountValue
              }

              variant.price = Math.max(0, variantBasePrice - variantDiscountValue)
            }
            product.markModified('variants')
          }

          await product.save()
          console.log(`[APPLY DISCOUNTS] ✅ Successfully applied to category product: ${product.title}`)
        }
      }
    }

    console.log(`[APPLY DISCOUNTS] ✅ Completed application for campaign: ${campaign.title}`)
    
  } catch (error) {
    console.error(`[APPLY DISCOUNTS] ❌ Error applying discounts for campaign ${campaign.title}:`, error)
    throw error
  }
}

const removeDiscounts = async (campaign) => {
  console.log(`[REMOVE DISCOUNTS] Starting removal for campaign: ${campaign.title} (ID: ${campaign._id})`)
  console.log(`[REMOVE DISCOUNTS] Campaign type: ${campaign.type}, Target IDs: ${campaign.targetIds.length}`)

  const now = new Date()
  console.log(`[REMOVE DISCOUNTS] Current time: ${now.toISOString()}`)

  try {
    if (campaign.type === "product") {
      console.log(`[REMOVE DISCOUNTS] Processing product-based campaign`)
      
      for (const productId of campaign.targetIds) {
        console.log(`[REMOVE DISCOUNTS] Processing product ID: ${productId}`)
        
        const product = await Product.findById(productId)
        if (!product) {
          console.log(`[REMOVE DISCOUNTS] Product not found: ${productId}`)
          continue
        }

        console.log(`[REMOVE DISCOUNTS] Removing from product: ${product.title} (ID: ${product._id})`)
        console.log(`[REMOVE DISCOUNTS] Before removal - CampaignActive: ${product.campaignDiscountActive}, Price: ${product.price}`)

        // ✅ ১. Product-level আসল ডিসকাউন্ট ডেটা পুনরুদ্ধার
        if (product.originalDiscountType !== undefined) {
          product.discountType = product.originalDiscountType
          product.discountPercentage = product.originalDiscountPercentage || 0
          product.discountAmount = product.originalDiscountAmount || 0
          product.discountStartTime = product.originalDiscountStartTime
          product.discountEndTime = product.originalDiscountEndTime
          
          console.log(`[REMOVE DISCOUNTS] ✅ Product original discount restored: ${product.discountPercentage}% (Type: ${product.discountType})`)
          console.log(`[REMOVE DISCOUNTS] Product original discount time: ${product.discountStartTime} to ${product.discountEndTime}`)
        } else {
          console.log(`[REMOVE DISCOUNTS] ⚠️ No product original discount data found, resetting to default`)
          product.discountType = "percentage"
          product.discountPercentage = 0
          product.discountAmount = 0
          product.discountStartTime = undefined
          product.discountEndTime = undefined
        }

        // ✅ ২. Product campaign discount fields reset
        product.campaignDiscountActive = false
        product.campaignDiscountType = undefined
        product.campaignDiscountPercentage = 0
        product.campaignDiscountAmount = 0
        product.campaignDiscountStartTime = undefined
        product.campaignDiscountEndTime = undefined

        // ✅ ৩. Product price recalculation
        let discountValue = 0
        const isOriginalDiscountActive = (
          (product.discountPercentage > 0 || product.discountAmount > 0) &&
          product.discountStartTime &&
          product.discountEndTime &&
          now >= product.discountStartTime &&
          now <= product.discountEndTime
        )

        console.log(`[REMOVE DISCOUNTS] Product original discount active: ${isOriginalDiscountActive}`)

        if (isOriginalDiscountActive) {
          if (product.discountType === "percentage" && product.discountPercentage > 0) {
            discountValue = (product.basePrice * product.discountPercentage) / 100
            console.log(`[REMOVE DISCOUNTS] Applying product original percentage discount: ${product.discountPercentage}% = ${discountValue}`)
          } else if (product.discountType === "fixed" && product.discountAmount > 0) {
            discountValue = product.discountAmount
            console.log(`[REMOVE DISCOUNTS] Applying product original fixed discount: ${product.discountAmount}`)
          }
        } else {
          console.log(`[REMOVE DISCOUNTS] No active product discount, using base price`)
        }

        product.price = Math.max(0, product.basePrice - discountValue)
        console.log(`[REMOVE DISCOUNTS] Product final price: ${product.basePrice} - ${discountValue} = ${product.price}`)

        // ✅ ৪. ভেরিয়েন্ট ডিসকাউন্ট ডেটা পুনরুদ্ধার - CRITICAL FIX
        if (product.variants && product.variants.length > 0) {
          console.log(`[REMOVE DISCOUNTS] Processing ${product.variants.length} variants`)
          
          for (const variant of product.variants) {
            console.log(`[REMOVE DISCOUNTS] Processing variant: ${variant.colorName} - ${variant.size}`)
            console.log(`[REMOVE DISCOUNTS] Variant before - Discount: ${variant.discountPercentage}%, CampaignActive: ${variant.campaignDiscountActive}`)

            // ✅ CRITICAL FIX: Variant-এর আসল ডিসকাউন্ট ডেটা properly restore
            if (variant.originalDiscountType !== undefined) {
              variant.discountType = variant.originalDiscountType
              variant.discountPercentage = variant.originalDiscountPercentage || 0
              variant.discountAmount = variant.originalDiscountAmount || 0
              variant.discountStartTime = variant.originalDiscountStartTime
              variant.discountEndTime = variant.originalDiscountEndTime
              
              console.log(`[REMOVE DISCOUNTS] ✅ Variant restored to original: ${variant.discountPercentage}%`)
            } else {
              console.log(`[REMOVE DISCOUNTS] ⚠️ No variant original data, setting defaults`)
              variant.discountType = "percentage"
              variant.discountPercentage = 0
              variant.discountAmount = 0
              variant.discountStartTime = undefined
              variant.discountEndTime = undefined
            }

            // ✅ Variant campaign discount fields reset
            variant.campaignDiscountActive = false
            variant.campaignDiscountType = undefined
            variant.campaignDiscountPercentage = 0
            variant.campaignDiscountAmount = 0
            variant.campaignDiscountStartTime = undefined
            variant.campaignDiscountEndTime = undefined

            // ✅ Variant price recalculation
            const variantBasePrice = variant.basePrice !== undefined ? variant.basePrice : product.basePrice
            let variantDiscountValue = 0
            
            const isVariantDiscountActive = (
              (variant.discountPercentage > 0 || variant.discountAmount > 0) &&
              variant.discountStartTime &&
              variant.discountEndTime &&
              now >= variant.discountStartTime &&
              now <= variant.discountEndTime
            )

            if (isVariantDiscountActive) {
              if (variant.discountType === "percentage" && variant.discountPercentage > 0) {
                variantDiscountValue = (variantBasePrice * variant.discountPercentage) / 100
              } else if (variant.discountType === "fixed" && variant.discountAmount > 0) {
                variantDiscountValue = variant.discountAmount
              }
            }

            variant.price = Math.max(0, variantBasePrice - variantDiscountValue)
            console.log(`[REMOVE DISCOUNTS] Variant price: ${variantBasePrice} - ${variantDiscountValue} = ${variant.price}`)
            console.log(`[REMOVE DISCOUNTS] Variant after - Discount: ${variant.discountPercentage}%, CampaignActive: ${variant.campaignDiscountActive}`)
          }
          
          // ✅ Mongoose-কে variants change সম্পর্কে notify
          product.markModified('variants')
          console.log(`[REMOVE DISCOUNTS] Variants marked as modified`)
        }

        // ✅ ৫. প্রোডাক্ট সেভ
        await product.save()
        console.log(`[REMOVE DISCOUNTS] ✅ Successfully removed campaign from: ${product.title}`)
        console.log(`[REMOVE DISCOUNTS] After removal - CampaignActive: ${product.campaignDiscountActive}, Price: ${product.price}`)
      }

    } else if (campaign.type === "category") {
      console.log(`[REMOVE DISCOUNTS] Processing category-based campaign`)
      
      for (const categoryId of campaign.targetIds) {
        console.log(`[REMOVE DISCOUNTS] Processing category ID: ${categoryId}`)
        
        let products = []
        const parentCategory = await ParentCategory.findById(categoryId)
        
        if (parentCategory) {
          console.log(`[REMOVE DISCOUNTS] Found parent category: ${parentCategory.name}`)
          products = await Product.find({ parentCategoryId: categoryId })
        } else {
          const subCategory = await SubCategory.findById(categoryId)
          if (subCategory) {
            console.log(`[REMOVE DISCOUNTS] Found sub category: ${subCategory.name}`)
            products = await Product.find({ subCategoryId: categoryId })
          }
        }

        console.log(`[REMOVE DISCOUNTS] Found ${products.length} products in category`)

        for (const product of products) {
          console.log(`[REMOVE DISCOUNTS] Removing from category product: ${product.title}`)

          // ✅ Category products-এর জন্য একই লজিক apply
          if (product.originalDiscountType !== undefined) {
            product.discountType = product.originalDiscountType
            product.discountPercentage = product.originalDiscountPercentage || 0
            product.discountAmount = product.originalDiscountAmount || 0
            product.discountStartTime = product.originalDiscountStartTime
            product.discountEndTime = product.originalDiscountEndTime
          } else {
            product.discountType = "percentage"
            product.discountPercentage = 0
            product.discountAmount = 0
            product.discountStartTime = undefined
            product.discountEndTime = undefined
          }

          product.campaignDiscountActive = false
          product.campaignDiscountType = undefined
          product.campaignDiscountPercentage = 0
          product.campaignDiscountAmount = 0
          product.campaignDiscountStartTime = undefined
          product.campaignDiscountEndTime = undefined

          // Price recalculation
          let discountValue = 0
          const isOriginalDiscountActive = (
            (product.discountPercentage > 0 || product.discountAmount > 0) &&
            product.discountStartTime &&
            product.discountEndTime &&
            now >= product.discountStartTime &&
            now <= product.discountEndTime
          )

          if (isOriginalDiscountActive) {
            if (product.discountType === "percentage" && product.discountPercentage > 0) {
              discountValue = (product.basePrice * product.discountPercentage) / 100
            } else if (product.discountType === "fixed" && product.discountAmount > 0) {
              discountValue = product.discountAmount
            }
          }

          product.price = Math.max(0, product.basePrice - discountValue)

          // Variants processing
          if (product.variants && product.variants.length > 0) {
            for (const variant of product.variants) {
              if (variant.originalDiscountType !== undefined) {
                variant.discountType = variant.originalDiscountType
                variant.discountPercentage = variant.originalDiscountPercentage || 0
                variant.discountAmount = variant.originalDiscountAmount || 0
                variant.discountStartTime = variant.originalDiscountStartTime
                variant.discountEndTime = variant.originalDiscountEndTime
              } else {
                variant.discountType = "percentage"
                variant.discountPercentage = 0
                variant.discountAmount = 0
                variant.discountStartTime = undefined
                variant.discountEndTime = undefined
              }

              variant.campaignDiscountActive = false
              variant.campaignDiscountType = undefined
              variant.campaignDiscountPercentage = 0
              variant.campaignDiscountAmount = 0
              variant.campaignDiscountStartTime = undefined
              variant.campaignDiscountEndTime = undefined

              const variantBasePrice = variant.basePrice || product.basePrice
              let variantDiscountValue = 0
              
              const isVariantDiscountActive = (
                (variant.discountPercentage > 0 || variant.discountAmount > 0) &&
                variant.discountStartTime &&
                variant.discountEndTime &&
                now >= variant.discountStartTime &&
                now <= variant.discountEndTime
              )

              if (isVariantDiscountActive) {
                if (variant.discountType === "percentage" && variant.discountPercentage > 0) {
                  variantDiscountValue = (variantBasePrice * variant.discountPercentage) / 100
                } else if (variant.discountType === "fixed" && variant.discountAmount > 0) {
                  variantDiscountValue = variant.discountAmount
                }
              }

              variant.price = Math.max(0, variantBasePrice - variantDiscountValue)
            }
            product.markModified('variants')
          }

          await product.save()
          console.log(`[REMOVE DISCOUNTS] ✅ Successfully removed from category product: ${product.title}`)
        }
      }
    }

    console.log(`[REMOVE DISCOUNTS] ✅ Completed removal for campaign: ${campaign.title}`)
    
  } catch (error) {
    console.error(`[REMOVE DISCOUNTS] ❌ Error removing discounts for campaign ${campaign.title}:`, error)
    throw error
  }
}
