import express from 'express';
import HeroSlide from '../models/HeroSection.js';

const router = express.Router();

// GET all active hero slides for slider
router.get('/', async (req, res) => {
  try {
    const currentDate = new Date();
    
    const slides = await HeroSlide.find({ 
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
      data: slides,
      count: slides.length,
      message: 'Hero slides fetched successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// GET all hero slides (for admin panel)
router.get('/all', async (req, res) => {
  try {
    const slides = await HeroSlide.find()
      .sort({ order: 1, createdAt: -1 })
      .select('-__v');
    
    res.json({
      success: true,
      data: slides,
      count: slides.length,
      message: 'All hero slides fetched successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// GET single hero slide by ID
router.get('/:id', async (req, res) => {
  try {
    const slide = await HeroSlide.findById(req.params.id).select('-__v');
    
    if (!slide) {
      return res.status(404).json({
        success: false,
        message: 'Hero slide not found'
      });
    }
    
    res.json({
      success: true,
      data: slide,
      message: 'Hero slide fetched successfully'
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Hero slide not found'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// CREATE new hero slide
router.post('/', async (req, res) => {
  try {
    const {
      title,
      subtitle,
      year,
      description,
      desktopImage,
      mobileImage,
      category,
      link,
      metaTitle,
      metaDescription,
      order,
      startDate,
      endDate
    } = req.body;

    // Validation
    if (!desktopImage || !category || !link) {
      return res.status(400).json({
        success: false,
        message: 'Desktop image, category, and link are required fields'
      });
    }

    const newSlide = new HeroSlide({
      title: title || "",
      subtitle: subtitle || "Shop Now",
      year: year || "",
      description: description || "",
      desktopImage,
      mobileImage: mobileImage || desktopImage, // Fallback to desktop image
      category,
      link,
      metaTitle: metaTitle || "",
      metaDescription: metaDescription || "",
      order: order || 0,
      startDate: startDate || Date.now(),
      endDate: endDate || null
    });

    const savedSlide = await newSlide.save();
    
    res.status(201).json({
      success: true,
      data: savedSlide,
      message: 'Hero slide created successfully'
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

// UPDATE hero slide
router.put('/:id', async (req, res) => {
  try {
    const {
      title,
      subtitle,
      year,
      description,
      desktopImage,
      mobileImage,
      category,
      link,
      metaTitle,
      metaDescription,
      isActive,
      order,
      startDate,
      endDate
    } = req.body;

    const updateFields = {};
    if (title !== undefined) updateFields.title = title;
    if (subtitle !== undefined) updateFields.subtitle = subtitle;
    if (year !== undefined) updateFields.year = year;
    if (description !== undefined) updateFields.description = description;
    if (desktopImage !== undefined) updateFields.desktopImage = desktopImage;
    if (mobileImage !== undefined) updateFields.mobileImage = mobileImage;
    if (category !== undefined) updateFields.category = category;
    if (link !== undefined) updateFields.link = link;
    if (metaTitle !== undefined) updateFields.metaTitle = metaTitle;
    if (metaDescription !== undefined) updateFields.metaDescription = metaDescription;
    if (isActive !== undefined) updateFields.isActive = isActive;
    if (order !== undefined) updateFields.order = order;
    if (startDate !== undefined) updateFields.startDate = startDate;
    if (endDate !== undefined) updateFields.endDate = endDate;

    const updatedSlide = await HeroSlide.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).select('-__v');

    if (!updatedSlide) {
      return res.status(404).json({
        success: false,
        message: 'Hero slide not found'
      });
    }

    res.json({
      success: true,
      data: updatedSlide,
      message: 'Hero slide updated successfully'
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Hero slide not found'
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

// DELETE hero slide
router.delete('/:id', async (req, res) => {
  try {
    const deletedSlide = await HeroSlide.findByIdAndDelete(req.params.id);

    if (!deletedSlide) {
      return res.status(404).json({
        success: false,
        message: 'Hero slide not found'
      });
    }

    res.json({
      success: true,
      message: 'Hero slide deleted successfully',
      deletedId: deletedSlide._id
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Hero slide not found'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// BULK UPDATE slide orders (for drag & drop reordering)
router.put('/bulk/orders', async (req, res) => {
  try {
    const { slides } = req.body;

    if (!Array.isArray(slides)) {
      return res.status(400).json({
        success: false,
        message: 'Slides array is required'
      });
    }

    const bulkOperations = slides.map(slide => ({
      updateOne: {
        filter: { _id: slide.id },
        update: { $set: { order: slide.order } }
      }
    }));

    const result = await HeroSlide.bulkWrite(bulkOperations);

    res.json({
      success: true,
      message: 'Slide orders updated successfully',
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

// TOGGLE slide active status
router.patch('/:id/toggle', async (req, res) => {
  try {
    const slide = await HeroSlide.findById(req.params.id);
    
    if (!slide) {
      return res.status(404).json({
        success: false,
        message: 'Hero slide not found'
      });
    }

    slide.isActive = !slide.isActive;
    const updatedSlide = await slide.save();

    res.json({
      success: true,
      data: updatedSlide,
      message: `Slide ${updatedSlide.isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Hero slide not found'
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