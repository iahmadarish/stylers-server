// // routes/couponRoutes.js
// import express from "express";
// import {
//   createCoupon,
//   getCoupons,
//   getCouponById,
//   getCouponByCode,
//   updateCoupon,
//   deleteCoupon,
//   validateCoupon,
//   applyCoupon,
//   getCouponUsage,
//   toggleCouponStatus,
//   getCouponStats
// } from "../controllers/couponController.js";
// import { protect, admin } from "../middleware/auth.middleware.js";

// const router = express.Router();

// // Public routes
// router.post("/validate", validateCoupon);
// router.get("/code/:code", getCouponByCode);

// // Protected routes (Admin only)
// router.use(protect);
// router.use(admin);

// router.post("/", createCoupon);
// router.get("/", getCoupons);
// router.get("/stats", getCouponStats);
// router.get("/usage/:couponId", getCouponUsage);
// router.get("/:id", getCouponById);
// router.put("/:id", updateCoupon);
// router.delete("/:id", deleteCoupon);
// router.patch("/:id/toggle-status", toggleCouponStatus);
// router.post("/apply", applyCoupon);

// export default router;

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
import { protect, restrictTo } from "../middleware/auth.middleware.js";
import { hasPermission } from "../middleware/permission.middleware.js"; // ✅ NEW

const router = express.Router();

// Public routes
router.post("/validate", validateCoupon);
router.get("/code/:code", getCouponByCode);

// Protected routes (Admin & Executive with permissions)
router.use(protect);

// ✅ UPDATED: Get coupons - admin  executive
router.get("/", 
  restrictTo("admin", "executive"),
  hasPermission('coupons', 'view'), // ✅ Permission check
  getCoupons
);

// ✅ UPDATED: Get coupon stats - admin  executive
router.get("/stats", 
  restrictTo("admin", "executive"), 
  hasPermission('coupons', 'view'),
  getCouponStats
);

// ✅ UPDATED: Get coupon by ID - admin  executive
router.get("/:id", 
  restrictTo("admin", "executive"),
  hasPermission('coupons', 'view'),
  getCouponById
);

// ✅ UPDATED: Get coupon usage - admin  executive  
router.get("/usage/:couponId", 
  restrictTo("admin", "executive"),
  hasPermission('coupons', 'view'),
  getCouponUsage
);

// ✅ UPDATED: Create coupon -  coupons:create permission 
router.post("/", 
  restrictTo("admin", "executive"),
  hasPermission('coupons', 'create'), // ✅ Create permission check
  createCoupon
);

// ✅ UPDATED: Update coupon -  coupons:update permission 
router.put("/:id", 
  restrictTo("admin", "executive"),
  hasPermission('coupons', 'update'), // ✅ Update permission check
  updateCoupon
);

// ✅ UPDATED: Toggle coupon status -  coupons:update permission 
router.patch("/:id/toggle-status", 
  restrictTo("admin", "executive"),
  hasPermission('coupons', 'update'),
  toggleCouponStatus
);

// ✅ UPDATED: Apply coupon - admin  executive
router.post("/apply", 
  restrictTo("admin", "executive"),
  hasPermission('coupons', 'view'), // View permission 
  applyCoupon
);

// ✅ UPDATED: Delete coupon - coupons:delete permission 
router.delete("/:id", 
  restrictTo("admin", "executive"),
  hasPermission('coupons', 'delete'), // ✅ Delete permission check
  deleteCoupon
);

export default router;