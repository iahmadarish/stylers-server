import express from "express";
import StockNotification from "../models/StockNotification.js";
import { protect, admin } from "../middleware/auth.middleware.js";

const router = express.Router();

// for admin only get stock notification
router.get("/", protect, admin, async (req, res) => {
  try {
    const { page = 1, limit = 10, unreadOnly = false } = req.query;
    
    let query = {};
    if (unreadOnly === "true") {
      query.isRead = false;
    }
    
    const notifications = await StockNotification.find(query)
      .sort({ notifiedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await StockNotification.countDocuments(query);
    
    res.json({
      notifications,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// for making mark as read
router.patch("/:id/read", protect, admin, async (req, res) => {
  try {
    const notification = await StockNotification.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true }
    );
    
    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }
    
    res.json({ success: true, notification });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// for making all notification mark as read
router.patch("/read-all", protect, admin, async (req, res) => {
  try {await StockNotification.updateMany({ isRead: false },
  { isRead: true });
  res.json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
  res.status(500).json({ message: error.message });
  }
});

export default router;