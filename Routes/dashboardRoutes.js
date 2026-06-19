import express from "express";
import mongoose from "mongoose";
import Booking from "../models/BookingModel.js";
import Venue from "../models/VenueModel.js";
import UserVendorPayment from "../models/UserVendorPaymentModel.js";
import { isAdmin } from "../middleare/isAdmin.js";

const router = express.Router();

// Simple in-memory cache
let dashboardCache = null;
let cacheTimestamp = null;
const CACHE_TTL_MS = 60 * 1000;

router.get("/summary", isAdmin, async (req, res) => {
  try {
    if (dashboardCache && cacheTimestamp && (Date.now() - cacheTimestamp) < CACHE_TTL_MS) {
      return res.json({ ...dashboardCache, cached: true });
    }

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Run all aggregations in parallel to keep it fast
    const [
      totalBookings,
      revenueResult,
      activeVenues,
      topVendorsRaw,
      totalUsers,
      totalVendors,
      bookingsThisWeek,
      bookingsLastWeek,
      topSubscriptionsRaw,
      pendingVenues,
      pendingVendors,
      failedBookings,
      graceSubscriptions,
      cityVenues,
      cityBookings,
      allBookings,
      cancelledBookingsCount
    ] = await Promise.all([
      Booking.countDocuments(),
      
      UserVendorPayment.aggregate([
        { $match: { paymentStatus: "success" } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]),
      
      Venue.countDocuments({ status: "approved", deleted: { $ne: true }, deactivated: { $ne: true } }),
      
      // Top 5 Vendors by revenue
      UserVendorPayment.aggregate([
        { $match: { paymentStatus: "success" } },
        { $group: { _id: "$vendorId", revenue: { $sum: "$amount" }, count: { $sum: 1 } } },
        { $sort: { revenue: -1 } },
        { $limit: 5 },
        { $lookup: { from: "vendors", localField: "_id", foreignField: "_id", as: "vendor" } },
        { $unwind: { path: "$vendor", preserveNullAndEmptyArrays: true } },
        { $project: { name: { $ifNull: ["$vendor.businessName", "$vendor.fullName"] }, email: "$vendor.email", count: 1, revenue: 1, _id: 0 } }
      ]),

      mongoose.model("User").countDocuments({ deleted: { $ne: true } }),
      mongoose.model("Vendor").countDocuments({ deleted: { $ne: true } }),

      Booking.countDocuments({ createdAt: { $gte: oneWeekAgo, $lte: now } }),
      Booking.countDocuments({ createdAt: { $gte: twoWeeksAgo, $lt: oneWeekAgo } }),

      mongoose.model("Subscription").aggregate([
        { $match: { status: { $in: ["active", "grace"] } } },
        { $group: { _id: "$planSnapshot.name", count: { $sum: 1 }, totalEarned: { $sum: "$planSnapshot.price" } } },
        { $project: { name: "$_id", count: 1, totalEarned: 1, _id: 0 } },
        { $sort: { totalEarned: -1 } }
      ]),

      Venue.find({ status: "pending" }).select("_id name capacity pricePerDay createdAt"),
      mongoose.model("Vendor").find({ status: "pending" }).select("_id businessName fullName createdAt"),
      Booking.find({ paymentStatus: "failed" }).populate("venueId", "name").populate("vendorId", "businessName fullName").select("_id totalBookingAmount cost createdAt"),
      mongoose.model("Subscription").find({ status: "grace" }).select("_id vendorId planSnapshot graceEndDate endDate"),
      
      Venue.aggregate([ { $group: { _id: { $toLower: "$city" }, venuesCount: { $sum: 1 } } } ]),
      
      Booking.aggregate([
        { $lookup: { from: "venues", localField: "venueId", foreignField: "_id", as: "venue" } },
        { $unwind: { path: "$venue", preserveNullAndEmptyArrays: true } },
        { $group: { _id: { $toLower: "$venue.city" }, bookingsCount: { $sum: 1 }, revenue: { $sum: { $cond: [ { $eq: ["$paymentStatus", "success"] }, "$totalBookingAmount", 0 ] } } } }
      ]),

      Booking.find({}, "date createdAt"),
      
      Booking.countDocuments({ status: "cancelled" })
    ]);

    // Data Processing 
    const changePercent = bookingsLastWeek === 0 
      ? (bookingsThisWeek > 0 ? 100 : 0) 
      : Math.round(((bookingsThisWeek - bookingsLastWeek) / bookingsLastWeek) * 100);

    const pendingApprovals = [
      ...pendingVenues.map(v => ({ id: v._id, type: "venue", name: v.name, subText: `Capacity: ${v.capacity} | Price: ₹${v.pricePerDay}`, date: v.createdAt })),
      ...pendingVendors.map(v => ({ id: v._id, type: "vendor", name: v.businessName || v.fullName, subText: "Awaiting Verification", date: v.createdAt }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    const paymentIssues = [
      ...failedBookings.map(b => ({ id: b._id, type: "booking", description: `Booking payment failed for ${b.venueId?.name || 'Venue'}`, amount: b.totalBookingAmount || b.cost || 0, vendor: b.vendorId?.businessName || b.vendorId?.fullName || 'Vendor', date: b.createdAt })),
      ...graceSubscriptions.map(s => ({ id: s._id, type: "subscription", description: `Grace period for Vendor: ${s.vendorId}`, amount: s.planSnapshot?.price || 0, vendor: `Plan: ${s.planSnapshot?.name || 'N/A'}`, date: s.graceEndDate || s.endDate }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    const cityMap = new Map();
    cityVenues.forEach(cv => {
      if (cv._id) cityMap.set(cv._id, { cityName: cv._id.charAt(0).toUpperCase() + cv._id.slice(1), venuesCount: cv.venuesCount, bookingsCount: 0, revenue: 0 });
    });

    cityBookings.forEach(cb => {
      if (!cb._id) return;
      const current = cityMap.get(cb._id) || { cityName: cb._id.charAt(0).toUpperCase() + cb._id.slice(1), venuesCount: 0, bookingsCount: 0, revenue: 0 };
      current.bookingsCount = cb.bookingsCount;
      current.revenue = cb.revenue;
      cityMap.set(cb._id, current);
    });

    const cityGrowth = Array.from(cityMap.values()).map(c => ({ ...c, totalScore: c.bookingsCount * 2 + c.venuesCount })).sort((a, b) => b.totalScore - a.totalScore).slice(0, 5);

    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    const peakBookingHours = { morning: 0, afternoon: 0, evening: 0, night: 0 };

    allBookings.forEach(b => {
      const d = new Date(b.date || b.createdAt);
      if (!isNaN(d.getTime())) {
        dayCounts[d.getDay()]++;
        const hr = d.getHours();
        if (hr >= 6 && hr < 12) peakBookingHours.morning++;
        else if (hr >= 12 && hr < 17) peakBookingHours.afternoon++;
        else if (hr >= 17 && hr < 21) peakBookingHours.evening++;
        else peakBookingHours.night++;
      }
    });

    const summary = {
      totalBookings,
      netRevenue: revenueResult[0]?.total || 0,
      activeVenues,
      pendingApprovalsCount: pendingApprovals.length,
      cancelledBookingsCount,
      totalUsers,
      totalVendors,
      bookingVelocity: { thisWeek: bookingsThisWeek, lastWeek: bookingsLastWeek, changePercent, isIncreasing: bookingsThisWeek >= bookingsLastWeek },
      topVendors: topVendorsRaw,
      topSubscriptions: topSubscriptionsRaw,
      pendingApprovals,
      paymentIssues,
      cityGrowth,
      mostBookedDays: dayCounts,
      peakBookingHours,
      generatedAt: new Date().toISOString()
    };

    dashboardCache = summary;
    cacheTimestamp = Date.now();
    res.json(summary);
  } catch (error) {
    console.error("Dashboard summary error:", error);
    res.status(500).json({ error: "Failed to generate dashboard summary" });
  }
});

export default router;
