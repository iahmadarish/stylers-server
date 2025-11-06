// routes/promotionalCampaignRoutes.js
import express from 'express';
import {
  createPromotionalCampaign,
  getPromotionalCampaigns,
  getPromotionalCampaignById,
  updatePromotionalCampaign,
  deletePromotionalCampaign,
  updateCampaignOrders
} from '../controllers/promotionalCampaignController.js';
import { campaignUpload } from '../utils/cloudinary.js'; // utils থেকে upload function import

const router = express.Router();

// Image upload route (যদি দরকার হয়)
router.post('/upload', campaignUpload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      imageUrl: req.file.path
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading image',
      error: error.message
    });
  }
});

// Existing routes
router.post('/promotional-campaigns', createPromotionalCampaign);
router.get('/promotional-campaigns', getPromotionalCampaigns);
router.get('/promotional-campaigns/:id', getPromotionalCampaignById);
router.put('/promotional-campaigns/:id', updatePromotionalCampaign);
router.delete('/promotional-campaigns/:id', deletePromotionalCampaign);
router.patch('/promotional-campaigns/orders', updateCampaignOrders);

export default router;