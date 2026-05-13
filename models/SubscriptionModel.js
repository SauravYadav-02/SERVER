import mongoose from "mongoose";

const planSnapshotSchema = {
  name: String,
  duration_days: Number,
  price: Number,
  features: {
    type: [String],
    default: [],
  },
};

const fullPaymentSubscriptionSchema = new mongoose.Schema(
  {
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      required: true,
    },
    planSnapshot: planSnapshotSchema,
    status: {
      type: String,
      enum: ["active", "expired"],
      default: "active",
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    purchasedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const subscriptionSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      unique: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      required: true,
    },
    planSnapshot: planSnapshotSchema,
    status: {
      type: String,
      enum: ["active", "grace", "expired"],
      default: "active",
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    graceEndDate: {
      type: Date,
      required: true,
    },
    fullPayments: {
      type: [fullPaymentSubscriptionSchema],
      default: [],
    },

    // Extra descriptive fields for reporting/tracking
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    adminName: { type: String, default: "" },
    userName: { type: String, default: "" },
    userEmail: { type: String, default: "" }, // Email ID
    vendorName: { type: String, default: "" },
    vendorEmail: { type: String, default: "" },

    // Notification flags prevent duplicate emails.
    notifiedExpiry15Days: { type: Boolean, default: false },
    notifiedExpiry5Days: { type: Boolean, default: false },
    notifiedExpiryDay: { type: Boolean, default: false },
    notifiedGraceEnd: { type: Boolean, default: false },
  },
  { timestamps: true }
);

subscriptionSchema.index({ status: 1 });
subscriptionSchema.index({ endDate: 1 });
subscriptionSchema.index({ graceEndDate: 1 });
subscriptionSchema.index({ "fullPayments.status": 1, "fullPayments.endDate": 1 });

export default mongoose.model("Subscription", subscriptionSchema);
