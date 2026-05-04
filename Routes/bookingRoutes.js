import express from "express";
import Booking from "../models/BookingModel.js";
import Venue from "../models/VenueModel.js";

const router = express.Router();

// Get all booked dates for a specific venue
router.get("/venue/:venueId/booked-dates", async (req, res) => {
  try {
    const { venueId } = req.params;
    const bookings = await Booking.find({ venueId, status: { $ne: "rejected" } });
    const bookedDates = bookings.map((b) => b.date);
    res.json({ bookedDates });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch booked dates" });
  }
});

// Create a new booking
router.post("/", async (req, res) => {
  try {
    const { userId, vendorId, venueId, date, cost } = req.body;

    // Check if the venue is already booked for this date
    const existingBooking = await Booking.findOne({
      venueId,
      date,
      status: { $ne: "rejected" },
    });

    if (existingBooking) {
      return res.status(400).json({ error: "Venue is already booked on this date" });
    }

    const booking = new Booking({
      userId,
      vendorId,
      venueId,
      date,
      cost,
      status: "approved", // Bookings are approved by default
    });

    await booking.save();
    res.status(201).json({ message: "Booking created successfully", booking });
  } catch (error) {
    res.status(500).json({ error: "Failed to create booking" });
  }
});

// Get booking history for a specific user
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const bookings = await Booking.find({ userId })
      .populate("venueId", "name location")
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

// Get all bookings (admin route)
router.get("/", async (req, res) => {
  try {
    const bookings = await Booking.find({})
      .populate("userId", "name email phone")
      .populate("vendorId", "fullName email phone businessName businessType")
      .populate("venueId", "name address city state zip country")
      .sort({ createdAt: -1 });
    res.json({ bookings });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch all bookings" });
  }
});

export default router;
