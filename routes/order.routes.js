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
  createManualOrder
} from "../controllers/order.controller.js"

import { protect, restrictTo } from "../middleware/auth.middleware.js"
import Order from '../models/Order.js';
import Product from '../models/Product.js';


const router = express.Router()
router.post("/guest", createGuestOrder)
router.get("/guest/:orderNumber", getGuestOrder)
router.post("/guest/track", trackGuestOrder)


router.get("/dashboard/stats", protect, restrictTo("admin", "executive"), getDashboardStats)
router.get("/dashboard/sales", protect, restrictTo("admin", "executive"), getSalesData)
router.get("/dashboard/order-status", protect, restrictTo("admin", "executive"), getOrderStatusData)

router.use(protect)

// User routes
router.post("/", createOrder)
router.get("/my-orders", getMyOrders)
router.patch("/:id/cancel", cancelOrder)
router.get("/:id", getOrder)


// Simplified version
router.get('/top-products-simple', restrictTo("admin", "executive"), async (req, res) => {
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



// Admin routes
router.use(restrictTo("admin", "executive"))

router.post("/manual", createManualOrder);
// Comprehensive order editing
router.patch("/:id/comprehensive", updateOrderComprehensive);


router.get("/", getOrders)
router.patch("/:id", updateOrder)
router.delete("/:id", restrictTo("admin"), deleteOrder)

export default router