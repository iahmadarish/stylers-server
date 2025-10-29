// campaignCronJob.js - Complete Updated Version
import Campaign from "../models/Campaign.js"
import Product from "../models/Product.js"
import ParentCategory from "../models/ParentCategory.js" 
import SubCategory from "../models/SubCategory.js" 

// ----------------------------------------------------------------------
// A. Helper Functions
// ----------------------------------------------------------------------

// একটি একক প্রোডাক্টে ক্যাম্পেইন ডিসকাউন্ট প্রয়োগ
// const applyDiscountToProduct = async (product, campaign) => {
//   console.log(`[APPLY] Applying campaign to product: ${product.title}`)
  
//   // ১. শুধুমাত্র যদি campaignDiscountActive ইতিমধ্যে false থাকে তবেই original ডেটা সেভ করুন
//   if (!product.campaignDiscountActive) {
//     product.originalDiscountType = product.discountType
//     product.originalDiscountPercentage = product.discountPercentage || 0
//     product.originalDiscountAmount = product.discountAmount || 0
//     product.originalDiscountStartTime = product.discountStartTime
//     product.originalDiscountEndTime = product.discountEndTime
//     console.log(`[APPLY] Original discount saved: ${product.originalDiscountPercentage}%`)
//   }

//   // ২. ক্যাম্পেইন ডিসকাউন্ট সেট করুন
//   product.campaignDiscountActive = true
//   product.campaignDiscountType = campaign.discountType
//   product.campaignDiscountPercentage = campaign.discountValue
//   product.campaignDiscountAmount = 0
//   product.campaignDiscountStartTime = campaign.startDate
//   product.campaignDiscountEndTime = campaign.endDate

//   // ৩. বর্তমান ডিসকাউন্ট temporarily ক্যাম্পেইন ডিসকাউন্টে সেট করুন
//   product.discountType = campaign.discountType
//   product.discountPercentage = campaign.discountValue
//   product.discountAmount = 0
//   product.discountStartTime = campaign.startDate
//   product.discountEndTime = campaign.endDate

//   // ৪. ভেরিয়েন্টগুলোর জন্য ক্যাম্পেইন ডিসকাউন্ট প্রয়োগ
//   if (product.variants && product.variants.length > 0) {
//     for (const variant of product.variants) {
//       // শুধুমাত্র যদি campaignDiscountActive ইতিমধ্যে false থাকে তবেই original ডেটা সেভ করুন
//       if (!variant.campaignDiscountActive) {
//         variant.originalDiscountType = variant.discountType
//         variant.originalDiscountPercentage = variant.discountPercentage || 0
//         variant.originalDiscountAmount = variant.discountAmount || 0
//         variant.originalDiscountStartTime = variant.discountStartTime
//         variant.originalDiscountEndTime = variant.discountEndTime
//       }

//       // ক্যাম্পেইন ডিসকাউন্ট সেট করুন
//       variant.campaignDiscountActive = true
//       variant.campaignDiscountType = campaign.discountType
//       variant.campaignDiscountPercentage = campaign.discountValue
//       variant.campaignDiscountAmount = 0
//       variant.campaignDiscountStartTime = campaign.startDate
//       variant.campaignDiscountEndTime = campaign.endDate

//       // বর্তমান ডিসকাউন্ট temporarily ক্যাম্পেইন ডিসকাউন্টে সেট করুন
//       variant.discountType = campaign.discountType
//       variant.discountPercentage = campaign.discountValue
//       variant.discountAmount = 0
//       variant.discountStartTime = campaign.startDate
//       variant.discountEndTime = campaign.endDate
//     }
//   }

//   console.log(`[APPLY] Campaign discount applied: ${campaign.discountValue}%`)
  
//   return product
// }

// #############

const applyDiscountToProduct = async (product, campaign) => {
  console.log(`[APPLY] Applying campaign to product: ${product.title}`)
  console.log(`[APPLY] Campaign type: ${campaign.discountType}, value: ${campaign.discountValue}`)
  
  // ১. শুধুমাত্র যদি campaignDiscountActive ইতিমধ্যে false থাকে তবেই original ডেটা সেভ করুন
  if (!product.campaignDiscountActive) {
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
    console.log(`[APPLY] Original discount saved: ${product.originalDiscountPercentage}% / ${product.originalDiscountAmount} fixed`)
  }

  // ২. ক্যাম্পেইন ডিসকাউন্ট সেট করুন - FIXED
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

  // ৩. বর্তমান ডিসকাউন্ট temporarily ক্যাম্পেইন ডিসকাউন্টে সেট করুন - FIXED
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

  // ৪. ভেরিয়েন্টগুলোর জন্য ক্যাম্পেইন ডিসকাউন্ট প্রয়োগ - FIXED
  if (product.variants && product.variants.length > 0) {
    for (const variant of product.variants) {
      // শুধুমাত্র যদি campaignDiscountActive ইতিমধ্যে false থাকে তবেই original ডেটা সেভ করুন
      if (!variant.campaignDiscountActive) {
        variant.originalDiscountType = variant.discountType || "percentage"
        
        // ✅ FIX: Discount type অনুযায়ী correct field backup
        if (variant.discountType === "percentage") {
          variant.originalDiscountPercentage = variant.discountPercentage || 0
          variant.originalDiscountAmount = 0
        } else if (variant.discountType === "fixed") {
          variant.originalDiscountPercentage = 0
          variant.originalDiscountAmount = variant.discountAmount || 0
        }
        
        variant.originalDiscountStartTime = variant.discountStartTime
        variant.originalDiscountEndTime = variant.discountEndTime
      }

      // ক্যাম্পেইন ডিসকাউন্ট সেট করুন - FIXED
      variant.campaignDiscountActive = true
      variant.campaignDiscountType = campaign.discountType
      variant.campaignDiscountStartTime = campaign.startDate
      variant.campaignDiscountEndTime = campaign.endDate

      if (campaign.discountType === "percentage") {
        variant.campaignDiscountPercentage = campaign.discountValue
        variant.campaignDiscountAmount = 0  // ✅ Percentage হলে amount 0
      } else if (campaign.discountType === "fixed") {
        variant.campaignDiscountPercentage = 0  // ✅ Fixed হলে percentage 0
        variant.campaignDiscountAmount = campaign.discountValue
      }

      // বর্তমান ডিসকাউন্ট temporarily ক্যাম্পেইন ডিসকাউন্টে সেট করুন - FIXED
      variant.discountType = campaign.discountType
      variant.discountStartTime = campaign.startDate
      variant.discountEndTime = campaign.endDate

      if (campaign.discountType === "percentage") {
        variant.discountPercentage = campaign.discountValue
        variant.discountAmount = 0  // ✅ Percentage হলে amount 0
      } else if (campaign.discountType === "fixed") {
        variant.discountPercentage = 0  // ✅ Fixed হলে percentage 0
        variant.discountAmount = campaign.discountValue
      }
    }
  }

  console.log(`[APPLY] Campaign discount applied: ${campaign.discountValue}${campaign.discountType === 'percentage' ? '%' : ' fixed amount'}`)
  
  return product
}

// #############

const removeDiscountFromProduct = (product) => {
  console.log(`[REMOVE] Removing campaign discount from: ${product.title}`)
  
  // ✅ ১. Product-level restoration - FIXED LOGIC
  console.log(`[REMOVE] Product original data:`, {
    type: product.originalDiscountType,
    percentage: product.originalDiscountPercentage,
    amount: product.originalDiscountAmount
  })
  
  if (product.originalDiscountType !== undefined) {
    product.discountType = product.originalDiscountType
    product.discountPercentage = product.originalDiscountPercentage !== undefined ? product.originalDiscountPercentage : 0
    product.discountAmount = product.originalDiscountAmount !== undefined ? product.originalDiscountAmount : 0
    product.discountStartTime = product.originalDiscountStartTime
    product.discountEndTime = product.originalDiscountEndTime
    
    console.log(`[REMOVE] ✅ Product restored to: ${product.discountPercentage}% (Type: ${product.discountType})`)
  } else {
    console.log(`[REMOVE] ⚠️ No product original data, resetting to default`)
    product.discountType = "percentage"
    product.discountPercentage = 0
    product.discountAmount = 0
    product.discountStartTime = undefined
    product.discountEndTime = undefined
  }
  
  // ✅ ২. Product campaign fields reset
  product.campaignDiscountActive = false
  product.campaignDiscountType = undefined
  product.campaignDiscountPercentage = 0
  product.campaignDiscountAmount = 0
  product.campaignDiscountStartTime = undefined
  product.campaignDiscountEndTime = undefined

  // ✅ ৩. Variant-level restoration - CRITICAL FIX
  if (product.variants && product.variants.length > 0) {
    console.log(`[REMOVE] Restoring ${product.variants.length} variants`)
    
    for (const variant of product.variants) {
      console.log(`[REMOVE] Restoring variant: ${variant.colorName} - ${variant.size}`)
      console.log(`[REMOVE] Variant original data:`, {
        type: variant.originalDiscountType,
        percentage: variant.originalDiscountPercentage,
        amount: variant.originalDiscountAmount
      })
      
      // ✅ CRITICAL FIX: Check if variant had specific original discount
      if (variant.originalDiscountType !== undefined) {
        variant.discountType = variant.originalDiscountType
        variant.discountPercentage = variant.originalDiscountPercentage !== undefined ? variant.originalDiscountPercentage : 0
        variant.discountAmount = variant.originalDiscountAmount !== undefined ? variant.originalDiscountAmount : 0
        variant.discountStartTime = variant.originalDiscountStartTime
        variant.discountEndTime = variant.originalDiscountEndTime
        
        console.log(`[REMOVE] ✅ Variant restored to original: ${variant.discountPercentage}%`)
      } else {
        // ✅ যদি variant-এর আলাদা original discount না থাকে, তাহলে product-level discount use করবে না
        // বরং default (0%) set করবে
        console.log(`[REMOVE] ⚠️ No variant-specific original data, resetting to default (0%)`)
        variant.discountType = "percentage"
        variant.discountPercentage = 0
        variant.discountAmount = 0
        variant.discountStartTime = undefined
        variant.discountEndTime = undefined
      }

      // Variant campaign fields reset
      variant.campaignDiscountActive = false
      variant.campaignDiscountType = undefined
      variant.campaignDiscountPercentage = 0
      variant.campaignDiscountAmount = 0
      variant.campaignDiscountStartTime = undefined
      variant.campaignDiscountEndTime = undefined

      console.log(`[REMOVE] Variant after - Discount: ${variant.discountPercentage}%`)
    }
    
    product.markModified('variants')
    console.log(`[REMOVE] Variants marked as modified`)
  }

  console.log(`[REMOVE] Campaign discount removed from: ${product.title}`)
  
  return product
}

// ক্যাম্পেইন ডিসকাউন্ট প্রয়োগের প্রধান ফাংশন
const applyDiscounts = async (campaign) => {
  if (!campaign.isActive) return 
  
  console.log(`[APPLY DISCOUNTS] Applying campaign: ${campaign.title} to ${campaign.targetIds.length} targets`)
  console.log(`[APPLY DISCOUNTS] Campaign type: ${campaign.discountType}, value: ${campaign.discountValue}`)
  
  if (campaign.type === "product") {
    for (const productId of campaign.targetIds) {
      const product = await Product.findById(productId)
      if (product) {
        console.log(`[APPLY DISCOUNTS] Applying to product: ${product.title}`)
        await applyDiscountToProduct(product, campaign)
        await product.save() 
        console.log(`[APPLY DISCOUNTS] Successfully applied to: ${product.title}`)
      }
    }
  } else if (campaign.type === "category") {
    for (const categoryId of campaign.targetIds) {
      let productQuery = {}
      const parentCategory = await ParentCategory.findById(categoryId)
      if (parentCategory) {
        productQuery.parentCategoryId = categoryId
      } else {
        const subCategory = await SubCategory.findById(categoryId)
        if (subCategory) {
          productQuery.subCategoryId = categoryId
        }
      }
      if (Object.keys(productQuery).length > 0) {
        const products = await Product.find(productQuery)
        console.log(`[APPLY DISCOUNTS] Found ${products.length} products in category`)
        for (const product of products) {
          await applyDiscountToProduct(product, campaign)
          await product.save() 
        }
      }
    }
  }
}

// একটি ছোট সহায়ক ফাংশন যা affected product IDs খুঁজে বের করে
const getAffectedProductIds = async (campaign) => {
  let productIds = []
  if (campaign.type === "product") {
    productIds = campaign.targetIds
  } else if (campaign.type === "category") {
    for (const categoryId of campaign.targetIds) {
      let tempQuery = {}
      const parentCategory = await ParentCategory.findById(categoryId)
      if (parentCategory) {
        tempQuery.parentCategoryId = categoryId
      } else {
        const subCategory = await SubCategory.findById(categoryId)
        if (subCategory) {
          tempQuery.subCategoryId = categoryId
        }
      }
      if (Object.keys(tempQuery).length > 0) {
        const categoryProducts = await Product.find(tempQuery, { _id: 1 })
        productIds.push(...categoryProducts.map(p => p._id))
      }
    }
  }
  return [...new Set(productIds.map(String))]
}

// ক্যাম্পেইন ডিসকাউন্ট অপসারণের প্রধান ফাংশন
const removeDiscounts = async (campaign) => {
  const uniqueProductIds = await getAffectedProductIds(campaign)
  
  console.log(`[CRON REMOVE] Removing discounts from ${uniqueProductIds.length} products`)
  
  for (const productId of uniqueProductIds) {
    const product = await Product.findById(productId)
    if (product) {
      console.log(`[CRON REMOVE] Processing product: ${product.title}`)
      
      // শুধুমাত্র removeDiscountFromProduct call করুন
      removeDiscountFromProduct(product)
      
      // ✅ IMPORTANT: product.save() call করুন - pre-save hook price calculate করবে
      await product.save()
      
      console.log(`[CRON REMOVE] ✅ Successfully processed: ${product.title}`)
    }
  }
}

// ----------------------------------------------------------------------
// B. Main Exported Job
// ----------------------------------------------------------------------

export const runCampaignDiscountJob = async () => {
  console.log('[CAMPAIGN CRON] Running full discount update check...')
  const now = new Date()
  
  console.log(`[CAMPAIGN CRON] Current UTC time: ${now.toISOString()}`)

  try {
    // --- A. মেয়াদ শেষ হওয়া ক্যাম্পেইন খুঁজে বের করে ডিসকাউন্ট অপসারণ করা ---
    const campaignsToDeactivate = await Campaign.find({
      endDate: { $lt: now }, 
      isActive: true,
    })

    console.log(`[CAMPAIGN CRON] Found ${campaignsToDeactivate.length} expired campaigns to remove.`)
    
    for (const campaign of campaignsToDeactivate) {
      console.log(`[CAMPAIGN CRON] Removing campaign: ${campaign.title}, End: ${campaign.endDate}`)
      await removeDiscounts(campaign)
      // ক্যাম্পেইনটি Inactive করে দিন 
      await Campaign.findByIdAndUpdate(campaign._id, { isActive: false })
      console.log(`[CAMPAIGN CRON] Campaign deactivated: ${campaign.title}`)
    }

    // --- B. বর্তমানে Active হওয়ার কথা এমন ক্যাম্পেইন খুঁজে বের করে প্রয়োগ করা ---
    const campaignsToActivate = await Campaign.find({
      startDate: { $lte: now },
      endDate: { $gte: now },
      isActive: true,
    })

    console.log(`[CAMPAIGN CRON] Found ${campaignsToActivate.length} campaigns to activate/re-apply.`)
    
    for (const campaign of campaignsToActivate) {
      console.log(`[CAMPAIGN CRON] Applying campaign: ${campaign.title}`)
      await applyDiscounts(campaign) 
      console.log(`[CAMPAIGN CRON] Campaign applied: ${campaign.title}`)
    }

    // --- C. সাধারণ প্রোডাক্ট ডিসকাউন্ট আপডেট করা ---
    try {
      if (Product.updateDiscountPrices) { 
        console.log('[CRON] Running Product.updateDiscountPrices() for standard discounts...')
        await Product.updateDiscountPrices() 
        console.log('[CRON] Product.updateDiscountPrices completed')
      }
    } catch(error) {
      console.error('[CRON] Error in Product.updateDiscountPrices:', error)
    }

    console.log('[CAMPAIGN CRON] Finished successfully.')
    
  } catch (error) {
    console.error('[CAMPAIGN CRON] Error:', error)
  }
}

// ----------------------------------------------------------------------
// C. Utility Functions for Debugging
// ----------------------------------------------------------------------

export const debugProductDiscount = async (productId) => {
  const product = await Product.findById(productId)
  if (!product) {
    console.log('Product not found')
    return
  }

  console.log('=== PRODUCT DISCOUNT DEBUG ===')
  console.log('Product:', product.title)
  console.log('Base Price:', product.basePrice)
  console.log('Current Price:', product.price)
  console.log('Campaign Active:', product.campaignDiscountActive)
  console.log('Campaign Discount:', product.campaignDiscountPercentage + '%')
  console.log('Regular Discount:', product.discountPercentage + '%')
  console.log('Original Discount:', product.originalDiscountPercentage + '%')
  console.log('Discount Type:', product.discountType)
  console.log('Campaign Discount Type:', product.campaignDiscountType)
  
  const now = new Date()
  console.log('Current Time:', now.toISOString())
  console.log('Discount Start:', product.discountStartTime)
  console.log('Discount End:', product.discountEndTime)
  console.log('Campaign Start:', product.campaignDiscountStartTime)
  console.log('Campaign End:', product.campaignDiscountEndTime)
  
  // Check which discount should be active
  const isCampaignActive = product.campaignDiscountActive && 
    product.campaignDiscountStartTime && 
    product.campaignDiscountEndTime &&
    now >= product.campaignDiscountStartTime && 
    now <= product.campaignDiscountEndTime

  const isRegularActive = (product.discountPercentage > 0 || product.discountAmount > 0) &&
    product.discountStartTime &&
    product.discountEndTime &&
    now >= product.discountStartTime &&
    now <= product.discountEndTime

  console.log('Should Campaign be active:', isCampaignActive)
  console.log('Should Regular be active:', isRegularActive)
  console.log('Calculated Price should be:', product.getCurrentPrice())
  console.log('=== END DEBUG ===')
}

export const manuallyFixProductDiscount = async (productId) => {
  const product = await Product.findById(productId)
  if (!product) {
    console.log('Product not found')
    return
  }

  console.log('=== MANUAL FIX START ===')
  console.log('Before fix - CampaignActive:', product.campaignDiscountActive, 'Price:', product.price)
  
  // Reset to regular discount
  if (product.campaignDiscountActive) {
    await removeDiscountFromProduct(product)
    await product.save()
  }

  console.log('After fix - CampaignActive:', product.campaignDiscountActive, 'Price:', product.price)
  console.log('=== MANUAL FIX COMPLETE ===')
}

export const checkCampaignStatus = async (campaignId) => {
  const campaign = await Campaign.findById(campaignId)
  if (!campaign) {
    console.log('Campaign not found')
    return
  }

  const now = new Date()
  console.log('=== CAMPAIGN STATUS CHECK ===')
  console.log('Campaign:', campaign.title)
  console.log('Is Active:', campaign.isActive)
  console.log('Start Date:', campaign.startDate)
  console.log('End Date:', campaign.endDate)
  console.log('Current Time:', now.toISOString())
  console.log('Should be active:', now >= campaign.startDate && now <= campaign.endDate)
  console.log('=== END CHECK ===')
}

