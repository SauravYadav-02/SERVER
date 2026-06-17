import mongoose from "mongoose";
import UserModel from "./models/UserModel.js";
import VendorModel from "./models/VendorModel.js";
import VenueModel from "./models/VenueModel.js";
import AdminModel from "./models/AdminModel.js";
import BookingModel from "./models/BookingModel.js";
import RatingFeedbackModel from "./models/RatingFeedbackModel.js";
import ComplaintModel from "./models/ComplaintModel.js";
import ReportModel from "./models/ReportModel.js";

const fixPath = (filePath = "") => filePath.replace(/\\/g, "/");

const buildVenueResponse = (venue, req) => {
    const venueObj = venue.toObject ? venue.toObject() : venue;
    return {
        ...venueObj,
        mediaFiles: venueObj.mediaFiles?.map((file) =>
            file ? `${req.protocol}://${req.get("host")}/${fixPath(file)}` : null
        ),
    };
};

async function main() {
  try {
    await mongoose.connect("mongodb://localhost:27017/Book_My_Venue");
    console.log("Connected to MongoDB successfully.");

    // 1. Test Bookings query
    console.log("\nTesting Bookings query...");
    try {
      const bookings = await BookingModel.find()
        .populate("userId", "name email phone")
        .populate("vendorId", "fullName email phone businessName businessType")
        .populate("venueId", "name address city state zip country")
        .lean();
      console.log("Bookings query succeeded, found:", bookings.length);
    } catch (e) {
      console.error("Bookings query FAILED:", e);
    }

    // 2. Test Venues query & mapping
    console.log("\nTesting Venues query & mapping...");
    try {
      const venues = await VenueModel.find()
        .populate("vendorId", "fullName email phone businessName businessType address city state zip pincode status")
        .lean();
      console.log("Venues found:", venues.length);
      const mapped = venues.map((v) => buildVenueResponse(v, { protocol: "http", get: () => "localhost:3000" }));
      console.log("Venues mapping succeeded.");
    } catch (e) {
      console.error("Venues mapping FAILED:", e);
    }

    // 3. Test Reviews query & mapping
    console.log("\nTesting Reviews query & mapping...");
    try {
      const reviews = await RatingFeedbackModel.find()
        .populate("userId", "name email")
        .populate("venueId", "name")
        .lean();
      console.log("Reviews found:", reviews.length);
      const mapped = reviews.map(r => ({
            ...r,
            venueId: r.venueId?._id,
            venueName: r.venueId?.name
      }));
      console.log("Reviews mapping succeeded.");
    } catch (e) {
      console.error("Reviews mapping FAILED:", e);
    }

    // 4. Test Complaints query
    console.log("\nTesting Complaints query...");
    try {
      const complaints = await ComplaintModel.find()
        .populate("user", "name email phone")
        .populate("vendor", "fullName businessName email")
        .populate("venue", "name city")
        .lean();
      console.log("Complaints succeeded, found:", complaints.length);
    } catch (e) {
      console.error("Complaints query FAILED:", e);
    }

    // 5. Test Reports query
    console.log("\nTesting Reports query...");
    try {
      const reports = await ReportModel.find()
        .populate("user", "name email phone")
        .populate("venue", "name city vendorId")
        .lean();
      console.log("Reports succeeded, found:", reports.length);
    } catch (e) {
      console.error("Reports query FAILED:", e);
    }

  } catch (err) {
    console.error("Connection failed:", err);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB.");
  }
}

main();
