// import express from "express"
// import {
//   createParentCategory,
//   getParentCategories,
//   getParentCategory,
//   updateParentCategory,
//   deleteParentCategory,
//   createSubCategory,
//   getSubCategories,
//   getSubCategory,
//   updateSubCategory,
//   deleteSubCategory,
//   createDressType,
//   getDressTypes,
//   getDressType,
//   updateDressType,
//   deleteDressType,
//   createStyle,
//   getStyles,
//   getStyle,
//   updateStyle,
//   deleteStyle,
//   getCategoryHierarchy,
//   getParentCategoriesForAdmin,
//   getParentCategoryForAdmin,
//   getSubCategoriesForAdmin,
//   getSubCategoryForAdmin,
//   getDressTypesForAdmin,
//   getDressTypeForAdmin,
//   getStylesForAdmin,
//   getStyleForAdmin,
//   getCategoryHierarchyForAdmin,
//   getParentCategoriesForCampaign,
//   getSubCategoriesForCampaign
// } from "../controllers/category.controller.js"
// import { protect, restrictTo } from "../middleware/auth.middleware.js"
// import { categoryUpload } from "../utils/cloudinary.js"

// const router = express.Router()

// // Admin view routes - authentication required
// router.get("/hierarchy/admin", protect, restrictTo("admin", "executive"), getCategoryHierarchyForAdmin)
// router.get("/parent/campaign", protect, restrictTo("admin", "executive"), getParentCategoriesForCampaign)
// router.get("/sub/campaign", protect, restrictTo("admin", "executive"), getSubCategoriesForCampaign)

// router.get("/parent/admin", protect, restrictTo("admin", "executive"), getParentCategoriesForAdmin)
// router.get("/sub/admin", protect, restrictTo("admin", "executive"), getSubCategoriesForAdmin)
// router.get("/dress-type/admin", protect, restrictTo("admin", "executive"), getDressTypesForAdmin)
// router.get("/style/admin", protect, restrictTo("admin", "executive"), getStylesForAdmin)
// router.get("/parent/:id/admin", protect, restrictTo("admin", "executive"), getParentCategoryForAdmin)
// router.get("/sub/:id/admin", protect, restrictTo("admin", "executive"), getSubCategoryForAdmin)
// router.get("/dress-type/:id/admin", protect, restrictTo("admin", "executive"), getDressTypeForAdmin)
// router.get("/style/:id/admin", protect, restrictTo("admin", "executive"), getStyleForAdmin)

// // Public routes - no authentication required
// router.get("/hierarchy", getCategoryHierarchy)
// router.get("/parent", getParentCategories)
// router.get("/sub", getSubCategories)
// router.get("/dress-type", getDressTypes)
// router.get("/style", getStyles)
// router.get("/parent/:id", getParentCategory)
// router.get("/sub/:id", getSubCategory)
// router.get("/dress-type/:id", getDressType)
// router.get("/style/:id", getStyle)

// // Admin CRUD routes 
// router.use(protect, restrictTo("admin"))

// // Parent category routes
// router.post("/parent", categoryUpload.single("image"), createParentCategory)
// router.patch("/parent/:id", categoryUpload.single("image"), updateParentCategory)
// router.delete("/parent/:id", deleteParentCategory)

// // Sub category routes
// router.post("/sub", categoryUpload.single("image"), createSubCategory)
// router.patch("/sub/:id", categoryUpload.single("image"), updateSubCategory)
// router.delete("/sub/:id", deleteSubCategory)

// // Dress type routes
// router.post("/dress-type", categoryUpload.single("image"), createDressType)
// router.patch("/dress-type/:id", categoryUpload.single("image"), updateDressType)
// router.delete("/dress-type/:id", deleteDressType)

// // Style routes
// router.post("/style", categoryUpload.single("image"), createStyle)
// router.patch("/style/:id", categoryUpload.single("image"), updateStyle)
// router.delete("/style/:id", deleteStyle)

// export default router

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
  getParentCategoriesForAdmin,
  getParentCategoryForAdmin,
  getSubCategoriesForAdmin,
  getSubCategoryForAdmin,
  getDressTypesForAdmin,
  getDressTypeForAdmin,
  getStylesForAdmin,
  getStyleForAdmin,
  getCategoryHierarchyForAdmin,
  getParentCategoriesForCampaign,
  getSubCategoriesForCampaign
} from "../controllers/category.controller.js"
import { protect, restrictTo } from "../middleware/auth.middleware.js"
import { hasPermission } from "../middleware/permission.middleware.js" // ✅ NEW
import { categoryUpload } from "../utils/cloudinary.js"

const router = express.Router()

// Admin view routes - authentication required
router.get("/hierarchy/admin", protect, restrictTo("admin", "executive"), getCategoryHierarchyForAdmin)
router.get("/parent/campaign", protect, restrictTo("admin", "executive"), getParentCategoriesForCampaign)
router.get("/sub/campaign", protect, restrictTo("admin", "executive"), getSubCategoriesForCampaign)

router.get("/parent/admin", protect, restrictTo("admin", "executive"), getParentCategoriesForAdmin)
router.get("/sub/admin", protect, restrictTo("admin", "executive"), getSubCategoriesForAdmin)
router.get("/dress-type/admin", protect, restrictTo("admin", "executive"), getDressTypesForAdmin)
router.get("/style/admin", protect, restrictTo("admin", "executive"), getStylesForAdmin)
router.get("/parent/:id/admin", protect, restrictTo("admin", "executive"), getParentCategoryForAdmin)
router.get("/sub/:id/admin", protect, restrictTo("admin", "executive"), getSubCategoryForAdmin)
router.get("/dress-type/:id/admin", protect, restrictTo("admin", "executive"), getDressTypeForAdmin)
router.get("/style/:id/admin", protect, restrictTo("admin", "executive"), getStyleForAdmin)

// Public routes - no authentication required
router.get("/hierarchy", getCategoryHierarchy)
router.get("/parent", getParentCategories)
router.get("/sub", getSubCategories)
router.get("/dress-type", getDressTypes)
router.get("/style", getStyles)
router.get("/parent/:id", getParentCategory)
router.get("/sub/:id", getSubCategory)
router.get("/dress-type/:id", getDressType)
router.get("/style/:id", getStyle)

// ✅ FIXED: Admin CRUD routes with permission checks
router.use(protect)

// Parent category routes - with permission checks
router.post("/parent", 
  restrictTo("admin", "executive"), 
  hasPermission('categories', 'create'), // ✅ Permission check
  categoryUpload.single("image"), 
  createParentCategory
)

router.patch("/parent/:id", 
  restrictTo("admin", "executive"),
  hasPermission('categories', 'update'), // ✅ Permission check
  categoryUpload.single("image"), 
  updateParentCategory
)

router.delete("/parent/:id", 
  restrictTo("admin", "executive"),
  hasPermission('categories', 'delete'), // ✅ Permission check
  deleteParentCategory
)

// Sub category routes - with permission checks
router.post("/sub", 
  restrictTo("admin", "executive"),
  hasPermission('categories', 'create'), // ✅ Permission check
  categoryUpload.single("image"), 
  createSubCategory
)

router.patch("/sub/:id", 
  restrictTo("admin", "executive"),
  hasPermission('categories', 'update'), // ✅ Permission check
  categoryUpload.single("image"), 
  updateSubCategory
)

router.delete("/sub/:id", 
  restrictTo("admin", "executive"),
  hasPermission('categories', 'delete'), // ✅ Permission check
  deleteSubCategory
)

// Dress type routes - with permission checks
router.post("/dress-type", 
  restrictTo("admin", "executive"),
  hasPermission('categories', 'create'), // ✅ Permission check
  categoryUpload.single("image"), 
  createDressType
)

router.patch("/dress-type/:id", 
  restrictTo("admin", "executive"),
  hasPermission('categories', 'update'), // ✅ Permission check
  categoryUpload.single("image"), 
  updateDressType
)

router.delete("/dress-type/:id", 
  restrictTo("admin", "executive"),
  hasPermission('categories', 'delete'), // ✅ Permission check
  deleteDressType
)

// Style routes - with permission checks
router.post("/style", 
  restrictTo("admin", "executive"),
  hasPermission('categories', 'create'), // ✅ Permission check
  categoryUpload.single("image"), 
  createStyle
)

router.patch("/style/:id", 
  restrictTo("admin", "executive"),
  hasPermission('categories', 'update'), // ✅ Permission check
  categoryUpload.single("image"), 
  updateStyle
)

router.delete("/style/:id", 
  restrictTo("admin", "executive"),
  hasPermission('categories', 'delete'), // ✅ Permission check
  deleteStyle
)

export default router