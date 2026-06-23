import mongoose from "mongoose";
import Booking from "../models/BookingModel.js";
import Venue from "../models/VenueModel.js";
import UserVendorPayment from "../models/UserVendorPaymentModel.js";
import User from "../models/UserModel.js";
import Vendor from "../models/VendorModel.js";

async function run() {
  try {
    await mongoose.connect("mongodb://localhost:27017/Book_My_Venue");
    console.log("Connected to MongoDB");

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
      Booking.countDocuments(),
      UserVendorPayment.aggregate([
        { $match: { paymentStatus: "success" } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]),
      Venue.countDocuments({ status: "approved", deleted: { $ne: true }, deactivated: { $ne: true } }),
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
      Booking.countDocuments({ status: "pending" }),
      Booking.countDocuments({ status: "cancelled" }),
      User.countDocuments({ deleted: { $ne: true } }),
      Vendor.countDocuments({ deleted: { $ne: true } }),
    ]);

    console.log("--- Dashboard Summary Verification Output ---");
    console.log("Total Bookings:", totalBookings);
    console.log("Net Revenue:", revenueResult[0]?.total || 0);
    console.log("Active Venues:", activeVenues);
    console.log("Top Venues by Revenue:", topVenuesRaw);
    console.log("Pending Bookings:", pendingBookings);
    console.log("Cancelled Bookings:", cancelledBookings);
    console.log("Total Users:", totalUsers);
    console.log("Total Vendors:", totalVendors);
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
