import mongoose from "mongoose";
import Venue from "../models/VenueModel.js";
import Booking from "../models/BookingModel.js";
import RatingFeedback from "../models/RatingFeedbackModel.js";
import Complaint from "../models/ComplaintModel.js";
import Report from "../models/ReportModel.js";
import Vendor from "../models/VendorModel.js";
import User from "../models/UserModel.js";

async function checkIntegrity() {
  try {
    await mongoose.connect("mongodb://localhost:27017/Book_My_Venue");
    console.log("Connected to MongoDB successfully.\n");

    // 1. Check Venues
    console.log("Checking Venues...");
    const venues = await Venue.find();
    for (const venue of venues) {
      if (venue.mediaFiles && !Array.isArray(venue.mediaFiles)) {
        console.error(`[INVALID TYPE] Venue ${venue._id} (${venue.name}) has non-array mediaFiles:`, venue.mediaFiles);
      }
      if (venue.vendorId) {
        const vendorExists = await Vendor.exists({ _id: venue.vendorId });
        if (!vendorExists) {
          console.warn(`[BROKEN REF] Venue ${venue._id} references non-existent vendor: ${venue.vendorId}`);
        }
      }
    }

    // 2. Check Bookings
    console.log("Checking Bookings...");
    const bookings = await Booking.find();
    for (const b of bookings) {
      if (b.userId) {
        const exists = await User.exists({ _id: b.userId });
        if (!exists) {
          console.warn(`[BROKEN REF] Booking ${b._id} references non-existent user: ${b.userId}`);
        }
      }
      if (b.vendorId) {
        const exists = await Vendor.exists({ _id: b.vendorId });
        if (!exists) {
          console.warn(`[BROKEN REF] Booking ${b._id} references non-existent vendor: ${b.vendorId}`);
        }
      }
      if (b.venueId) {
        const exists = await Venue.exists({ _id: b.venueId });
        if (!exists) {
          console.warn(`[BROKEN REF] Booking ${b._id} references non-existent venue: ${b.venueId}`);
        }
      }
    }

    // 3. Check Reviews
    console.log("Checking Reviews...");
    const reviews = await RatingFeedback.find();
    for (const r of reviews) {
      if (r.userId) {
        const exists = await User.exists({ _id: r.userId });
        if (!exists) {
          console.warn(`[BROKEN REF] Review ${r._id} references non-existent user: ${r.userId}`);
        }
      }
      if (r.venueId) {
        const exists = await Venue.exists({ _id: r.venueId });
        if (!exists) {
          console.warn(`[BROKEN REF] Review ${r._id} references non-existent venue: ${r.venueId}`);
        }
      }
    }

    // 4. Check Complaints
    console.log("Checking Complaints...");
    const complaints = await Complaint.find();
    for (const c of complaints) {
      if (c.user) {
        const exists = await User.exists({ _id: c.user });
        if (!exists) {
          console.warn(`[BROKEN REF] Complaint ${c._id} references non-existent user: ${c.user}`);
        }
      }
      if (c.vendor) {
        const exists = await Vendor.exists({ _id: c.vendor });
        if (!exists) {
          console.warn(`[BROKEN REF] Complaint ${c._id} references non-existent vendor: ${c.vendor}`);
        }
      }
      if (c.venue) {
        const exists = await Venue.exists({ _id: c.venue });
        if (!exists) {
          console.warn(`[BROKEN REF] Complaint ${c._id} references non-existent venue: ${c.venue}`);
        }
      }
    }

    // 5. Check Reports
    console.log("Checking Reports...");
    const reports = await Report.find();
    for (const r of reports) {
      if (r.user) {
        const exists = await User.exists({ _id: r.user });
        if (!exists) {
          console.warn(`[BROKEN REF] Report ${r._id} references non-existent user: ${r.user}`);
        }
      }
      if (r.venue) {
        const exists = await Venue.exists({ _id: r.venue });
        if (!exists) {
          console.warn(`[BROKEN REF] Report ${r._id} references non-existent venue: ${r.venue}`);
        }
      }
    }

    console.log("\nIntegrity check complete.");
  } catch (err) {
    console.error("Integrity check failed to run:", err);
  } finally {
    await mongoose.disconnect();
  }
}

checkIntegrity();
