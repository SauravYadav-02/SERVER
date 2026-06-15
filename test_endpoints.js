import mongoose from "mongoose";
import {
  vendorLogPayment,
  userPayOnline,
  getVendorBookingTransactions,
  getUserBookingTransactions,
} from "./controllers/remainingPaymentController.js";
import { createBookingWithUpfrontPayment } from "./services/mockPaymentService.js";
import Booking from "./models/BookingModel.js";
import User from "./models/UserModel.js";
import Vendor from "./models/VendorModel.js";
import Venue from "./models/VenueModel.js";

async function run() {
  try {
    await mongoose.connect("mongodb://localhost:27017/Book_My_Venue");
    console.log("Connected to DB.");

    const user = await User.findOne({ deleted: false });
    const venue = await Venue.findOne({});
    const vendor = await Vendor.findById(venue.vendorId);

    // Create a new booking
    const payload = {
      userId: user._id.toString(),
      vendorId: vendor._id.toString(),
      venueId: venue._id.toString(),
      date: "2026-08-15",
      bookingAmount: 100000,
      selectedSlot: "fullday",
      guestCount: 50,
    };

    console.log("Creating new test booking...");
    const booking = await createBookingWithUpfrontPayment(payload);
    console.log("Booking created with remainingAmount:", booking.remainingAmount);

    // Mock Response object
    const res = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        console.log(`Response [${this.statusCode || 200}]:`, data);
        return this;
      }
    };

    // Test vendorLogPayment (partial amount)
    console.log("\n--- Testing vendorLogPayment (partial amount: 20000) ---");
    const reqLog = {
      params: { bookingId: booking._id.toString() },
      body: { amount: 20000, method: "cash", note: "Vendor logged partial cash" },
      vendorId: vendor._id.toString()
    };
    await vendorLogPayment(reqLog, res);

    // Test getVendorBookingTransactions
    console.log("\n--- Testing getVendorBookingTransactions ---");
    const reqGetVendorTx = {
      params: { bookingId: booking._id.toString() },
      vendorId: vendor._id.toString()
    };
    await getVendorBookingTransactions(reqGetVendorTx, res);

    // Test userPayOnline (for the rest of the remaining amount)
    console.log("\n--- Testing userPayOnline (pay remaining) ---");
    const reqPayOnline = {
      params: { bookingId: booking._id.toString() },
      userId: user._id.toString()
    };
    await userPayOnline(reqPayOnline, res);

    // Clean up test booking
    await Booking.deleteOne({ _id: booking._id });
    console.log("\nTest booking cleaned up.");

  } catch (err) {
    console.error("Test execution failed:", err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
