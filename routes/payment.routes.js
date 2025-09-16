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

/**
 * Aamarpay redirect and server-to-server callback routes
 * GET এবং POST উভয়ই handle করবে
 */
router.route("/success/:transactionId")
  .get(paymentSuccess)  // GET request handle করবে
  .post(paymentSuccess); // POST request handle করবে

router.route("/fail/:transactionId")
  .get(paymentFail)
  .post(paymentFail);

router.route("/cancel/:transactionId")
  .get(paymentCancel)
  .post(paymentCancel);

/**
 * AamarPay IPN route (always POST)
 */
router.post("/notify", handleIPN);


router.post('/notify', paymentNotify); // Aamarpay server callback


router.post("/cod", createCODOrder);

export default router;