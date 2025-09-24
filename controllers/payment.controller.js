import Order from "../models/Order.js"
import Cart from "../models/Cart.js"
import axios from "axios"
import { sendOrderEmails } from "../services/emailService.js"
import User from "../models/User.js"
import Product from "../models/Product.js"

const store_id = process.env.SSLCOMMERZ_STORE_ID
const store_passwd = process.env.SSLCOMMERZ_STORE_PASSWORD
const is_live = false // true for live, false for sandbox

// Helper function to calculate shipping cost
function calculateShippingCost(subtotal, city) {
  if (subtotal >= 4000) return 0
  const isDhaka = city && city.toLowerCase().includes("dhaka")
  return isDhaka ? 1 : 1
}

async function calculateOrderAmount(userId, shippingAddress) {
  try {
    // Cart items populate for load data
    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      model: "Product",
    })

    if (!cart || !cart.items || cart.items.length === 0) {
      throw new Error("Cart is empty")
    }
    // calculate cart all items
    await cart.calculateTotals()
    // adding shipping cost
    const shippingCost = calculateShippingCost(cart.finalAmount, shippingAddress.city)
    const finalTotal = cart.finalAmount + shippingCost
    return {
      subtotal: cart.totalBaseAmount,
      discount: cart.totalDiscountAmount,
      shippingCost,
      finalTotal,
      cartItems: cart.items,
    }
  } catch (error) {
    console.error("Error calculating order amount:", error)
    throw error
  }
}

function calculateGuestOrderAmount(guestOrderData) {
  try {
    const subtotal = guestOrderData.subtotal || 0
    const shippingCost = calculateShippingCost(subtotal, guestOrderData.shippingAddress?.city)
    const finalTotal = subtotal + shippingCost

    return {
      subtotal,
      discount: guestOrderData.totalDiscount || 0,
      shippingCost,
      finalTotal,
    }
  } catch (error) {
    console.error("Error calculating guest order amount:", error)
    throw error
  }
}

// Helper function to update product stock
const updateProductStock = async (orderItems) => {
  for (const item of orderItems) {
    const product = await Product.findById(item.productId)
    if (!product) continue

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
}

// Initialize payment for guest orders
export const initializeGuestPayment = async (req, res) => {
  try {
    console.log("=== Initialize Guest Payment Request ===")
    console.log("Request body:", JSON.stringify(req.body, null, 2))

    const { guestOrderData, customerInfo, paymentMethod = "card" } = req.body

    // Detailed validation
    if (!guestOrderData) {
      return res.status(400).json({
        success: false,
        message: "Guest order data is required",
      })
    }

    if (!customerInfo) {
      return res.status(400).json({
        success: false,
        message: "Customer information is required",
      })
    }

    if (!customerInfo.name || !customerInfo.email || !customerInfo.phone) {
      return res.status(400).json({
        success: false,
        message: "Customer name, email, and phone are required",
        missing: {
          name: !customerInfo.name,
          email: !customerInfo.email,
          phone: !customerInfo.phone,
        },
      })
    }

    if (!guestOrderData.shippingAddress) {
      return res.status(400).json({
        success: false,
        message: "Shipping address is required",
      })
    }

    if (!guestOrderData.shippingAddress.address || !guestOrderData.shippingAddress.city) {
      return res.status(400).json({
        success: false,
        message: "Shipping address and city are required",
        missing: {
          address: !guestOrderData.shippingAddress.address,
          city: !guestOrderData.shippingAddress.city,
        },
      })
    }

    if (!guestOrderData.items || !Array.isArray(guestOrderData.items) || guestOrderData.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Order items are required",
      })
    }

    // Calculate order amounts
    const subtotal =
      guestOrderData.subtotal ||
      guestOrderData.items.reduce(
        (sum, item) => sum + (item.discountedPrice || item.originalPrice || 0) * (item.quantity || 1),
        0,
      )

    const shippingCost = calculateShippingCost(subtotal, guestOrderData.shippingAddress.city)
    const finalTotal = subtotal + shippingCost

    // Generate unique transaction ID for guest
    const tran_id = `GUEST_TXN_${Date.now()}_${Math.floor(Math.random() * 10000)}`

    // Prepare complete guest order data for storage
    const completeGuestOrderData = {
      items: guestOrderData.items.map((item) => ({
        productId: item.productId,
        productTitle: item.productTitle || "Unknown Product",
        productImage: item.productImage || "/placeholder.svg",
        variantId: item.variantId || null,
        colorVariantId: item.colorVariantId || null,
        quantity: item.quantity || 1,
        originalPrice: item.originalPrice || 0,
        discountedPrice: item.discountedPrice || item.originalPrice || 0,
        discountPercentage: item.discountPercentage || 0,
        totalOriginalPrice: (item.originalPrice || 0) * (item.quantity || 1),
        totalDiscountedPrice: (item.discountedPrice || item.originalPrice || 0) * (item.quantity || 1),
        discountAmount:
          ((item.originalPrice || 0) - (item.discountedPrice || item.originalPrice || 0)) * (item.quantity || 1),
      })),
      subtotal: subtotal,
      totalDiscount: guestOrderData.totalDiscount || 0,
      shippingCost: shippingCost,
      totalAmount: finalTotal,
      shippingAddress: {
        fullName: guestOrderData.shippingAddress.fullName || customerInfo.name,
        phone: guestOrderData.shippingAddress.phone || customerInfo.phone,
        email: guestOrderData.shippingAddress.email || customerInfo.email,
        address: guestOrderData.shippingAddress.address,
        city: guestOrderData.shippingAddress.city,
        state: guestOrderData.shippingAddress.state || "",
        zipCode: guestOrderData.shippingAddress.zipCode || guestOrderData.shippingAddress.postalCode || "",
        country: guestOrderData.shippingAddress.country || "Bangladesh",
      },
      billingAddress: guestOrderData.billingAddress || { sameAsShipping: true },
      customerInfo: customerInfo,
      couponCode: guestOrderData.couponCode || null,
      specialInstructions: guestOrderData.specialInstructions || "",
      transactionId: tran_id,
      paymentStatus: "pending",
      paymentMethod: paymentMethod,
    }

    // Aamarpay payment data preparation
    const store_id = process.env.AMARPAY_STORE_ID
    const signature_key = process.env.AMARPAY_SIGNATURE_KEY

    // ✅ Fixed: Use URL parameters instead of query parameters to match frontend routes
    const paymentData = {
      store_id: store_id,
      signature_key: signature_key,
      tran_id: tran_id,
      amount: finalTotal.toFixed(2),
      currency: "BDT",
      desc: `Guest Order Payment - ${customerInfo.name}`,
      cus_name: customerInfo.name,
      cus_email: customerInfo.email,
      cus_phone: customerInfo.phone,
      cus_add1: guestOrderData.shippingAddress.address.substring(0, 50),
      cus_city: guestOrderData.shippingAddress.city,
      cus_country: guestOrderData.shippingAddress.country || "Bangladesh",
      // ✅ Fixed: Frontend URLs with URL parameters
      success_url: `${process.env.FRONTEND_URL}/payment-success/${tran_id}`,
      fail_url: `${process.env.FRONTEND_URL}/payment-fail/${tran_id}`,
      cancel_url: `${process.env.FRONTEND_URL}/payment-cancel/${tran_id}`,
      // Server-side callback for payment verification
      notify_url: `${process.env.BACKEND_URL}/api/payment/notify`,
      type: "json",
    }

    console.log("Aamarpay payment data:", JSON.stringify(paymentData, null, 2))

    // Store guest order data temporarily for later retrieval
    global.pendingGuestOrders = global.pendingGuestOrders || new Map()
    global.pendingGuestOrders.set(tran_id, completeGuestOrderData)

    console.log("Stored guest order data for transaction:", tran_id)
    console.log("Pending guest orders count:", global.pendingGuestOrders.size)

    // Send request to Aamarpay
    try {
      const response = await axios.post(
        process.env.AMARPAY_PAYMENT_URL || "https://sandbox.aamarpay.com/jsonpost.php",
        paymentData,
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 15000,
        },
      )

      console.log("Aamarpay API response:", response.data)

      if (response.data && response.data.payment_url) {
        res.status(200).json({
          success: true,
          message: "Payment initialized successfully",
          data: {
            payment_url: response.data.payment_url,
            transactionId: tran_id,
            orderAmount: finalTotal,
            customerEmail: customerInfo.email,
          },
        })
      } else {
        // Clean up if failed
        global.pendingGuestOrders.delete(tran_id)

        console.error("Aamarpay error response:", response.data)
        res.status(400).json({
          success: false,
          message: response.data.msg || response.data.message || "Payment initialization failed",
          aamarpayResponse: response.data,
        })
      }
    } catch (axiosError) {
      // Clean up if failed
      global.pendingGuestOrders.delete(tran_id)

      console.error("Axios error calling Aamarpay:", axiosError.response?.data || axiosError.message)

      res.status(500).json({
        success: false,
        message: "Failed to connect to payment gateway",
        error: axiosError.response?.data || axiosError.message,
      })
    }
  } catch (error) {
    console.error("Error initializing guest payment:", error)
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    })
  }
}

// Cash on Delivery order
export const createCODOrder = async (req, res) => {
  try {
    console.log("=== COD Order Request ===")
    console.log("Request body:", JSON.stringify(req.body, null, 2))

    const { userId, shippingAddress, couponCode = null, specialInstructions = "" } = req.body

    // Basic validation
    if (!userId) {
      console.log("Error: User ID missing")
      return res.status(400).json({ message: "User ID is required" })
    }

    if (!shippingAddress) {
      console.log("Error: Shipping address missing")
      return res.status(400).json({ message: "Shipping address is required" })
    }

    // Get user's cart with better error handling
    console.log("Fetching cart for user:", userId)
    let cart
    try {
      cart = await Cart.findOne({ userId }).populate({
        path: "items.productId",
        model: "Product",
      })
    } catch (dbError) {
      console.error("Database error fetching cart:", dbError)
      return res.status(500).json({
        success: false,
        message: "Database error while fetching cart",
        error: dbError.message,
      })
    }

    if (!cart) {
      console.log("No cart found for user:", userId)
      return res.status(400).json({
        success: false,
        message: "Cart not found",
      })
    }

    if (!cart.items || cart.items.length === 0) {
      console.log("Cart is empty for user:", userId)
      return res.status(400).json({
        success: false,
        message: "Cart is empty",
      })
    }

    console.log("Cart found with", cart.items.length, "items")

    // Simple order items creation with better error handling
    const orderItems = []
    let subtotal = 0

    for (const cartItem of cart.items) {
      const product = cartItem.productId

      if (!product) {
        console.log("Product not found for cart item, skipping...")
        continue
      }

      // Use cart item prices directly with fallbacks
      const originalPrice = cartItem.originalPrice || 0
      const discountedPrice = cartItem.discountedPrice || originalPrice
      const quantity = cartItem.quantity || 1

      const totalOriginalPrice = originalPrice * quantity
      const totalDiscountedPrice = discountedPrice * quantity

      // Get product image - provide fallback
      let productImage = "/placeholder.svg?height=200&width=200"
      if (product.images && product.images.length > 0) {
        productImage = product.images[0]
      } else if (product.colorVariants && product.colorVariants.length > 0 && product.colorVariants[0].images) {
        productImage = product.colorVariants[0].images[0]
      }

      const orderItem = {
        productId: product._id,
        productTitle: product.title || "Unknown Product",
        productImage: productImage,
        variantId: cartItem.variantId || null,
        colorVariantId: cartItem.colorVariantId || null,
        quantity: quantity,
        originalPrice: originalPrice,
        discountedPrice: discountedPrice,
        discountPercentage: cartItem.discountPercentage || 0,
        totalOriginalPrice: totalOriginalPrice,
        totalDiscountedPrice: totalDiscountedPrice,
        discountAmount: Math.max(0, totalOriginalPrice - totalDiscountedPrice),
      }

      orderItems.push(orderItem)
      subtotal += totalDiscountedPrice
    }

    if (orderItems.length === 0) {
      console.log("No valid items in cart")
      return res.status(400).json({
        success: false,
        message: "No valid items in cart",
      })
    }

    // Calculate shipping cost based on location and amount
    const shippingCost = calculateShippingCost(subtotal, shippingAddress.city)
    const finalTotal = subtotal + shippingCost // No tax

    console.log("Order calculation:", {
      subtotal,
      shippingCost,
      city: shippingAddress.city,
      finalTotal,
    })

    // Generate order number manually
    const orderCount = await Order.countDocuments()
    const orderNumber = `ORD-${Date.now()}-${(orderCount + 1).toString().padStart(4, "0")}`

    // Format shipping address properly
    const formattedShippingAddress = {
      fullName: shippingAddress.fullName || "",
      phone: shippingAddress.phone || "",
      email: shippingAddress.email || "",
      address: shippingAddress.address || "",
      city: shippingAddress.city || "Dhaka",
      state: shippingAddress.state || "Dhaka",
      zipCode: shippingAddress.zipCode || "",
      country: shippingAddress.country || "Bangladesh",
    }

    // Create order
    const orderData = {
      userId,
      orderNumber: orderNumber,
      items: orderItems,
      subtotal,
      totalDiscount: 0,
      shippingCost,
      tax: 0, // No tax
      totalAmount: finalTotal,
      shippingAddress: formattedShippingAddress,
      paymentMethod: "cash_on_delivery",
      couponCode: couponCode || null,
      couponDiscount: 0,
      specialInstructions: specialInstructions || "",
      status: "confirmed",
      paymentStatus: "pending",
    }

    console.log("Creating order with data:", JSON.stringify(orderData, null, 2))

    let order
    try {
      order = new Order(orderData)
      await order.save()
      console.log("Order created successfully:", order._id)
    } catch (saveError) {
      console.error("Error saving order:", saveError)
      return res.status(500).json({
        success: false,
        message: "Failed to save order",
        error: saveError.message,
      })
    }

    // Update product stock after successful order creation
    try {
      await updateProductStock(orderItems)
      console.log("Product stock updated successfully")
    } catch (stockError) {
      console.error("Error updating product stock:", stockError)
      // Don't fail the order if stock update fails, but log it
    }

    // Clear user's cart
    try {
      await Cart.findOneAndUpdate(
        { userId },
        {
          $set: {
            items: [],
            totalAmount: 0,
            totalDiscountAmount: 0,
            finalAmount: 0,
          },
        },
      )
      console.log("Cart cleared for user:", userId)
    } catch (cartError) {
      console.log("Error clearing cart (non-critical):", cartError.message)
      // Don't fail the order if cart clearing fails
    }

    // Order confirmation mail
    try {
      // logged-in user হলে user DB থেকে ইমেইল বের করো
      const user = await User.findById(userId)

      // shipping address এর ইমেইল থাকলে ওটা নাও, না থাকলে user.email নাও
      const toEmail = order?.shippingAddress?.email || user?.email
      console.log("📧 Sending confirmation email to:", toEmail)

      await sendOrderEmails(order, toEmail)
      console.log("✅ Order confirmation email sent")
    } catch (mailError) {
      console.error("❌ Failed to send confirmation email:", mailError)
    }

    res.status(201).json({
      success: true,
      message: "Order placed successfully",
      data: {
        order: {
          _id: order._id,
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount,
          status: order.status,
          paymentStatus: order.paymentStatus,
        },
      },
    })
  } catch (error) {
    console.error("=== COD Order Error ===")
    console.error("Error message:", error.message)
    console.error("Error stack:", error.stack)

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    })
  }
}

// Initialize online payment with Aamarpay
export const initializeAamarpayPayment = async (req, res) => {
  try {
    console.log("=== Initialize Aamarpay Payment Request ===")
    console.log("Request body:", JSON.stringify(req.body, null, 2))

    const { userId, shippingAddress, couponCode = null, specialInstructions = "" } = req.body

    // Validate required fields
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" })
    }

    if (!shippingAddress || !shippingAddress.fullName || !shippingAddress.phone || !shippingAddress.address) {
      return res.status(400).json({ message: "Complete shipping address is required" })
    }

    // Get user's cart
    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      model: "Product",
    })

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" })
    }

    // Process cart items
    const orderItems = []
    let subtotal = 0

    for (const cartItem of cart.items) {
      const product = cartItem.productId
      if (!product) continue

      const originalPrice = cartItem.basePrice || product.basePrice || product.price || 0
      const discountedPrice = cartItem.discountedPrice || originalPrice
      const quantity = cartItem.quantity || 1

      const totalOriginalPrice = originalPrice * quantity
      const totalDiscountedPrice = discountedPrice * quantity

      const productImage =
        (product.images && product.images.length > 0 && (product.images[0].url || product.images[0])) ||
        "/placeholder.svg"

      const orderItem = {
        productId: product._id,
        productTitle: product.title || "Unknown Product",
        productImage,
        variantId: cartItem.variantId || null,
        colorVariantId: cartItem.colorVariantId || null,
        quantity,
        originalPrice,
        discountedPrice,
        discountPercentage: cartItem.discountPercentage || 0,
        totalOriginalPrice,
        totalDiscountedPrice,
        discountAmount: Math.max(0, totalOriginalPrice - totalDiscountedPrice),
      }

      orderItems.push(orderItem)
      subtotal += totalDiscountedPrice
    }

    if (orderItems.length === 0) {
      return res.status(400).json({ message: "No valid items in cart" })
    }

    // Calculate shipping cost
    const shippingCost = calculateShippingCost(subtotal, shippingAddress.city)
    const finalTotal = subtotal + shippingCost

    // Generate order number
    const orderCount = await Order.countDocuments()
    const orderNumber = `ORD-${Date.now()}-${(orderCount + 1).toString().padStart(4, "0")}`

    // Create order with pending status
    const order = new Order({
      userId,
      orderNumber,
      items: orderItems,
      subtotal,
      totalDiscount: 0,
      shippingCost,
      tax: 0,
      totalAmount: finalTotal,
      shippingAddress,
      paymentMethod: "card",
      couponCode,
      couponDiscount: 0,
      specialInstructions,
      status: "pending",
      paymentStatus: "pending",
    })

    await order.save()

    // Aamarpay payment data preparation
    const store_id = process.env.AMARPAY_STORE_ID
    const signature_key = process.env.AMARPAY_SIGNATURE_KEY
    const tran_id = `TXN_${order._id}_${Date.now()}`

    // Update order with transaction ID
    order.transactionId = tran_id
    await order.save()

    // ✅ Fixed: Use URL parameters instead of query parameters to match frontend routes
    const paymentData = {
      store_id: store_id,
      signature_key: signature_key,
      tran_id: tran_id,
      amount: finalTotal.toFixed(2),
      currency: "BDT",
      desc: `Order #${orderNumber}`,
      cus_name: shippingAddress.fullName,
      cus_email: shippingAddress.email || "customer@example.com",
      cus_phone: shippingAddress.phone,
      cus_add1: shippingAddress.address.substring(0, 50),
      cus_city: shippingAddress.city || "Dhaka",
      cus_country: shippingAddress.country || "Bangladesh",
      // ✅ Fixed: Frontend URLs with URL parameters
      success_url: `${process.env.FRONTEND_URL}/payment-success/${tran_id}`,
      fail_url: `${process.env.FRONTEND_URL}/payment-fail/${tran_id}`,
      cancel_url: `${process.env.FRONTEND_URL}/payment-cancel/${tran_id}`,
      // Server-side callback for payment verification
      notify_url: `${process.env.BACKEND_URL}/api/payment/notify`,
      type: "json",
    }

    console.log("Aamarpay payment data:", JSON.stringify(paymentData, null, 2))

    // Send payment request to Aamarpay
    try {
      const response = await axios.post(
        process.env.AMARPAY_PAYMENT_URL || "https://sandbox.aamarpay.com/jsonpost.php",
        paymentData,
        {
          headers: {
            "Content-Type": "application/json",
          },
          timeout: 15000,
        },
      )

      console.log("Aamarpay API response:", response.data)

      if (response.data && response.data.payment_url) {
        res.status(200).json({
          success: true,
          message: "Payment initialized successfully",
          data: {
            payment_url: response.data.payment_url,
            orderId: order._id,
            transactionId: tran_id,
          },
        })
      } else {
        // Delete the order if payment initialization fails
        await Order.findByIdAndDelete(order._id)
        res.status(400).json({
          message: response.data.msg || "Payment initialization failed",
        })
      }
    } catch (error) {
      // Delete the order if payment initialization fails
      await Order.findByIdAndDelete(order._id)
      console.error("Aamarpay API error:", error.response?.data || error.message)
      res.status(400).json({
        message: "Payment initialization failed",
      })
    }
  } catch (error) {
    console.error("Payment initialization error:", error)
    res.status(500).json({ message: "Internal server error", error: error.message })
  }
}

// Payment Success Handler - This handles user redirects from payment gateway
export const paymentSuccess = async (req, res) => {
  try {
    console.log("🎉 === Payment Success Handler ===")
    console.log("📨 Request method:", req.method)
    console.log("📨 Request body:", JSON.stringify(req.body, null, 2))
    console.log("📨 Request params:", req.params)
    console.log("📨 Request query:", req.query)

    const transactionId = req.params.transactionId || req.body.tran_id || req.query.tran_id

    if (!transactionId) {
      console.log("❌ Transaction ID missing in success handler")
      return res.redirect(`${process.env.FRONTEND_URL}/payment-fail/unknown`)
    }

    console.log("🔍 Processing success for transaction:", transactionId)

    // Check if it's a guest order
    const isGuest = transactionId.startsWith("GUEST_TXN_")

    if (isGuest) {
      console.log("🎯 Processing guest order success")

      // Check if order already exists in database
      const existingOrder = await Order.findOne({ transactionId: transactionId })

      if (existingOrder) {
        console.log("✅ Guest order already exists:", existingOrder.orderNumber)
        return res.redirect(`${process.env.FRONTEND_URL}/order-success/${existingOrder.orderNumber}`)
      }

      global.pendingGuestOrders = global.pendingGuestOrders || new Map()
      const guestOrderData = global.pendingGuestOrders.get(transactionId)

      if (guestOrderData) {
        console.log("🔄 Creating guest order from success handler (IPN backup)")

        try {
          // Create guest order
          const orderCount = await Order.countDocuments()
          const orderNumber = `GUEST-${Date.now()}-${(orderCount + 1).toString().padStart(4, "0")}`

          const order = new Order({
            isGuestOrder: true,
            guestCustomerInfo: {
              name: guestOrderData.customerInfo.name,
              email: guestOrderData.customerInfo.email,
              phone: guestOrderData.customerInfo.phone,
            },
            orderNumber: orderNumber,
            transactionId: transactionId,
            items: guestOrderData.items,
            subtotal: guestOrderData.subtotal,
            totalDiscount: guestOrderData.totalDiscount || 0,
            shippingCost: guestOrderData.shippingCost,
            tax: 0,
            totalAmount: guestOrderData.totalAmount,
            shippingAddress: guestOrderData.shippingAddress,
            billingAddress: guestOrderData.billingAddress || guestOrderData.shippingAddress,
            paymentMethod: "card",
            couponCode: guestOrderData.couponCode || null,
            couponDiscount: 0,
            specialInstructions: guestOrderData.specialInstructions || "",
            status: "confirmed",
            paymentStatus: "paid",
            paymentGatewayResponse: {
              pg_txnid: transactionId,
              pay_time: new Date().toISOString(),
              amount: guestOrderData.totalAmount,
              currency: "BDT",
              source: "success_handler_backup",
            },
          })

          await order.save()
          console.log("✅ Guest order created via success handler:", order.orderNumber)

          // Update product stock
          try {
            await updateProductStock(guestOrderData.items)
            console.log("✅ Product stock updated for guest order")
          } catch (stockError) {
            console.error("❌ Error updating product stock:", stockError)
          }

          // Clean up pending data
          global.pendingGuestOrders.delete(transactionId)

          // Send confirmation email
          try {
            await sendOrderConfirmationEmail(order)
            console.log("✅ Order confirmation email sent")
          } catch (emailError) {
            console.error("❌ Error sending confirmation email:", emailError)
          }

          return res.redirect(`${process.env.FRONTEND_URL}/order-success/${order.orderNumber}`)
        } catch (orderError) {
          console.error("❌ Error creating guest order in success handler:", orderError)
          return res.redirect(`${process.env.FRONTEND_URL}/payment-fail/${transactionId}`)
        }
      } else {
        console.log("❌ Guest order data not found in success handler")
        console.log("Available guest transactions:", Array.from(global.pendingGuestOrders.keys()))

        try {
          const verificationResult = await verifyPaymentWithGateway(transactionId)
          if (verificationResult && verificationResult.pay_status === "Successful") {
            console.log("✅ Payment verified with gateway, but order data lost")
            // Create a minimal order record
            const orderCount = await Order.countDocuments()
            const orderNumber = `GUEST-${Date.now()}-${(orderCount + 1).toString().padStart(4, "0")}`

            const minimalOrder = new Order({
              isGuestOrder: true,
              guestCustomerInfo: {
                name: "Guest Customer",
                email: verificationResult.cus_email || "guest@example.com",
                phone: verificationResult.cus_phone || "N/A",
              },
              orderNumber: orderNumber,
              transactionId: transactionId,
              items: [], // Empty items as data is lost
              subtotal: Number.parseFloat(verificationResult.amount) || 0,
              totalDiscount: 0,
              shippingCost: 0,
              tax: 0,
              totalAmount: Number.parseFloat(verificationResult.amount) || 0,
              shippingAddress: {
                fullName: "Guest Customer",
                phone: "N/A",
                email: verificationResult.cus_email || "guest@example.com",
                address: "N/A",
                city: "N/A",
                state: "N/A",
                zipCode: "N/A",
                country: "Bangladesh",
              },
              paymentMethod: "card",
              status: "confirmed",
              paymentStatus: "paid",
              specialNotes: "Order created from payment verification - original order data lost",
              paymentGatewayResponse: verificationResult,
            })

            await minimalOrder.save()
            console.log("✅ Minimal guest order created from payment verification:", minimalOrder.orderNumber)

            return res.redirect(`${process.env.FRONTEND_URL}/order-success/${minimalOrder.orderNumber}`)
          }
        } catch (verifyError) {
          console.error("❌ Error verifying payment:", verifyError)
        }

        return res.redirect(`${process.env.FRONTEND_URL}/payment-fail/${transactionId}`)
      }
    } else {
      // Handle logged-in user orders
      console.log("👤 Processing logged-in user order success")

      const order = await Order.findOne({ transactionId: transactionId })
      if (order) {
        console.log("✅ User order found:", order.orderNumber)
        return res.redirect(`${process.env.FRONTEND_URL}/order-success/${order.orderNumber}`)
      } else {
        console.log("❌ User order not found for transaction:", transactionId)
        return res.redirect(`${process.env.FRONTEND_URL}/payment-fail/${transactionId}`)
      }
    }
  } catch (error) {
    console.error("❌ Error in payment success handler:", error)
    const transactionId = req.params.transactionId || "unknown"
    return res.redirect(`${process.env.FRONTEND_URL}/payment-fail/${transactionId}`)
  }
}

const verifyPaymentWithGateway = async (transactionId) => {
  try {
    console.log("🔍 Verifying payment with gateway for:", transactionId)

    // For AamarPay, we can use their search/verify API
    const verifyUrl = `https://sandbox.aamarpay.com/api/v1/trxcheck/request.php`

    const verifyData = {
      store_id: process.env.AMARPAY_STORE_ID,
      signature_key: process.env.AMARPAY_SIGNATURE_KEY,
      type: "json",
      request_id: transactionId,
    }

    const response = await axios.post(verifyUrl, verifyData, {
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 10000,
    })

    console.log("🔍 Gateway verification response:", response.data)
    return response.data
  } catch (error) {
    console.error("❌ Error verifying payment with gateway:", error)
    return null
  }
}

// Helper function to send order confirmation email (used by both IPN and success handler)
const sendOrderConfirmationEmail = async (order) => {
  try {
    let toEmail = order?.shippingAddress?.email
    if (!toEmail && order.isGuestOrder && order.guestCustomerInfo?.email) {
      toEmail = order.guestCustomerInfo.email
    } else if (!toEmail && order.userId) {
      const user = await User.findById(order.userId)
      toEmail = user?.email
    }

    if (toEmail) {
      await sendOrderEmails(order, toEmail, order.isGuestOrder)
      console.log("✅ Order confirmation email sent successfully.")
    } else {
      console.warn("⚠️ Could not determine recipient email for order confirmation.")
    }
  } catch (error) {
    console.error("❌ Failed to send order confirmation email:", error)
    throw error // Re-throw to be caught by the caller
  }
}

export const paymentFail = async (req, res) => {
  try {
    console.log("=== Payment Fail Handler ===")
    console.log("Method:", req.method)
    console.log("Params:", req.params)
    console.log("Query:", req.query)
    console.log("Body:", req.body)

    const tran_id = req.params.transactionId || req.query?.transactionId || req.body?.tran_id
    const isGuest = tran_id && tran_id.startsWith("GUEST_TXN_")

    if (!tran_id) {
      console.log("❌ Transaction ID missing in fail handler")
      const failUrl = `${process.env.FRONTEND_URL}/payment-fail/unknown`
      if (req.headers.accept && req.headers.accept.includes("application/json")) {
        return res.status(400).json({
          success: false,
          message: "Transaction ID missing",
          redirectUrl: failUrl,
        })
      } else {
        return res.redirect(failUrl)
      }
    }

    console.log(`🔍 Processing payment failure for:`, tran_id)

    // Clean up data
    if (isGuest) {
      global.pendingGuestOrders = global.pendingGuestOrders || new Map()
      global.pendingGuestOrders.delete(tran_id)
      console.log("🧹 Cleaned up pending guest order data")
    } else {
      const order = await Order.findOne({ transactionId: tran_id })
      if (order) {
        order.paymentStatus = "failed"
        order.status = "cancelled"
        await order.save()
        console.log("❌ Order marked as failed")
      }
    }

    const failUrl = `${process.env.FRONTEND_URL}/payment-fail/${tran_id}`
    if (req.headers.accept && req.headers.accept.includes("application/json")) {
      return res.status(400).json({
        success: false,
        message: "Payment failed",
        transactionId: tran_id,
        redirectUrl: failUrl,
      })
    } else {
      return res.redirect(failUrl)
    }
  } catch (error) {
    console.error("❌ Payment fail handler error:", error)
    const errorUrl = `${process.env.FRONTEND_URL}/payment-fail/error`
    if (req.headers.accept && req.headers.accept.includes("application/json")) {
      return res.status(500).json({
        success: false,
        message: "Payment processing error",
        redirectUrl: errorUrl,
      })
    } else {
      return res.redirect(errorUrl)
    }
  }
}

export const paymentCancel = async (req, res) => {
  try {
    console.log("=== Payment Cancel Handler ===")
    console.log("Method:", req.method)
    console.log("Params:", req.params)
    console.log("Query:", req.query)
    console.log("Body:", req.body)

    const tran_id = req.params.transactionId || req.query?.transactionId || req.body?.tran_id
    const isGuest = tran_id && tran_id.startsWith("GUEST_TXN_")

    if (!tran_id) {
      console.log("❌ Transaction ID missing in cancel handler")
      const cancelUrl = `${process.env.FRONTEND_URL}/payment-cancel/unknown`
      if (req.headers.accept && req.headers.accept.includes("application/json")) {
        return res.status(400).json({
          success: false,
          message: "Transaction ID missing",
          redirectUrl: cancelUrl,
        })
      } else {
        return res.redirect(cancelUrl)
      }
    }

    console.log(`🔍 Processing payment cancellation for:`, tran_id)

    // Clean up data
    if (isGuest) {
      global.pendingGuestOrders = global.pendingGuestOrders || new Map()
      global.pendingGuestOrders.delete(tran_id)
      console.log("🧹 Cleaned up pending guest order data")
    } else {
      const order = await Order.findOne({ transactionId: tran_id })
      if (order) {
        order.paymentStatus = "cancelled"
        order.status = "cancelled"
        await order.save()
        console.log("❌ Order marked as cancelled")
      }
    }

    const cancelUrl = `${process.env.FRONTEND_URL}/payment-cancel/${tran_id}`
    if (req.headers.accept && req.headers.accept.includes("application/json")) {
      return res.status(200).json({
        success: false,
        message: "Payment cancelled",
        transactionId: tran_id,
        redirectUrl: cancelUrl,
      })
    } else {
      return res.redirect(cancelUrl)
    }
  } catch (error) {
    console.error("❌ Payment cancel handler error:", error)
    const errorUrl = `${process.env.FRONTEND_URL}/payment-cancel/error`
    if (req.headers.accept && req.headers.accept.includes("application/json")) {
      return res.status(500).json({
        success: false,
        message: "Payment processing error",
        redirectUrl: errorUrl,
      })
    } else {
      return res.redirect(errorUrl)
    }
  }
}

// MAIN IPN/Notify Handler - This is where the actual order processing happens
export const paymentNotify = async (req, res) => {
    try {
        console.log("🔔 IPN (Notify) Handler Called")
        console.log("Request body:", JSON.stringify(req.body, null, 2))

        const { tran_id, pay_status, amount, card_type, bank_tran_id } = req.body

        if (pay_status === "Successful") {
            // Find the order using the transaction ID
            const order = await Order.findOne({ transactionId: tran_id })

            if (order) {
                if (order.paymentStatus === "pending") {
                    order.paymentStatus = "paid"
                    order.status = "confirmed"
                    order.paymentDetails = { // Optional: store payment details
                        amount,
                        cardType: card_type,
                        bankTransactionId: bank_tran_id,
                    }

                    await order.save()
                    console.log("✅ Order updated successfully for transaction:", tran_id)

                    // Send confirmation email
                    try {
                        const email = order.isGuestOrder ? order.guestCustomerInfo.email : order.shippingAddress.email
                        await sendOrderEmails(order, email)
                        console.log("✅ Order confirmation email sent")
                    } catch (emailError) {
                        console.error("❌ Failed to send confirmation email:", emailError.message)
                    }

                    return res.status(200).send("OK")
                } else {
                    console.log("⚠️ Order already processed:", tran_id)
                    return res.status(200).send("OK - ALREADY PROCESSED")
                }
            } else {
                console.error("❌ Order not found for transaction:", tran_id)
                return res.status(404).send("FAILED - Order not found")
            }
        } else {
            console.log("⚠️ Payment not successful for transaction:", tran_id)
            // Handle failed payments here if needed
            return res.status(200).send("OK - PAYMENT NOT SUCCESSFUL")
        }
    } catch (error) {
        console.error("❌ Error in IPN handler:", error)
        return res.status(500).send("FAILED - Internal server error")
    }
}

// Legacy IPN handler (keeping for compatibility)
export const handleIPN = async (req, res) => {
  console.log("⚠️ Legacy IPN handler called, redirecting to paymentNotify")
  return paymentNotify(req, res)
}

// Manual order status update endpoint for testing
export const updateOrderStatus = async (req, res) => {
  try {
    const { transactionId } = req.params
    const { status, paymentStatus } = req.body

    console.log("🔧 Manual order status update for:", transactionId)

    const order = await Order.findOne({ transactionId })
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      })
    }

    if (status) order.status = status
    if (paymentStatus) order.paymentStatus = paymentStatus

    await order.save()

    console.log("✅ Order status updated manually:", order.orderNumber)

    res.json({
      success: true,
      message: "Order status updated",
      data: {
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
      },
    })
  } catch (error) {
    console.error("❌ Manual update error:", error)
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    })
  }
}
