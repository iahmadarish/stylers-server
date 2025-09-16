// import express from "express";
// import {
//   createCheckout,
//   getCheckoutDetails,
//   processCashOnDelivery
// } from "../controllers/checkout.controller.js";
// import { protect } from "../middleware/auth.middleware.js";

// const router = express.Router();

// // Protected routes
// router.use(protect);
// router.post("/", createCheckout);
// router.get("/:orderId", getCheckoutDetails);
// router.post("/cash-on-delivery", processCashOnDelivery);

// export default router;



import express from "express"
import { getCheckoutSummary, applyCoupon, processCheckout } from "../controllers/checkout.controller.js"

const router = express.Router()

router.get("/summary/:userId", getCheckoutSummary)
router.post("/apply-coupon", applyCoupon)
router.post("/process", processCheckout)

export default router
