import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
    venueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Venue",
      required: true,
    },
    date: {
      type: String, // Store as YYYY-MM-DD
      required: true,
    },
    cost: {
      type: Number,
      required: true,
    },
    totalBookingAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    upfrontPaymentAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "pending",
    },
    transactionId: {
      type: String,
      default: null,
    },
    paymentTimestamp: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "success", "failed", "cancelled"],
      default: "pending",
    },
    selectedSlot: {
      type: String,
      enum: ["morning", "afternoon", "evening", "fullday"],
      default: "fullday",
    },
    basePrice: {
      type: Number,
    },
    slotMultiplier: {
      type: Number,
    },
    calculatedVenueAmount: {
      type: Number,
    },
    totalAmount: {
      type: Number,
    },
    selectedFoodType: {
      type: String,
      enum: ["veg", "nonveg", "none"],
      default: "none",
    },
    guestCount: {
      type: Number,
      default: 0,
    },
    perPlatePrice: {
      type: Number,
      default: 0,
    },
    foodTotal: {
      type: Number,
      default: 0,
    },
    venueAmount: {
      type: Number,
      default: 0,
    },
    finalAmount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Booking", bookingSchema);
