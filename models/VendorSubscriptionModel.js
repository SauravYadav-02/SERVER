import mongoose from "mongoose";

const vendorSubscriptionSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      unique: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VendorPlan",
      required: true,
    },
    cycle: {
      type: String,
      enum: ["monthly", "yearly"],
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "grace", "expired"],
      default: "active",
    },
    paymentRef: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

export default mongoose.model("VendorSubscription", vendorSubscriptionSchema);
