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
import { campaignUpload } from "../utils/cloudinary.js"

const router = express.Router()

// Public routes
router.get("/active", getActiveCampaigns)

// Admin routes
router.use(protect, restrictTo("admin", "executive"))
router.route("/")
  .get(getCampaigns)
  .post(campaignUpload.single('bannerImage'), createCampaign)
  
router.route("/:id")
  .get(getCampaign)
  .patch(campaignUpload.single('bannerImage'), updateCampaign)
  .delete(deleteCampaign)
  
router.post("/:id/apply", applyCampaign)
router.post("/:id/remove", removeCampaign)

export default router
