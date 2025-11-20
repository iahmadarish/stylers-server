

import Cart from "../models/Cart.js"
import Product from "../models/Product.js"
import Order from "../models/Order.js"

// Get checkout summary
export const getCheckoutSummary = async (req, res) => {
  try {
    const { userId } = req.params

    // Get user's cart
    const cart = await Cart.findOne({ userId }).populate("items.productId")
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" })
    }

    // Validate cart items and check stock
    const validationErrors = []
    const updatedItems = []

    for (const item of cart.items) {
      const product = item.productId

      // Check if product is still active
      if (!product.isActive) {
        validationErrors.push(`Product "${product.title}" is no longer available`)
        continue
      }

      // Check variant stock if applicable
      if (item.variantId) {
        const variant = product.variants.id(item.variantId)
        if (!variant || variant.stock < item.quantity) {
          validationErrors.push(
            `Insufficient stock for "${product.title}" - ${variant?.size || "Unknown size"}. Available: ${variant?.stock || 0}, Requested: ${item.quantity}`,
          )
          continue
        }
      }

      // Check color variant stock if applicable
      if (item.colorVariantId) {
        const colorVariant = product.colorVariants.id(item.colorVariantId)
        if (!colorVariant || colorVariant.stock < item.quantity) {
          validationErrors.push(
            `Insufficient stock for "${product.title}" - ${colorVariant?.name || "Unknown color"}. Available: ${colorVariant?.stock || 0}, Requested: ${item.quantity}`,
          )
          continue
        }
      }

      // Check general product stock
      if (product.stock < item.quantity) {
        validationErrors.push(
          `Insufficient stock for "${product.title}". Available: ${product.stock}, Requested: ${item.quantity}`,
        )
        continue
      }

      // Recalculate pricing (in case prices changed)
      const currentPricing = product.getPricingDetails(item.variantId)

      const updatedItem = {
        ...item.toObject(),
        originalPrice: currentPricing.originalPrice,
        discountedPrice: currentPricing.discountedPrice,
        discountPercentage: currentPricing.discountPercentage,
        totalPrice: currentPricing.discountedPrice * item.quantity,
        priceChanged: item.discountedPrice !== currentPricing.discountedPrice,
      }

      updatedItems.push(updatedItem)
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        message: "Cart validation failed",
        errors: validationErrors,
      })
    }

    // Calculate totals
    let subtotal = 0
    let totalDiscount = 0
    let totalOriginalAmount = 0

    updatedItems.forEach((item) => {
      const itemOriginalTotal = item.originalPrice * item.quantity
      const itemDiscountedTotal = item.discountedPrice * item.quantity

      totalOriginalAmount += itemOriginalTotal
      subtotal += itemDiscountedTotal
      totalDiscount += itemOriginalTotal - itemDiscountedTotal
    })

    // Calculate shipping (you can customize this logic)
    const shippingCost = calculateShippingCost(subtotal)

    // Calculate tax (you can customize this logic)
    const taxRate = 0.05 // 5% tax
    const tax = Math.round(subtotal * taxRate)

    const finalTotal = subtotal + shippingCost + tax

    const checkoutSummary = {
      items: updatedItems,
      pricing: {
        totalOriginalAmount,
        subtotal,
        totalDiscount,
        shippingCost,
        tax,
        taxRate: taxRate * 100,
        finalTotal,
      },
      itemCount: updatedItems.length,
      totalQuantity: updatedItems.reduce((sum, item) => sum + item.quantity, 0),
    }

    res.status(200).json({
      message: "Checkout summary retrieved successfully",
      checkout: checkoutSummary,
    })
  } catch (error) {
    console.error("Get checkout summary error:", error)
    res.status(500).json({ message: "Internal server error", error: error.message })
  }
}

// Apply coupon code
export const applyCoupon = async (req, res) => {
  try {
    const { userId, couponCode } = req.body

    // Get user's cart
    const cart = await Cart.findOne({ userId }).populate("items.productId")
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" })
    }

    // Validate coupon (you can create a Coupon model for this)
    const couponDiscount = validateCoupon(couponCode, cart.finalAmount)

    if (!couponDiscount.isValid) {
      return res.status(400).json({ message: couponDiscount.message })
    }

    res.status(200).json({
      message: "Coupon applied successfully",
      coupon: {
        code: couponCode,
        discount: couponDiscount.discount,
        type: couponDiscount.type, // 'percentage' or 'fixed'
      },
    })
  } catch (error) {
    console.error("Apply coupon error:", error)
    res.status(500).json({ message: "Internal server error", error: error.message })
  }
}

// Process checkout and create order
export const processCheckout = async (req, res) => {
  try {
    const { userId, shippingAddress, paymentMethod, couponCode = null, specialInstructions = "" } = req.body

    // Validate required fields
    if (!shippingAddress || !paymentMethod) {
      return res.status(400).json({ message: "Shipping address and payment method are required" })
    }

    // Get user's cart
    const cart = await Cart.findOne({ userId }).populate("items.productId")
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" })
    }

    // Re-validate cart items and stock (final check)
    const validationErrors = []
    const orderItems = []
    let subtotal = 0
    let totalDiscount = 0

    for (const cartItem of cart.items) {
      const product = cartItem.productId

      // Final stock check
      if (cartItem.variantId) {
        const variant = product.variants.id(cartItem.variantId)
        if (!variant || variant.stock < cartItem.quantity) {
          validationErrors.push(`Insufficient stock for ${product.title} - ${variant?.size}`)
          continue
        }
      }

      if (cartItem.colorVariantId) {
        const colorVariant = product.colorVariants.id(cartItem.colorVariantId)
        if (!colorVariant || colorVariant.stock < cartItem.quantity) {
          validationErrors.push(`Insufficient stock for ${product.title} - ${colorVariant?.name}`)
          continue
        }
      }

      if (product.stock < cartItem.quantity) {
        validationErrors.push(`Insufficient stock for ${product.title}`)
        continue
      }

      // Get current pricing
      const pricingDetails = product.getPricingDetails(cartItem.variantId)

      // Get variant and color variant details
      let variantDetails = null
      if (cartItem.variantId) {
        const variant = product.variants.id(cartItem.variantId)
        variantDetails = {
          size: variant.size,
          dimension: variant.dimension,
        }
      }

      let colorVariantDetails = null
      if (cartItem.colorVariantId) {
        const colorVariant = product.colorVariants.id(cartItem.colorVariantId)
        colorVariantDetails = {
          name: colorVariant.name,
          code: colorVariant.code,
        }
      }

      const totalOriginalPrice = pricingDetails.originalPrice * cartItem.quantity
      const totalDiscountedPrice = pricingDetails.discountedPrice * cartItem.quantity
      const itemDiscountAmount = totalOriginalPrice - totalDiscountedPrice

      const orderItem = {
        productId: product._id,
        productTitle: product.title,
        productImage: colorVariantDetails?.images?.[0] || product.images[0] || "",
        variantId: cartItem.variantId,
        variantDetails,
        colorVariantId: cartItem.colorVariantId,
        colorVariantDetails,
        quantity: cartItem.quantity,
        originalPrice: pricingDetails.originalPrice,
        discountedPrice: pricingDetails.discountedPrice,
        discountPercentage: pricingDetails.discountPercentage,
        totalOriginalPrice,
        totalDiscountedPrice,
        discountAmount: itemDiscountAmount,
      }

      orderItems.push(orderItem)
      subtotal += totalDiscountedPrice
      totalDiscount += itemDiscountAmount
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        message: "Checkout validation failed",
        errors: validationErrors,
      })
    }

    // Apply coupon if provided
    let couponDiscount = 0
    if (couponCode) {
      const couponValidation = validateCoupon(couponCode, subtotal)
      if (couponValidation.isValid) {
        couponDiscount = couponValidation.discount
        subtotal -= couponDiscount
      }
    }

    // Calculate shipping and tax
    const shippingCost = calculateShippingCost(subtotal)
    const tax = Math.round(subtotal * 0.05) // 5% tax
    const finalTotal = subtotal + shippingCost + tax

    // Create order
    const order = new Order({
      userId,
      items: orderItems,
      subtotal: subtotal + couponDiscount, // Original subtotal before coupon
      totalDiscount: totalDiscount + couponDiscount,
      shippingCost,
      tax,
      totalAmount: finalTotal,
      shippingAddress,
      paymentMethod,
      couponCode,
      couponDiscount,
      specialInstructions,
    })

    await order.save()

    // Update product stock
    for (const item of orderItems) {
      const product = await Product.findById(item.productId)

      if (item.variantId) {
        const variant = product.variants.id(item.variantId)
        if (variant) {
          variant.stock = Math.max(0, variant.stock - item.quantity)
        }
      }

      if (item.colorVariantId) {
        const colorVariant = product.colorVariants.id(item.colorVariantId)
        if (colorVariant) {
          colorVariant.stock = Math.max(0, colorVariant.stock - item.quantity)
        }
      }

      product.stock = Math.max(0, product.stock - item.quantity)
      await product.save()
    }

    // Clear cart
    await Cart.findOneAndUpdate(
      { userId },
      {
        items: [],
        totalAmount: 0,
        totalDiscountAmount: 0,
        finalAmount: 0,
      },
    )

    res.status(201).json({
      message: "Order placed successfully",
      order: {
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        status: order.status,
        paymentStatus: order.paymentStatus,
        _id: order._id,
      },
    })
  } catch (error) {
    console.error("Process checkout error:", error)
    res.status(500).json({ message: "Internal server error", error: error.message })
  }
}

// Helper function to calculate shipping cost
function calculateShippingCost(subtotal) {
  if (subtotal >= 4000) {
    return 0 // Free shipping for orders above 2000 BDT
  } else if (subtotal >= 1000) {
    return 130 // 50 BDT for orders above 1000 BDT
  } else {
    return 130 // 100 BDT for orders below 1000 BDT
  }
}

// Helper function to validate coupon
function validateCoupon(couponCode, subtotal) {
  // This is a simple example. You should create a proper Coupon model
  const coupons = {
    SAVE10: { type: "percentage", value: 10, minAmount: 500 },
    FLAT50: { type: "fixed", value: 50, minAmount: 300 },
    WELCOME20: { type: "percentage", value: 20, minAmount: 1000 },
  }

  const coupon = coupons[couponCode.toUpperCase()]

  if (!coupon) {
    return { isValid: false, message: "Invalid coupon code" }
  }

  if (subtotal < coupon.minAmount) {
    return {
      isValid: false,
      message: `Minimum order amount of ৳${coupon.minAmount} required for this coupon`,
    }
  }

  let discount = 0
  if (coupon.type === "percentage") {
    discount = Math.round((subtotal * coupon.value) / 100)
  } else {
    discount = coupon.value
  }

  return {
    isValid: true,
    discount,
    type: coupon.type,
    message: "Coupon applied successfully",
  }
}
