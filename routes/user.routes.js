import express from "express"
import { getUsers, getUser, updateUser, deleteUser, updateProfile } from "../controllers/user.controller.js"
import { protect, restrictTo } from "../middleware/auth.middleware.js"

const router = express.Router()

// Protect all routes
router.use(protect)

// User routes
router.patch("/update-profile", updateProfile)

// Admin routes
router.use(restrictTo("admin"))
router.route("/").get(getUsers)
router.route("/:id").get(getUser).patch(updateUser).delete(deleteUser)

export default router
