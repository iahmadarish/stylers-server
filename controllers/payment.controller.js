import SSLCommerzPayment from "sslcommerz-lts"
import Order from "../models/Order.js"
import Cart from "../models/Cart.js"
import crypto from 'crypto';
import axios from 'axios';
import qs from "qs"
import { sendOrderEmails } from "../services/emailService.js";
import User from "../models/User.js";
import Product from "../models/Product.js"


const store_id = process.env.SSLCOMMERZ_STORE_ID
const store_passwd = process.env.SSLCOMMERZ_STORE_PASSWORD
const is_live = false // true for live, false for sandbox

// Helper function to calculate shipping cost
function calculateShippingCost(subtotal, city) {
  if (subtotal >= 4000) return 0
  const isDhaka = city && city.toLowerCase().includes("dhaka")
  return isDhaka ? 8 : 150
}

async function calculateOrderAmount(userId, shippingAddress) {
  try {
    // কার্ট আইটেমগুলো পপুলেট সহ লোড করুন
    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      model: "Product",
    });

    if (!cart || !cart.items || cart.items.length === 0) {
      throw new Error("Cart is empty");
    }

    // কার্টের সামগ্রিক মূল্য গণনা করুন
    await cart.calculateTotals();

    // শিপিং খরচ যোগ করুন
    const shippingCost = calculateShippingCost(cart.finalAmount, shippingAddress.city);
    const finalTotal = cart.finalAmount + shippingCost;

    return {
      subtotal: cart.totalBaseAmount,
      discount: cart.totalDiscountAmount,
      shippingCost,
      finalTotal,
      cartItems: cart.items
    };
  } catch (error) {
    console.error("Error calculating order amount:", error);
    throw error;
  }
}

function calculateGuestOrderAmount(guestOrderData) {
  try {

    const subtotal = guestOrderData.subtotal || 0;
    const shippingCost = calculateShippingCost(subtotal, guestOrderData.shippingAddress?.city);
    const finalTotal = subtotal + shippingCost;

    return {
      subtotal,
      discount: guestOrderData.totalDiscount || 0,
      shippingCost,
      finalTotal
    };
  } catch (error) {
    console.error("Error calculating guest order amount:", error);
    throw error;
  }
}
// NEW: Initialize payment for guest orders
// payment.controller.js - initializeGuestPayment function
// payment.controller.js - initializeGuestPayment function
// export const initializeGuestPayment = async (req, res) => {
//   try {
//     const { guestOrderData, customerInfo, orderInfo, paymentMethod } = req.body;

//     console.log("=== Initialize Guest Payment Request ===");
//     console.log("Guest Order Data:", JSON.stringify(guestOrderData, null, 2));
//     console.log("Customer Info:", JSON.stringify(customerInfo, null, 2));

//     // Calculate amounts
//     const subtotal = guestOrderData.subtotal || guestOrderData.items.reduce((sum, item) =>
//       sum + (item.discountedPrice || item.originalPrice || 0) * (item.quantity || 1), 0);

//     const shippingCost = calculateShippingCost(subtotal, guestOrderData.shippingAddress.city);
//     const finalTotal = subtotal + shippingCost;
//     const tran_id = `GUEST_TXN_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

//     // Ensure guest order data has all required fields
//     const completeGuestOrderData = {
//       items: guestOrderData.items.map(item => ({
//         productId: item.productId,
//         productTitle: item.productTitle || "Unknown Product",
//         productImage: item.productImage || "/placeholder.svg",
//         variantId: item.variantId || null,
//         colorVariantId: item.colorVariantId || null, // Keep as string, not ObjectId
//         quantity: item.quantity || 1,
//         originalPrice: item.originalPrice || 0,
//         discountedPrice: item.discountedPrice || item.originalPrice || 0,
//         discountPercentage: item.discountPercentage || 0,
//         totalOriginalPrice: (item.originalPrice || 0) * (item.quantity || 1),
//         totalDiscountedPrice: (item.discountedPrice || item.originalPrice || 0) * (item.quantity || 1),
//         discountAmount: ((item.originalPrice || 0) - (item.discountedPrice || item.originalPrice || 0)) * (item.quantity || 1)
//       })),
//       subtotal: subtotal,
//       totalDiscount: guestOrderData.totalDiscount || 0,
//       shippingCost: shippingCost,
//       totalAmount: finalTotal,
//       shippingAddress: guestOrderData.shippingAddress,
//       couponCode: guestOrderData.couponCode || null,
//       specialInstructions: guestOrderData.specialInstructions || "",
//       transactionId: tran_id,
//       paymentStatus: "pending",
//       customerInfo: customerInfo,
//       paymentMethod: paymentMethod
//     };

//     // Aamarpay payment data preparation
//     const store_id = process.env.AMARPAY_STORE_ID;
//     const signature_key = process.env.AMARPAY_SIGNATURE_KEY;

//     // Prepare payment data
//     const paymentData = {
//       store_id,
//       signature_key,
//       tran_id,
//       amount: finalTotal.toFixed(2),
//       currency: "BDT",
//       desc: `Guest Order Payment`,
//       cus_name: customerInfo.name,
//       cus_email: customerInfo.email,
//       cus_phone: customerInfo.phone,
//       cus_add1: guestOrderData.shippingAddress.address.substring(0, 50),
//       cus_city: guestOrderData.shippingAddress.city,
//       cus_country: guestOrderData.shippingAddress.country || "Bangladesh",
//       success_url: `${process.env.FRONTEND_URL}/payment/success/${tran_id}?isGuest=true`,
//       fail_url: `${process.env.FRONTEND_URL}/payment/fail/${tran_id}?isGuest=true`,
//       cancel_url: `${process.env.FRONTEND_URL}/payment/cancel/${tran_id}?isGuest=true`,
//       notify_url: `${process.env.BACKEND_URL}/payment/notify`,
//       type: 'json'
//     };

//     // Store guest order data temporarily
//     global.pendingGuestOrders = global.pendingGuestOrders || new Map();
//     global.pendingGuestOrders.set(tran_id, completeGuestOrderData);

//     console.log("Stored guest order data for transaction:", tran_id);

//     // Send request to Aamarpay
//     const response = await axios.post(
//       process.env.AMARPAY_PAYMENT_URL,
//       paymentData,
//       {
//         headers: {
//           'Content-Type': 'application/json'
//         }
//       }
//     );

//     if (response.data && response.data.payment_url) {
//       res.status(200).json({
//         success: true,
//         message: "Payment initialized successfully",
//         data: {
//           payment_url: response.data.payment_url,
//           transactionId: tran_id,
//         },
//       });
//     } else {
//       // Clean up if failed
//       global.pendingGuestOrders.delete(tran_id);

//       res.status(400).json({
//         success: false,
//         message: response.data.msg || "Payment initialization failed",
//       });
//     }
//   } catch (error) {
//     console.error("Error initializing guest payment:", error);
//     res.status(500).json({
//       success: false,
//       message: "Internal server error",
//       error: error.message
//     });
//   }
// };


// COMPLETE: Initialize payment for guest orders
export const initializeGuestPayment = async (req, res) => {
  try {
    console.log("=== Initialize Guest Payment Request ===");
    console.log("Request body:", JSON.stringify(req.body, null, 2));

    const {
      guestOrderData,
      customerInfo,
      paymentMethod = "card"
    } = req.body;

    // Detailed validation
    if (!guestOrderData) {
      return res.status(400).json({
        success: false,
        message: "Guest order data is required"
      });
    }

    if (!customerInfo) {
      return res.status(400).json({
        success: false,
        message: "Customer information is required"
      });
    }

    if (!customerInfo.name || !customerInfo.email || !customerInfo.phone) {
      return res.status(400).json({
        success: false,
        message: "Customer name, email, and phone are required",
        missing: {
          name: !customerInfo.name,
          email: !customerInfo.email,
          phone: !customerInfo.phone
        }
      });
    }

    if (!guestOrderData.shippingAddress) {
      return res.status(400).json({
        success: false,
        message: "Shipping address is required"
      });
    }

    if (!guestOrderData.shippingAddress.address || !guestOrderData.shippingAddress.city) {
      return res.status(400).json({
        success: false,
        message: "Shipping address and city are required",
        missing: {
          address: !guestOrderData.shippingAddress.address,
          city: !guestOrderData.shippingAddress.city
        }
      });
    }

    if (!guestOrderData.items || !Array.isArray(guestOrderData.items) || guestOrderData.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Order items are required"
      });
    }

    // Calculate order amounts
    const subtotal = guestOrderData.subtotal || guestOrderData.items.reduce((sum, item) => 
      sum + (item.discountedPrice || item.originalPrice || 0) * (item.quantity || 1), 0);

    const shippingCost = calculateShippingCost(subtotal, guestOrderData.shippingAddress.city);
    const finalTotal = subtotal + shippingCost;

    // Generate unique transaction ID for guest
    const tran_id = `GUEST_TXN_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    // Prepare complete guest order data for storage
    const completeGuestOrderData = {
      items: guestOrderData.items.map(item => ({
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
        discountAmount: ((item.originalPrice || 0) - (item.discountedPrice || item.originalPrice || 0)) * (item.quantity || 1)
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
        country: guestOrderData.shippingAddress.country || "Bangladesh"
      },
      billingAddress: guestOrderData.billingAddress || { sameAsShipping: true },
      customerInfo: customerInfo,
      couponCode: guestOrderData.couponCode || null,
      specialInstructions: guestOrderData.specialInstructions || "",
      transactionId: tran_id,
      paymentStatus: "pending",
      paymentMethod: paymentMethod
    };

    // Aamarpay payment data preparation
    const store_id = process.env.AMARPAY_STORE_ID;
    const signature_key = process.env.AMARPAY_SIGNATURE_KEY;

    // Prepare payment data with CORRECT URLs
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
      // Use frontend URLs for user redirects
      success_url: `${process.env.FRONTEND_URL}/payment-success/${tran_id}?isGuest=true`,
      fail_url: `${process.env.FRONTEND_URL}/payment-fail/${tran_id}?isGuest=true`,
      cancel_url: `${process.env.FRONTEND_URL}/payment-cancel/${tran_id}?isGuest=true`,
      // Server-side callback for payment verification
      notify_url: `${process.env.BACKEND_URL}/api/payment/notify`,
      type: 'json'
    };

    console.log("Aamarpay payment data:", JSON.stringify(paymentData, null, 2));

    // Store guest order data temporarily for later retrieval
    global.pendingGuestOrders = global.pendingGuestOrders || new Map();
    global.pendingGuestOrders.set(tran_id, completeGuestOrderData);

    console.log("Stored guest order data for transaction:", tran_id);
    console.log("Pending guest orders count:", global.pendingGuestOrders.size);

    // Send request to Aamarpay
    try {
      const response = await axios.post(
        process.env.AMARPAY_PAYMENT_URL || "https://sandbox.aamarpay.com/jsonpost.php",
        paymentData,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      console.log("Aamarpay API response:", response.data);

      if (response.data && response.data.payment_url) {
        res.status(200).json({
          success: true,
          message: "Payment initialized successfully",
          data: {
            payment_url: response.data.payment_url,
            transactionId: tran_id,
            orderAmount: finalTotal,
            customerEmail: customerInfo.email
          },
        });
      } else {
        // Clean up if failed
        global.pendingGuestOrders.delete(tran_id);
        
        console.error("Aamarpay error response:", response.data);
        res.status(400).json({
          success: false,
          message: response.data.msg || response.data.message || "Payment initialization failed",
          aamarpayResponse: response.data
        });
      }
    } catch (axiosError) {
      // Clean up if failed
      global.pendingGuestOrders.delete(tran_id);
      
      console.error("Axios error calling Aamarpay:", axiosError.response?.data || axiosError.message);
      
      res.status(500).json({
        success: false,
        message: "Failed to connect to payment gateway",
        error: axiosError.response?.data || axiosError.message
      });
    }

  } catch (error) {
    console.error("Error initializing guest payment:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};






// Cash on Delivery order 
// (For log in user only. guest user COD manageing from order controller. 
// So don't change it for guest order. log in user can smoothly COD)
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
        error: dbError.message
      })
    }

    if (!cart) {
      console.log("No cart found for user:", userId)
      return res.status(400).json({
        success: false,
        message: "Cart not found"
      })
    }

    if (!cart.items || cart.items.length === 0) {
      console.log("Cart is empty for user:", userId)
      return res.status(400).json({
        success: false,
        message: "Cart is empty"
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
      console.log("No valid items found in cart")
      return res.status(400).json({
        success: false,
        message: "No valid items in cart"
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
        error: saveError.message
      })
    }

    // Update product stock after successful order creation
    try {
      await updateProductStock(orderItems);
      console.log("Product stock updated successfully");
    } catch (stockError) {
      console.error("Error updating product stock:", stockError);
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

    // ======================
    // 🔔 Order confirmation mail পাঠানো
    // ======================
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

// Helper function to update product stock (same as in guest order)
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

// Initialize online payment with SSLCommerz (existing - no changes needed)
// Initialize online payment with Aamarpay
export const initializePayment = async (req, res) => {
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

    // Aamarpay payment data preparation - FORM URLENCODED
    const store_id = process.env.AMARPAY_STORE_ID
    const signature_key = process.env.AMARPAY_SIGNATURE_KEY
    const tran_id = `TXN_${order._id}_${Date.now()}`

    // Prepare form-urlencoded data
    const formData = new URLSearchParams()
    formData.append('store_id', store_id)
    formData.append('signature_key', signature_key)
    formData.append('tran_id', tran_id)
    formData.append('amount', finalTotal.toString())
    formData.append('currency', "BDT")
    formData.append('desc', `Order #${orderNumber}`)
    formData.append('cus_name', shippingAddress.fullName)
    formData.append('cus_email', shippingAddress.email || "customer@example.com")
    formData.append('cus_phone', shippingAddress.phone)
    formData.append('cus_add1', shippingAddress.address)
    formData.append('cus_city', shippingAddress.city || "Dhaka")
    formData.append('cus_country', shippingAddress.country || "Bangladesh")
    formData.append('success_url', `${process.env.FRONTEND_URL}/payment/success/${tran_id}`)
    formData.append('fail_url', `${process.env.FRONTEND_URL}/payment/fail/${tran_id}`)
    formData.append('cancel_url', `${process.env.FRONTEND_URL}/payment/cancel/${tran_id}`)
    formData.append("notify_url", `${process.env.BACKEND_URL}/payment/notify`);
    formData.append('type', 'json')

    // Update order with transaction ID
    order.transactionId = tran_id
    await order.save()

    // Send payment request to Aamarpay with form-urlencoded data
    try {
      const response = await axios.post(process.env.AMARPAY_PAYMENT_URL, formData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      })

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
          message: response.data.msg || "Payment initialization failed"
        })
      }
    } catch (error) {
      // Delete the order if payment initialization fails
      await Order.findByIdAndDelete(order._id)
      console.error("Aamarpay API error:", error.response?.data || error.message)
      res.status(400).json({
        message: "Payment initialization failed"
      })
    }

  } catch (error) {
    console.error("Payment initialization error:", error)
    res.status(500).json({ message: "Internal server error", error: error.message })
  }
}




// COMPLETE FIXED: Payment Success Handler
export const paymentSuccess = async (req, res) => {
  try {
    console.log("=== Payment Success Handler ===");
    console.log("Method:", req.method);
    console.log("Params:", req.params);
    console.log("Query:", req.query);
    console.log("Body:", req.body);

    // Get transaction ID from different sources
    const tran_id = req.params.transactionId || req.body?.tran_id || req.query?.tran_id;
    const isGuest = req.query?.isGuest === "true" || (tran_id && tran_id.startsWith("GUEST_TXN_"));

    if (!tran_id) {
      console.log("Transaction ID missing");
      if (req.method === "GET") {
        return res.redirect(`${process.env.FRONTEND_URL}/payment-failed?error=missing_transaction_id`);
      }
      return res.status(400).json({
        success: false,
        message: "Transaction ID missing",
      });
    }

    console.log(`Processing ${isGuest ? 'GUEST' : 'REGULAR'} order with transaction ID:`, tran_id);

    // Handle GET request (user redirect from payment gateway)
    if (req.method === "GET") {
      console.log("GET request - redirecting user to frontend");
      
      if (isGuest) {
        // For guest orders, check if order already exists
        const existingOrder = await Order.findOne({ transactionId: tran_id });
        if (existingOrder) {
          console.log("Guest order found, redirecting to success page");
          return res.redirect(`${process.env.FRONTEND_URL}/order-success?orderNumber=${existingOrder.orderNumber}&isGuest=true`);
        } else {
          console.log("Guest order not found yet, showing processing page");
          return res.redirect(`${process.env.FRONTEND_URL}/payment-processing?transactionId=${tran_id}&isGuest=true`);
        }
      } else {
        // For regular orders
        const order = await Order.findOne({ transactionId: tran_id });
        if (order) {
          return res.redirect(`${process.env.FRONTEND_URL}/order-success/${order._id}`);
        } else {
          return res.redirect(`${process.env.FRONTEND_URL}/payment-failed?error=order_not_found`);
        }
      }
    }

    // Handle POST request (server callback from payment gateway)
    console.log("POST request - Processing payment callback");
    const callbackData = req.body;

    // Verify payment was successful
    const isPaymentSuccessful = callbackData.pay_status === "Successful";
    if (!isPaymentSuccessful) {
      console.log("Payment was not successful:", callbackData.pay_status);
      return res.status(400).json({
        success: false,
        message: "Payment was not successful",
        paymentStatus: callbackData.pay_status
      });
    }

    // Verify store credentials match (security check)
    if (callbackData.store_id && callbackData.store_id !== process.env.AMARPAY_STORE_ID) {
      console.log("Store ID mismatch. Expected:", process.env.AMARPAY_STORE_ID, "Received:", callbackData.store_id);
      return res.status(400).json({
        success: false,
        message: "Store ID verification failed"
      });
    }

    console.log("Payment verification successful via callback");

    // Handle guest orders
    if (isGuest) {
      console.log("Processing guest order payment");
      global.pendingGuestOrders = global.pendingGuestOrders || new Map();
      const guestOrderData = global.pendingGuestOrders.get(tran_id);

      if (!guestOrderData) {
        console.log("Guest order data not found for transaction:", tran_id);
        console.log("Available transaction IDs:", Array.from(global.pendingGuestOrders.keys()));
        return res.status(404).json({
          success: false,
          message: "Guest order data not found"
        });
      }

      // Check if order already exists to avoid duplicates
      const existingOrder = await Order.findOne({ transactionId: tran_id });
      if (existingOrder) {
        console.log("Guest order already exists:", existingOrder.orderNumber);
        // Clean up pending data
        global.pendingGuestOrders.delete(tran_id);
        return res.status(200).json({
          success: true,
          message: "Order already processed",
          data: {
            orderId: existingOrder._id,
            orderNumber: existingOrder.orderNumber
          }
        });
      }

      // Generate order number
      const orderCount = await Order.countDocuments();
      const orderNumber = `GUEST-${Date.now()}-${(orderCount + 1).toString().padStart(4, "0")}`;

      // Create guest order
      const order = new Order({
        isGuestOrder: true,
        guestCustomerInfo: {
          name: guestOrderData.customerInfo.name,
          email: guestOrderData.customerInfo.email,
          phone: guestOrderData.customerInfo.phone,
        },
        orderNumber: orderNumber,
        transactionId: tran_id,
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
          pg_txnid: callbackData.pg_txnid || callbackData.transaction_id,
          bank_txn: callbackData.bank_txn,
          card_type: callbackData.card_type,
          pay_time: callbackData.pay_time || new Date().toISOString(),
          amount: callbackData.amount || guestOrderData.totalAmount,
          store_amount: callbackData.store_amount,
          currency: callbackData.currency || "BDT"
        }
      });

      await order.save();
      console.log("Guest order created successfully:", order.orderNumber);

      // Update product stock
      try {
        await updateProductStock(guestOrderData.items);
        console.log("Product stock updated for guest order");
      } catch (stockError) {
        console.error("Error updating product stock:", stockError);
      }

      // Clean up pending data
      global.pendingGuestOrders.delete(tran_id);

      // Send confirmation email
      try {
        const toEmail = guestOrderData.customerInfo.email;
        if (toEmail) {
          await sendOrderEmails(order, toEmail, true);
          console.log("Guest order confirmation email sent");
        }
      } catch (emailError) {
        console.error("Email sending failed:", emailError.message);
      }

      return res.status(200).json({
        success: true,
        message: "Guest order payment successful",
        data: {
          orderId: order._id,
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount,
          status: order.status,
          paymentStatus: order.paymentStatus,
        },
      });
    }

    // Handle regular user orders
    console.log("Processing regular user order payment");
    const order = await Order.findOne({ transactionId: tran_id });

    if (!order) {
      console.log("Order not found for transaction ID:", tran_id);
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Update order status and payment status
    order.status = "confirmed";
    order.paymentStatus = "paid";
    
    // Store gateway response
    order.paymentGatewayResponse = {
      pg_txnid: callbackData.pg_txnid || callbackData.transaction_id,
      bank_txn: callbackData.bank_txn,
      card_type: callbackData.card_type,
      pay_time: callbackData.pay_time || new Date().toISOString(),
      amount: callbackData.amount || order.totalAmount,
      store_amount: callbackData.store_amount,
      currency: callbackData.currency || "BDT"
    };

    await order.save();
    console.log("Order payment confirmed:", order.orderNumber);

    // Update product stock
    try {
      await updateProductStock(order.items);
      console.log("Product stock updated for regular order");
    } catch (stockError) {
      console.error("Error updating product stock:", stockError);
    }

    // Clear user's cart
    if (order.userId) {
      try {
        await Cart.findOneAndUpdate(
          { userId: order.userId },
          {
            $set: {
              items: [],
              totalBaseAmount: 0,
              totalDiscountAmount: 0,
              finalAmount: 0,
              itemCount: 0,
            },
          }
        );
        console.log("Cart cleared for user:", order.userId);
      } catch (cartError) {
        console.error("Error clearing cart:", cartError.message);
      }
    }

    // Send confirmation email
    try {
      const user = await User.findById(order.userId);
      const toEmail = order?.shippingAddress?.email || user?.email;
      if (toEmail) {
        await sendOrderEmails(order, toEmail);
        console.log("Order confirmation email sent");
      }
    } catch (emailError) {
      console.error("Email sending failed:", emailError.message);
    }

    return res.status(200).json({
      success: true,
      message: "Payment successful",
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        status: order.status,
        paymentStatus: order.paymentStatus,
      },
    });

  } catch (error) {
    console.error("Payment success handler error:", error);
    if (req.method === "GET") {
      return res.redirect(`${process.env.FRONTEND_URL}/payment-failed?error=server_error`);
    }
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};


// UPDATED: Handle payment success - now handles both user and guest orders
// UPDATED: Handle payment success - now handles both user and guest orders
// UPDATED: Handle payment success - Fixed version
// CORRECTED: Handle payment success without separate verification API
// UPDATED: Handle payment success - Fixed version
// export const paymentSuccess = async (req, res) => {
//   try {
//     console.log("=== Payment Success Request ===");
//     console.log("Method:", req.method);
//     console.log("Params:", req.params);
//     console.log("Query:", req.query);
//     console.log("Body:", req.body);


//     console.log("POST request received - This is Aamarpay server callback");
//     console.log("Callback data:", req.body);


//     const tran_id = req.params.transactionId || req.body?.tran_id || req.query?.tran_id;

//     if (!tran_id) {
//       if (req.method === "GET") {
//         return res.redirect(`${process.env.FRONTEND_URL}/payment-failed?error=missing_transaction_id`);
//       }
//       return res.status(400).json({
//         success: false,
//         message: "Transaction ID missing",
//       });
//     }

//     // যদি GET request হয় 👉 শুধু frontend-এ redirect করবে
//     if (req.method === "GET") {
//       console.log("GET request received for payment success, redirecting to frontend");

//       // Check if it's a guest order
//       if (tran_id.startsWith("GUEST_TXN_")) {
//         return res.redirect(`${process.env.FRONTEND_URL}/order-success?transactionId=${tran_id}&isGuest=true`);
//       } else {
//         const order = await Order.findOne({ transactionId: tran_id });
//         if (order) {
//           return res.redirect(`${process.env.FRONTEND_URL}/order-success/${order._id}`);
//         } else {
//           return res.redirect(`${process.env.FRONTEND_URL}/payment-failed?error=order_not_found`);
//         }
//       }
//     }

//     // যদি POST request হয় 👉 এটি Aamarpay থেকে server callback (IPN)
//     console.log("POST request received - This is Aamarpay server callback");
//     console.log("Callback data:", req.body);

//     // Aamarpay callback data validation
//     const callbackData = req.body;

//     // Check if payment was successful
//     const isPaymentSuccessful = callbackData.pay_status === "Successful";

//     if (!isPaymentSuccessful) {
//       console.log("Payment was not successful:", callbackData.pay_status);
//       return res.status(400).json({
//         success: false,
//         message: "Payment was not successful",
//         paymentStatus: callbackData.pay_status
//       });
//     }

//     // Verify store credentials match (security check)
//     if (callbackData.store_id !== process.env.AMARPAY_STORE_ID) {
//       console.log("Store ID mismatch. Expected:", process.env.AMARPAY_STORE_ID, "Received:", callbackData.store_id);
//       return res.status(400).json({
//         success: false,
//         message: "Store ID verification failed"
//       });
//     }

//     console.log("Payment verification successful via callback");

//     // গেস্ট অর্ডার কিনা চেক করো
//     if (tran_id.startsWith("GUEST_TXN_")) {
//       global.pendingGuestOrders = global.pendingGuestOrders || new Map();
//       const guestOrderData = global.pendingGuestOrders.get(tran_id);

//       if (!guestOrderData) {
//         console.log("Guest order data not found for:", tran_id);
//         return res.status(404).json({
//           success: false,
//           message: "Guest order data not found"
//         });
//       }

//       // Create guest order
//       const orderCount = await Order.countDocuments();
//       const orderNumber = `ORD-${Date.now()}-${(orderCount + 1).toString().padStart(4, "0")}`;

//       // Ensure all required fields are present
//       const orderItems = guestOrderData.items.map(item => ({
//         productId: item.productId,
//         productTitle: item.productTitle || "Unknown Product",
//         productImage: item.productImage || "/placeholder.svg",
//         variantId: item.variantId || null,
//         colorVariantId: item.colorVariantId || null,
//         quantity: item.quantity || 1,
//         originalPrice: item.originalPrice || 0,
//         discountedPrice: item.discountedPrice || item.originalPrice || 0,
//         discountPercentage: item.discountPercentage || 0,
//         totalOriginalPrice: item.totalOriginalPrice || (item.originalPrice || 0) * (item.quantity || 1),
//         totalDiscountedPrice: item.totalDiscountedPrice || (item.discountedPrice || item.originalPrice || 0) * (item.quantity || 1),
//         discountAmount: item.discountAmount || ((item.originalPrice || 0) - (item.discountedPrice || item.originalPrice || 0)) * (item.quantity || 1)
//       }));

//       const subtotal = guestOrderData.subtotal || orderItems.reduce((sum, item) => sum + item.totalDiscountedPrice, 0);

//       const order = new Order({
//         isGuestOrder: true,
//         guestCustomerInfo: {
//           name: guestOrderData.shippingAddress.fullName,
//           email: guestOrderData.shippingAddress.email || guestOrderData.customerInfo?.email || "",
//           phone: guestOrderData.shippingAddress.phone || guestOrderData.customerInfo?.phone,
//         },
//         orderNumber,
//         items: orderItems,
//         subtotal: subtotal,
//         totalDiscount: guestOrderData.totalDiscount || 0,
//         shippingCost: guestOrderData.shippingCost,
//         tax: 0,
//         totalAmount: guestOrderData.totalAmount,
//         shippingAddress: guestOrderData.shippingAddress,
//         paymentMethod: "card",
//         couponCode: guestOrderData.couponCode || null,
//         couponDiscount: 0,
//         specialInstructions: guestOrderData.specialInstructions || "",
//         status: "confirmed", // ✅ স্ট্যাটাস confirmed সেট করা
//         paymentStatus: "paid", // ✅ পেমেন্ট স্ট্যাটাস paid সেট করা
//         transactionId: tran_id,
//         paymentGatewayResponse: {
//           pg_txnid: callbackData.pg_txnid,
//           bank_txn: callbackData.bank_txn,
//           card_type: callbackData.card_type,
//           pay_time: callbackData.pay_time,
//           amount: callbackData.amount,
//           store_amount: callbackData.store_amount,
//           currency: callbackData.currency
//         }
//       });

//       await order.save();

//       // Update product stock
//       try {
//         await updateProductStock(orderItems);
//         console.log("Product stock updated for guest order");
//       } catch (stockError) {
//         console.error("Error updating product stock:", stockError);
//       }

//       // Clean up
//       global.pendingGuestOrders.delete(tran_id);
//       console.log("Guest order created successfully:", order.orderNumber);

//       // Send confirmation email
//       try {
//         const toEmail = guestOrderData.shippingAddress.email || guestOrderData.customerInfo?.email;
//         if (toEmail) {
//           await sendOrderEmails(order, toEmail);
//           console.log("✅ Guest order confirmation email sent");
//         }
//       } catch (mailError) {
//         console.error("❌ Failed to send guest confirmation email:", mailError);
//       }

//       return res.status(200).json({
//         success: true,
//         message: "Guest order payment successful",
//         data: {
//           order: {
//             _id: order._id,
//             orderNumber: order.orderNumber,
//             totalAmount: order.totalAmount,
//             status: order.status,
//             paymentStatus: order.paymentStatus,
//           },
//         },
//       });
//     } else {
//       // Regular order processing
//       const order = await Order.findOne({ transactionId: tran_id });
//       if (!order) {
//         console.log("Order not found for transaction ID:", tran_id);
//         return res.status(404).json({
//           success: false,
//           message: "Order not found"
//         });
//       }

//       // ✅ স্ট্যাটাস এবং পেমেন্ট স্ট্যাটাস আপডেট করুন
//       order.paymentStatus = "paid";
//       order.status = "confirmed";

//       // Store payment gateway response
//       order.paymentGatewayResponse = {
//         pg_txnid: callbackData.pg_txnid,
//         bank_txn: callbackData.bank_txn,
//         card_type: callbackData.card_type,
//         pay_time: callbackData.pay_time,
//         amount: callbackData.amount,
//         store_amount: callbackData.store_amount,
//         currency: callbackData.currency
//       };

//       await order.save();

//       // Update product stock
//       try {
//         await updateProductStock(order.items);
//         console.log("Product stock updated for regular order");
//       } catch (stockError) {
//         console.error("Error updating product stock:", stockError);
//       }

//       // Clear user's cart
//       try {
//         await Cart.findOneAndUpdate(
//           { userId: order.userId },
//           {
//             $set: {
//               items: [],
//               totalBaseAmount: 0,
//               totalDiscountAmount: 0,
//               finalAmount: 0,
//               itemCount: 0,
//             },
//           }
//         );
//         console.log("Cart cleared for user:", order.userId);
//       } catch (cartError) {
//         console.error("Error clearing cart:", cartError);
//       }

//       console.log("Order payment confirmed successfully:", order.orderNumber);

//       // Send confirmation email
//       try {
//         const user = await User.findById(order.userId);
//         const toEmail = order?.shippingAddress?.email || user?.email;
//         if (toEmail) {
//           await sendOrderEmails(order, toEmail);
//           console.log("✅ Order confirmation email sent");
//         }
//       } catch (mailError) {
//         console.error("❌ Failed to send confirmation email:", mailError);
//       }

//       return res.status(200).json({
//         success: true,
//         message: "Payment successful",
//         data: {
//           order: {
//             _id: order._id,
//             orderNumber: order.orderNumber,
//             totalAmount: order.totalAmount,
//             status: order.status,
//             paymentStatus: order.paymentStatus,
//           },
//         },
//       });
//     }

//   } catch (error) {
//     console.error("Payment success handler error:", error);

//     if (req.method === "GET") {
//       return res.redirect(`${process.env.FRONTEND_URL}/payment-failed?error=server_error`);
//     }

//     return res.status(500).json({
//       success: false,
//       message: "Internal server error",
//       error: error.message,
//     });
//   }
// };






// export const paymentSuccess = async (req, res) => {
//   try {
//     console.log("=== Payment Success Handler ===");
//     console.log("Method:", req.method);
//     console.log("Params:", req.params);
//     console.log("Body:", req.body);
//     console.log("Query:", req.query);

//     const tran_id = req.params.transactionId || req.body?.tran_id || req.query?.tran_id;

//     if (!tran_id) {
//       console.log("Transaction ID missing");
//       if (req.method === "GET") {
//         return res.redirect(`${process.env.FRONTEND_URL}/payment-failed?error=missing_transaction_id`);
//       }
//       return res.status(400).json({
//         success: false,
//         message: "Transaction ID missing",
//       });
//     }

//     // Handle GET request (user redirect)
//     if (req.method === "GET") {
//       console.log("GET request - redirecting user to frontend");
      
//       if (tran_id.startsWith("GUEST_TXN_")) {
//         return res.redirect(`${process.env.FRONTEND_URL}/order-success?transactionId=${tran_id}&isGuest=true`);
//       } else {
//         return res.redirect(`${process.env.FRONTEND_URL}/order-success?transactionId=${tran_id}`);
//       }
//     }

//     console.log("POST request - Processing payment callback from Aamarpay");
//     const callbackData = req.body;

//     // Verify payment was successful
//     if (callbackData.pay_status !== "Successful") {
//       console.log("Payment not successful:", callbackData.pay_status);
//       return res.status(400).json({
//         success: false,
//         message: "Payment was not successful",
//         paymentStatus: callbackData.pay_status
//       });
//     }

//     // Verify store ID
//     if (callbackData.store_id !== process.env.AMARPAY_STORE_ID) {
//       console.log("Store ID mismatch");
//       return res.status(400).json({
//         success: false,
//         message: "Store ID verification failed"
//       });
//     }

//     console.log("Payment verification successful");

//     // Handle guest orders
//     if (tran_id.startsWith("GUEST_TXN_")) {
//       console.log("Processing guest order payment");
//       global.pendingGuestOrders = global.pendingGuestOrders || new Map();
//       const guestOrderData = global.pendingGuestOrders.get(tran_id);
      
//       if (!guestOrderData) {
//         console.log("Guest order data not found");
//         return res.status(404).json({
//           success: false,
//           message: "Guest order data not found"
//         });
//       }
      
//       const orderCount = await Order.countDocuments();
//       const orderNumber = `ORD-${Date.now()}-${(orderCount + 1).toString().padStart(4, "0")}`;

//       const order = new Order({
//         isGuestOrder: true,
//         guestCustomerInfo: {
//           name: guestOrderData.customerInfo?.name || guestOrderData.shippingAddress.fullName,
//           email: guestOrderData.customerInfo?.email || guestOrderData.shippingAddress.email,
//           phone: guestOrderData.customerInfo?.phone || guestOrderData.shippingAddress.phone,
//         },
//         orderNumber,
//         transactionId: tran_id,
//         items: guestOrderData.items,
//         subtotal: guestOrderData.subtotal,
//         totalDiscount: guestOrderData.totalDiscount || 0,
//         shippingCost: guestOrderData.shippingCost,
//         tax: 0,
//         totalAmount: guestOrderData.totalAmount,
//         shippingAddress: guestOrderData.shippingAddress,
//         billingAddress: guestOrderData.billingAddress || { sameAsShipping: true },
//         paymentMethod: "card",
//         specialInstructions: guestOrderData.specialInstructions || "",
//         status: "confirmed", // ✅ Set status to confirmed
//         paymentStatus: "paid", // ✅ Set payment status to paid
//         paymentGatewayResponse: {
//           pg_txnid: callbackData.pg_txnid,
//           bank_txn: callbackData.bank_txn,
//           card_type: callbackData.card_type,
//           pay_time: callbackData.pay_time,
//           amount: callbackData.amount,
//           store_amount: callbackData.store_amount,
//           currency: callbackData.currency
//         }
//       });

//       await order.save();
//       console.log("Guest order created successfully:", order.orderNumber);

//       // Update product stock
//       if (guestOrderData.items && guestOrderData.items.length > 0) {
//         await updateProductStock(guestOrderData.items);
//         console.log("Product stock updated");
//       }
      
//       // Clean up pending data
//       global.pendingGuestOrders.delete(tran_id);
      
//       // Send email
//       try {
//         const toEmail = guestOrderData.customerInfo?.email || guestOrderData.shippingAddress.email;
//         if (toEmail) {
//           await sendOrderEmails(order, toEmail);
//           console.log("Guest confirmation email sent");
//         }
//       } catch (emailError) {
//         console.error("Email sending failed:", emailError.message);
//       }
      
//       return res.status(200).json({
//         success: true,
//         message: "Guest order payment successful",
//         data: { orderId: order._id, orderNumber: order.orderNumber }
//       });
//     }

//     // Handle regular user orders
//     console.log("Processing regular user order payment");
//     const order = await Order.findOne({ transactionId: tran_id });
    
//     if (!order) {
//       console.log("Order not found for transaction ID:", tran_id);
//       return res.status(404).json({
//         success: false,
//         message: "Order not found"
//       });
//     }

//     // ✅ Update paymentStatus and status for regular orders
//     order.status = "confirmed";
//     order.paymentStatus = "paid";
    
//     // Store gateway response
//     order.paymentGatewayResponse = {
//       pg_txnid: callbackData.pg_txnid,
//       bank_txn: callbackData.bank_txn,
//       card_type: callbackData.card_type,
//       pay_time: callbackData.pay_time,
//       amount: callbackData.amount,
//       store_amount: callbackData.store_amount,
//       currency: callbackData.currency
//     };
    
//     await order.save();
//     console.log("Order payment confirmed:", order.orderNumber);
    
//     // Update product stock
//     if (order.items && order.items.length > 0) {
//       await updateProductStock(order.items);
//       console.log("Product stock updated");
//     }
    
//     // Clear user's cart
//     if (order.userId) {
//       try {
//         await Cart.findOneAndUpdate(
//           { userId: order.userId },
//           {
//             $set: {
//               items: [],
//               totalBaseAmount: 0,
//               totalDiscountAmount: 0,
//               finalAmount: 0,
//               itemCount: 0,
//             },
//           }
//         );
//         console.log("Cart cleared for user");
//       } catch (cartError) {
//         console.error("Error clearing cart:", cartError.message);
//       }
//     }
    
//     // Send confirmation email
//     try {
//       const user = order.userId ? await User.findById(order.userId) : null;
//       const toEmail = order?.shippingAddress?.email || user?.email;
//       if (toEmail) {
//         await sendOrderEmails(order, toEmail);
//         console.log("Order confirmation email sent");
//       }
//     } catch (emailError) {
//       console.error("Email sending failed:", emailError.message);
//     }

//     return res.status(200).json({
//       success: true,
//       message: "Payment successful",
//       data: { orderId: order._id, orderNumber: order.orderNumber }
//     });
//   } catch (error) {
//     console.error("Payment success handler error:", error);
//     if (req.method === "GET") {
//       return res.redirect(`${process.env.FRONTEND_URL}/payment-failed?error=server_error`);
//     }
//     return res.status(500).json({
//       success: false,
//       message: "Internal server error",
//       error: error.message,
//     });
//   }
// };





export const paymentNotify = async (req, res) => {
  try {
    console.log("=== Payment Notify (IPN) Request ===");
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    // This is the same logic as paymentSuccess POST handler
    await paymentSuccess(req, res);
  } catch (error) {
    console.error("Payment notify error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// Handle payment failure (existing - no changes needed)
export const paymentFail = async (req, res) => {
  try {
    console.log("=== Payment Fail Request ===")
    console.log("Request body:", JSON.stringify(req.body, null, 2))

    const { tran_id } = req.body

    // Check if it's a guest order
    if (tran_id.startsWith("GUEST_TXN_")) {
      // Clean up pending guest order data
      global.pendingGuestOrders = global.pendingGuestOrders || new Map()
      global.pendingGuestOrders.delete(tran_id)
      console.log("Cleaned up pending guest order data for:", tran_id)
    } else {
      // Handle regular user order
      const order = await Order.findOne({ transactionId: tran_id })
      if (order) {
        order.paymentStatus = "failed"
        order.status = "cancelled"
        await order.save()
        console.log("Order status updated to cancelled and payment status to failed")
      } else {
        console.log("Order not found for transaction ID:", tran_id)
      }
    }

    res.status(200).json({
      success: false,
      message: "Payment failed",
    })
  } catch (error) {
    console.error("Payment fail error:", error)
    res.status(500).json({ message: "Internal server error", error: error.message })
  }
}

// Handle payment cancellation (existing - no changes needed)
export const paymentCancel = async (req, res) => {
  try {
    console.log("=== Payment Cancel Request ===")
    console.log("Request body:", JSON.stringify(req.body, null, 2))

    const { tran_id } = req.body

    // Check if it's a guest order
    if (tran_id.startsWith("GUEST_TXN_")) {
      // Clean up pending guest order data
      global.pendingGuestOrders = global.pendingGuestOrders || new Map()
      global.pendingGuestOrders.delete(tran_id)
      console.log("Cleaned up pending guest order data for:", tran_id)
    } else {
      // Handle regular user order
      const order = await Order.findOne({ transactionId: tran_id })
      if (order) {
        order.paymentStatus = "cancelled"
        order.status = "cancelled"
        await order.save()
        console.log("Order status updated to cancelled and payment status to cancelled")
      } else {
        console.log("Order not found for transaction ID:", tran_id)
      }
    }

    res.status(200).json({
      success: false,
      message: "Payment cancelled",
    })
  } catch (error) {
    console.error("Payment cancel error:", error)
    res.status(500).json({ message: "Internal server error", error: error.message })
  }
}

// IPN (Instant Payment Notification) handler (existing - no changes needed)
export const handleIPN = async (req, res) => {
  try {
    console.log("=== IPN Request ===")
    console.log("Request body:", JSON.stringify(req.body, null, 2))
    const { tran_id, status } = req.body
    if (tran_id.startsWith("GUEST_TXN_")) {
      // Handle guest order IPN
      if (status === "VALID") {
        // Process guest order creation similar to paymentSuccess
        global.pendingGuestOrders = global.pendingGuestOrders || new Map()
        const guestOrderData = global.pendingGuestOrders.get(tran_id)
        if (guestOrderData) {
          const { createGuestOrder } = await import("./order.controller.js")
          guestOrderData.paymentStatus = "paid"
          guestOrderData.transactionId = tran_id
          const mockReq = { body: guestOrderData }
          const mockRes = {
            status: (code) => ({
              json: (data) => ({ statusCode: code, data }),
            }),
          }
          await createGuestOrder(mockReq, mockRes)
          global.pendingGuestOrders.delete(tran_id)
          console.log("Guest order created via IPN")
        }
      }
    } else {
      // Handle regular user order IPN
      const order = await Order.findOne({ transactionId: tran_id })
      if (!order) {
        console.log("Order not found for transaction ID:", tran_id)
        return res.status(404).json({ message: "Order not found" })
      }
      if (status === "VALID") {
        order.paymentStatus = "paid"
        order.status = "confirmed"
        await order.save()
        console.log("Order status updated to confirmed and payment status to paid via IPN")
        // Clear user's cart
        try {
          await Cart.findOneAndUpdate(
            { userId: order.userId },
            { $set: { items: [], totalAmount: 0, totalDiscountAmount: 0, finalAmount: 0 } },
          )
          console.log("Cart cleared for user:", order.userId)
        } catch (cartError) {
          console.error("Error clearing cart:", cartError)
        }
      }
    }
    res.status(200).json({ message: "IPN processed" })
  } catch (error) {
    console.error("IPN error:", error)
    res.status(500).json({ message: "Internal server error", error: error.message })
  }
}

export const initializeAamarpayPayment = async (req, res) => {
  try {
    console.log("=== Initialize Aamarpay Payment Request ===");
    console.log("Request body:", JSON.stringify(req.body, null, 2));

    const { userId, shippingAddress, couponCode = null, specialInstructions = "", isGuest = false, guestOrderData = null } = req.body;
    let amountDetails, orderItems, finalAmount;

    if (!isGuest && !userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required for regular orders"
      });
    }


    if (!shippingAddress || !shippingAddress.fullName || !shippingAddress.phone || !shippingAddress.address) {
      return res.status(400).json({
        success: false,
        message: "Complete shipping address is required"
      });
    }


    if (isGuest) {
      // Process guest order
      if (!guestOrderData || !guestOrderData.items || guestOrderData.items.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Guest order data with items is required"
        });
      }
      amountDetails = calculateGuestOrderAmount(guestOrderData);
      finalAmount = amountDetails.finalTotal;
      orderItems = guestOrderData.items;
    } else {
      // Process regular user order
      try {
        amountDetails = await calculateOrderAmount(userId, shippingAddress);
        finalAmount = amountDetails.finalTotal;
        orderItems = amountDetails.cartItems;
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: error.message || "Error calculating order amount"
        });
      }
    }

    // Generate order number
    const orderCount = await Order.countDocuments();
    const orderNumber = `ORD-${Date.now()}-${(orderCount + 1).toString().padStart(4, "0")}`;

    // Generate transaction ID
    const tran_id = isGuest ? `GUEST_TXN_${Date.now()}_${Math.floor(Math.random() * 10000)}` : `TXN_${orderNumber}`;

    // Prepare Aamarpay payment data - using the exact format Aamarpay expects
    const formData = new URLSearchParams();
    formData.append('store_id', process.env.AMARPAY_STORE_ID || "aamarpaytest");
    formData.append('signature_key', process.env.AMARPAY_SIGNATURE_KEY || "dbb74894e82415a2f7ff0ec3a97e4183");
    formData.append('tran_id', tran_id);
    formData.append('amount', finalAmount.toFixed(2));
    formData.append('currency', "BDT");
    formData.append('desc', `Order #${orderNumber}`);
    formData.append('cus_name', shippingAddress.fullName);
    formData.append('cus_email', shippingAddress.email || "customer@example.com");
    formData.append('cus_phone', shippingAddress.phone);
    formData.append('cus_add1', shippingAddress.address.substring(0, 50));
    formData.append('cus_city', shippingAddress.city || "Dhaka");
    formData.append('cus_country', shippingAddress.country || "Bangladesh");

    //    formData.append(
    //   'success_url',
    //   `${process.env.FRONTEND_URL}/payment-success/${tran_id}`
    // );  // User browser redirect
    //  formData.append(
    //   'fail_url',
    //   `${process.env.FRONTEND_URL}/payment-fail/${tran_id}`
    // );
    // formData.append(
    //   'cancel_url',
    //   `${process.env.FRONTEND_URL}/payment-cancel/${tran_id}`
    // );

    formData.append(
      -  'success_url',
      -  `${process.env.FRONTEND_URL}/payment-success/${tran_id}`
      + 'success_url',
      +  `${process.env.BACKEND_URL}/api/payment/success/${tran_id}`
    );  // Aamarpay POST 

    formData.append(
      -  'fail_url',
      -  `${process.env.FRONTEND_URL}/payment-fail/${tran_id}`
      + 'fail_url',
      +  `${process.env.BACKEND_URL}/api/payment/fail/${tran_id}`
    );

    formData.append(
      -  'cancel_url',
      -  `${process.env.FRONTEND_URL}/payment-cancel/${tran_id}`
      + 'cancel_url',
      +  `${process.env.BACKEND_URL}/api/payment/cancel/${tran_id}`
    );


    // Server-side verification (callback)
    formData.append('notify_url', `${process.env.BACKEND_URL}/api/payment/notify`);
    formData.append('type', 'json');
    console.log("Aamarpay form data:", Object.fromEntries(formData));
    // For guest orders, store in pending orders
    if (isGuest) {
      global.pendingGuestOrders = global.pendingGuestOrders || new Map();
      global.pendingGuestOrders.set(tran_id, {
        ...guestOrderData,
        transactionId: tran_id,
        orderNumber,
        shippingAddress,
        paymentStatus: "pending",
        totalAmount: finalAmount,
        shippingCost: amountDetails.shippingCost,
        subtotal: amountDetails.subtotal,
        totalDiscount: amountDetails.discount,
        specialInstructions: specialInstructions || "",
        paymentMethod: "card"
      });
    } else {
      // Create regular order in database
      try {
        const order = new Order({
          userId,
          orderNumber,
          items: orderItems.map(item => ({
            productId: item.productId?._id || item.productId,
            productTitle: item.productId?.title || "Unknown Product",
            productImage: (item.productId?.images && item.productId.images.length > 0)
              ? (item.productId.images[0].url || item.productId.images[0])
              : "/placeholder.svg",
            variantId: item.variantId || null,
            quantity: item.quantity || 1,
            originalPrice: item.basePrice || 0,
            discountedPrice: item.discountedPrice || 0,
            discountPercentage: item.discountPercentage || 0,
            totalOriginalPrice: (item.basePrice || 0) * (item.quantity || 1),
            totalDiscountedPrice: (item.discountedPrice || 0) * (item.quantity || 1),
            discountAmount: ((item.basePrice || 0) - (item.discountedPrice || 0)) * (item.quantity || 1)
          })),
          subtotal: amountDetails.subtotal,
          totalDiscount: amountDetails.discount,
          shippingCost: amountDetails.shippingCost,
          tax: 0,
          totalAmount: finalAmount,
          shippingAddress,
          paymentMethod: "card",
          couponCode,
          couponDiscount: 0,
          specialInstructions,
          status: "pending",
          paymentStatus: "pending",
          transactionId: tran_id
        });

        await order.save();
        console.log("Order saved successfully with ID:", order._id);
      } catch (saveError) {
        console.error("Error saving order:", saveError);
        return res.status(500).json({
          success: false,
          message: "Failed to save order",
          error: saveError.message
        });
      }
    }

    const payload = {
      store_id: process.env.AMARPAY_STORE_ID || "aamarpaytest",
      signature_key: process.env.AMARPAY_SIGNATURE_KEY || "dbb74894e82415a2f7ff0ec3a97e4183",
      tran_id: tran_id,
      amount: finalAmount.toFixed(2),
      currency: "BDT",
      desc: `Order #${orderNumber}`,
      cus_name: shippingAddress.fullName,
      cus_email: shippingAddress.email || "customer@example.com",
      cus_phone: shippingAddress.phone,
      cus_add1: shippingAddress.address.substring(0, 50),
      cus_city: shippingAddress.city || "Dhaka",
      cus_country: shippingAddress.country || "Bangladesh",
      success_url: `${process.env.FRONTEND_URL}/payment-success/${tran_id}`,  // 👉 User redirect
      fail_url: `${process.env.FRONTEND_URL}/payment-fail/${tran_id}`,
      cancel_url: `${process.env.FRONTEND_URL}/payment-cancel/${tran_id}`,


      // success_url: `${process.env.BACKEND_URL}/api/payment/success/${tran_id}`,
      // fail_url: `${process.env.BACKEND_URL}/api/payment/fail/${tran_id}`,
      // cancel_url: `${process.env.BACKEND_URL}/api/payment/cancel/${tran_id}`,

      // Gateway callback  notify_url (server-side POST callback)
      notify_url: `${process.env.BACKEND_URL}/api/payment/notify`,
      type: 'json'
    };

    console.log("Aamarpay request payload:", payload);

    // Send request to Aamarpay - using form-urlencoded format
    try {
      const response = await axios.post(
        process.env.AMARPAY_PAYMENT_URL || "https://sandbox.aamarpay.com/jsonpost.php",
        payload, // Send as JSON object directly
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      console.log("Aamarpay API response:", response.data);

      if (response.data && response.data.payment_url) {
        res.status(200).json({
          success: true,
          message: "Payment initialized successfully",
          data: {
            payment_url: response.data.payment_url,
            transactionId: tran_id,
            orderNumber: orderNumber,
            amount: finalAmount
          },
        });
      } else {
        console.error("Aamarpay error response:", response.data);
        res.status(400).json({
          success: false,
          message: response.data.msg || response.data.message || "Payment initialization failed at Aamarpay",
          aamarpayResponse: response.data
        });
      }
    } catch (axiosError) {
      console.error("Axios error calling Aamarpay:", axiosError.response?.data || axiosError.message);

      res.status(500).json({
        success: false,
        message: "Failed to connect to payment gateway",
        error: axiosError.response?.data || axiosError.message
      });
    }

  } catch (error) {
    console.error("Payment initialization error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
}

// Verify Aamarpay payment
// export const verifyAamarpayPayment = async (req, res) => {
//   try {
//     const { tran_id } = req.body

//     // Create the data for verification
//     const verificationData = {
//       store_id: process.env.AMARPAY_STORE_ID,
//       signature_key: process.env.AMARPAY_SIGNATURE_KEY,
//       request_id: tran_id, // এখানে transaction ID যাবে
//       type: "json",
//     };

//     // Send the verification request
//     const verifyResponse = await axios.post(
//       process.env.AMARPAY_VERIFICATION_URL,
//       qs.stringify(verificationData),  // 🔥 convert to x-www-form-urlencoded
//       {
//         headers: { "Content-Type": "application/x-www-form-urlencoded" },
//       }
//     );

//     console.log("Aamarpay verification response:", verifyResponse.data);



//     if (verifyResponse.data && verifyResponse.data.pay_status === "Successful") {
//       // Check if it's a guest order
//       if (tran_id.startsWith("GUEST_TXN_")) {
//         // Handle guest order payment success
//         global.pendingGuestOrders = global.pendingGuestOrders || new Map()
//         const guestOrderData = global.pendingGuestOrders.get(tran_id)

//         if (!guestOrderData) {
//           console.log("Guest order data not found for transaction ID:", tran_id)
//           return res.status(404).json({ message: "Order data not found" })
//         }

//         // Import and use the guest order creation function
//         const { createGuestOrder } = await import("./order.controller.js")

//         // Create guest order
//         const mockReq = {
//           body: {
//             ...guestOrderData,
//             paymentStatus: "paid",
//             status: "confirmed",
//           },
//         }
//         const mockRes = {
//           status: (code) => ({
//             json: (data) => {
//               if (code === 201) {
//                 // Clean up pending order data
//                 global.pendingGuestOrders.delete(tran_id)
//               }
//               return { statusCode: code, data }
//             },
//           }),
//         }

//         await createGuestOrder(mockReq, mockRes)

//         return res.status(200).json({
//           success: true,
//           message: "Payment successful",
//         })
//       } else {
//         // Handle regular user order payment success
//         const order = await Order.findOne({ transactionId: tran_id })
//         if (!order) {
//           console.log("Order not found for transaction ID:", tran_id)
//           return res.status(404).json({ message: "Order not found" })
//         }

//         // Update order status
//         order.paymentStatus = "paid"
//         order.status = "confirmed"
//         await order.save()

//         // Clear user's cart
//         try {
//           await Cart.findOneAndUpdate(
//             { userId: order.userId },
//             { $set: { items: [], totalAmount: 0, totalDiscountAmount: 0, finalAmount: 0 } }
//           )
//           console.log("Cart cleared for user:", order.userId)
//         } catch (cartError) {
//           console.error("Error clearing cart:", cartError)
//         }

//         return res.status(200).json({
//           success: true,
//           message: "Payment successful",
//           data: {
//             order: {
//               _id: order._id,
//               orderNumber: order.orderNumber,
//               totalAmount: order.totalAmount,
//               status: order.status,
//               paymentStatus: order.paymentStatus,
//             },
//           },
//         })
//       }
//     } else {
//       // Payment verification failed
//       return res.status(400).json({
//         success: false,
//         message: "Payment verification failed",
//       })
//     }
//   } catch (error) {
//     console.error("Aamarpay verification error:", error)
//     return res.status(500).json({
//       message: "Payment verification error",
//       error: error.message,
//     })
//   }
// }
