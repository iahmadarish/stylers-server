// import express from "express"
// import {
//   register,
//   verifyEmail,
//   verifyPhone,
//   resendOTP,
//   login,
//   logout,
//   getMe,
//   forgotPassword,
//   resetPassword,
//   updatePassword,
//   googleAuth,
//   facebookAuth,
// } from "../controllers/auth.controller.js"
// import { protect } from "../middleware/auth.middleware.js"

// const router = express.Router()

// // Public routes
// router.post("/register", register)
// router.post("/verify-email", verifyEmail) // Changed from GET to POST
// router.post("/verify-phone", verifyPhone)
// router.post("/resend-otp", resendOTP)
// router.post("/login", login)
// router.post("/forgot-password", forgotPassword)
// router.patch("/reset-password/:token", resetPassword)
// router.post("/google", googleAuth)
// router.post("/facebook", facebookAuth)

// // Protected routes
// router.get("/logout", protect, logout)
// router.get("/me", protect, getMe)
// router.patch("/update-password", protect, updatePassword)

// export default router


import express from "express"
import {
  register,
  verifyEmail,
  verifyPhone,
  resendOTP,
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  updatePassword,
  googleAuth,
  facebookAuth,
  verifyPasswordResetOTP,
  createUser
} from "../controllers/auth.controller.js"
import { protect } from "../middleware/auth.middleware.js"

const router = express.Router()

// Public routes
router.post("/register", register)
router.post("/verify-email", verifyEmail) // Changed from GET to POST
router.post("/verify-phone", verifyPhone)
router.post("/resend-otp", resendOTP)
router.post("/login", login)
router.post("/forgot-password", forgotPassword)
router.patch("/reset-password/:token", resetPassword)
router.post("/google", googleAuth)
router.post("/facebook", facebookAuth)
router.post("/verify-password-otp", verifyPasswordResetOTP)

// Protected routes
router.get("/logout", protect, logout)
router.get("/me", protect, getMe)
router.patch("/update-password", protect, updatePassword)
router.post("/create-user", protect,  createUser);

export default router