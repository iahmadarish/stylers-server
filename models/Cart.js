import mongoose from "mongoose"

const cartItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    // ✅ Updated to match Product model's variant structure
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false, // For specific size+color combination from product variants
    },
    // Store selected variant details for quick access
    selectedVariant: {
      productCode: {
        type: String,
        required: false,
      },
      colorCode: {
        type: String,
        required: false,
      },
      colorName: {
        type: String,
        required: false,
      },
      size: {
        type: String,
        required: false,
      },
      dimension: {
        type: String,
        required: false,
      },
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, "Quantity must be at least 1"],
      default: 1,
    },
    // Store calculated prices at the time of adding to cart
    basePrice: {
      type: Number,
      required: true,
      min: [0, "Base price cannot be negative"],
    },
    discountedPrice: {
      type: Number,
      required: true,
      min: [0, "Discounted price cannot be negative"],
    },
    discountPercentage: {
      type: Number,
      default: 0,
      min: [0, "Discount percentage cannot be negative"],
      max: [100, "Discount percentage cannot exceed 100"],
    },
    totalPrice: {
      type: Number,
      required: true,
      min: [0, "Total price cannot be negative"],
    },
    // Store discount timing info for reference
    discountStartTime: {
      type: Date,
      required: false,
    },
    discountEndTime: {
      type: Date,
      required: false,
    },
    // Flag to check if discount was active when added
    wasDiscountActive: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
)

const cartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // One cart per user
    },
    items: [cartItemSchema],
    // Summary calculations
    totalBaseAmount: {
      type: Number,
      default: 0,
      min: [0, "Total base amount cannot be negative"],
    },
    totalDiscountAmount: {
      type: Number,
      default: 0,
      min: [0, "Total discount amount cannot be negative"],
    },
    finalAmount: {
      type: Number,
      default: 0,
      min: [0, "Final amount cannot be negative"],
    },
    itemCount: {
      type: Number,
      default: 0,
      min: [0, "Item count cannot be negative"],
    },
  },
  {
    timestamps: true,
  },
)

// ✅ Calculate cart totals method
cartSchema.methods.calculateTotals = function () {
  let totalBaseAmount = 0
  let totalDiscountAmount = 0
  let itemCount = 0

  this.items.forEach((item) => {
    const itemBasePrice = Number(item.basePrice) || 0
    const itemDiscountedPrice = Number(item.discountedPrice) || 0
    const itemQuantity = Number(item.quantity) || 0

    totalBaseAmount += itemBasePrice * itemQuantity
    totalDiscountAmount += (itemBasePrice - itemDiscountedPrice) * itemQuantity
    itemCount += itemQuantity
  })

  this.totalBaseAmount = Math.round(totalBaseAmount)
  this.totalDiscountAmount = Math.round(totalDiscountAmount)
  this.finalAmount = Math.round(totalBaseAmount - totalDiscountAmount)
  this.itemCount = itemCount

  return {
    totalBaseAmount: this.totalBaseAmount,
    totalDiscountAmount: this.totalDiscountAmount,
    finalAmount: this.finalAmount,
    itemCount: this.itemCount,
  }
}

// ✅ Method to check if any discounts have expired and update prices
cartSchema.methods.refreshPrices = async function () {
  const Product = mongoose.model("Product")
  const now = new Date()
  
  let updatedItemsCount = 0
  let campaignEndedItems = []

  console.log("🔄 Starting cart price refresh...")

  for (let [index, item] of this.items.entries()) {
    try {
      const product = await Product.findById(item.productId)
      if (!product) continue

      if (!product.isActive) continue

      let variant = null
      if (item.variantId && product.variants && product.variants.length > 0) {
        variant = product.variants.id(item.variantId)
      }

      // ✅ CHECK IF ITEM WAS ADDED WITH FORCED DISCOUNT
      // Jodi item recently add hoye thake (within 1 hour) and wasDiscountActive true, 
      // tahole client-calculated price preserve korun
      const itemAddedTime = item.addedAt ? new Date(item.addedAt) : new Date()
      const timeSinceAdded = now - itemAddedTime
      const isRecentlyAdded = timeSinceAdded < (60 * 60 * 1000) // 1 hour

      if (isRecentlyAdded && item.wasDiscountActive) {
        console.log(`🔒 Preserving forced discount for recently added item: "${product.title}"`)
        continue // Skip price refresh for this item
      }

      // Store old prices for comparison
      const oldDiscountedPrice = item.discountedPrice
      const oldWasDiscountActive = item.wasDiscountActive

      // Calculate current pricing
      const currentPricing = this.calculateCurrentPrice(product, variant, now)

      // Check if prices changed
      const priceChanged = 
        oldDiscountedPrice !== currentPricing.discountedPrice ||
        oldWasDiscountActive !== currentPricing.isCampaignActive

      if (priceChanged) {
        updatedItemsCount++

        // Track campaign ended items
        if (oldWasDiscountActive && !currentPricing.isCampaignActive) {
          campaignEndedItems.push(product.title)
        }

        console.log(`💰 Price updated for "${product.title}":`, {
          oldPrice: oldDiscountedPrice,
          newPrice: currentPricing.discountedPrice,
          oldDiscountActive: oldWasDiscountActive,
          newDiscountActive: currentPricing.isCampaignActive,
          variant: variant?.size
        })

        // Update item with new prices
        item.basePrice = currentPricing.originalPrice
        item.originalPrice = currentPricing.originalPrice
        item.discountedPrice = currentPricing.discountedPrice
        item.discountPercentage = currentPricing.discountPercentage
        item.discountAmount = currentPricing.discountAmount
        item.discountType = currentPricing.discountType
        item.wasDiscountActive = currentPricing.isCampaignActive
        item.totalPrice = Math.round(currentPricing.discountedPrice * item.quantity)

        // Update discount timing
        if (variant) {
          item.discountStartTime = variant.discountStartTime
          item.discountEndTime = variant.discountEndTime
        } else {
          item.discountStartTime = product.discountStartTime
          item.discountEndTime = product.discountEndTime
        }
      }

    } catch (error) {
      console.error(`❌ Error refreshing price for item ${index}:`, error)
    }
  }

  // Recalculate cart totals
  this.calculateTotals()

  console.log(`✅ Price refresh completed: ${updatedItemsCount} items updated`)
  if (campaignEndedItems.length > 0) {
    console.log(`🎯 Campaigns ended for:`, campaignEndedItems)
  }

  return {
    updatedItemsCount,
    campaignEndedItems,
    totalBaseAmount: this.totalBaseAmount,
    finalAmount: this.finalAmount,
    totalDiscountAmount: this.totalDiscountAmount
  }
}

// ✅ ADD THIS calculateCurrentPrice METHOD TO CART SCHEMA
cartSchema.methods.calculateCurrentPrice = function(product, variant, now = new Date()) {
  // Helper function to round prices
  const roundPrice = (price) => {
    if (typeof price !== 'number' || isNaN(price)) return 0;
    const numPrice = Number(price);
    const fractionalPart = Math.abs((numPrice * 100) % 100) / 100;
    return fractionalPart >= 0.50 ? Math.ceil(numPrice) : Math.floor(numPrice);
  };

  // Get original price
  let originalPrice = Number(
    variant?.basePrice || product?.basePrice || variant?.price || product?.price || 0
  );

  // Check if discount is currently active based on time
  const isDiscountTimeActive = (entity) => {
    if (!entity) return false;
    
    // Check time-based discount first
    if (entity.discountStartTime && entity.discountEndTime) {
      const startTime = new Date(entity.discountStartTime);
      const endTime = new Date(entity.discountEndTime);
      const isTimeActive = now >= startTime && now <= endTime;
      
      // If time constraints exist, only return true if within time
      if (isTimeActive) {
        return (entity.discountPercentage > 0 || entity.discountAmount > 0);
      }
      return false;
    }
    
    // If no time constraints, discount is considered active if values exist
    return (entity.discountPercentage > 0 || entity.discountAmount > 0);
  };

  const discountActive = variant ? 
    isDiscountTimeActive(variant) : 
    isDiscountTimeActive(product);

  let discountedPrice = originalPrice;
  let discountPercentage = 0;
  let discountAmount = 0;
  let discountType = "none";

  if (discountActive) {
    const entity = variant || product;
    discountType = entity.discountType || "percentage";
    
    if (discountType === "percentage") {
      discountPercentage = Number(entity.discountPercentage || 0);
      discountAmount = (originalPrice * discountPercentage) / 100;
      discountedPrice = Math.max(0.01, originalPrice - discountAmount);
    } else if (discountType === "fixed") {
      discountAmount = Number(entity.discountAmount || 0);
      discountedPrice = Math.max(0.01, originalPrice - discountAmount);
      discountPercentage = originalPrice > 0 ? 
        Math.round((discountAmount / originalPrice) * 100) : 0;
    }
  }

  // Apply rounding
  originalPrice = roundPrice(originalPrice);
  discountedPrice = roundPrice(discountedPrice);
  discountAmount = roundPrice(discountAmount);

  // Ensure valid prices
  originalPrice = Math.max(originalPrice, 0.01);
  discountedPrice = Math.max(discountedPrice, 0.01);

  // Ensure discounted price doesn't exceed original price
  if (discountedPrice > originalPrice) {
    discountedPrice = originalPrice;
    discountPercentage = 0;
    discountAmount = 0;
    discountType = "none";
  }

  return {
    originalPrice,
    discountedPrice,
    discountPercentage,
    discountAmount,
    discountType,
    isCampaignActive: discountActive
  };
};


cartSchema.methods.calculateCurrentItemPrice = async function (product, variant, currentTime = new Date()) {
  let currentPrice = 0
  let currentBasePrice = 0
  let currentDiscount = 0
  let discountActive = false
  let discountType = "none"

  const isCampaignActive = (item) => {
    if (!item.discountStartTime && !item.discountEndTime) {
      return (item.discountPercentage > 0 || item.discountAmount > 0)
    }
    
    const startTime = item.discountStartTime ? new Date(item.discountStartTime) : null
    const endTime = item.discountEndTime ? new Date(item.discountEndTime) : null
    
    if (startTime && endTime) {
      return currentTime >= startTime && currentTime <= endTime
    } else if (startTime && !endTime) {
      return currentTime >= startTime
    } else if (!startTime && endTime) {
      return currentTime <= endTime
    }
    
    return false
  }

  if (variant) {
    // Use variant pricing
    currentBasePrice = variant.basePrice || product.basePrice || variant.price || product.price || 0
    currentPrice = variant.price || product.price || 0
    
    // Check if variant discount is active
    const variantDiscountActive = isCampaignActive(variant)
    
    if (variantDiscountActive) {
      // Campaign is active - use discounted price
      discountActive = true
      discountType = variant.discountType || "percentage"
      
      if (discountType === "fixed" && variant.discountAmount > 0) {
        currentDiscount = 0 // For fixed amount, we don't store percentage
        currentPrice = Math.max(0, currentBasePrice - variant.discountAmount)
      } else {
        currentDiscount = variant.discountPercentage || 0
        currentPrice = currentBasePrice - (currentBasePrice * currentDiscount / 100)
      }
    } else {
      // Campaign ended - use base price
      discountActive = false
      currentDiscount = 0
      currentPrice = currentBasePrice
    }
  } else {
    // Use product pricing
    currentBasePrice = product.basePrice || product.price || 0
    currentPrice = product.price || 0
    
    // Check if product discount is active
    const productDiscountActive = isCampaignActive(product)
    
    if (productDiscountActive) {
      // Campaign is active - use discounted price
      discountActive = true
      discountType = product.discountType || "percentage"
      
      if (discountType === "fixed" && product.discountAmount > 0) {
        currentDiscount = 0
        currentPrice = Math.max(0, currentBasePrice - product.discountAmount)
      } else {
        currentDiscount = product.discountPercentage || 0
        currentPrice = currentBasePrice - (currentBasePrice * currentDiscount / 100)
      }
    } else {
      // Campaign ended - use base price
      discountActive = false
      currentDiscount = 0
      currentPrice = currentBasePrice
    }
  }

  // Ensure prices are valid
  currentBasePrice = Math.max(0.01, currentBasePrice)
  currentPrice = Math.max(0.01, currentPrice)

  return {
    currentPrice,
    currentBasePrice,
    currentDiscount,
    discountActive,
    discountType
  }
}

// ✅ Pre-save middleware to calculate totals
cartSchema.pre('save', function (next) {
  this.calculateTotals()
  next()
})

// ✅ Indexes for better performance
cartSchema.index({ userId: 1 })
cartSchema.index({ 'items.productId': 1 })
cartSchema.index({ 'items.variantId': 1 })
cartSchema.index({ updatedAt: -1 })

// ✅ Check if model already exists before creating
const Cart = mongoose.models.Cart || mongoose.model("Cart", cartSchema)

export default Cart