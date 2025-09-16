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
  
  for (let item of this.items) {
    try {
      const product = await Product.findById(item.productId)
      if (!product) continue

      let currentPrice = 0
      let currentBasePrice = 0
      let currentDiscount = 0
      let discountActive = false

      if (item.variantId && product.variants.length > 0) {
        // Get current variant price
        const variant = product.variants.id(item.variantId)
        if (variant) {
          currentPrice = product.getCurrentPrice(item.variantId)
          currentBasePrice = variant.basePrice || product.basePrice
          
          // Check if variant discount is active
          discountActive = product.isVariantDiscountActive(item.variantId)
          if (discountActive) {
            currentDiscount = variant.discountPercentage || product.discountPercentage
          }
        }
      } else {
        // Get current product price
        currentPrice = product.getCurrentPrice()
        currentBasePrice = product.basePrice
        
        // Check if product discount is active
        discountActive = product.isDiscountActive()
        if (discountActive) {
          currentDiscount = product.discountPercentage
        }
      }

      // Update item prices if they have changed
      item.basePrice = currentBasePrice
      item.discountedPrice = currentPrice
      item.discountPercentage = currentDiscount
      item.wasDiscountActive = discountActive
      item.totalPrice = Math.round(currentPrice * item.quantity)
      
    } catch (error) {
      console.error(`Error refreshing price for item ${item._id}:`, error)
    }
  }

  this.calculateTotals()
  return this
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