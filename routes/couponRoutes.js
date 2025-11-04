// routes/couponRoutes.js
import express from "express";
import {
  createCoupon,
  getCoupons,
  getCouponById,
  getCouponByCode,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
  applyCoupon,
  getCouponUsage,
  toggleCouponStatus,
  getCouponStats
} from "../controllers/couponController.js";
import { protect, admin } from "../middleware/auth.middleware.js";

const router = express.Router();

// Public routes
router.post("/validate", validateCoupon);
router.get("/code/:code", getCouponByCode);

// Protected routes (Admin only)
router.use(protect);
router.use(admin);

router.post("/", createCoupon);
router.get("/", getCoupons);
router.get("/stats", getCouponStats);
router.get("/usage/:couponId", getCouponUsage);
router.get("/:id", getCouponById);
router.put("/:id", updateCoupon);
router.delete("/:id", deleteCoupon);
router.patch("/:id/toggle-status", toggleCouponStatus);
router.post("/apply", applyCoupon);

export default router;