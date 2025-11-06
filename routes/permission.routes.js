import express from "express"
import {
  getAvailablePermissions,
  updateUserPermissions,
  getUserPermissions,
  getMyPermissions,
  resetPermissions
} from "../controllers/permission.controller.js"
import { protect, admin } from "../middleware/auth.middleware.js"

const router = express.Router()

// All routes are protected
router.use(protect)

// Get available permissions modules and actions
router.get("/available", admin, getAvailablePermissions)

// Get current user permissions
router.get("/my-permissions", getMyPermissions)

// Get user permissions (admin only)
router.get("/user/:userId", admin, getUserPermissions)

// Update user permissions (admin only)
router.patch("/user/:userId", admin, updateUserPermissions)

// Reset user permissions to default (admin only)
router.post("/user/:userId/reset", admin, resetPermissions)

export default router