import express from "express";
import {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
} from "../controllers/notificationController.js";
import { isUser } from "../middleare/isUser.js";

const router = express.Router();

// Apply auth middleware to all notification routes
router.use(isUser);

// GET /api/notifications/user/:userId -> fetch user's notifications
router.get("/user/:userId", getUserNotifications);

// PATCH /api/notifications/:id/read -> mark a single notification as read
router.patch("/:id/read", markAsRead);

// PATCH /api/notifications/user/:userId/read-all -> mark all notifications as read
router.patch("/user/:userId/read-all", markAllAsRead);

export default router;
