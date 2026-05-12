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
  },
  { timestamps: true }
);

export default mongoose.model("Booking", bookingSchema);
