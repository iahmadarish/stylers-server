// import express from "express"
// import {
//   createCampaign,
//   getCampaigns,
//   getActiveCampaigns,
//   getCampaign,
//   updateCampaign,
//   deleteCampaign,
//   applyCampaign,
//   removeCampaign,
// } from "../controllers/campaign.controller.js"
// import { protect, restrictTo } from "../middleware/auth.middleware.js"
// import { campaignUpload } from "../utils/cloudinary.js"

// const router = express.Router()

// // Public routes
// router.get("/active", getActiveCampaigns)

// // Admin routes
// router.use(protect, restrictTo("admin", "executive"))
// router.route("/")
//   .get(getCampaigns)
//   .post(campaignUpload.single('bannerImage'), createCampaign)
  
// router.route("/:id")
//   .get(getCampaign)
//   .patch(campaignUpload.single('bannerImage'), updateCampaign)
//   .put(campaignUpload.single('bannerImage'), updateCampaign) 
//   .delete(deleteCampaign)
  
// router.post("/:id/apply", applyCampaign)
// router.post("/:id/remove", removeCampaign)

// export default router

import express from "express"
import {
  createCampaign,
  getCampaigns,
  getActiveCampaigns,
  getCampaign,
  updateCampaign,
  deleteCampaign,
  applyCampaign,
  removeCampaign,
} from "../controllers/campaign.controller.js"
import { protect, restrictTo } from "../middleware/auth.middleware.js"
import { hasPermission } from "../middleware/permission.middleware.js" // ✅ NEW
import { campaignUpload } from "../utils/cloudinary.js"

const router = express.Router()

// Public routes
router.get("/active", getActiveCampaigns)

// Admin & Executive routes with permissions
router.use(protect, restrictTo("admin", "executive"))

// ✅ UPDATED: Get campaigns - view permission
router.get("/", 
  hasPermission('campaigns', 'view'),
  getCampaigns
)

// ✅ UPDATED: Create campaign - create permission  
router.post("/",
  hasPermission('campaigns', 'create'),
  campaignUpload.single('bannerImage'), 
  createCampaign
)

// ✅ UPDATED: Get single campaign - view permission
router.get("/:id",
  hasPermission('campaigns', 'view'),
  getCampaign
)

// ✅ UPDATED: Update campaign - update permission
router.patch("/:id",
  hasPermission('campaigns', 'update'),
  campaignUpload.single('bannerImage'), 
  updateCampaign
)

// ✅ UPDATED: Update campaign (PUT) - update permission
router.put("/:id",
  hasPermission('campaigns', 'update'), 
  campaignUpload.single('bannerImage'),
  updateCampaign
)

// ✅ UPDATED: Delete campaign - delete permission
router.delete("/:id",
  hasPermission('campaigns', 'delete'),
  deleteCampaign
)

// ✅ UPDATED: Apply campaign - update permission
router.post("/:id/apply",
  hasPermission('campaigns', 'update'),
  applyCampaign
)

// ✅ UPDATED: Remove campaign - update permission
router.post("/:id/remove",
  hasPermission('campaigns', 'update'),
  removeCampaign
)

export default router