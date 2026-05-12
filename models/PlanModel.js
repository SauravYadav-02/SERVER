import mongoose from "mongoose";

/**
 * PlanModel
 * Represents a subscription plan managed by Admin.
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
      enum: ["base", "full payment"],
      default: "base",
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

// Only return non-deleted plans by default
planSchema.index({ deletedAt: 1 });

export default mongoose.model("Plan", planSchema);
