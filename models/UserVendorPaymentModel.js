import mongoose from "mongoose";

const userVendorPaymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userName: { type: String, required: true },
    userEmail: { type: String, required: true },
    
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
    vendorName: { type: String, required: true },
    vendorEmail: { type: String, required: true },
    
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    adminName: { type: String, default: "" },

    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
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
  { timestamps: true }
);

// Index for efficient queries
userVendorPaymentSchema.index({ vendorId: 1, paymentTimestamp: -1 });
userVendorPaymentSchema.index({ userId: 1, paymentTimestamp: -1 });
userVendorPaymentSchema.index({ bookingId: 1 });

export default mongoose.model("UserVendorPayment", userVendorPaymentSchema);
