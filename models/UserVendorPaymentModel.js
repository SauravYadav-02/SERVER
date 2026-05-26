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
    userName: { type: String },
    userEmail: { type: String },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
    vendorName: { type: String },
    vendorEmail: { type: String },
    venueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Venue",
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    adminName: { type: String, default: "" },
    amount: {
      type: Number,
      required: true,
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
userVendorPaymentSchema.index({ transactionId: 1 });
userVendorPaymentSchema.index({ vendorId: 1, paymentTimestamp: -1 });
userVendorPaymentSchema.index({ userId: 1, paymentTimestamp: -1 });

export default mongoose.model("UserVendorPayment", userVendorPaymentSchema);
