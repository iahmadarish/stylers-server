import express from 'express';
import TrendingOffer from '../models/TrendingOffer.js';

const router = express.Router();

// GET all active trending offers
router.get('/', async (req, res) => {
  try {
    const currentDate = new Date();
    
    const offers = await TrendingOffer.find({ 
      isActive: true,
      $or: [
        { startDate: { $lte: currentDate }, endDate: { $exists: false } },
        { startDate: { $lte: currentDate }, endDate: { $gte: currentDate } },
        { startDate: { $exists: false }, endDate: { $exists: false } }
      ]
    })
    .sort({ order: 1, createdAt: -1 })
    .select('-__v');
    
    res.json({
      success: true,
      data: offers,
      count: offers.length,
      message: 'Trending offers fetched successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// GET all trending offers (for admin)
router.get('/all', async (req, res) => {
  try {
    const offers = await TrendingOffer.find()
      .sort({ order: 1, createdAt: -1 })
      .select('-__v');
    
    res.json({
      success: true,
      data: offers,
      count: offers.length,
      message: 'All trending offers fetched successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// GET single trending offer by ID
router.get('/:id', async (req, res) => {
  try {
    const offer = await TrendingOffer.findById(req.params.id).select('-__v');
    
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Trending offer not found'
      });
    }
    
    res.json({
      success: true,
      data: offer,
      message: 'Trending offer fetched successfully'
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Trending offer not found'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// CREATE new trending offer
router.post('/', async (req, res) => {
  try {
    const {
      brand,
      title,
      discount,
      image,
      link,
      order,
      startDate,
      endDate
    } = req.body;

    // Validation
    if (!brand || !title || !discount || !image || !link) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required: brand, title, discount, image, link'
      });
    }

    const newOffer = new TrendingOffer({
      brand: brand.trim(),
      title: title.trim(),
      discount: discount.trim(),
      image,
      link,
      order: order || 0,
      startDate: startDate || Date.now(),
      endDate: endDate || null
    });

    const savedOffer = await newOffer.save();
    
    res.status(201).json({
      success: true,
      data: savedOffer,
      message: 'Trending offer created successfully'
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        error: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// UPDATE trending offer
router.put('/:id', async (req, res) => {
  try {
    const {
      brand,
      title,
      discount,
      image,
      link,
      isActive,
      order,
      startDate,
      endDate
    } = req.body;

    const updateFields = {};
    if (brand !== undefined) updateFields.brand = brand;
    if (title !== undefined) updateFields.title = title;
    if (discount !== undefined) updateFields.discount = discount;
    if (image !== undefined) updateFields.image = image;
    if (link !== undefined) updateFields.link = link;
    if (isActive !== undefined) updateFields.isActive = isActive;
    if (order !== undefined) updateFields.order = order;
    if (startDate !== undefined) updateFields.startDate = startDate;
    if (endDate !== undefined) updateFields.endDate = endDate;

    const updatedOffer = await TrendingOffer.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).select('-__v');

    if (!updatedOffer) {
      return res.status(404).json({
        success: false,
        message: 'Trending offer not found'
      });
    }

    res.json({
      success: true,
      data: updatedOffer,
      message: 'Trending offer updated successfully'
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Trending offer not found'
      });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        error: error.message
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// DELETE trending offer
router.delete('/:id', async (req, res) => {
  try {
    const deletedOffer = await TrendingOffer.findByIdAndDelete(req.params.id);

    if (!deletedOffer) {
      return res.status(404).json({
        success: false,
        message: 'Trending offer not found'
      });
    }

    res.json({
      success: true,
      message: 'Trending offer deleted successfully',
      deletedId: deletedOffer._id
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Trending offer not found'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// BULK UPDATE offer orders
router.put('/bulk/orders', async (req, res) => {
  try {
    const { offers } = req.body;

    if (!Array.isArray(offers)) {
      return res.status(400).json({
        success: false,
        message: 'Offers array is required'
      });
    }

    const bulkOperations = offers.map(offer => ({
      updateOne: {
        filter: { _id: offer.id },
        update: { $set: { order: offer.order } }
      }
    }));

    const result = await TrendingOffer.bulkWrite(bulkOperations);

    res.json({
      success: true,
      message: 'Offer orders updated successfully',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// TOGGLE offer active status
router.patch('/:id/toggle', async (req, res) => {
  try {
    const offer = await TrendingOffer.findById(req.params.id);
    
    if (!offer) {
      return res.status(404).json({
        success: false,
        message: 'Trending offer not found'
      });
    }

    offer.isActive = !offer.isActive;
    const updatedOffer = await offer.save();

    res.json({
      success: true,
      data: updatedOffer,
      message: `Offer ${updatedOffer.isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Trending offer not found'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

export default router;