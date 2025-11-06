// import express from "express"
// import {
//   createOrder,
//   getOrders,
//   getMyOrders,
//   getOrder,
//   updateOrder,
//   cancelOrder,
//   createGuestOrder,
//   getGuestOrder,
//   trackGuestOrder,
//   getDashboardStats,
//   getSalesData,
//   getOrderStatusData,
//    deleteOrder,
//   updateOrderComprehensive,
//   createManualOrder,
//   getTopSoldProducts, 
//   getCampaignSalesStats
// } from "../controllers/order.controller.js"

// import { protect, restrictTo } from "../middleware/auth.middleware.js"
// import Order from '../models/Order.js';
// import Product from '../models/Product.js';


// const router = express.Router()
// router.post("/guest", createGuestOrder)
// router.get("/guest/:orderNumber", getGuestOrder)
// router.post("/guest/track", trackGuestOrder)


// router.get("/dashboard/stats", protect, restrictTo("admin", "executive"), getDashboardStats)
// router.get("/dashboard/sales", protect, restrictTo("admin", "executive"), getSalesData)
// router.get("/dashboard/order-status", protect, restrictTo("admin", "executive"), getOrderStatusData)

// router.use(protect)

// // User routes
// router.post("/", createOrder)
// router.get("/my-orders", getMyOrders)
// router.patch("/:id/cancel", cancelOrder)
// router.get("/:id", getOrder)


// // Simplified version
// router.get('/top-products-simple', restrictTo("admin", "executive"), async (req, res) => {
//   try {
//     const { limit = 10 } = req.query;


//     const orders = await Order.find({
//       $or: [
//         { status: 'delivered' },
//         { paymentStatus: 'paid' }
//       ]
//     }).populate('items.productId');

//     const productSales = {};
    
//     orders.forEach(order => {
//       order.items.forEach(item => {
//         if (item.productId) {
//           const productId = item.productId._id.toString();
          
//           if (!productSales[productId]) {
//             productSales[productId] = {
//               product: item.productId,
//               totalSold: 0,
//               totalRevenue: 0,
//               orderCount: 0
//             };
//           }
          
//           productSales[productId].totalSold += item.quantity;
//           productSales[productId].totalRevenue += item.quantity * item.price;
//           productSales[productId].orderCount += 1;
//         }
//       });
//     });


//     const topProducts = Object.values(productSales)
//       .sort((a, b) => b.totalSold - a.totalSold)
//       .slice(0, parseInt(limit))
//       .map(item => ({
//         _id: item.product._id,
//         productName: item.product.title || item.product.name,
//         totalSold: item.totalSold,
//         totalRevenue: item.totalRevenue,
//         orderCount: item.orderCount,
//         image: item.product.images?.[0]?.url || null,
//         price: item.product.price,
//         basePrice: item.product.basePrice,
//         discountPercentage: item.product.discountPercentage
//       }));

//     res.json({
//       status: 'success',
//       results: topProducts.length,
//       data: {
//         products: topProducts
//       }
//     });

//   } catch (error) {
//     console.error('Error fetching top products:', error);
//     res.status(500).json({
//       status: 'error',
//       message: 'Internal server error'
//     });
//   }
// });

// router.get("/stats/top-products", protect, restrictTo("admin", "executive"), getTopSoldProducts);

// // ড্যাশবোর্ডের ক্যাম্পেইন সেলস Stats
// router.get("/stats/campaign", protect, restrictTo("admin", "executive"), getCampaignSalesStats);

// // Admin routes
// router.use(restrictTo("admin", "executive"))

// router.post("/manual", createManualOrder);
// // Comprehensive order editing
// router.patch("/:id/comprehensive", updateOrderComprehensive);


// router.get("/", getOrders)
// router.patch("/:id", updateOrder)
// router.delete("/:id", restrictTo("admin"), deleteOrder)

// export default router


import express from "express"
import {
  createOrder,
  getOrders,
  getMyOrders,
  getOrder,
  updateOrder,
  cancelOrder,
  createGuestOrder,
  getGuestOrder,
  trackGuestOrder,
  getDashboardStats,
  getSalesData,
  getOrderStatusData,
  deleteOrder,
  updateOrderComprehensive,
  createManualOrder,
  getTopSoldProducts, 
  getCampaignSalesStats
} from "../controllers/order.controller.js"

import { protect, restrictTo } from "../middleware/auth.middleware.js"
import { hasPermission, hasAnyPermission } from "../middleware/permission.middleware.js" // ✅ NEW
import Order from '../models/Order.js';
import Product from '../models/Product.js';

const router = express.Router()

// Public routes (no authentication required)
router.post("/guest", createGuestOrder)
router.get("/guest/:orderNumber", getGuestOrder)
router.post("/guest/track", trackGuestOrder)

// Dashboard routes with permission check
router.get("/dashboard/stats", protect, hasPermission('analytics', 'view'), getDashboardStats)
router.get("/dashboard/sales", protect, hasPermission('analytics', 'view'), getSalesData)
router.get("/dashboard/order-status", protect, hasPermission('analytics', 'view'), getOrderStatusData)

// All routes below require authentication
router.use(protect)

// User routes (authenticated users)
router.post("/", createOrder)
router.get("/my-orders", getMyOrders)
router.patch("/:id/cancel", cancelOrder)
router.get("/:id", getOrder)

// Analytics routes with permission check
router.get('/top-products-simple', hasPermission('analytics', 'view'), async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const orders = await Order.find({
      $or: [
        { status: 'delivered' },
        { paymentStatus: 'paid' }
      ]
    }).populate('items.productId');

    const productSales = {};
    
    orders.forEach(order => {
      order.items.forEach(item => {
        if (item.productId) {
          const productId = item.productId._id.toString();
          
          if (!productSales[productId]) {
            productSales[productId] = {
              product: item.productId,
              totalSold: 0,
              totalRevenue: 0,
              orderCount: 0
            };
          }
          
          productSales[productId].totalSold += item.quantity;
          productSales[productId].totalRevenue += item.quantity * item.price;
          productSales[productId].orderCount += 1;
        }
      });
    });

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.totalSold - a.totalSold)
      .slice(0, parseInt(limit))
      .map(item => ({
        _id: item.product._id,
        productName: item.product.title || item.product.name,
        totalSold: item.totalSold,
        totalRevenue: item.totalRevenue,
        orderCount: item.orderCount,
        image: item.product.images?.[0]?.url || null,
        price: item.product.price,
        basePrice: item.product.basePrice,
        discountPercentage: item.product.discountPercentage
      }));

    res.json({
      status: 'success',
      results: topProducts.length,
      data: {
        products: topProducts
      }
    });

  } catch (error) {
    console.error('Error fetching top products:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
});

// Top products with permission
router.get("/stats/top-products", hasPermission('analytics', 'view'), getTopSoldProducts);

// Campaign stats with permission
router.get("/stats/campaign", hasPermission('analytics', 'view'), getCampaignSalesStats);

// ✅ ADMIN/EXECUTIVE ROUTES WITH PERMISSION CHECKS

// Manual order creation - need create permission
router.post("/manual", hasPermission('orders', 'create'), createManualOrder);

// Comprehensive order editing - need update permission
router.patch("/:id/comprehensive", hasPermission('orders', 'update'), updateOrderComprehensive);

// Get all orders - need view permission
router.get("/", hasPermission('orders', 'view'), getOrders)

// Update order - need update permission
router.patch("/:id", hasPermission('orders', 'update'), updateOrder)

// Delete order - need delete permission (only admin by default, but can be given to executives)
router.delete("/:id", hasPermission('orders', 'delete'), deleteOrder)

export default router