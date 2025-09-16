// routes/dashboard.js
import express from "express"
import { protect, restrictTo } from "../middleware/auth.middleware.js"
import {
  getDashboardStats,
  getSalesData,
  getOrderStatusData,
  getTopProducts
} from "../controllers/dashboard.controller.js"

const router = express.Router()

router.use(protect)
router.use(restrictTo("admin"))

router.get("/", getDashboardStats)
router.get("/sales", getSalesData)
router.get("/order-status", getOrderStatusData)
router.get("/top-products", getTopProducts)

export default router