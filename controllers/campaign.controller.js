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
  const campaignData = typeof req.body.campaignData === "string" ? JSON.parse(req.body.campaignData) : req.body
  const bannerImage = req.file ? req.file.path : undefined

console.log('🕒 Campaign Time Analysis:', {
    receivedStart: campaignData.startDate,
    receivedEnd: campaignData.endDate,
    bangladeshStart: new Date(campaignData.startDate).toLocaleString('en-BD', { timeZone: 'Asia/Dhaka' }),
    bangladeshEnd: new Date(campaignData.endDate).toLocaleString('en-BD', { timeZone: 'Asia/Dhaka' })
  });


  const { title, type, targetIds, discountType, discountValue, startDate, endDate, couponCode } = campaignData

  // ✅ সময় ভ্যালিডেশন যোগ করুন
  const now = new Date()
  const campaignStartDate = new Date(startDate)
  const campaignEndDate = new Date(endDate)

  if (campaignStartDate <= now) {
    return next(new AppError("Campaign start date must be in the future", 400))
  }

  if (campaignEndDate <= campaignStartDate) {
    return next(new AppError("Campaign end date must be after start date", 400))
  }

  // ... existing validation code ...

  // Create campaign
  const campaign = await Campaign.create({
    title,
    type,
    targetIds,
    discountType,
    discountValue,
    startDate: campaignStartDate,
    endDate: campaignEndDate,
    bannerImage,
    couponCode,
  })

  // ✅ FIX: Campaign start date future হলে এখনই apply করবেন না
  // শুধুমাত্র যদি campaign এখনই active হয় তবেই apply করুন
  if (campaignStartDate <= now && campaignEndDate >= now) {
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
