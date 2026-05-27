import mongoose from "mongoose";

/**
 * PlanModel
 * Represents a subscription plan managed by Admin.
 * Plans can be "base" (standalone) or "addon" (linked to a parent base plan).
 * Flexible enough to accommodate extra metadata via `features`.
 */
const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Plan name is required"],
      trim: true,
      unique: true,
    },

    duration_days: {
      type: Number,
      required: [true, "Duration in days is required"],
      min: [1, "Duration must be at least 1 day"],
    },

    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
    },

    planType: {
      type: String,
      enum: ["base", "addon", "full payment"],
      default: "base",
    },

    // ── Add-On relationship ─────────────────────────────────────
    // Required when planType === "addon". Must reference a base plan.
    parentPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      default: null,
    },

    is_active: {
      type: Boolean,
      default: true,
    },

    // Flexible feature list for dynamic plan descriptions
    features: {
      type: [String],
      default: [],
    },

    // Soft-delete support
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// ── Indexes ─────────────────────────────────────────────────────
planSchema.index({ deletedAt: 1 });
planSchema.index({ parentPlanId: 1 });

export default mongoose.model("Plan", planSchema);
