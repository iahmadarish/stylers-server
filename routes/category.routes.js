import express from "express"
import {
  createParentCategory,
  getParentCategories,
  getParentCategory,
  updateParentCategory,
  deleteParentCategory,
  createSubCategory,
  getSubCategories,
  getSubCategory,
  updateSubCategory,
  deleteSubCategory,
  createDressType,
  getDressTypes,
  getDressType,
  updateDressType,
  deleteDressType,
  createStyle,
  getStyles,
  getStyle,
  updateStyle,
  deleteStyle,
  getCategoryHierarchy,
} from "../controllers/category.controller.js"
import { protect, restrictTo } from "../middleware/auth.middleware.js"
import { categoryUpload } from "../utils/cloudinary.js"

const router = express.Router()

// Public routes
router.get("/parent", getParentCategories)
router.get("/parent/:id", getParentCategory)
router.get("/sub", getSubCategories)
router.get("/sub/:id", getSubCategory)
router.get("/dress-type", getDressTypes)
router.get("/dress-type/:id", getDressType)
router.get("/style", getStyles)
router.get("/style/:id", getStyle)
router.get("/hierarchy", getCategoryHierarchy)

// Admin routes
router.use(protect, restrictTo("admin"))

// Parent category routes
router.post("/parent", categoryUpload.single("image"), createParentCategory)
router.patch("/parent/:id", categoryUpload.single("image"), updateParentCategory)
router.delete("/parent/:id", deleteParentCategory)

// Sub category routes
router.post("/sub", categoryUpload.single("image"), createSubCategory)
router.patch("/sub/:id", categoryUpload.single("image"), updateSubCategory)
router.delete("/sub/:id", deleteSubCategory)

// Dress type routes
router.post("/dress-type", categoryUpload.single("image"), createDressType)
router.patch("/dress-type/:id", categoryUpload.single("image"), updateDressType)
router.delete("/dress-type/:id", deleteDressType)

// Style routes
router.post("/style", categoryUpload.single("image"), createStyle)
router.patch("/style/:id", categoryUpload.single("image"), updateStyle)
router.delete("/style/:id", deleteStyle)

export default router
