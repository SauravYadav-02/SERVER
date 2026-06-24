import express from "express";
import mongoose from "mongoose";
import Booking from "../models/BookingModel.js";
import { createBookingWithUpfrontPayment } from "../services/mockPaymentService.js";
import { getVendorSubscriptionStatus } from "../services/subscriptionService.js";
import Venue from "../models/VenueModel.js";
import { isAdmin } from "../middleare/isAdmin.js";
import { paginate } from "../utils/pagination.js";
import Notification from "../models/NotificationModel.js";
import { calculateRefund } from "../utils/refundCalculator.js";
import User from "../models/UserModel.js";
import Vendor from "../models/VendorModel.js";
import UserVendorPayment from "../models/UserVendorPaymentModel.js";

const router = express.Router();

// Get all booked dates for a specific venue
router.get("/venue/:venueId/booked-dates", async (req, res) => {
  try {
    const { venueId } = req.params;

    // Check venue and subscription status
    const venue = await Venue.findById(venueId);
    if (!venue) return res.status(404).json({ error: "Venue not found" });

    const subStatus = await getVendorSubscriptionStatus(venue.vendorId);
    if (subStatus === "expired" || subStatus === "none") {
      return res.status(403).json({ error: "Venue is not available for booking yet." });
    }

    const bookings = await Booking.find({ venueId, status: { $nin: ["rejected", "failed", "cancelled"] } });
    
    const bookingsByDate = {};
    bookings.forEach((b) => {
      if (!bookingsByDate[b.date]) {
        bookingsByDate[b.date] = [];
      }
      bookingsByDate[b.date].push((b.selectedSlot || "fullday").toLowerCase());
    });

    const bookedDates = [];
    Object.keys(bookingsByDate).forEach((date) => {
      const slots = bookingsByDate[date];
      if (
        slots.includes("fullday") ||
        (slots.includes("morning") && slots.includes("afternoon") && slots.includes("evening"))
      ) {
        bookedDates.push(date);
      }
    });

    const activeBookings = bookings.map((b) => ({
      date: b.date,
      selectedSlot: b.selectedSlot || "fullday",
    }));

    res.json({ bookedDates, activeBookings });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch booked dates" });
  }
});

// Create a new booking
router.post("/", async (req, res) => {
  try {
    const booking = await createBookingWithUpfrontPayment(req.body);
    res.status(201).json({ message: "Booking created successfully", booking });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || "Failed to create booking" });
  }
});

// Get booking history for a specific user
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { page, limit } = req.query;

    if (page || limit) {
      const p = Math.max(1, parseInt(page) || 1);
      const l = Math.max(1, parseInt(limit) || 10);
      const skip = (p - 1) * l;

      const [totalRecords, data, allBookings] = await Promise.all([
        Booking.countDocuments({ userId }),
        Booking.find({ userId })
          .populate("venueId", "name city")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(l),
        Booking.find({ userId }).select("cost status")
      ]);

      const totalSpent = allBookings.reduce((sum, b) => sum + (b.status !== "rejected" ? b.cost : 0), 0);
      const totalBookings = allBookings.length;
      const totalPages = Math.ceil(totalRecords / l);

      return res.json({
        success: true,
        data,
        page: p,
        limit: l,
        totalRecords,
        totalPages,
        totalSpent,
        totalBookings
      });
    }

    const bookings = await Booking.find({ userId })
      .populate("venueId", "name city")
      .sort({ createdAt: -1 });

    const totalSpent = bookings.reduce((sum, b) => sum + (b.status !== "rejected" ? b.cost : 0), 0);
    const totalBookings = bookings.length;

    res.json({ bookings, totalSpent, totalBookings });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user bookings" });
  }
});

// Get bookings for a specific vendor
router.get("/vendor/:vendorId", async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { page, limit } = req.query;

    if (page || limit) {
      const p = Math.max(1, parseInt(page) || 1);
      const l = Math.max(1, parseInt(limit) || 10);
      const skip = (p - 1) * l;

      const [totalRecords, data] = await Promise.all([
        Booking.countDocuments({ vendorId }),
        Booking.find({ vendorId })
          .populate("userId", "name username email")
          .populate("venueId", "name")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(l)
      ]);

      const totalPages = Math.ceil(totalRecords / l);

      return res.json({
        success: true,
        data,
        page: p,
        limit: l,
        totalRecords,
        totalPages
      });
    }

    const bookings = await Booking.find({ vendorId })
      .populate("userId", "name username email")
      .populate("venueId", "name")
      .sort({ createdAt: -1 });
    res.json({ bookings });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch vendor bookings" });
  }
});

// Update booking status (for vendors)
router.put("/:bookingId/status", async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status } = req.body; // "approved" or "rejected"

    const booking = await Booking.findByIdAndUpdate(bookingId, { status }, { new: true });

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    res.json({ message: "Booking status updated", booking });
  } catch (error) {
    res.status(500).json({ error: "Failed to update booking status" });
  }
});

// Get Booking Stats (Admin - KPI)
router.get("/stats", isAdmin, async (req, res) => {
  try {
    const stats = await Booking.aggregate([
      {
        $facet: {
          financials: [
            { $match: { status: { $nin: ["cancelled", "rejected", "failed"] } } },
            {
              $group: {
                _id: null,
                totalRevenue: { $sum: "$totalBookingAmount" },
                collected: { $sum: "$amountPaid" },
                outstanding: { $sum: "$remainingAmount" }
              }
            }
          ],
          todayCount: [
            {
              $match: {
                createdAt: {
                  $gte: new Date(new Date().setHours(0, 0, 0, 0))
                }
              }
            },
            { $count: "count" }
          ]
        }
      }
    ]);

    const financials = stats[0].financials[0] || { totalRevenue: 0, collected: 0, outstanding: 0 };
    const todayCount = stats[0].todayCount[0]?.count || 0;

    res.json({
      totalRevenue: financials.totalRevenue,
      collected: financials.collected,
      outstanding: financials.outstanding,
      todayCount
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve booking statistics: " + error.message });
  }
});

// Get all bookings (admin route - Paginated)
router.get("/", isAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const skip = (page - 1) * limit;

    const query = { deleted: { $ne: true } };
    if (req.query.status && req.query.status !== 'all') {
      query.status = req.query.status;
    }

    if (req.query.startDate || req.query.endDate) {
      query.createdAt = {};
      if (req.query.startDate) query.createdAt.$gte = new Date(req.query.startDate);
      if (req.query.endDate) query.createdAt.$lte = new Date(req.query.endDate);
    }

    if (search) {
      const regex = new RegExp(search.trim(), "i");
      query.$or = [
        { status: regex }
      ];
    }

    const [bookings, totalRecords] = await Promise.all([
      Booking.find(query)
        .populate([
          { path: "userId", select: "name email phone" },
          { path: "vendorId", select: "fullName email phone businessName businessType" },
          { path: "venueId", select: "name address city state zip country" }
        ])
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      Booking.countDocuments(query)
    ]);

    return res.status(200).json({
      data: bookings,
      page,
      limit,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit)
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch all bookings: " + error.message });
  }
});

// Cancel booking
router.post("/:bookingId/cancel", async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { userId, reason } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    if (booking.userId.toString() !== userId) {
      return res.status(403).json({ error: "Unauthorized: You do not own this booking" });
    }

    const uncancelableStatuses = ["cancelled", "rejected", "failed"];
    if (uncancelableStatuses.includes(booking.status)) {
      return res.status(400).json({ error: "Booking cannot be cancelled" });
    }

    const amountPaid = booking.amountPaid || 0;
    const upfrontPaymentAmount = booking.upfrontPaymentAmount || 0;

    const { refundAmount, tier, daysBeforeEvent } = calculateRefund(
      booking.date,
      amountPaid,
      upfrontPaymentAmount
    );

    booking.status = "cancelled";
    booking.paymentStatus = "cancelled";
    booking.cancellation = {
      cancelledAt: new Date(),
      cancelledBy: "user",
      refundTier: tier,
      refundAmount,
      refundStatus: refundAmount > 0 ? "pending" : "none",
      reason: reason || "",
      daysBeforeEvent
    };

    if (refundAmount > 0) {
      if (!booking.transactions) {
        booking.transactions = [];
      }
      booking.transactions.push({
        amount: refundAmount,
        method: "online",
        loggedBy: "user",
        note: `Refund (${tier} tier) — ${daysBeforeEvent} days before event`,
        paidAt: new Date()
      });
    }

    await booking.save();

    if (refundAmount > 0) {
      try {
        const [userObj, vendorObj] = await Promise.all([
          User.findById(booking.userId).select("name email"),
          Vendor.findById(booking.vendorId).select("fullName email")
        ]);

        await UserVendorPayment.create({
          bookingId: booking._id,
          userId: booking.userId,
          userName: userObj?.name || "",
          userEmail: userObj?.email || "",
          vendorId: booking.vendorId,
          vendorName: vendorObj?.fullName || "",
          vendorEmail: vendorObj?.email || "",
          venueId: booking.venueId,
          amount: refundAmount,
          paymentStatus: "pending",
          description: `Refund (${tier} tier) for cancelled booking on ${booking.date}`
        });
      } catch (err) {
        console.error("Failed to create UserVendorPayment refund entry:", err.message);
      }
    }

    // Create Notification
    const notificationMessage = refundAmount > 0
      ? `Your booking for ${booking.date} has been cancelled. Refund of ₹${refundAmount} (${tier} tier) will be processed within 5-7 business days.`
      : (tier === "none"
          ? `Your booking for ${booking.date} has been cancelled. No refund is applicable as the event was less than 15 days away.`
          : `Your booking for ${booking.date} has been cancelled. No refund is applicable as only the non-refundable upfront deposit was paid.`);

    await Notification.create({
      userId: booking.userId,
      type: "booking_cancelled",
      title: "Booking Cancelled",
      message: notificationMessage,
      relatedBookingId: booking._id,
      relatedVenueId: booking.venueId,
    });

    res.json({
      success: true,
      booking,
      refundAmount,
      refundTier: tier,
      daysBeforeEvent,
      message: "Booking cancelled successfully"
    });
  } catch (error) {
    console.error("Error cancelling booking:", error);
    res.status(500).json({ error: error.message || "Failed to cancel booking" });
  }
});

// Preview refund for a booking
router.get("/:bookingId/refund-preview", async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    if (booking.userId.toString() !== userId) {
      return res.status(403).json({ error: "Unauthorized: You do not own this booking" });
    }

    const cancelableStatuses = ["pending", "approved", "success"];
    const canCancel = cancelableStatuses.includes(booking.status);

    const amountPaid = booking.amountPaid || 0;
    const upfrontPaymentAmount = booking.upfrontPaymentAmount || 0;

    const { refundAmount, tier, daysBeforeEvent } = calculateRefund(
      booking.date,
      amountPaid,
      upfrontPaymentAmount
    );

    res.json({
      refundAmount,
      refundTier: tier,
      daysBeforeEvent,
      amountPaid,
      canCancel
    });
  } catch (error) {
    console.error("Error fetching refund preview:", error);
    res.status(500).json({ error: error.message || "Failed to fetch refund preview" });
  }
});

// Process booking refund manually (by vendor or admin)
router.put("/:bookingId/process-refund", async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { actorId, actorType } = req.body;

    if (!actorId || !actorType) {
      return res.status(400).json({ error: "actorId and actorType are required" });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    if (actorType === "vendor") {
      if (booking.vendorId.toString() !== actorId) {
        return res.status(403).json({ error: "Unauthorized: You do not own this booking" });
      }
    }

    if (booking.status !== "cancelled" || booking.cancellation?.refundStatus !== "pending") {
      return res.status(400).json({ error: "Booking is not cancelled or refund is not pending" });
    }

    booking.cancellation.refundStatus = "processed";
    await booking.save();

    try {
      const refundTxId = "REF-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10).toUpperCase();
      await UserVendorPayment.findOneAndUpdate(
        { bookingId: booking._id, description: { $regex: /refund/i } },
        {
          paymentStatus: "success",
          paymentTimestamp: new Date(),
          transactionId: refundTxId
        }
      );
    } catch (err) {
      console.error("Failed to update UserVendorPayment refund entry:", err.message);
    }

    // Create Notification
    await Notification.create({
      userId: booking.userId,
      type: "general",
      title: "Refund Processed",
      message: `The refund of ₹${booking.cancellation.refundAmount} for your cancelled booking on ${booking.date} has been processed successfully.`,
      relatedBookingId: booking._id,
      relatedVenueId: booking.venueId,
    });

    res.json({ success: true, booking, message: "Refund processed successfully" });
  } catch (error) {
    console.error("Error processing refund:", error);
    res.status(500).json({ error: error.message || "Failed to process refund" });
  }
});

export default router;
