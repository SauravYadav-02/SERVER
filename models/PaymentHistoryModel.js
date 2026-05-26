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
      default: null,
    },

    // adminId is populated when a subscription is assigned manually by an admin
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },

    // "booking" | "subscription" | "full payment"
    type: {
      type: String,
      enum: ["booking", "subscription", "full payment"],
      required: true,
    },

    // References bookingId or subscriptionId depending on type
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
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

    // Timestamp of when payment was completed (null while pending)
    paymentTimestamp: {
      type: Date,
      default: null,
    },

    description: {
      type: String,
      default: "",
    },

    // Payment method — always "online" for this platform
    paymentMethod: {
      type: String,
      default: "online",
      immutable: true,
    },

    // ── Denormalised display fields (avoid extra lookups in reports) ──────────
    userName:    { type: String, default: "" },
    userEmail:   { type: String, default: "" },
    vendorName:  { type: String, default: "" },
    vendorEmail: { type: String, default: "" },
    adminName:   { type: String, default: "" },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
paymentHistorySchema.index({ vendorId: 1, paymentTimestamp: -1 });
paymentHistorySchema.index({ adminId:  1, paymentTimestamp: -1 });
paymentHistorySchema.index({ userId:   1, paymentTimestamp: -1 });
paymentHistorySchema.index({ type: 1, relatedId: 1 });

// Optimised for the vendor self-service subscription history endpoint
paymentHistorySchema.index({ vendorId: 1, type: 1, createdAt: -1 });

export default mongoose.model("PaymentHistory", paymentHistorySchema);
