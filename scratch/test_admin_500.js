import mongoose from "mongoose";

// We import the models to query real IDs from the database
import Admin from "../models/AdminModel.js";
import Booking from "../models/BookingModel.js";
import Venue from "../models/VenueModel.js";
import Complaint from "../models/ComplaintModel.js";
import Report from "../models/ReportModel.js";
import RatingFeedback from "../models/RatingFeedbackModel.js";
import Vendor from "../models/VendorModel.js";
import User from "../models/UserModel.js";

const BASE_URL = "http://localhost:3000";

async function runTests() {
  try {
    await mongoose.connect("mongodb://localhost:27017/Book_My_Venue");
    console.log("Connected to MongoDB for retrieving IDs.");

    // Retrieve real documents
    const admin = await Admin.findOne();
    const adminId = admin ? admin._id.toString() : "admin-mock-id";
    console.log(`Using adminId: ${adminId}`);

    const booking = await Booking.findOne();
    const bookingId = booking ? booking._id.toString() : null;
    console.log(`Using bookingId: ${bookingId}`);

    const venue = await Venue.findOne();
    const venueId = venue ? venue._id.toString() : null;
    console.log(`Using venueId: ${venueId}`);

    const complaint = await Complaint.findOne();
    const complaintId = complaint ? complaint._id.toString() : null;
    console.log(`Using complaintId: ${complaintId}`);

    const report = await Report.findOne();
    const reportId = report ? report._id.toString() : null;
    console.log(`Using reportId: ${reportId}`);

    const review = await RatingFeedback.findOne();
    const reviewId = review ? review._id.toString() : null;
    console.log(`Using reviewId: ${reviewId}`);

    const vendor = await Vendor.findOne();
    const vendorId = vendor ? vendor._id.toString() : null;

    const user = await User.findOne();
    const userId = user ? user._id.toString() : null;

    await mongoose.disconnect();

    const endpoints = [
      { name: "GET admin/venues", url: `${BASE_URL}/admin/venues`, method: "GET" },
      { name: "GET admin/reviews", url: `${BASE_URL}/admin/reviews`, method: "GET" },
      { name: "GET bookings/", url: `${BASE_URL}/bookings/`, method: "GET" },
      { name: "GET complaints/", url: `${BASE_URL}/complaints/`, method: "GET" },
      { name: "GET reports/", url: `${BASE_URL}/reports/`, method: "GET" },
      { name: "GET api/admin/plans", url: `${BASE_URL}/api/admin/plans`, method: "GET" },
      { name: "GET plans/all", url: `${BASE_URL}/plans/all`, method: "GET" },
      { name: "GET subscription/all", url: `${BASE_URL}/subscription/all`, method: "GET" },
      { name: "GET subscription/expiring-soon", url: `${BASE_URL}/subscription/expiring-soon`, method: "GET" },
      { name: "GET payments/", url: `${BASE_URL}/payments/`, method: "GET" },
      { name: "GET payments/admin-vendor", url: `${BASE_URL}/payments/admin-vendor`, method: "GET" },
      { name: "GET payments/user-vendor", url: `${BASE_URL}/payments/user-vendor`, method: "GET" },
      { name: "GET users/", url: `${BASE_URL}/users/`, method: "GET" },
      { name: "GET vendors/", url: `${BASE_URL}/vendors/`, method: "GET" },
    ];

    if (venueId) {
      endpoints.push({ name: "GET admin/venues/:id", url: `${BASE_URL}/admin/venues/${venueId}`, method: "GET" });
    }
    if (complaintId) {
      endpoints.push({ name: "GET complaints/:id", url: `${BASE_URL}/complaints/${complaintId}`, method: "GET" });
      endpoints.push({ name: "GET complaints/:id/messages", url: `${BASE_URL}/complaints/${complaintId}/messages`, method: "GET" });
    }
    if (reportId) {
      endpoints.push({ name: "GET reports/:id", url: `${BASE_URL}/reports/${reportId}`, method: "GET" });
    }
    if (vendorId) {
      endpoints.push({ name: "GET subscription/admin/vendor/:vendorId", url: `${BASE_URL}/subscription/admin/vendor/${vendorId}`, method: "GET" });
    }

    console.log(`\nTesting ${endpoints.length} admin endpoints...\n`);

    for (const ep of endpoints) {
      try {
        const res = await fetch(ep.url, {
          method: ep.method,
          headers: { adminid: adminId },
        });
        
        const bodyText = await res.text();
        if (res.status === 500) {
          console.error(`\x1b[31m[500 ERROR]\x1b[0m ${ep.name} returned 500!`);
          console.error(`Response:`, bodyText);
        } else {
          console.log(`[${res.status}] ${ep.name}`);
        }
      } catch (err) {
        console.error(`[ERR] ${ep.name}: Request Error: ${err.message}`);
      }
    }

  } catch (err) {
    console.error("Test execution failed:", err);
  }
}

runTests();
