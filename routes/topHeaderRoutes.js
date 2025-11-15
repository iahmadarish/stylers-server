// routes/topHeaderRoutes.js
import express from 'express';
import TopHeader from '../models/topHeaderModel.js';

const router = express.Router();

// GET - Get top header data
router.get('/', async (req, res) => {
  try {
    let topHeader = await TopHeader.findOne();
    
    if (!topHeader) {
      // Create default top header if not exists
      topHeader = await TopHeader.create({
        scrollingTexts: [
          { text: 'FREE SHIPPING ON ORDERS TK 4000+', emoji: '😲', order: 1 },
          { text: 'Flat 40% Discount on all Products.', emoji: '', order: 2 },
          { text: 'CONTACT US FOR BULK ORDERS', emoji: '💵', order: 3 },
          { text: 'FAST DELIVERY ACROSS BANGLADESH', emoji: '🚚', order: 4 },
          { text: 'SECURE PAYMENT OPTIONS', emoji: '💳', order: 5 },
          { text: 'EASY RETURN POLICY WITHIN 7 DAYS', emoji: '🔄', order: 6 },
          { text: '100% CUSTOMER SATISFACTION GUARANTEE', emoji: '⭐', order: 7 }
        ],
        contactInfo: {
          phone: '+8809613002024',
          email: 'support@paarel.com',
          bulkOrderLink: '/stylers-outfit-corporate-sales'
        }
      });
    }

    res.json({
      success: true,
      data: topHeader
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

// PUT - Update top header
router.put('/', async (req, res) => {
  try {
    const {
      scrollingTexts,
      contactInfo,
      country,
      isActive
    } = req.body;

    let topHeader = await TopHeader.findOne();

    if (!topHeader) {
      topHeader = new TopHeader();
    }

    if (scrollingTexts) topHeader.scrollingTexts = scrollingTexts;
    if (contactInfo) topHeader.contactInfo = contactInfo;
    if (country) topHeader.country = country;
    if (isActive !== undefined) topHeader.isActive = isActive;

    await topHeader.save();

    res.json({
      success: true,
      message: 'Top header updated successfully',
      data: topHeader
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update top header',
      error: error.message
    });
  }
});

// POST - Add new scrolling text
router.post('/scrolling-texts', async (req, res) => {
  try {
    const { text, emoji, isActive, order } = req.body;

    let topHeader = await TopHeader.findOne();
    
    if (!topHeader) {
      topHeader = new TopHeader();
    }

    topHeader.scrollingTexts.push({
      text,
      emoji: emoji || '',
      isActive: isActive !== undefined ? isActive : true,
      order: order || topHeader.scrollingTexts.length + 1
    });

    await topHeader.save();

    res.json({
      success: true,
      message: 'Scrolling text added successfully',
      data: topHeader
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to add scrolling text',
      error: error.message
    });
  }
});

// PUT - Update scrolling text
router.put('/scrolling-texts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { text, emoji, isActive, order } = req.body;

    const topHeader = await TopHeader.findOne();
    
    if (!topHeader) {
      return res.status(404).json({
        success: false,
        message: 'Top header not found'
      });
    }

    const scrollingText = topHeader.scrollingTexts.id(id);
    if (!scrollingText) {
      return res.status(404).json({
        success: false,
        message: 'Scrolling text not found'
      });
    }

    if (text) scrollingText.text = text;
    if (emoji !== undefined) scrollingText.emoji = emoji;
    if (isActive !== undefined) scrollingText.isActive = isActive;
    if (order !== undefined) scrollingText.order = order;

    await topHeader.save();

    res.json({
      success: true,
      message: 'Scrolling text updated successfully',
      data: topHeader
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update scrolling text',
      error: error.message
    });
  }
});

// DELETE - Remove scrolling text
router.delete('/scrolling-texts/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const topHeader = await TopHeader.findOne();
    
    if (!topHeader) {
      return res.status(404).json({
        success: false,
        message: 'Top header not found'
      });
    }

    topHeader.scrollingTexts.pull(id);
    await topHeader.save();

    res.json({
      success: true,
      message: 'Scrolling text deleted successfully',
      data: topHeader
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete scrolling text',
      error: error.message
    });
  }
});

// PUT - Update contact information
router.put('/contact-info', async (req, res) => {
  try {
    const { phone, email, bulkOrderLink } = req.body;

    let topHeader = await TopHeader.findOne();
    
    if (!topHeader) {
      topHeader = new TopHeader();
    }

    if (phone) topHeader.contactInfo.phone = phone;
    if (email) topHeader.contactInfo.email = email;
    if (bulkOrderLink) topHeader.contactInfo.bulkOrderLink = bulkOrderLink;

    await topHeader.save();

    res.json({
      success: true,
      message: 'Contact information updated successfully',
      data: topHeader
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update contact information',
      error: error.message
    });
  }
});

export default router;