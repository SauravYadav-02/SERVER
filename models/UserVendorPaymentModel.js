import mongoose from "mongoose";

const userVendorPaymentSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
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
    amount: {
      type: Number,
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "pending",
    },
    transactionId: {
      type: String,
      required: true,
    },
    paymentTimestamp: {
      type: Date,
      default: Date.now,
    },
    description: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
    collection: "uservendorpayments",
  }
);

// Indexes
userVendorPaymentSchema.index({ userId: 1 });
userVendorPaymentSchema.index({ vendorId: 1 });
userVendorPaymentSchema.index({ bookingId: 1 });
userVendorPaymentSchema.index({ transactionId: 1 }, { unique: true });

export default mongoose.model("UserVendorPayment", userVendorPaymentSchema);
