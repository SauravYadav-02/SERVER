import mongoose from "mongoose";
import Booking from "../models/BookingModel.js";
import Venue from "../models/VenueModel.js";
import UserVendorPayment from "../models/UserVendorPaymentModel.js";
import User from "../models/UserModel.js";
import Vendor from "../models/VendorModel.js";
import Subscription from "../models/SubscriptionModel.js";
import PaymentHistory from "../models/PaymentHistoryModel.js";

async function run() {
  try {
    await mongoose.connect("mongodb://localhost:27017/Book_My_Venue");
    console.log("Connected to MongoDB");

    // Run parallel basic counts/aggregations
    const [
      totalBookings,
      revenueResult,
      activeVenues,
      totalUsers,
      totalVendors,
      pendingVenuesCount,
      pendingVendorsCount,
      cancelledBookingsCount,
    ] = await Promise.all([
      Booking.countDocuments(),
      UserVendorPayment.aggregate([
        { $match: { paymentStatus: "success" } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]),
      Venue.countDocuments({ status: "approved", deleted: { $ne: true }, deactivated: { $ne: true } }),
      User.countDocuments({ deleted: { $ne: true } }),
      Vendor.countDocuments({ deleted: { $ne: true } }),
      Venue.countDocuments({ status: "pending" }),
      Vendor.countDocuments({ status: "pending", deleted: { $ne: true } }),
      Booking.countDocuments({ status: "cancelled" })
    ]);

    const pendingApprovalsCount = pendingVenuesCount + pendingVendorsCount;

    // Booking Growth Velocity
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [thisWeekBookings, lastWeekBookings] = await Promise.all([
      Booking.countDocuments({ createdAt: { $gte: sevenDaysAgo, $lte: now } }),
      Booking.countDocuments({ createdAt: { $gte: fourteenDaysAgo, $lt: sevenDaysAgo } })
    ]);

    const changePercent = lastWeekBookings === 0
      ? (thisWeekBookings > 0 ? 100 : 0)
      : Math.round(((thisWeekBookings - lastWeekBookings) / lastWeekBookings) * 100);

    const bookingVelocity = {
      thisWeek: thisWeekBookings,
      lastWeek: lastWeekBookings,
      changePercent,
      isIncreasing: thisWeekBookings >= lastWeekBookings
    };

    // Top Performing Vendors
    const topVendorsRaw = await UserVendorPayment.aggregate([
      { $match: { paymentStatus: "success" } },
      {
        $group: {
          _id: "$vendorId",
          revenue: { $sum: "$amount" },
          bookingIds: { $addToSet: "$bookingId" }
        }
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "vendors",
          localField: "_id",
          foreignField: "_id",
          as: "vendor"
        }
      },
      { $unwind: "$vendor" },
      {
        $project: {
          name: { $ifNull: ["$vendor.businessName", "$vendor.fullName"] },
          email: "$vendor.email",
          count: { $size: "$bookingIds" },
          revenue: 1,
          _id: 0
        }
      }
    ]);

    // Subscription Revenue Model
    const allSubs = await Subscription.find().lean();
    const subIdToPlanName = {};
    const planNameToActiveCount = {};
    for (const sub of allSubs) {
      const planName = sub.planSnapshot?.name || sub.planId?.name || "Unknown Plan";
      subIdToPlanName[sub._id.toString()] = planName;
      if (sub.status === "ACTIVE" || sub.status === "active") {
        planNameToActiveCount[planName] = (planNameToActiveCount[planName] || 0) + 1;
      }
    }

    const subPayments = await PaymentHistory.find({
      type: "subscription",
      paymentStatus: "success"
    }).lean();

    const planNameToRevenue = {};
    for (const pay of subPayments) {
      const subId = pay.relatedId?.toString();
      const planName = subIdToPlanName[subId] || "Unknown Plan";
      planNameToRevenue[planName] = (planNameToRevenue[planName] || 0) + pay.amount;
    }

    const allPlanNames = new Set([
      ...Object.keys(planNameToActiveCount),
      ...Object.keys(planNameToRevenue)
    ]);
    const topSubscriptions = Array.from(allPlanNames).map(name => ({
      name,
      count: planNameToActiveCount[name] || 0,
      totalEarned: planNameToRevenue[name] || 0
    })).sort((a, b) => b.totalEarned - a.totalEarned);

    // Pending Approvals Queue
    const [pendingVenues, pendingVendors] = await Promise.all([
      Venue.find({ status: "pending" }).lean(),
      Vendor.find({ status: "pending", deleted: { $ne: true } }).lean()
    ]);

    const pendingApprovals = [
      ...pendingVenues.map(venue => ({
        id: venue._id.toString(),
        type: "venue",
        name: venue.name,
        subText: `Capacity: ${venue.capacity || "N/A"}`,
        date: venue.createdAt
      })),
      ...pendingVendors.map(vendor => ({
        id: vendor._id.toString(),
        type: "vendor",
        name: vendor.businessName || vendor.fullName || "Unknown Vendor",
        subText: `Email: ${vendor.email || "N/A"}`,
        date: vendor.createdAt
      }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Payment Issues Queue
    const [failedBookings, graceSubscriptions] = await Promise.all([
      Booking.find({ paymentStatus: "failed" })
        .populate("vendorId")
        .populate("userId")
        .lean(),
      Subscription.find({ status: "grace" })
        .populate("vendorId")
        .lean()
    ]);

    const paymentIssues = [
      ...failedBookings.map(b => ({
        id: b._id.toString(),
        type: "booking",
        description: `Booking payment failed - User: ${b.userId?.name || "N/A"}`,
        amount: b.finalAmount || b.totalBookingAmount || b.cost || 0,
        vendor: b.vendorId?.businessName || b.vendorId?.fullName || "N/A",
        date: b.createdAt
      })),
      ...graceSubscriptions.map(s => ({
        id: s._id.toString(),
        type: "subscription",
        description: `Subscription in grace period - Plan: ${s.planSnapshot?.name || "N/A"}`,
        amount: s.planSnapshot?.price || 0,
        vendor: s.vendorId?.businessName || s.vendorId?.fullName || "N/A",
        date: s.createdAt
      }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Top Growing Cities
    const [venuesForCities, bookingsForCities] = await Promise.all([
      Venue.find({ deleted: { $ne: true } }).select("city").lean(),
      Booking.find({ status: { $in: ["approved", "success"] } })
        .populate("venueId", "city")
        .lean()
    ]);

    const cityData = {};
    for (const v of venuesForCities) {
      const city = (v.city || "Other").trim();
      if (!cityData[city]) {
        cityData[city] = { cityName: city, venuesCount: 0, bookingsCount: 0, revenue: 0 };
      }
      cityData[city].venuesCount += 1;
    }

    for (const b of bookingsForCities) {
      if (b.venueId) {
        const city = (b.venueId.city || "Other").trim();
        if (!cityData[city]) {
          cityData[city] = { cityName: city, venuesCount: 0, bookingsCount: 0, revenue: 0 };
        }
        cityData[city].bookingsCount += 1;
        cityData[city].revenue += (b.amountPaid || b.finalAmount || b.cost || 0);
      }
    }

    const cityGrowth = Object.values(cityData).map(c => {
      const totalScore = c.bookingsCount * 2 + c.venuesCount;
      return {
        ...c,
        totalScore
      };
    }).sort((a, b) => b.totalScore - a.totalScore);

    // Most Booked Days & Peak Booking Hours
    const mostBookedDays = [0, 0, 0, 0, 0, 0, 0];
    const peakBookingHours = { morning: 0, afternoon: 0, evening: 0, night: 0 };

    const allBookingsForTimeStats = await Booking.find().select("createdAt").lean();
    for (const b of allBookingsForTimeStats) {
      if (b.createdAt) {
        const dateObj = new Date(b.createdAt);
        const day = dateObj.getDay();
        mostBookedDays[day] += 1;

        const hour = dateObj.getHours();
        if (hour >= 6 && hour < 12) {
          peakBookingHours.morning += 1;
        } else if (hour >= 12 && hour < 17) {
          peakBookingHours.afternoon += 1;
        } else if (hour >= 17 && hour < 21) {
          peakBookingHours.evening += 1;
        } else {
          peakBookingHours.night += 1;
        }
      }
    }

    const summary = {
      totalBookings,
      netRevenue: revenueResult[0]?.total || 0,
      activeVenues,
      totalUsers,
      totalVendors,
      pendingApprovalsCount,
      cancelledBookingsCount,
      bookingVelocity,
      topVendors: topVendorsRaw,
      topSubscriptions,
      pendingApprovals,
      paymentIssues,
      cityGrowth,
      mostBookedDays,
      peakBookingHours,
      generatedAt: new Date().toISOString(),
    };

    console.log("--- Dashboard Summary Verification Output ---");
    console.log(JSON.stringify(summary, null, 2));
    console.log("---------------------------------------------");
    console.log("Verification Succeeded!");
  } catch (error) {
    console.error("Aggregation query verification failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

run();
