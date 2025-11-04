// routes/adminCouponRoutes.js
import express from "express";
import {
  getCouponDashboardStats,
  createAdminCoupon,
  bulkCreateCoupons,
  getAdminCoupons,
  getCouponAnalytics,
  bulkUpdateCoupons,
  exportCoupons,
  duplicateCoupon
} from "../controllers/adminCouponController.js";
import { protect, admin } from "../middleware/auth.middleware.js";

const router = express.Router();

// All routes are protected and admin only
router.use(protect);
router.use(admin);

// Dashboard and analytics
router.get("/dashboard/stats", getCouponDashboardStats);
router.get("/analytics/:couponId", getCouponAnalytics);

// CRUD operations
router.post("/", createAdminCoupon);
router.post("/bulk-create", bulkCreateCoupons);
router.get("/", getAdminCoupons);
router.post("/bulk-update", bulkUpdateCoupons);
router.get("/export", exportCoupons);
router.post("/:id/duplicate", duplicateCoupon);

export default router;