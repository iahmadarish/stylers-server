import Cart from "../models/Cart.js"
import Product from "../models/Product.js"
import mongoose from "mongoose"

// ✅ Add item to cart with proper variant handling
// controllers/cartController.js - addToCart ফাংশন আপডেট করুন
export const addToCart = async (req, res) => {
  try {
    const {
      userId,
      productId,
      variantId,
      quantity = 1,
      // ✅ ACCEPT ALL PRICING FIELDS FROM CLIENT
      originalPrice,
      discountedPrice,
      discountPercentage,
      totalPrice,
      basePrice,
      forceDiscount = false,
      // ✅ ADD THESE NEW FIELDS FOR DISCOUNT TYPE SUPPORT
      discountAmount,
      discountType = "percentage"
    } = req.body

    console.log("=== ADD TO CART REQUEST ===")
    console.log("Received data:", { 
      userId, 
      productId, 
      variantId, 
      quantity,
      originalPrice,
      discountedPrice,
      discountPercentage,
      totalPrice,
      basePrice,
      forceDiscount,
      discountAmount,
      discountType
    })

    // ✅ ENHANCED VALIDATION
    if (!userId || !productId) {
      return res.status(400).json({ 
        success: false,
        message: "User ID and Product ID are required" 
      })
    }

    // Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid User ID or Product ID format" 
      })
    }

    if (variantId && !mongoose.Types.ObjectId.isValid(variantId)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid Variant ID format" 
      })
    }

    if (quantity < 1 || quantity > 100) {
      return res.status(400).json({ 
        success: false,
        message: "Quantity must be between 1 and 100" 
      })
    }

    // Get product details
    const product = await Product.findById(productId)
    if (!product) {
      return res.status(404).json({ 
        success: false,
        message: "Product not found" 
      })
    }

    if (!product.isActive) {
      return res.status(400).json({ 
        success: false,
        message: "Product is not active" 
      })
    }

    console.log("✅ Product found:", product.title)

    // Validate and get variant details if variantId is provided
    let variant = null
    let selectedVariant = null
    
    if (variantId) {
      variant = product.variants.id(variantId)
      if (!variant) {
        return res.status(404).json({ 
          success: false,
          message: "Variant not found" 
        })
      }

      // Check stock availability
      if (variant.stock < quantity) {
        return res.status(400).json({ 
          success: false,
          message: `Insufficient stock. Available: ${variant.stock}` 
        })
      }

      selectedVariant = {
        productCode: variant.productCode,
        colorCode: variant.colorCode,
        colorName: variant.colorName,
        size: variant.size,
        dimension: variant.dimension,
      }

      console.log("✅ Variant selected:", selectedVariant)
    } else {
      // Check product-level stock
      if (product.stock < quantity) {
        return res.status(400).json({ 
          success: false,
          message: `Insufficient stock. Available: ${product.stock}` 
        })
      }
    }

    // ✅ ENHANCED PRICE CALCULATION WITH DISCOUNT TYPE SUPPORT
    let finalBasePrice = 0;
    let finalDiscountedPrice = 0;
    let finalDiscountPercentage = 0;
    let finalDiscountAmount = 0;
    let discountActive = false;
    let discountStartTime = null;
    let discountEndTime = null;

    // If client sent calculated prices and forceDiscount is true, use them
    if (forceDiscount && discountedPrice !== undefined && basePrice !== undefined) {
      console.log("💰 Using client-calculated prices with forced discount");
      
      finalBasePrice = Number(basePrice) || 0;
      finalDiscountedPrice = Number(discountedPrice) || 0;
      finalDiscountPercentage = Number(discountPercentage) || 0;
      finalDiscountAmount = Number(discountAmount) || 0;
      
      // Validate prices
      if (finalBasePrice <= 0 || finalDiscountedPrice <= 0) {
        return res.status(400).json({ 
          success: false,
          message: "Invalid price values provided" 
        })
      }

      discountActive = finalDiscountPercentage > 0 || finalDiscountAmount > 0;
      
      // Set discount timing based on product/variant
      if (variantId && variant) {
        discountStartTime = variant.discountStartTime;
        discountEndTime = variant.discountEndTime;
      } else {
        discountStartTime = product.discountStartTime;
        discountEndTime = product.discountEndTime;
      }
    } else {
      // ✅ FALLBACK TO SERVER-SIDE PRICE CALCULATION
      console.log("💰 Using server-calculated prices");
      
      if (variantId && variant) {
        // Use variant pricing
        finalBasePrice = Number(variant.basePrice || product.basePrice || variant.price || product.price || 0);
        finalDiscountedPrice = Number(variant.price || product.price || 0);
        
        // Calculate discount based on discount type
        if (variant.discountType === "fixed" && variant.discountAmount > 0) {
          finalDiscountAmount = Number(variant.discountAmount) || 0;
          finalDiscountedPrice = Math.max(0, finalBasePrice - finalDiscountAmount);
          finalDiscountPercentage = finalBasePrice > 0 ? 
            Math.round((finalDiscountAmount / finalBasePrice) * 100) : 0;
        } else {
          // Percentage discount
          finalDiscountPercentage = Number(variant.discountPercentage || product.discountPercentage || 0);
          finalDiscountedPrice = finalBasePrice - (finalBasePrice * finalDiscountPercentage / 100);
          finalDiscountAmount = finalBasePrice - finalDiscountedPrice;
        }
        
        discountActive = product.isVariantDiscountActive(variantId);
        discountStartTime = variant.discountStartTime;
        discountEndTime = variant.discountEndTime;
      } else {
        // Use product pricing
        finalBasePrice = Number(product.basePrice || product.price || 0);
        finalDiscountedPrice = Number(product.price || 0);
        
        // Calculate discount based on discount type
        if (product.discountType === "fixed" && product.discountAmount > 0) {
          finalDiscountAmount = Number(product.discountAmount) || 0;
          finalDiscountedPrice = Math.max(0, finalBasePrice - finalDiscountAmount);
          finalDiscountPercentage = finalBasePrice > 0 ? 
            Math.round((finalDiscountAmount / finalBasePrice) * 100) : 0;
        } else {
          // Percentage discount
          finalDiscountPercentage = Number(product.discountPercentage || 0);
          finalDiscountedPrice = finalBasePrice - (finalBasePrice * finalDiscountPercentage / 100);
          finalDiscountAmount = finalBasePrice - finalDiscountedPrice;
        }
        
        discountActive = product.isDiscountActive();
        discountStartTime = product.discountStartTime;
        discountEndTime = product.discountEndTime;
      }

      // Ensure prices are valid
      finalBasePrice = Math.max(0.01, finalBasePrice);
      finalDiscountedPrice = Math.max(0.01, finalDiscountedPrice);
    }

    console.log("✅ Final price calculation:", {
      basePrice: finalBasePrice,
      discountedPrice: finalDiscountedPrice,
      discountPercentage: finalDiscountPercentage,
      discountAmount: finalDiscountAmount,
      discountActive,
      forceDiscount
    })

    // Find or create cart
    let cart = await Cart.findOne({ userId })
    if (!cart) {
      cart = new Cart({ userId, items: [] })
      console.log("🆕 Created new cart for user:", userId)
    }

    // Check if item already exists in cart (same product + variant combination)
    const existingItemIndex = cart.items.findIndex(item => {
      const sameProduct = item.productId.toString() === productId;
      const sameVariant = (!variantId && !item.variantId) || 
                         (variantId && item.variantId?.toString() === variantId);
      return sameProduct && sameVariant;
    })

    const cartItemData = {
      productId: new mongoose.Types.ObjectId(productId),
      variantId: variantId ? new mongoose.Types.ObjectId(variantId) : null,
      selectedVariant,
      quantity: Number(quantity),
      originalPrice: finalBasePrice,
      basePrice: finalBasePrice,
      discountedPrice: finalDiscountedPrice,
      discountPercentage: discountActive ? finalDiscountPercentage : 0,
      discountAmount: discountActive ? finalDiscountAmount : 0,
      totalPrice: Math.round(finalDiscountedPrice * quantity),
      discountStartTime,
      discountEndTime,
      wasDiscountActive: discountActive,
    }

    if (existingItemIndex > -1) {
      // Update existing item quantity
      const existingItem = cart.items[existingItemIndex]
      const newQuantity = existingItem.quantity + Number(quantity)
      
      // Check stock again for new quantity
      const availableStock = variantId ? variant.stock : product.stock
      if (newQuantity > availableStock) {
        return res.status(400).json({ 
          success: false,
          message: `Cannot add ${quantity} more items. Maximum available: ${availableStock - existingItem.quantity}` 
        })
      }

      existingItem.quantity = newQuantity
      existingItem.totalPrice = Math.round(finalDiscountedPrice * newQuantity)
      
      console.log("✅ Updated existing item quantity:", newQuantity)
    } else {
      // Add new item to cart
      cart.items.push(cartItemData)
      console.log("✅ Added new item to cart")
    }

    // Save cart (this will trigger calculateTotals via pre-save middleware)
    await cart.save()

    // Populate product details for response
    await cart.populate({
      path: 'items.productId',
      select: 'title slug images brand basePrice price discountPercentage discountType discountAmount'
    })

    console.log("✅ CART UPDATED SUCCESSFULLY")
    console.log("Final cart:", {
      items: cart.items.length,
      totalBaseAmount: cart.totalBaseAmount,
      finalAmount: cart.finalAmount
    })

    res.status(200).json({
      success: true,
      message: "Item added to cart successfully",
      data: {
        cart,
        addedItem: cartItemData
      }
    })

  } catch (error) {
    console.error("❌ Add to cart error:", error)
    
    // More specific error messages
    let errorMessage = "Internal server error"
    if (error.name === 'CastError') {
      errorMessage = "Invalid ID format"
    } else if (error.name === 'ValidationError') {
      errorMessage = "Validation failed: " + Object.values(error.errors).map(e => e.message).join(', ')
    }
    
    res.status(500).json({ 
      success: false,
      message: errorMessage, 
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}

// ✅ Get cart with price refresh
export const getCart = async (req, res) => {
  try {
    const { userId } = req.params

    if (!userId) {
      return res.status(400).json({ 
        success: false,
        message: "User ID is required" 
      })
    }

    let cart = await Cart.findOne({ userId }).populate({
      path: 'items.productId',
      select: 'title slug images brand basePrice price discountPercentage isActive stock'
    })

    if (!cart) {
      return res.status(200).json({
        success: true,
        data: {
          cart: { 
            items: [], 
            totalBaseAmount: 0, 
            totalDiscountAmount: 0, 
            finalAmount: 0,
            itemCount: 0
          }
        }
      })
    }

    // Refresh prices to ensure they're current
    await cart.refreshPrices()
    await cart.save()

    // Re-populate after price refresh
    await cart.populate({
      path: 'items.productId',
      select: 'title slug images brand basePrice price discountPercentage isActive stock'
    })

    res.status(200).json({ 
      success: true,
      data: { cart } 
    })

  } catch (error) {
    console.error("Get cart error:", error)
    res.status(500).json({ 
      success: false,
      message: "Internal server error", 
      error: error.message 
    })
  }
}

// ✅ Update cart item quantity
export const updateCartItem = async (req, res) => {
  try {
    const { userId, itemId, quantity } = req.body

    if (!userId || !itemId) {
      return res.status(400).json({ 
        success: false,
        message: "User ID and Item ID are required" 
      })
    }

    if (quantity < 1) {
      return res.status(400).json({ 
        success: false,
        message: "Quantity must be at least 1" 
      })
    }

    const cart = await Cart.findOne({ userId })
    if (!cart) {
      return res.status(404).json({ 
        success: false,
        message: "Cart not found" 
      })
    }

    const item = cart.items.id(itemId)
    if (!item) {
      return res.status(404).json({ 
        success: false,
        message: "Cart item not found" 
      })
    }

    // Get product to check stock
    const product = await Product.findById(item.productId)
    if (!product) {
      return res.status(404).json({ 
        success: false,
        message: "Product not found" 
      })
    }

    // Check stock availability
    let availableStock = product.stock
    if (item.variantId) {
      const variant = product.variants.id(item.variantId)
      if (variant) {
        availableStock = variant.stock
      }
    }

    if (quantity > availableStock) {
      return res.status(400).json({ 
        success: false,
        message: `Insufficient stock. Available: ${availableStock}` 
      })
    }

    // Update quantity and recalculate total
    item.quantity = quantity
    item.totalPrice = Math.round(item.discountedPrice * quantity)

    await cart.save() // This will trigger calculateTotals

    // Populate for response
    await cart.populate({
      path: 'items.productId',
      select: 'title slug images brand basePrice price discountPercentage'
    })

    res.status(200).json({
      success: true,
      message: "Cart item updated successfully",
      data: { cart }
    })

  } catch (error) {
    console.error("Update cart item error:", error)
    res.status(500).json({ 
      success: false,
      message: "Internal server error", 
      error: error.message 
    })
  }
}

// ✅ Remove item from cart
export const removeFromCart = async (req, res) => {
  try {
    const { userId, itemId } = req.body

    if (!userId || !itemId) {
      return res.status(400).json({ 
        success: false,
        message: "User ID and Item ID are required" 
      })
    }

    const cart = await Cart.findOne({ userId })
    if (!cart) {
      return res.status(404).json({ 
        success: false,
        message: "Cart not found" 
      })
    }

    const itemExists = cart.items.id(itemId)
    if (!itemExists) {
      return res.status(404).json({ 
        success: false,
        message: "Cart item not found" 
      })
    }

    // Remove item
    cart.items.pull(itemId)
    await cart.save() // This will trigger calculateTotals

    // Populate for response
    await cart.populate({
      path: 'items.productId',
      select: 'title slug images brand basePrice price discountPercentage'
    })

    res.status(200).json({
      success: true,
      message: "Item removed from cart successfully",
      data: { cart }
    })

  } catch (error) {
    console.error("Remove from cart error:", error)
    res.status(500).json({ 
      success: false,
      message: "Internal server error", 
      error: error.message 
    })
  }
}

// ✅ Clear entire cart
export const clearCart = async (req, res) => {
  try {
    const { userId } = req.body

    if (!userId) {
      return res.status(400).json({ 
        success: false,
        message: "User ID is required" 
      })
    }

    await Cart.findOneAndUpdate(
      { userId },
      {
        items: [],
        totalBaseAmount: 0,
        totalDiscountAmount: 0,
        finalAmount: 0,
        itemCount: 0,
      },
      { new: true }
    )

    res.status(200).json({ 
      success: true,
      message: "Cart cleared successfully" 
    })

  } catch (error) {
    console.error("Clear cart error:", error)
    res.status(500).json({ 
      success: false,
      message: "Internal server error", 
      error: error.message 
    })
  }
}

// ✅ Delete cart completely
export const deleteCart = async (req, res) => {
  try {
    const { userId } = req.body

    if (!userId) {
      return res.status(400).json({ 
        success: false,
        message: "User ID is required" 
      })
    }

    await Cart.findOneAndDelete({ userId })

    res.status(200).json({ 
      success: true,
      message: "Cart deleted completely" 
    })

  } catch (error) {
    console.error("Delete cart error:", error)
    res.status(500).json({ 
      success: false,
      message: "Internal server error", 
      error: error.message 
    })
  }
}

// ✅ Refresh cart prices (useful for scheduled updates)
export const refreshCartPrices = async (req, res) => {
  try {
    const { userId } = req.params

    if (!userId) {
      return res.status(400).json({ 
        success: false,
        message: "User ID is required" 
      })
    }

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid User ID format" 
      })
    }

    console.log("🔄 Refreshing cart prices for user:", userId)

    const cart = await Cart.findOne({ userId })
    if (!cart) {
      return res.status(404).json({ 
        success: false,
        message: "Cart not found" 
      })
    }

    console.log(`📦 Found cart with ${cart.items.length} items`)

    // Enhanced price refresh with campaign awareness
    await cart.refreshPrices()
    await cart.save()

    // Enhanced population with more fields
    await cart.populate({
      path: 'items.productId',
      select: 'title slug images brand basePrice price discountPercentage discountType discountAmount discountStartTime discountEndTime isActive stock variants'
    })

    console.log("✅ Cart prices refreshed successfully")
    console.log("📊 Cart summary after refresh:", {
      totalItems: cart.items.length,
      totalBaseAmount: cart.totalBaseAmount,
      finalAmount: cart.finalAmount,
      totalDiscount: cart.totalDiscountAmount
    })

    res.status(200).json({
      success: true,
      message: "Cart prices refreshed successfully",
      data: { 
        cart,
        summary: {
          itemsUpdated: cart.items.length,
          totalBaseAmount: cart.totalBaseAmount,
          finalAmount: cart.finalAmount,
          totalDiscount: cart.totalDiscountAmount
        }
      }
    })

  } catch (error) {
    console.error("❌ Refresh cart prices error:", error)
    
    let errorMessage = "Internal server error"
    if (error.name === 'CastError') {
      errorMessage = "Invalid ID format"
    } else if (error.name === 'ValidationError') {
      errorMessage = "Validation failed: " + Object.values(error.errors).map(e => e.message).join(', ')
    }
    
    res.status(500).json({ 
      success: false,
      message: errorMessage, 
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
}

// ✅ Get cart summary (lightweight version)
export const getCartSummary = async (req, res) => {
  try {
    const { userId } = req.params

    if (!userId) {
      return res.status(400).json({ 
        success: false,
        message: "User ID is required" 
      })
    }

    const cart = await Cart.findOne({ userId }).select(
      'totalBaseAmount totalDiscountAmount finalAmount itemCount updatedAt'
    )

    if (!cart) {
      return res.status(200).json({
        success: true,
        data: {
          summary: { 
            totalBaseAmount: 0, 
            totalDiscountAmount: 0, 
            finalAmount: 0,
            itemCount: 0
          }
        }
      })
    }

    res.status(200).json({ 
      success: true,
      data: { 
        summary: {
          totalBaseAmount: cart.totalBaseAmount,
          totalDiscountAmount: cart.totalDiscountAmount,
          finalAmount: cart.finalAmount,
          itemCount: cart.itemCount,
          lastUpdated: cart.updatedAt
        }
      } 
    })

  } catch (error) {
    console.error("Get cart summary error:", error)
    res.status(500).json({ 
      success: false,
      message: "Internal server error", 
      error: error.message 
    })
  }
}