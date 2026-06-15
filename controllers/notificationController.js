import Notification from "../models/NotificationModel.js";

// GET /api/notifications/user/:userId
export const getUserNotifications = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Security check: ensure requesting user only gets their own notifications
    if (userId !== req.userId) {
      return res.status(403).json({ message: "Forbidden: You cannot access notifications for another user." });
    }

    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 });

    res.status(200).json(notifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// PATCH /api/notifications/:id/read
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const notification = await Notification.findById(id);
    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    // Security check: ensure notification belongs to requesting user
    if (notification.userId.toString() !== userId) {
      return res.status(403).json({ message: "Forbidden: You do not own this notification." });
    }

    notification.isRead = true;
    await notification.save();

    res.status(200).json({ message: "Notification marked as read", notification });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// PATCH /api/notifications/user/:userId/read-all
export const markAllAsRead = async (req, res) => {
  try {
    const { userId } = req.params;

    // Security check: ensure requesting user only modifies their own notifications
    if (userId !== req.userId) {
      return res.status(403).json({ message: "Forbidden: You cannot modify notifications for another user." });
    }

    await Notification.updateMany(
      { userId, isRead: false },
      { $set: { isRead: true } }
    );

    res.status(200).json({ message: "All notifications marked as read" });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
