import Order from "../models/Order.js"
import Cart from "../models/Cart.js"
import Product from "../models/Product.js"
import { sendOrderEmails } from "../services/emailService.js"
import User from "../models/User.js"
import { createPathaoOrder } from "../services/pathaoService.js";
import { PATHAO_BASE_URL } from "../services/pathaoService.js";
import { getIo } from "../utils/socket.js"


// ##########################################################
// GENERATING ORDER NUMBER BY FOLLWING CLIENT REQUIREMENTS BY DATE MONTH YEAR TIME FRAMME. 
// ##########################################################
// order.controller.js (or utils file)

const generateOrderNumber = (serialNum) => {
  const now = new Date();
  
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const HHMM = `${hours}${minutes}`;
  
  // 🌟 CHANGE: Use the provided serial number instead of Math.random()
  const serialPart = serialNum.toString().padStart(4, '0'); 

  // Format: [YYYY][MM][DD][HHMM][XXXX]
  return `${year}${month}${day}${HHMM}${serialPart}`;
};


// ##########################################################
// updated this function for comprehensive order updates
// ##########################################################

export const createOrder = async (req, res) => {
  try {
    const { userId, shippingAddress, paymentMethod, shippingCost = 0 } = req.body;

    // Get user's cart
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: "Cart is empty" });
    }

    // Prepare order items with detailed pricing
    const orderItems = [];
    let subtotal = 0;
    let totalDiscount = 0;

    for (const cartItem of cart.items) {
      const product = cartItem.productId;

      // Get variant details if exists
      let variantDetails = null;
      if (cartItem.variantId) {
        variantDetails = product.variants.id(cartItem.variantId);
      }

      // Get color variant details if exists
      let colorVariantDetails = null;
      if (cartItem.colorVariantId) {
        colorVariantDetails = product.colorVariants.id(cartItem.colorVariantId);
      }

      const totalOriginalPrice = cartItem.originalPrice * cartItem.quantity;
      const totalDiscountedPrice = cartItem.discountedPrice * cartItem.quantity;
      const itemDiscountAmount = totalOriginalPrice - totalDiscountedPrice;

      const orderItem = {
        productId: product._id,
        productTitle: product.title,
        productImage: colorVariantDetails?.images[0] || product.images[0] || "/placeholder.svg?height=200&width=200",
        variantId: cartItem.variantId,
        variantDetails: variantDetails
          ? {
            size: variantDetails.size,
            dimension: variantDetails.dimension,
          }
          : null,
        colorVariantId: cartItem.colorVariantId,
        colorVariantDetails: colorVariantDetails
          ? {
            name: colorVariantDetails.name,
            code: colorVariantDetails.code,
          }
          : null,
        quantity: cartItem.quantity,
        originalPrice: cartItem.originalPrice,
        discountedPrice: cartItem.discountedPrice,
        discountPercentage: cartItem.discountPercentage,
        totalOriginalPrice,
        totalDiscountedPrice,
        discountAmount: itemDiscountAmount,
      };

      orderItems.push(orderItem);
      subtotal += totalDiscountedPrice;
      totalDiscount += itemDiscountAmount;
    }

    const totalAmount = subtotal + shippingCost;

    // Generate order number
    const orderCount = await Order.countDocuments()
    const serialNumber = orderCount + 1

    const orderNumber = generateOrderNumber(serialNumber) 
  console.log(`Generated New Order Number: ${orderNumber}`)

    // Create order
    const order = new Order({
      userId,
      orderNumber,
      items: orderItems,
      subtotal,
      totalDiscount,
      shippingCost,
      totalAmount,
      shippingAddress,
      paymentMethod,
      isGuestOrder: false,
    });

    await order.save();
    console.log('✅ Order created successfully:', order.orderNumber);



    // =======================================================
    // 🔔 Socket.IO Notification Block - START 
    // =======================================================
    try {
      const io = getIo();
      const customerName = order.shippingAddress.fullName || 'a Customer';
      const notificationMessage = `New Order #${order.orderNumber} placed by ${customerName}`
      
      const notificationData = {
        message: notificationMessage,
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        timestamp: new Date().toISOString(),
        link: `/orders/${order._id}` 
      }
      
      // Emit the notification to all connected clients (e.g., admin dashboard)
      io.emit('newOrderNotification', notificationData); 
      console.log(`[Socket.IO] Emitted new order notification for: ${order.orderNumber}`);

    } catch (socketError) {
      // Socket error should not block the main process
      console.error('[Socket.IO] Error emitting notification:', socketError.message);
    }


    // Send confirmation email using the new helper function
    try {
      const email = order.shippingAddress.email;
      const customerName = order.shippingAddress.fullName || 'Customer';

      console.log('📧 Sending email to logged-in user:', email);

      if (email) {
        const emailResult = await sendOrderEmails({
          email: email,
          customerName: customerName,
          orderNumber: order.orderNumber,
          orderDate: order.createdAt.toLocaleDateString('en-GB'),
          totalAmount: `৳${order.totalAmount.toLocaleString()}`,
          paymentMethod: order.paymentMethod,
        });

        if (emailResult.success) {
          console.log('✅ Email sent to logged-in user');
        }
      }
    } catch (emailError) {
      console.error('❌ Email error:', emailError.message);
    }


    console.log("📦 Order created:", order._id);
    console.log("📧 Trying to send email...");


    // Update product stock
    await updateProductStock(orderItems);

    // Clear cart after successful order
    await Cart.findOneAndUpdate(
      { userId },
      {
        items: [],
        totalAmount: 0,
        totalDiscountAmount: 0,
        finalAmount: 0,
      },
    );

    res.status(201).json({
      status: "success",
      message: "Order created successfully",
      data: { order },
    });

  } catch (error) {
    console.error("❌ Create order error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
};


// ##########################################################
// THIS IS MAIN FUNCTION FOR CREATING ORDER AS A GUEST USER. 
// ##########################################################

export const createGuestOrder = async (req, res) => {
  try {
    console.log("Received guest order request:", JSON.stringify(req.body, null, 2));

    const {
      customerInfo,
      shippingAddress,
      billingAddress,
      items,
      paymentMethod,
      shippingCost = 0, 
      specialInstructions = "",
    } = req.body;

    if (!customerInfo) {
      return res.status(400).json({ message: "Customer information is required" });
    }

    if (!customerInfo.name || !customerInfo.email || !customerInfo.phone) {
      return res.status(400).json({
        message: "Customer name, email, and phone are required",
        missing: {
          name: !customerInfo.name,
          email: !customerInfo.email,
          phone: !customerInfo.phone,
        },
      });
    }

    if (!shippingAddress) {
      return res.status(400).json({ message: "Shipping address is required" });
    }

    if (!shippingAddress.address || !shippingAddress.city) {
      return res.status(400).json({
        message: "Shipping address and city are required",
        missing: {
          address: !shippingAddress.address,
          city: !shippingAddress.city,
        },
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Order items are required" });
    }

    if (!paymentMethod) {
      return res.status(400).json({ message: "Payment method is required" });
    }

    // Prepare order items with detailed pricing
    const orderItems = [];
    let calculatedSubtotal = 0;
    let calculatedTotalDiscount = 0;

    for (const item of items) {
      // Fetch product details to ensure data integrity
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(400).json({ message: `Product not found: ${item.productId}` });
      }

      // Get variant details if exists
      let variantDetails = null;
      if (item.variantId) {
        variantDetails = product.variants.id(item.variantId);
      }

      // Get color variant details if exists
      let colorVariantDetails = null;
      if (item.colorVariantId) {
        // Fix: Check if colorVariants exists and is an array before calling methods on it
        if (product.colorVariants && Array.isArray(product.colorVariants)) {
          if (item.colorVariantId.startsWith('#')) {
            // It's a color code, find by colorCode
            colorVariantDetails = product.colorVariants.find(
              cv => cv && cv.colorCode === item.colorVariantId
            );
          } else {
            // It's an ObjectId, try to find by ID
            try {
              colorVariantDetails = product.colorVariants.id(item.colorVariantId);
            } catch (error) {
              console.log("Error finding color variant by ID:", error.message);
              // Fallback: try to find by colorCode if ID search fails
              colorVariantDetails = product.colorVariants.find(
                cv => cv && cv.colorCode === item.colorVariantId
              );
            }
          }
        } else {
          console.log("Warning: Product colorVariants is not an array or is undefined");
        }
      }

      const totalOriginalPrice = item.originalPrice * item.quantity;
      const totalDiscountedPrice = item.discountedPrice * item.quantity;
      const itemDiscountAmount = totalOriginalPrice - totalDiscountedPrice;

      const orderItem = {
        productId: product._id,
        productTitle: item.productTitle || product.title,
        productImage:
          item.productImage ||
          (colorVariantDetails && colorVariantDetails.images && colorVariantDetails.images[0]) ||
          (product.images && product.images[0]) ||
          "/placeholder.svg?height=200&width=200",
        variantId: item.variantId,
        variantDetails: variantDetails
          ? {
            size: variantDetails.size,
            dimension: variantDetails.dimension,
          }
          : null,
        // FIX: Only set colorVariantId if it's a valid ObjectId, not color code
        colorVariantId: item.colorVariantId && item.colorVariantId.startsWith('#') ? null : item.colorVariantId,
        colorVariantDetails: colorVariantDetails
          ? {
            name: colorVariantDetails.name,
            code: colorVariantDetails.code,
          }
          : null,
        quantity: item.quantity,
        originalPrice: item.originalPrice,
        discountedPrice: item.discountedPrice,
        discountPercentage: item.discountPercentage || 0,
        totalOriginalPrice,
        totalDiscountedPrice,
        discountAmount: Math.max(0, itemDiscountAmount),
      };

      orderItems.push(orderItem);
      calculatedSubtotal += totalDiscountedPrice;
      calculatedTotalDiscount += itemDiscountAmount;
    }

    // ✅ NEW: Calculate shipping cost dynamically like logged-in users
    const calculateShippingCost = (subtotal, city) => {
      if (subtotal >= 4000) return 0;
      const isDhaka = city && city.toLowerCase().includes("dhaka");
      return isDhaka ? 70 : 130;
    };

    const dynamicShippingCost = calculateShippingCost(calculatedSubtotal, shippingAddress.city);
    const calculatedTotalAmount = calculatedSubtotal + dynamicShippingCost;

    console.log("Shipping cost calculation:", {
      subtotal: calculatedSubtotal,
      city: shippingAddress.city,
      shippingCost: dynamicShippingCost,
      totalAmount: calculatedTotalAmount
    });
    const orderCount = await Order.countDocuments();
    const serialNumber = orderCount + 1; 
    const orderNumber = generateOrderNumber(serialNumber);
    console.log(`Generated Guest Order Number: ${orderNumber}`);


    // Prepare billing address - handle both cases
    const finalBillingAddress =
      billingAddress?.sameAsShipping !== false
        ? {
          fullName: shippingAddress.fullName || customerInfo.name,
          phone: shippingAddress.phone || customerInfo.phone,
          email: shippingAddress.email || customerInfo.email,
          address: shippingAddress.address,
          city: shippingAddress.city,
          state: shippingAddress.state || "",
          zipCode: shippingAddress.zipCode || shippingAddress.postalCode || "",
          country: shippingAddress.country || "Bangladesh",
          sameAsShipping: true,
        }
        : {
          fullName: billingAddress.fullName || customerInfo.name,
          phone: billingAddress.phone || customerInfo.phone,
          email: billingAddress.email || customerInfo.email,
          address: billingAddress.address,
          city: billingAddress.city,
          state: billingAddress.state || "",
          zipCode: billingAddress.zipCode || billingAddress.postalCode || "",
          country: billingAddress.country || "Bangladesh",
          sameAsShipping: false,
        };

    // Create guest order
    const order = new Order({
      isGuestOrder: true,
      guestCustomerInfo: {
        name: customerInfo.name,
        email: customerInfo.email,
        phone: customerInfo.phone,
      },
      orderNumber,
      items: orderItems,
      subtotal: calculatedSubtotal,
      totalDiscount: Math.max(0, calculatedTotalDiscount), // Prevent negative values
      shippingCost: dynamicShippingCost, // dynamic shipping cost added to filed
      totalAmount: calculatedTotalAmount,
      shippingAddress: {
        fullName: shippingAddress.fullName || customerInfo.name,
        phone: shippingAddress.phone || customerInfo.phone,
        email: shippingAddress.email || customerInfo.email,
        address: shippingAddress.address,
        city: shippingAddress.city,
        state: shippingAddress.state || "",
        zipCode: shippingAddress.zipCode || shippingAddress.postalCode || "",
        country: shippingAddress.country || "Bangladesh",
      },
      billingAddress: finalBillingAddress,
      paymentMethod,
      specialInstructions,
      status: "pending", // confirm can be changed to pending
      paymentStatus: paymentMethod === "cash_on_delivery" ? "pending" : "paid",
    });

    console.log("Creating order with data:", JSON.stringify(order.toObject(), null, 2));

    await order.save();

try {
  const io = getIo(); // <-- নিশ্চিত করুন যে getIo() ইমপোর্ট করা হয়েছে
  const customerName = order.shippingAddress.fullName || 'a Guest Customer';
  const notificationMessage = `New Guest Order #${order.orderNumber} placed by ${customerName}`
  
  const notificationData = {
    message: notificationMessage,
    orderId: order._id.toString(),
    orderNumber: order.orderNumber,
    timestamp: new Date().toISOString(),
    link: `/orders/${order._id}` 
  }
  
  io.emit('newOrderNotification', notificationData); 
  console.log(`[Socket.IO] Emitted new order notification for: ${order.orderNumber}`); // <-- এই লগটি আপনার সার্ভার লগে আসা উচিত

} catch (socketError) {
  console.error('[Socket.IO] Error emitting notification:', socketError.message);
}



    // Send confirmation email using the new helper function
    try {
      const guestEmail = order.guestCustomerInfo.email;
      const emailResult = await sendOrderEmails(order, order.guestCustomerInfo.email, true); // true = guest order

      if (emailResult.success) {
        console.log('✅ Guest confirmation email sent successfully');
      } else {
        console.error('❌ Failed to send guest email:', emailResult.error);
      }
    } catch (emailError) {
      console.error('❌ Guest email sending error:', emailError.message);
    }

    // Update product stock
    await updateProductStock(orderItems);

    res.status(201).json({
      status: "success",
      message: "Guest order created successfully",
      data: {
        order,
        orderNumber: order.orderNumber,
        trackingInfo: {
          orderNumber: order.orderNumber,
          email: customerInfo.email,
        },
      },
    });
  } catch (error) {
    console.error("Create guest order error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};


// ##########################################################
// FUNCTION FOR UPDATE PRODUCT STOCK AFTER ORDER PLACED BY USER AND GUEST BOTH. 
// ##########################################################
const updateProductStock = async (orderItems) => {
  console.log('Updating product stock for items:', JSON.stringify(orderItems, null, 2));
  
  for (const item of orderItems) {
    try {
      console.log(`Processing item: ${item.productTitle || 'Unknown Product'}`);
      console.log(`Product ID: ${item.productId}`);
      console.log(`Quantity: ${item.quantity}`);
      const product = await Product.findById(item.productId);
      if (!product) {
        console.log(`Product not found: ${item.productId}`);
        continue;
      }
      console.log(`Product found: ${product.title}`);
      // Update variant stock if variantId exists
      if (item.variantId) {
        const variant = product.variants.id(item.variantId);
        if (variant) {
          console.log(`Updating variant stock: ${variant.colorName} - ${variant.size}`);
          variant.stock = Math.max(0, variant.stock - item.quantity);
          console.log(`Variant stock updated: ${variant.stock}`);
        } else {
          console.log(`Variant not found: ${item.variantId}`);
        }
      }
      // Update color variant stock if colorVariantId exists
      if (item.colorVariantId) {
        const colorVariant = product.colorVariants.id(item.colorVariantId);
        if (colorVariant) {
          console.log(`Updating color variant stock: ${colorVariant.colorName}`);
          colorVariant.stock = Math.max(0, colorVariant.stock - item.quantity);
          console.log(`Color variant stock updated: ${colorVariant.stock}`);
        } else {
          console.log(`Color variant not found: ${item.colorVariantId}`);
        }
      }

      // Update main product stock
      console.log(`Updating main product stock: ${product.stock} - ${item.quantity}`);
      product.stock = Math.max(0, product.stock - item.quantity);
      console.log(`Main product stock updated: ${product.stock}`);

      await product.save();
      console.log(`Product saved successfully: ${product.title}`);

    } catch (error) {
      console.error(`Error updating stock for product ${item.productId}:`, error);
    }
  }
  
  console.log('Product stock update completed');
};

// ##########################################################
// GUEST ORDER FUNCTION FOR GET ORDER DETAILS IN TRACKING PAGE
// ##########################################################
export const getGuestOrder = async (req, res) => {
  try {
    const { orderNumber } = req.params
    const { email } = req.query

    if (!email) {
      return res.status(400).json({ message: "Email is required to view guest order" })
    }

    const order = await Order.findOne({
      orderNumber,
      isGuestOrder: true,
      "guestCustomerInfo.email": email,
    })

    if (!order) {
      return res.status(404).json({ message: "Order not found or email doesn't match" })
    }

    res.status(200).json({
      status: "success",
      data: { order },
    })
  } catch (error) {
    console.error("Get guest order error:", error)
    res.status(500).json({ message: "Internal server error", error: error.message })
  }
}

// ##########################################################
// THIS FUNCTION IS MINIMAL AND STANDARD FOR GUEST ORDER TRACKING
// ##########################################################
export const trackGuestOrder = async (req, res) => {
  try {
    const { orderNumber, email } = req.body

    if (!orderNumber || !email) {
      return res.status(400).json({ message: "Order number and email are required" })
    }

    const order = await Order.findOne({
      orderNumber,
      isGuestOrder: true,
      "guestCustomerInfo.email": email,
    }).select("orderNumber status paymentStatus totalAmount createdAt shippingAddress")

    if (!order) {
      return res.status(404).json({ message: "Order not found or email doesn't match" })
    }

    res.status(200).json({
      status: "success",
      data: {
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        totalAmount: order.totalAmount,
        orderDate: order.createdAt,
        shippingAddress: order.shippingAddress,
      },
    })
  } catch (error) {
    console.error("Track guest order error:", error)
    res.status(500).json({ message: "Internal server error", error: error.message })
  }
}

// ##########################################################
// FUNCTION ONLY ADMIN AND EXECUTIVE CAN ACCESS ALL ORDERS WITH FILTERS
// ##########################################################
export const getOrders = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      paymentStatus,
      orderType = "all", 
      search,
      fromDate,
      toDate 
    } = req.query

    const filter = {}
    
    // Status filter
    if (status && status !== "all") {
      filter.status = status
    }

    // Payment status filter (NEW)
    if (paymentStatus && paymentStatus !== "all") {
      filter.paymentStatus = paymentStatus
    }

    // Order type filter
    if (orderType === "guest") {
      filter.isGuestOrder = true
    } else if (orderType === "user") {
      filter.isGuestOrder = { $ne: true }
    }

    // Date range filter (NEW)
    if (fromDate || toDate) {
      filter.createdAt = {}
      
      if (fromDate) {
        // Start of the day for fromDate
        const startDate = new Date(fromDate)
        startDate.setHours(0, 0, 0, 0)
        filter.createdAt.$gte = startDate
      }
      
      if (toDate) {
        // End of the day for toDate
        const endDate = new Date(toDate)
        endDate.setHours(23, 59, 59, 999)
        filter.createdAt.$lte = endDate
      }
    }

    // Search functionality
    if (search) {
      const searchRegex = new RegExp(search, 'i')

      const searchConditions = [
        { orderNumber: searchRegex },
        { transactionId: searchRegex }
      ]

      // Phone number search
      if (/^\d+$/.test(search)) {
        searchConditions.push(
          { 'shippingAddress.phone': searchRegex },
          { 'guestCustomerInfo.phone': searchRegex }
        )
      } else {
        // Name and email search
        searchConditions.push(
          { 'shippingAddress.fullName': searchRegex },
          { 'guestCustomerInfo.name': searchRegex },
          { 'guestCustomerInfo.email': searchRegex },
          { 'shippingAddress.email': searchRegex }
        )

        if (search.includes('@')) {
          searchConditions.push(
            { 'guestCustomerInfo.email': searchRegex },
            { 'shippingAddress.email': searchRegex }
          )
        }
      }

      filter.$or = searchConditions
    }

    const orders = await Order.find(filter)
      .populate("userId", "name email")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)

    const total = await Order.countDocuments(filter)

    res.status(200).json({
      status: "success",
      data: {
        orders,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        total,
      },
    })
  } catch (error) {
    console.error("Get orders error:", error)
    res.status(500).json({ message: "Internal server error", error: error.message })
  }
}



// ##########################################################
// THIS FUNCTION IS NEW  GET USER ORDER FUNCTION IN TRACKING ORDER OR ORDER DETAILS IN THEIR PROFILE. 
// ##########################################################
export const getMyOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query
    const userId = req.user.id

    const orders = await Order.find({ userId, isGuestOrder: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)

    const total = await Order.countDocuments({ userId, isGuestOrder: { $ne: true } })

    res.status(200).json({
      status: "success",
      data: {
        orders,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        total,
      },
    })
  } catch (error) {
    console.error("Get my orders error:", error)
    res.status(500).json({ message: "Internal server error", error: error.message })
  }
}



// ##########################################################
// THIS FUNCTION IS PREVIOUS GET ORDER FUNCTION IS ONLY PROVIDE ORDER NUMBER MATCHING ORDER OBJECT ID
// ##########################################################

// export const getOrder = async (req, res) => {
//   try {
//     const { id } = req.params

//     const order = await Order.findById(id).populate("userId", "name email phone")

//     if (!order) {
//       return res.status(404).json({ message: "Order not found" })
//     }

//     // Check if user owns this order or is admin (skip for guest orders)
//     if (!order.isGuestOrder && req.user.role !== "admin" && order.userId._id.toString() !== req.user.id) {
//       return res.status(403).json({ message: "Access denied" })
//     }

//     res.status(200).json({
//       status: "success",
//       data: { order },
//     })
//   } catch (error) {
//     console.error("Get order error:", error)
//     res.status(500).json({ message: "Internal server error", error: error.message })
//   }
// }



// order.controller.js - updateOrder function



// order.controller.js ফাইলের মধ্যে



// ##########################################################
// GET ORDER FUNCTION UPDATED TO HANDLE BOTH ORDER NUMBER AND OBJECT ID
// ##########################################################
export const getOrder = async (req, res) => {
  try {
    const identifier = req.params.id; // এটি ORD-XXXXX বা 24-char ObjectId হতে পারে
    let order;

    // MongoDB ObjectId ভ্যালিডেশন চেক করুন (24 হেক্স ক্যারেক্টার)
    if (identifier.length === 24 && identifier.match(/^[0-9a-fA-F]{24}$/)) {
        // যদি বৈধ ObjectId হয়, তবে _id দিয়ে খুঁজুন
        order = await Order.findById(identifier);
    } else {
        // যদি কাস্টম অর্ডার নম্বর হয়, তবে orderNumber ফিল্ড দিয়ে খুঁজুন
        order = await Order.findOne({ orderNumber: identifier });
    }

    if (!order) {
      // যদি ObjectId বা orderNumber কোনোটি দিয়েই না পাওয়া যায়
      return res.status(404).json({ message: "Order not found" });
    }

    res.status(200).json({ data: { order } });

  } catch (error) {
    // console.error(error) যোগ করুন যাতে কোনো অপ্রত্যাশিত এরর লগ হয়
    console.error("❌ Error fetching order:", error); 
    res.status(500).json({ message: "Internal server error" });
  }
};



// ##########################################################
// This is V1 function WHEN I WAS FIRST UPDATING THE ORDER FUNCTION
// ##########################################################

// export const updateOrder = async (req, res) => {
//   try {
//     const { id } = req.params
//     const { status, paymentStatus } = req.body

//     const updateData = {}
//     if (status) updateData.status = status
//     if (paymentStatus) updateData.paymentStatus = paymentStatus

//     const order = await Order.findByIdAndUpdate(id, updateData, { new: true })

//     if (!order) {
//       return res.status(404).json({ message: "Order not found" })
//     }

    
//     if (status === "shipped" && !order.pathaoOrderId) {
//       try {
//         console.log('Creating Pathao order for:', order.orderNumber);
        
//         const pathaoRes = await createPathaoOrder(order)

//         order.pathaoTrackingId = pathaoRes.data.consignment_id
//         order.pathaoOrderId = pathaoRes.data.order_id
//         order.pathaoStatus = pathaoRes.data.status

//         await order.save()
//         console.log("Pathao order created successfully:", pathaoRes.data)
        
//       } catch (err) {
//         console.error("❌ Pathao order creation failed:", err.message)
        
//         // Sandbox-specific error handling
//         if (PATHAO_BASE_URL.includes('sandbox')) {
//           console.log('Sandbox environment - creating mock Pathao data');
          
//           // Mock data for sandbox testing
//           order.pathaoTrackingId = `PATH-SANDBOX-${Date.now()}`;
//           order.pathaoOrderId = `PATH-ORDER-${Date.now()}`;
//           order.pathaoStatus = 'pending';
//           order.pathaoSandboxMode = true;
          
//           await order.save();
//           console.log('✅ Mock Pathao data created for sandbox testing');
//         } else {
//           // Production error handling
//           order.pathaoError = err.message;
//           await order.save();
//         }
//       }
//     }

//     res.status(200).json({
//       status: "success",
//       message: "Order updated successfully",
//       data: { order },
//     })
//   } catch (error) {
//     console.error("Update order error:", error)
//     res.status(500).json({ message: "Internal server error", error: error.message })
//   }
// }


const restoreProductStock = async (orderItems) => {
  for (const item of orderItems) {
    const product = await Product.findById(item.productId);
    if (!product) continue;

    const quantity = item.quantity;

    if (item.variantId) {
      const variant = product.variants.id(item.variantId);
      if (variant) {
        variant.stock = variant.stock + quantity; // Restore stock
      }
    }

    if (item.colorVariantId) {
      const colorVariant = product.colorVariants.id(item.colorVariantId);
      if (colorVariant) {
        colorVariant.stock = colorVariant.stock + quantity; // Restore stock
      }
    }

    product.stock = product.stock + quantity; // Restore main product stock
    await product.save();
  }
  console.log('✅ Product stock restored for order items.');
};


// ##########################################################
// updated this function for comprehensive order updates
// ##########################################################
export const updateOrder = async (req, res) => {
  try {
    const { id } = req.params
    const { status, paymentStatus } = req.body

    const orderToUpdate = await Order.findById(id);

    if (!orderToUpdate) {
      return res.status(404).json({ message: "Order not found" })
    }

    const previousStatus = orderToUpdate.status;

    const updateData = {}
    if (status) updateData.status = status
    if (paymentStatus) updateData.paymentStatus = paymentStatus

    // ✅ Stock Restoration Logic:
    // Restore stock if the new status is 'cancelled' or 'refunded',
    // AND the previous status was NOT already 'cancelled' or 'refunded' 
const shouldRestoreStock =
  (status === "cancelled" || status === "refunded" || status === "returned") &&
  previousStatus !== "cancelled" &&
  previousStatus !== "refunded" &&
  previousStatus !== "returned";

    if (shouldRestoreStock) {
      console.log(`⚠️ Restoring stock for order ${orderToUpdate.orderNumber} due to status change from ${previousStatus} to ${status}`);
      await restoreProductStock(orderToUpdate.items);
    }


    const order = await Order.findByIdAndUpdate(id, updateData, { new: true })

    // Pathao integration logic (Unchanged, for 'shipped' status)
    if (status === "shipped" && !order.pathaoOrderId) {
      try {
        console.log('Creating Pathao order for:', order.orderNumber);
        
        const pathaoRes = await createPathaoOrder(order)

        order.pathaoTrackingId = pathaoRes.data.consignment_id
        order.pathaoOrderId = pathaoRes.data.order_id
        order.pathaoStatus = pathaoRes.data.status

        await order.save()
        console.log("Pathao order created successfully:", pathaoRes.data)
        
      } catch (err) {
        console.error("❌ Pathao order creation failed:", err.message)
        
        // Sandbox-specific error handling
        if (PATHAO_BASE_URL.includes('sandbox')) {
          console.log('Sandbox environment - creating mock Pathao data');
          
          order.pathaoTrackingId = `PATH-SANDBOX-${Date.now()}`;
          order.pathaoOrderId = `PATH-ORDER-${Date.now()}`;
          order.pathaoStatus = 'pending';
          order.pathaoSandboxMode = true;
          
          await order.save();
          console.log('✅ Mock Pathao data created for sandbox testing');
        } else {
          // Production error handling
          order.pathaoError = err.message;
          await order.save();
        }
      }
    }

    res.status(200).json({
      status: "success",
      message: "Order updated successfully",
      data: { order },
    })
  } catch (error) {
    console.error("Update order error:", error)
    res.status(500).json({ message: "Internal server error", error: error.message })
  }
}



// ##########################################################
// added this function for comprehensive order updates
// ##########################################################
export const updateOrderComprehensive = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      status,
      paymentStatus,
      items, // Updated items array
      shippingAddress,
      billingAddress,
      customerInfo, // For guest orders
      couponCode,
      couponDiscount,
      shippingCost,
      specialInstructions,
      adminNote // New admin note
    } = req.body;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const previousStatus = order.status;
    const updateData = {};
    const changes = [];

    // ✅ Status update with stock management
    if (status && status !== order.status) {
      updateData.status = status;
      changes.push(`Status changed from ${order.status} to ${status}`);

      // Stock restoration logic
      const shouldRestoreStock =
        (status === "cancelled" || status === "refunded" || status === "returned") &&
        previousStatus !== "cancelled" &&
        previousStatus !== "refunded" &&
        previousStatus !== "returned";

      if (shouldRestoreStock) {
        await restoreProductStock(order.items);
        changes.push("Product stock restored due to cancellation/refund");
      }

      // Pathao integration (existing logic)
      if (status === "shipped" && !order.pathaoOrderId) {
        try {
          console.log('Creating Pathao order for:', order.orderNumber);
          const pathaoRes = await createPathaoOrder(order);
          order.pathaoTrackingId = pathaoRes.data.consignment_id;
          order.pathaoOrderId = pathaoRes.data.order_id;
          order.pathaoStatus = pathaoRes.data.status;
          changes.push("Pathao order created");
        } catch (err) {
          console.error("❌ Pathao order creation failed:", err.message);
          if (PATHAO_BASE_URL.includes('sandbox')) {
            order.pathaoTrackingId = `PATH-SANDBOX-${Date.now()}`;
            order.pathaoOrderId = `PATH-ORDER-${Date.now()}`;
            order.pathaoStatus = 'pending';
            order.pathaoSandboxMode = true;
            changes.push("Mock Pathao data created (Sandbox)");
          }
        }
      }
    }

    // ✅ Payment status update
    if (paymentStatus && paymentStatus !== order.paymentStatus) {
      updateData.paymentStatus = paymentStatus;
      changes.push(`Payment status changed from ${order.paymentStatus} to ${paymentStatus}`);
    }

    // ✅ Items update with stock management
    if (items && Array.isArray(items)) {
      // Restore original stock first
      await restoreProductStock(order.items);
      
      // Update with new items
      await updateProductStock(items);
      
      updateData.items = items;
      
      // Recalculate order totals
      const recalculated = recalculateOrderTotals(items, shippingCost || order.shippingCost);
      Object.assign(updateData, recalculated);
      
      changes.push("Order items updated and totals recalculated");
    }

    // ✅ Shipping address update
    if (shippingAddress) {
      updateData.shippingAddress = { ...order.shippingAddress, ...shippingAddress };
      changes.push("Shipping address updated");
    }

    // ✅ Billing address update
    if (billingAddress) {
      updateData.billingAddress = { ...order.billingAddress, ...billingAddress };
      changes.push("Billing address updated");
    }

    // ✅ Guest customer info update
    if (order.isGuestOrder && customerInfo) {
      updateData.guestCustomerInfo = { ...order.guestCustomerInfo, ...customerInfo };
      changes.push("Customer information updated");
    }

    // ✅ Coupon and discount updates
    if (couponCode !== undefined) {
      updateData.couponCode = couponCode;
      changes.push(`Coupon code ${couponCode ? 'applied' : 'removed'}`);
    }
    if (couponDiscount !== undefined) {
      updateData.couponDiscount = couponDiscount;
      changes.push(`Coupon discount set to ${couponDiscount}`);
    }

    // ✅ Shipping cost update
    if (shippingCost !== undefined) {
      updateData.shippingCost = shippingCost;
      updateData.totalAmount = (updateData.subtotal || order.subtotal) + shippingCost;
      changes.push(`Shipping cost updated to ${shippingCost}`);
    }

    // ✅ Special instructions update
    if (specialInstructions !== undefined) {
      updateData.specialInstructions = specialInstructions;
      changes.push("Special instructions updated");
    }

    // ✅ Add admin note if provided
    if (adminNote) {
      if (!updateData.adminNotes) {
        updateData.adminNotes = [...order.adminNotes];
      }
      updateData.adminNotes.push({
        note: adminNote,
        addedBy: req.user.id,
        addedAt: new Date(),
        role: req.user.role
      });
      changes.push("Admin note added");
    }

    // Update the order
    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate("userId", "name email");

    res.status(200).json({
      status: "success",
      message: "Order updated successfully",
      data: { 
        order: updatedOrder,
        changes 
      },
    });
  } catch (error) {
    console.error("Comprehensive order update error:", error);
    res.status(500).json({ 
      message: "Internal server error", 
      error: error.message 
    });
  }
};


// ##########################################################
// added this function for recalculating order totals
// ##########################################################
const recalculateOrderTotals = (items, shippingCost = 0) => {
  let subtotal = 0;
  let totalDiscount = 0;

  items.forEach(item => {
    const totalOriginalPrice = item.originalPrice * item.quantity;
    const totalDiscountedPrice = item.discountedPrice * item.quantity;
    const itemDiscountAmount = totalOriginalPrice - totalDiscountedPrice;

    subtotal += totalDiscountedPrice;
    totalDiscount += Math.max(0, itemDiscountAmount);
  });

  const totalAmount = subtotal + shippingCost;

  return {
    subtotal,
    totalDiscount,
    shippingCost,
    totalAmount
  };
};


// ##########################################################
// added this function for added oder from manualy by admin and executive
// ##########################################################
export const createManualOrder = async (req, res) => {
  try {
    const {
      customerType, // "user" or "guest"
      userId, // for registered users
      guestCustomerInfo, // for guest orders
      items,
      shippingAddress,
      billingAddress,
      paymentMethod,
      shippingCost = 0,
      couponCode,
      couponDiscount = 0,
      specialInstructions = "",
      adminNote
    } = req.body;

    // Validate required fields
    if (!customerType || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Customer type and valid items are required" });
    }

    if (!shippingAddress || !shippingAddress.address || !shippingAddress.city) {
      return res.status(400).json({ message: "Valid shipping address is required" });
    }

    if (!paymentMethod) {
      return res.status(400).json({ message: "Payment method is required" });
    }

    // Validate guest customer info
    if (customerType === "guest") {
      if (!guestCustomerInfo || !guestCustomerInfo.name || !guestCustomerInfo.email || !guestCustomerInfo.phone) {
        return res.status(400).json({ 
          message: "Guest customer name, email, and phone are required" 
        });
      }
    }

    // Validate user order
    if (customerType === "user" && !userId) {
      return res.status(400).json({ message: "User ID is required for registered users" });
    }

    // Prepare order items with product validation
    const orderItems = [];
    let calculatedSubtotal = 0;
    let calculatedTotalDiscount = 0;

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(400).json({ message: `Product not found: ${item.productId}` });
      }

      // Validate stock
      if (product.stock < item.quantity) {
        return res.status(400).json({ 
          message: `Insufficient stock for product: ${product.title}. Available: ${product.stock}, Requested: ${item.quantity}` 
        });
      }

      // Calculate prices
      const originalPrice = item.originalPrice || product.basePrice;
      const discountedPrice = item.discountedPrice || originalPrice;
      const totalOriginalPrice = originalPrice * item.quantity;
      const totalDiscountedPrice = discountedPrice * item.quantity;
      const itemDiscountAmount = totalOriginalPrice - totalDiscountedPrice;

      const orderItem = {
        productId: product._id,
        productTitle: item.productTitle || product.title,
        productImage: item.productImage || product.images[0]?.url || "/placeholder.svg?height=200&width=200",
        variantId: item.variantId || null,
        variantDetails: item.variantDetails || null,
        colorVariantId: item.colorVariantId || null,
        colorVariantDetails: item.colorVariantDetails || null,
        quantity: item.quantity,
        originalPrice,
        discountedPrice,
        discountPercentage: item.discountPercentage || 0,
        totalOriginalPrice,
        totalDiscountedPrice,
        discountAmount: Math.max(0, itemDiscountAmount),
      };

      orderItems.push(orderItem);
      calculatedSubtotal += totalDiscountedPrice;
      calculatedTotalDiscount += itemDiscountAmount;
    }

    // Calculate shipping cost
    const finalShippingCost = shippingCost === 0 ? 
      calculateShippingCost(calculatedSubtotal, shippingAddress.city) : 
      shippingCost;

    const totalAmount = calculatedSubtotal + finalShippingCost - couponDiscount;

    // Generate order number
    // const orderNumber = generateOrderNumber(customerType === "guest");


    const orderCount = await Order.countDocuments();
    const serialNumber = orderCount + 1; 
    const orderNumber = generateOrderNumber(serialNumber);
    console.log(`Generated Manual Order Number: ${orderNumber}`);


    // Prepare order data
    const orderData = {
      isGuestOrder: customerType === "guest",
      orderNumber,
      items: orderItems,
      subtotal: calculatedSubtotal,
      totalDiscount: Math.max(0, calculatedTotalDiscount),
      couponCode: couponCode || null,
      couponDiscount: couponDiscount || 0,
      shippingCost: finalShippingCost,
      totalAmount,
      shippingAddress,
      paymentMethod,
      specialInstructions,
      status: "confirmed",
      paymentStatus: paymentMethod === "cash_on_delivery" ? "pending" : "paid",
      createdBy: req.user.id, // Track who created the order
      createdByRole: req.user.role
    };

    // Add user/guest specific data
    if (customerType === "user") {
      orderData.userId = userId;
    } else {
      orderData.guestCustomerInfo = guestCustomerInfo;
      orderData.billingAddress = billingAddress?.sameAsShipping !== false ? 
        { ...shippingAddress, sameAsShipping: true } : 
        { ...billingAddress, sameAsShipping: false };
    }

    // Add admin note if provided
    if (adminNote) {
      orderData.adminNotes = [{
        note: `Order created manually: ${adminNote}`,
        addedBy: req.user.id,
        addedAt: new Date(),
        role: req.user.role
      }];
    }

    // Create order
    const order = new Order(orderData);
    await order.save();

    // Update product stock
    await updateProductStock(orderItems);

    // Socket notification
    try {
      const io = getIo();
      const customerName = customerType === "user" ? 
        (shippingAddress.fullName || 'a Customer') : 
        (guestCustomerInfo.name || 'a Guest Customer');
      
      const notificationMessage = `New Manual Order #${order.orderNumber} created by ${req.user.name} for ${customerName}`;
      
      const notificationData = {
        message: notificationMessage,
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        timestamp: new Date().toISOString(),
        link: `/orders/${order._id}`,
        createdBy: req.user.name
      };
      
      io.emit('newOrderNotification', notificationData);
      console.log(`[Socket.IO] Emitted manual order notification for: ${order.orderNumber}`);
    } catch (socketError) {
      console.error('[Socket.IO] Error emitting notification:', socketError.message);
    }

    res.status(201).json({
      status: "success",
      message: "Manual order created successfully",
      data: { order },
    });

  } catch (error) {
    console.error("Create manual order error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

// ##########################################################
//  This is older version of cancel order function. Currently not using but have to keep for references in future. 
// ##########################################################
// export const cancelOrder = async (req, res) => {
//   try {
//     const { id } = req.params
//     const userId = req.user.id

//     const order = await Order.findById(id)

//     if (!order) {
//       return res.status(404).json({ message: "Order not found" })
//     }

//     // Check if user owns this order (skip for guest orders as they can't cancel through this endpoint)
//     if (!order.isGuestOrder && order.userId.toString() !== userId) {
//       return res.status(403).json({ message: "Access denied" })
//     }

//     // Check if order can be cancelled
//     if (order.status === "delivered" || order.status === "cancelled") {
//       return res.status(400).json({ message: "Order cannot be cancelled" })
//     }

//     order.status = "cancelled"
//     await order.save()

//     res.status(200).json({
//       status: "success",
//       message: "Order cancelled successfully",
//       data: { order },
//     })
//   } catch (error) {
//     console.error("Cancel order error:", error)
//     res.status(500).json({ message: "Internal server error", error: error.message })
//   }
// }
// Dashboard statistics

export const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params
    // req.user.id is available via auth middleware for logged-in users
    const userId = req.user.id

    const order = await Order.findById(id)

    if (!order) {
      return res.status(404).json({ message: "Order not found" })
    }

    // Check if user owns this order
    // Note: Guest orders typically cannot be cancelled via this logged-in user endpoint
    if (!order.isGuestOrder && order.userId.toString() !== userId) {
      return res.status(403).json({ message: "Access denied" })
    }

    // Check if order can be cancelled (e.g., prevent cancellation if already delivered/cancelled)
    if (order.status === "delivered" || order.status === "cancelled" || order.status === "shipped") {
      return res.status(400).json({ message: `Order cannot be cancelled in ${order.status} status` })
    }

    // ✅ Stock Restoration: Restore stock before marking as cancelled
    await restoreProductStock(order.items); 

    order.status = "cancelled"
    await order.save()

    res.status(200).json({
      status: "success",
      message: "Order cancelled successfully and stock restored",
      data: { order },
    })
  } catch (error) {
    console.error("Cancel order error:", error)
    res.status(500).json({ message: "Internal server error", error: error.message })
  }
}


export const getDashboardStats = async (req, res) => {
  try {
    const { range = '30days' } = req.query;

    // date filter calculations
    const dateFilter = {};
    const now = new Date();

    switch (range) {
      case '7days':
        dateFilter.$gte = new Date(now.setDate(now.getDate() - 7));
        break;
      case '30days':
        dateFilter.$gte = new Date(now.setDate(now.getDate() - 30));
        break;
      case '6months':
        dateFilter.$gte = new Date(now.setMonth(now.getMonth() - 6));
        break;
      case '1year':
        dateFilter.$gte = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      default:
        dateFilter.$gte = new Date(now.setDate(now.getDate() - 30));
    }

    // মোট অর্ডার
    const totalOrders = await Order.countDocuments({
      createdAt: dateFilter
    });

    // মোট রেভিনিউ (শুধু paid অর্ডার)
    const revenueData = await Order.aggregate([
      {
        $match: {
          paymentStatus: 'paid',
          createdAt: dateFilter
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          averageOrderValue: { $avg: '$totalAmount' }
        }
      }
    ]);

    // পেন্ডিং অর্ডার
    const pendingOrders = await Order.countDocuments({
      status: 'pending',
      createdAt: dateFilter
    });

    // বিভিন্ন স্ট্যাটাসের অর্ডার
    const orderStatusCounts = await Order.aggregate([
      {
        $match: { createdAt: dateFilter }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // মাসিক গ্রোথ ক্যালকুলেশন
    const currentMonth = new Date().getMonth();
    const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const currentYear = new Date().getFullYear();

    const currentMonthOrders = await Order.countDocuments({
      $expr: {
        $and: [
          { $eq: [{ $month: '$createdAt' }, currentMonth + 1] },
          { $eq: [{ $year: '$createdAt' }, currentYear] }
        ]
      }
    });

    const previousMonthOrders = await Order.countDocuments({
      $expr: {
        $and: [
          { $eq: [{ $month: '$createdAt' }, previousMonth + 1] },
          { $eq: [{ $year: '$createdAt' }, previousMonth === 11 ? currentYear - 1 : currentYear] }
        ]
      }
    });

    const orderGrowth = previousMonthOrders > 0
      ? ((currentMonthOrders - previousMonthOrders) / previousMonthOrders * 100).toFixed(1)
      : currentMonthOrders > 0 ? 100 : 0;

    // রেসপন্স
    res.json({
      status: 'success',
      data: {
        totalOrders,
        totalRevenue: revenueData[0]?.totalRevenue || 0,
        averageOrderValue: revenueData[0]?.averageOrderValue || 0,
        pendingOrders,
        orderStatusCounts,
        orderGrowth: parseFloat(orderGrowth),
        monthlyGrowth: 12.5, // এই ডেটা অন্য সোর্স থেকে আনতে হবে
        // অন্যান্য মক ডেটা (আপনার অন্যান্য API থেকে replace করবেন)
        totalProducts: 156,
        totalUsers: 2453,
        lowStockProducts: 12,
        userGrowth: 15.2
      }
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

// sales data
export const getSalesData = async (req, res) => {
  try {
    const { range = '6months' } = req.query;

    const months = [];
    const now = new Date();
    let monthCount = 6; // Deafault 6 months calucalted

    if (range === '1year') monthCount = 12;
    if (range === '30days') monthCount = 1;

    for (let i = monthCount - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      months.push({
        name: date.toLocaleString('default', { month: 'short' }),
        sales: 0,
        orders: 0
      });
    }

    // মাসিক সেলস ডেটা
    const monthlySales = await Order.aggregate([
      {
        $match: {
          paymentStatus: 'paid',
          createdAt: {
            $gte: new Date(new Date().setMonth(new Date().getMonth() - monthCount))
          }
        }
      },
      {
        $group: {
          _id: {
            month: { $month: '$createdAt' },
            year: { $year: '$createdAt' }
          },
          totalSales: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    // ডেটা ম্যাপিং
    const salesData = months.map(month => {
      const monthIndex = new Date(`${month.name} 1, 2020`).getMonth() + 1;
      const found = monthlySales.find(s => s._id.month === monthIndex);

      return {
        name: month.name,
        sales: found ? found.totalSales : 0,
        orders: found ? found.orderCount : 0
      };
    });

    res.json({
      status: 'success',
      data: salesData
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

export const getOrderStatusData = async (req, res) => {
  try {
    const { range = 'all' } = req.query;

    const dateFilter = {};
    if (range !== 'all') {
      const now = new Date(); 
      let startDate;

      switch (range) {
        case '7days':
         
          startDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case '30days':
         
          startDate = new Date(now.setDate(now.getDate() - 30));
          break;
        case '6months':
        
          startDate = new Date(now.setMonth(now.getMonth() - 6));
          break;
        default:
         
          startDate = null; 
          break;
      }
      
    
      if (startDate) {
        dateFilter.createdAt = { $gte: startDate };
      }
    }

    const orderStatusCounts = await Order.aggregate([
      {
        $match: dateFilter
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalOrders = orderStatusCounts.reduce((sum, item) => sum + item.count, 0);

    const statusColors = {
      'confirmed': '#10B981',
      'processing': '#3B82F6',
      'shipped': '#8B5CF6',
      'delivered': '#059669',
      'pending': '#F59E0B',
      'cancelled': '#EF4444'
    };

    const statusLabels = {
      'confirmed': 'Confirmed',
      'processing': 'Processing',
      'shipped': 'Shipped',
      'delivered': 'Delivered',
      'pending': 'Pending',
      'cancelled': 'Cancelled'
    };

    const orderStatusData = orderStatusCounts.map(item => ({
      name: statusLabels[item._id] || item._id,
   
      value: totalOrders > 0 ? Math.round((item.count / totalOrders) * 100) : 0, 
      color: statusColors[item._id] || '#6B7280'
    }));

    res.json({
      status: 'success',
      data: orderStatusData
    });

  } catch (error) {
   
    console.error('❌ Error in getOrderStatusData:', error); 
    res.status(500).json({
      status: 'error',
      message: error.message || 'Internal server error'
    });
  }
};

// ##########################################################
// added this function only for order deletation from admin user. 
export const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Restore product stock before deleting order
    await restoreProductStock(order.items);

    await Order.findByIdAndDelete(id);

    res.status(200).json({
      status: "success",
      message: "Order deleted successfully and stock restored",
    });
  } catch (error) {
    console.error("Delete order error:", error);
    res.status(500).json({ 
      message: "Internal server error", 
      error: error.message 
    });
  }
};


// Legacy functions for backward compatibility
export const getUserOrders = getMyOrders
export const getOrderById = getOrder
export const updateOrderStatus = updateOrder
