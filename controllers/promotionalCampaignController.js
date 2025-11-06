// controllers/promotionalCampaignController.js
import mongoose from 'mongoose';
import PromotionalCampaign from '../models/PromotionalCampaign.js';
import { deleteImage, getPublicIdFromUrl } from '../utils/cloudinary.js'; // utils folder থেকে import
// Create new promotional campaign
export const createPromotionalCampaign = async (req, res) => {
  try {
    const {
      targetCategory,
      title,
      description,
      altText,
      imageUrl,
      categorySlug,
      gradient,
      isActive,
      order,
      endDate
    } = req.body;

    // Validation
    if (!targetCategory || !title || !description || !altText || !imageUrl || !categorySlug) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    const newCampaign = new PromotionalCampaign({
      targetCategory,
      title,
      description,
      altText,
      imageUrl,
      categorySlug,
      gradient: gradient || 'from-blue-50 to-indigo-50',
      isActive: isActive !== undefined ? isActive : true,
      order: order || 0,
      endDate: endDate || null
    });

    const savedCampaign = await newCampaign.save();

    res.status(201).json({
      success: true,
      message: 'Promotional campaign created successfully',
      data: savedCampaign
    });
  } catch (error) {
    console.error('Error creating promotional campaign:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get all promotional campaigns with filtering
export const getPromotionalCampaigns = async (req, res) => {
  try {
    const { targetCategory, isActive } = req.query;
    
    let filter = {};
    
    if (targetCategory) {
      filter.targetCategory = targetCategory;
    }
    
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    const campaigns = await PromotionalCampaign.find(filter)
      .sort({ order: 1, createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: campaigns,
      count: campaigns.length
    });
  } catch (error) {
    console.error('Error fetching promotional campaigns:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Get promotional campaign by ID
export const getPromotionalCampaignById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid campaign ID'
      });
    }

    const campaign = await PromotionalCampaign.findById(id);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Promotional campaign not found'
      });
    }

    res.status(200).json({
      success: true,
      data: campaign
    });
  } catch (error) {
    console.error('Error fetching promotional campaign:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Update promotional campaign
export const updatePromotionalCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid campaign ID'
      });
    }

    // Find existing campaign to handle image deletion if needed
    const existingCampaign = await PromotionalCampaign.findById(id);
    if (!existingCampaign) {
      return res.status(404).json({
        success: false,
        message: 'Promotional campaign not found'
      });
    }

    // If image is being updated, delete old image from Cloudinary
    if (updateData.imageUrl && updateData.imageUrl !== existingCampaign.imageUrl) {
      const oldPublicId = getPublicIdFromUrl(existingCampaign.imageUrl);
      if (oldPublicId) {
        await deleteImage(oldPublicId);
      }
    }

    const updatedCampaign = await PromotionalCampaign.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Promotional campaign updated successfully',
      data: updatedCampaign
    });
  } catch (error) {
    console.error('Error updating promotional campaign:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Delete promotional campaign
export const deletePromotionalCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid campaign ID'
      });
    }

    const campaign = await PromotionalCampaign.findById(id);

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Promotional campaign not found'
      });
    }

    // Delete image from Cloudinary
    const publicId = getPublicIdFromUrl(campaign.imageUrl);
    if (publicId) {
      await deleteImage(publicId);
    }

    await PromotionalCampaign.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Promotional campaign deleted successfully',
      data: campaign
    });
  } catch (error) {
    console.error('Error deleting promotional campaign:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

// Bulk update campaign orders
export const updateCampaignOrders = async (req, res) => {
  try {
    const { orders } = req.body;

    if (!Array.isArray(orders)) {
      return res.status(400).json({
        success: false,
        message: 'Orders must be an array'
      });
    }

    const bulkOperations = orders.map(({ id, order }) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { order } }
      }
    }));

    await PromotionalCampaign.bulkWrite(bulkOperations);

    res.status(200).json({
      success: true,
      message: 'Campaign orders updated successfully'
    });
  } catch (error) {
    console.error('Error updating campaign orders:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};