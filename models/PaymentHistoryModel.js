import mongoose from "mongoose";

const paymentHistorySchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: function() {
        return this.type === "booking";
      }, // Required for booking payments
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: function() {
        return this.type === "full payment" || (this.type === "subscription" && !this.transactionId && !this.userId);
      }, // Required for admin-assigned payments
    },
    type: {
      type: String,
      enum: ["booking", "subscription", "full payment"],
      required: true,
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true, // bookingId or subscriptionId
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
    // Extra descriptive fields for reporting/tracking
    userName: { type: String, default: "" },
    userEmail: { type: String, default: "" },
    vendorName: { type: String, default: "" },
    vendorEmail: { type: String, default: "" },
    adminName: { type: String, default: "" },
  },
  { timestamps: true }
);

// Index for efficient queries
paymentHistorySchema.index({ vendorId: 1, paymentTimestamp: -1 });
paymentHistorySchema.index({ type: 1, relatedId: 1 });

export default mongoose.model("PaymentHistory", paymentHistorySchema);