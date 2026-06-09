import mongoose from "mongoose";

const vendorPlanSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Plan name is required"],
      trim: true,
      unique: true,
    },
    monthlyPrice: {
      type: Number,
      required: [true, "Monthly price is required"],
      min: [0, "Price cannot be negative"],
    },
    yearlyPrice: {
      type: Number,
      required: [true, "Yearly price is required"],
      min: [0, "Price cannot be negative"],
    },
    maxVenues: {
      type: Number,
      required: [true, "Maximum venues is required"],
      min: [0, "Maximum venues must be non-negative"],
    },
    maxPhotos: {
      type: Number,
      required: [true, "Maximum photos is required"],
      min: [0, "Maximum photos must be non-negative"],
      default: 10,
    },
    visibilityBoost: {
      type: Boolean,
      default: false,
    },
    customBranding: {
      type: Boolean,
      default: false,
    },
    supportTier: {
      type: String,
      enum: ["basic", "priority"],
      default: "basic",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("VendorPlan", vendorPlanSchema);
