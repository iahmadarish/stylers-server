import Cart from "../models/Cart.js"
import Product from "../models/Product.js"


// ✅ Add item to cart with proper variant handling
export const addToCart = async (req, res) => {
  try {
    const {
      userId,
      productId,
      variantId,
      quantity = 1,
      // ADD THESE NEW FIELDS TO ACCEPT CLIENT-CALCULATED PRICES
      originalPrice,
      discountedPrice,
      discountPercentage,
      totalPrice,
      basePrice,
      forceDiscount = false
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
      forceDiscount
    })

    // Validate required fields
    if (!userId || !productId) {
      return res.status(400).json({ 
        success: false,
        message: "User ID and Product ID are required" 
      })
    }

    if (quantity < 1) {
      return res.status(400).json({ 
        success: false,
        message: "Quantity must be at least 1" 
      })
    }

    // Get product details
    const product = await Product.findById(productId)
    if (!product || !product.isActive) {
      return res.status(404).json({ 
        success: false,
        message: "Product not found or inactive" 
      })
    }

    console.log("Product found:", product.title)

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

      console.log("Variant selected:", selectedVariant)
    } else {
      // Check product-level stock
      if (product.stock < quantity) {
        return res.status(400).json({ 
          success: false,
          message: `Insufficient stock. Available: ${product.stock}` 
        })
      }
    }

    // USE CLIENT-CALCULATED PRICES IF PROVIDED AND VALID
    let finalBasePrice = basePrice;
    let finalDiscountedPrice = discountedPrice;
    let finalDiscountPercentage = discountPercentage;
    let discountActive = false;
    let discountStartTime = null;
    let discountEndTime = null;

    // If client sent calculated prices and forceDiscount is true, use them
    if (forceDiscount && discountedPrice && basePrice && discountPercentage !== undefined) {
      console.log("💰 Using client-calculated prices with forced discount");
      finalBasePrice = basePrice;
      finalDiscountedPrice = discountedPrice;
      finalDiscountPercentage = discountPercentage;
      discountActive = discountPercentage > 0;
      
      // Set discount timing based on product/variant
      if (variantId && variant) {
        discountStartTime = variant.discountStartTime;
        discountEndTime = variant.discountEndTime;
      } else {
        discountStartTime = product.discountStartTime;
        discountEndTime = product.discountEndTime;
      }
    } else {
      // Fallback to server-side price calculation
      console.log("💰 Using server-calculated prices");
      
      if (variantId && variant) {
        finalDiscountedPrice = product.getCurrentPrice(variantId);
        finalBasePrice = variant.basePrice || product.basePrice;
        discountActive = product.isVariantDiscountActive(variantId);
        
        if (variant.discountPercentage !== undefined && variant.discountPercentage > 0) {
          finalDiscountPercentage = variant.discountPercentage;
          discountStartTime = variant.discountStartTime;
          discountEndTime = variant.discountEndTime;
        } else {
          finalDiscountPercentage = product.discountPercentage;
          discountStartTime = product.discountStartTime;
          discountEndTime = product.discountEndTime;
        }
      } else {
        finalDiscountedPrice = product.getCurrentPrice();
        finalBasePrice = product.basePrice;
        discountActive = product.isDiscountActive();
        finalDiscountPercentage = product.discountPercentage;
        discountStartTime = product.discountStartTime;
        discountEndTime = product.discountEndTime;
      }
    }

    console.log("Final price calculation:", {
      basePrice: finalBasePrice,
      discountedPrice: finalDiscountedPrice,
      discountPercentage: finalDiscountPercentage,
      discountActive,
      forceDiscount
    })

    // Find or create cart
    let cart = await Cart.findOne({ userId })
    if (!cart) {
      cart = new Cart({ userId, items: [] })
    }

    // Check if item already exists in cart (same product + variant combination)
    const existingItemIndex = cart.items.findIndex(item => {
      return item.productId.toString() === productId &&
             ((!variantId && !item.variantId) || 
              (variantId && item.variantId?.toString() === variantId))
    })

    const cartItemData = {
      productId,
      variantId: variantId || null,
      selectedVariant,
      quantity: Number(quantity),
      originalPrice: finalBasePrice,
      basePrice: finalBasePrice,
      discountedPrice: finalDiscountedPrice,
      discountPercentage: discountActive ? finalDiscountPercentage : 0,
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
      
      console.log("Updated existing item quantity:", newQuantity)
    } else {
      // Add new item to cart
      cart.items.push(cartItemData)
      console.log("Added new item to cart")
    }

    // Save cart (this will trigger calculateTotals via pre-save middleware)
    await cart.save()

    // Populate product details for response
    await cart.populate({
      path: 'items.productId',
      select: 'title slug images brand basePrice price discountPercentage'
    })

    console.log("=== CART UPDATED SUCCESSFULLY ===")

    res.status(200).json({
      success: true,
      message: "Item added to cart successfully",
      data: {
        cart,
        addedItem: cartItemData
      }
    })

  } catch (error) {
    console.error("Add to cart error:", error)
    res.status(500).json({ 
      success: false,
      message: "Internal server error", 
      error: error.message 
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

    const cart = await Cart.findOne({ userId })
    if (!cart) {
      return res.status(404).json({ 
        success: false,
        message: "Cart not found" 
      })
    }

    await cart.refreshPrices()
    await cart.save()

    await cart.populate({
      path: 'items.productId',
      select: 'title slug images brand basePrice price discountPercentage'
    })

    res.status(200).json({
      success: true,
      message: "Cart prices refreshed successfully",
      data: { cart }
    })

  } catch (error) {
    console.error("Refresh cart prices error:", error)
    res.status(500).json({ 
      success: false,
      message: "Internal server error", 
      error: error.message 
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