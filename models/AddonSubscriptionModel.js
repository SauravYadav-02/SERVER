import mongoose from "mongoose";

const addonSubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
    addonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      required: true,
    },
    baseSubscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      required: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "SUSPENDED", "EXPIRED", "CANCELLED"],
      default: "ACTIVE",
    },
    startDate: {
      type: Date,
      required: true,
    },
    expiryDate: {
      type: Date,
      required: true,
    },
    suspensionReason: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

// Indexes for fast querying
addonSubscriptionSchema.index({ userId: 1 });
addonSubscriptionSchema.index({ baseSubscriptionId: 1 });
addonSubscriptionSchema.index({ status: 1 });

export default mongoose.model("AddonSubscription", addonSubscriptionSchema);
