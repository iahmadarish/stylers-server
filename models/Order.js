

import mongoose from "mongoose"

const orderItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  productTitle: {
    type: String,
    required: true,
  },
  productImage: {
    type: String,
    required: true,
    default: "/placeholder.svg?height=200&width=200",
  },
  variantId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
  },
  variantDetails: {
    size: String,
    dimension: String,
  },
  colorVariantId: {
    type: mongoose.Schema.Types.ObjectId,
    required: false,
  },
  colorVariantDetails: {
    name: String,
    code: String,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  originalPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  discountedPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  discountPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  totalOriginalPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  totalDiscountedPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
})

const orderSchema = new mongoose.Schema(
  {
    // Make userId optional for guest orders
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Changed from true to false
    },
    // Add guest order identification
    isGuestOrder: {
      type: Boolean,
      default: false,
    },
    // Guest customer information (only for guest orders)
    guestCustomerInfo: {
      name: {
        type: String,
        required: function () {
          return this.isGuestOrder
        },
      },
      email: {
        type: String,
        required: function () {
          return this.isGuestOrder
        },
      },
      phone: {
        type: String,
        required: function () {
          return this.isGuestOrder
        },
      },
    },
    orderNumber: {
      type: String,
      unique: true,
      required: true,
    },
    transactionId: {
      type: String,
      unique: true,
      sparse: true,
    },
    items: [orderItemSchema],
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    totalDiscount: {
      type: Number,
      default: 0,
      min: 0,
    },
    couponCode: {
      type: String,
      default: null,
    },
    couponDiscount: {
      type: Number,
      default: 0,
      min: 0,
    },
    shippingCost: {
      type: Number,
      default: 0,
      min: 0,
    },
    tax: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded", "cancelled"],
      default: "pending",
    },
    shippingAddress: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      email: String,
      address: { type: String, required: true },
      city: String,
      state: String,
      zipCode: String,
      country: { type: String, default: "Bangladesh" },
    },
    // Add billing address for guest orders
    billingAddress: {
      fullName: String,
      phone: String,
      email: String,
      address: String,
      city: String,
      state: String,
      zipCode: String,
      country: { type: String, default: "Bangladesh" },
      sameAsShipping: { type: Boolean, default: true },
    },
    paymentMethod: {
      type: String,
      enum: ["cash_on_delivery", "card", "mobile_banking"],
      required: true,
    },
    specialInstructions: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  },
)

// Add validation to ensure either userId or guest info is provided
// order.controller.js - order creation logic এ
orderSchema.pre("save", function (next) {
  // Calculate discountAmount properly for each item
  this.items.forEach(item => {
    // Ensure discountedPrice is not higher than originalPrice
    const actualDiscountedPrice = Math.min(item.discountedPrice, item.originalPrice)
    
    // Calculate discount amount per item
    const discountPerItem = item.originalPrice - actualDiscountedPrice
    
    // Update item prices
    item.discountedPrice = actualDiscountedPrice
    item.discountAmount = Math.max(0, discountPerItem) // ✅ Negative হলে 0 set কর
    item.totalDiscountedPrice = actualDiscountedPrice * item.quantity
    
    // Recalculate totals if needed
    item.totalOriginalPrice = item.originalPrice * item.quantity
  })
  
  next()
})

// Check if model already exists before creating
const Order = mongoose.models.Order || mongoose.model("Order", orderSchema)

export default Order
