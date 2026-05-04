import mongoose from "mongoose";

/**
 * SubscriptionQueueModel
 * Stores pending (future) plans purchased while a vendor already has
 * an active subscription. Processed FIFO by the daily cron job.
 */
const subscriptionQueueSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },

    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      required: true,
    },

    // Snapshot of plan details at purchase time
    planSnapshot: {
      name: String,
      duration_days: Number,
      price: Number,
      features: {
        type: [String],
        default: [],
      },
    },

    // FIFO position within this vendor's queue
    position: {
      type: Number,
      required: true,
    },

    // Whether this queue entry has been activated
    isActivated: {
      type: Boolean,
      default: false,
    },

    activatedAt: {
      type: Date,
      default: null,
    },

    purchasedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Efficient lookup: vendor → pending queue items sorted by position
subscriptionQueueSchema.index({ vendorId: 1, isActivated: 1, position: 1 });

export default mongoose.model("SubscriptionQueue", subscriptionQueueSchema);
