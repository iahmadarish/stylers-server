import express from "express"
import {
  addToCart,
  getCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  deleteCart,
  refreshCartPrices,
  getCartSummary,
} from "../controllers/cart.controller.js"

const router = express.Router()

// ✅ Cart Management Routes
router.post("/add", addToCart)                    // Add item to cart
router.get("/:userId", getCart)                   // Get full cart with items
router.get("/summary/:userId", getCartSummary)    // Get cart summary only
router.put("/update", updateCartItem)             // Update item quantity
router.delete("/remove", removeFromCart)          // Remove specific item
router.delete("/clear", clearCart)                // Clear cart items (keep cart structure)
router.delete("/delete", deleteCart)              // Delete entire cart document
router.patch("/refresh/:userId", refreshCartPrices) // Refresh cart prices

export default router