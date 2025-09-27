import Order from "../models/Order.js"
import Cart from "../models/Cart.js"
import Product from "../models/Product.js"
import { sendOrderEmails } from "../services/emailService.js"
import User from "../models/User.js"
import { createPathaoOrder } from "../services/pathaoService.js";


// Existing createOrder function (unchanged for logged-in users)
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
    const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0")}`;

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

// NEW: Create guest order - FIXED VERSION
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

    // Detailed validation with specific error messages
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

    const calculatedTotalAmount = calculatedSubtotal + shippingCost;

    // Generate unique order number for guest
    const orderNumber = `GUEST-${Date.now()}-${Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0")}`;

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
      shippingCost,
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
      status: "confirmed",
      paymentStatus: paymentMethod === "cash_on_delivery" ? "pending" : "paid",
    });

    console.log("Creating order with data:", JSON.stringify(order.toObject(), null, 2));

    await order.save();

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

// NEW: Get guest order by order number
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

// NEW: Track guest order
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

// Existing functions remain unchanged
// In order.controller.js - update the getOrders function
export const getOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, orderType = "all", search } = req.query

    const filter = {}
    if (status && status !== "all") {
      filter.status = status
    }

    // Filter by order type
    if (orderType === "guest") {
      filter.isGuestOrder = true
    } else if (orderType === "user") {
      filter.isGuestOrder = { $ne: true }
    }

    // Add search functionality
    if (search) {
      const searchRegex = new RegExp(search, 'i')

      // Create an array of search conditions
      const searchConditions = [
        { orderNumber: searchRegex },
        { transactionId: searchRegex }
      ]

      // Check if search term could be a phone number (digits only)
      if (/^\d+$/.test(search)) {
        searchConditions.push(
          { 'shippingAddress.phone': searchRegex },
          { 'guestCustomerInfo.phone': searchRegex }
        )
      } else {
        // Search by name and email for non-numeric searches
        searchConditions.push(
          { 'shippingAddress.fullName': searchRegex },
          { 'guestCustomerInfo.name': searchRegex },
          { 'guestCustomerInfo.email': searchRegex },
          { 'shippingAddress.email': searchRegex }
        )

        // If search includes @, prioritize email search
        if (search.includes('@')) {
          searchConditions.push(
            { 'guestCustomerInfo.email': searchRegex },
            { 'shippingAddress.email': searchRegex }
          )
        }
      }

      // Use $or operator to search across multiple fields
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



export const updateOrder = async (req, res) => {
  try {
    const { id } = req.params
    const { status, paymentStatus } = req.body

    const updateData = {}
    if (status) updateData.status = status
    if (paymentStatus) updateData.paymentStatus = paymentStatus

    const order = await Order.findByIdAndUpdate(id, updateData, { new: true })

    if (!order) {
      return res.status(404).json({ message: "Order not found" })
    }

    
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
          
          // Mock data for sandbox testing
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


export const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params
    const userId = req.user.id

    const order = await Order.findById(id)

    if (!order) {
      return res.status(404).json({ message: "Order not found" })
    }

    // Check if user owns this order (skip for guest orders as they can't cancel through this endpoint)
    if (!order.isGuestOrder && order.userId.toString() !== userId) {
      return res.status(403).json({ message: "Access denied" })
    }

    // Check if order can be cancelled
    if (order.status === "delivered" || order.status === "cancelled") {
      return res.status(400).json({ message: "Order cannot be cancelled" })
    }

    order.status = "cancelled"
    await order.save()

    res.status(200).json({
      status: "success",
      message: "Order cancelled successfully",
      data: { order },
    })
  } catch (error) {
    console.error("Cancel order error:", error)
    res.status(500).json({ message: "Internal server error", error: error.message })
  }
}
// Dashboard statistics
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


// export const getOrderStatusData = async (req, res) => {
//   try {
//     const { range = 'all' } = req.query;

//     const dateFilter = {};
//     if (range !== 'all') {
//       const now = new Date();
//       switch (range) {
//         case '7days':
//           dateFilter.$gte = new Date(now.setDate(now.getDate() - 7));
//           break;
//         case '30days':
//           dateFilter.$gte = new Date(now.setDate(now.getDate() - 30));
//           break;
//         case '6months':
//           dateFilter.$gte = new Date(now.setMonth(now.getMonth() - 6));
//           break;
//       }
//     }

//     const orderStatusCounts = await Order.aggregate([
//       {
//         $match: dateFilter
//       },
//       {
//         $group: {
//           _id: '$status',
//           count: { $sum: 1 }
//         }
//       }
//     ]);

//     const totalOrders = orderStatusCounts.reduce((sum, item) => sum + item.count, 0);

//     const statusColors = {
//       'confirmed': '#10B981',
//       'processing': '#3B82F6',
//       'shipped': '#8B5CF6',
//       'delivered': '#059669',
//       'pending': '#F59E0B',
//       'cancelled': '#EF4444'
//     };

//     const statusLabels = {
//       'confirmed': 'Confirmed',
//       'processing': 'Processing',
//       'shipped': 'Shipped',
//       'delivered': 'Delivered',
//       'pending': 'Pending',
//       'cancelled': 'Cancelled'
//     };

//     const orderStatusData = orderStatusCounts.map(item => ({
//       name: statusLabels[item._id] || item._id,
//       value: totalOrders > 0 ? Math.round((item.count / totalOrders) * 100) : 0,
//       color: statusColors[item._id] || '#6B7280'
//     }));

//     res.json({
//       status: 'success',
//       data: orderStatusData
//     });

//   } catch (error) {
//     res.status(500).json({
//       status: 'error',
//       message: error.message
//     });
//   }
// };

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

// Legacy functions for backward compatibility
export const getUserOrders = getMyOrders
export const getOrderById = getOrder
export const updateOrderStatus = updateOrder
