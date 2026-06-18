import express from "express";
import mongoose from "mongoose";
import Booking from "../models/BookingModel.js";
import Venue from "../models/VenueModel.js";
import UserVendorPayment from "../models/UserVendorPaymentModel.js";
import { isAdmin } from "../middleare/isAdmin.js";

const router = express.Router();

// Simple in-memory cache (no Redis)
let dashboardCache = null;
let cacheTimestamp = null;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

router.get("/summary", isAdmin, async (req, res) => {
  try {
    // Check cache
    if (dashboardCache && cacheTimestamp && (Date.now() - cacheTimestamp) < CACHE_TTL_MS) {
      return res.json({ ...dashboardCache, cached: true });
    }

    // Run all aggregations in parallel
    const [
      totalBookings,
      revenueResult,
      activeVenues,
      topVenuesRaw,
      pendingBookings,
      cancelledBookings,
      totalUsers,
      totalVendors,
    ] = await Promise.all([
      // 1. Total bookings
      Booking.countDocuments(),

      // 2. Net revenue — sum of all successful payments
      UserVendorPayment.aggregate([
        { $match: { paymentStatus: "success" } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]),

      // 3. Active venues
      Venue.countDocuments({ status: "approved", deleted: { $ne: true }, deactivated: { $ne: true } }),

      // 4. Top 5 venues by revenue
      UserVendorPayment.aggregate([
        { $match: { paymentStatus: "success" } },
        { $group: { _id: "$venueId", revenue: { $sum: "$amount" } } },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: "venues",
            localField: "_id",
            foreignField: "_id",
            as: "venue"
          }
        },
        { $unwind: "$venue" },
        { $project: { name: "$venue.name", revenue: 1, _id: 0 } }
      ]),

      // 5. Pending bookings count
      Booking.countDocuments({ status: "pending" }),

      // 6. Cancelled bookings count
      Booking.countDocuments({ status: "cancelled" }),

      // 7. Total users
      mongoose.model("User").countDocuments({ deleted: { $ne: true } }),

      // 8. Total vendors
      mongoose.model("Vendor").countDocuments({ deleted: { $ne: true } }),
    ]);

    const summary = {
      totalBookings,
      netRevenue: revenueResult[0]?.total || 0,
      activeVenues,
      topVenues: topVenuesRaw,
      pendingBookings,
      cancelledBookings,
      totalUsers,
      totalVendors,
      generatedAt: new Date().toISOString(),
    };

    // Save to cache
    dashboardCache = summary;
    cacheTimestamp = Date.now();

    res.json(summary);
  } catch (error) {
    console.error("Dashboard summary error:", error);
    res.status(500).json({ error: "Failed to generate dashboard summary" });
  }
});

export default router;
