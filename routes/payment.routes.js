import express from "express";
import {
  paymentSuccess,
  paymentFail,
  paymentCancel,
  handleIPN,
  createCODOrder,
  initializeAamarpayPayment,
  initializeGuestPayment,
  paymentNotify,
  

} from "../controllers/payment.controller.js";

const router = express.Router();

/**
 * Test route
 */
router.get("/test", (req, res) => {
  res.json({
    message: "Payment routes are working",
    timestamp: new Date().toISOString(),
  });
});

/**
 * Aamarpay payment initialization routes
 */
router.post("/initialize", initializeAamarpayPayment);
router.post("/initialize-guest-payment", initializeGuestPayment);
// router.post("/verify", verifyAamarpayPayment);


router.route("/success/:transactionId")
  .get(paymentSuccess)  // GET request handle
  .post(paymentSuccess); // POST request handle 

router.route("/fail/:transactionId")
  .get(paymentFail)
  .post(paymentFail);

router.route("/cancel/:transactionId")
  .get(paymentCancel)
  .post(paymentCancel);




router.post('/notify', paymentNotify); // Aamarpay server callback


router.post("/cod", createCODOrder);

export default router;