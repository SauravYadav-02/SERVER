import mongoose from "mongoose";

const userVendorPaymentSchema = new mongoose.Schema(
  {
<<<<<<< HEAD
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
=======
>>>>>>> 40c8d7bb903d79d30f815186249dcb033d2a1109
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
<<<<<<< HEAD
=======
    userName: { type: String, required: true },
    userEmail: { type: String, required: true },
    
>>>>>>> 40c8d7bb903d79d30f815186249dcb033d2a1109
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
<<<<<<< HEAD
    venueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Venue",
=======
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
>>>>>>> 40c8d7bb903d79d30f815186249dcb033d2a1109
      required: true,
    },
    amount: {
      type: Number,
      required: true,
<<<<<<< HEAD
=======
      min: 0,
>>>>>>> 40c8d7bb903d79d30f815186249dcb033d2a1109
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "pending",
    },
    transactionId: {
      type: String,
<<<<<<< HEAD
      required: true,
    },
    paymentTimestamp: {
      type: Date,
      default: Date.now,
=======
      default: null,
    },
    paymentTimestamp: {
      type: Date,
      default: null,
>>>>>>> 40c8d7bb903d79d30f815186249dcb033d2a1109
    },
    description: {
      type: String,
      default: "",
    },
  },
<<<<<<< HEAD
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
=======
  { timestamps: true }
);

// Index for efficient queries
userVendorPaymentSchema.index({ vendorId: 1, paymentTimestamp: -1 });
userVendorPaymentSchema.index({ userId: 1, paymentTimestamp: -1 });
userVendorPaymentSchema.index({ bookingId: 1 });
>>>>>>> 40c8d7bb903d79d30f815186249dcb033d2a1109

export default mongoose.model("UserVendorPayment", userVendorPaymentSchema);
