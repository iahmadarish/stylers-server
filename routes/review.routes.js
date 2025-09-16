import express from "express"
import {
  createReview,
  getReviews,
  getReview,
  updateReview,
  deleteReview,
  getProductReviews,
} from "../controllers/review.controller.js"

const router = express.Router()

// Public routes
router.get("/", getReviews)
router.get("/product/:slug", getProductReviews)
router.get("/:id", getReview)
router.post("/", createReview) // No protection middleware

// Protected routes (remove if not needed)
// router.use(protect)
// router.route("/:id").patch(updateReview).delete(deleteReview)

export default router