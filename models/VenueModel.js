import mongoose from "mongoose";

const venueSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },

    name: { type: String, required: true , trim: true},
    type: String,
    capacity: Number,
    description: String,

    pricePerDay: Number,

    address: String,
    city: String,
    state: String,
    zip: String,
    country: String,

    lat: String,
    lng: String,

    amenities: [String],

    availableFrom: { type: Date },

    // ✅ store file paths
    mediaFiles: [String],





    // ✅ NEW FIELDS

    // ✅ NEW FIELDS
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    adminDescription: {
      type: String,
      default: "",
    },
    
    // ✅ AUTO-MANAGED by Subscription System
    isSubscriptionActive: {
      type: Boolean,
      default: true,
    },

    // ✅ Rating Statistics
    averageRating: {
      type: Number,
      default: 0,
    },
    totalReviews: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Venue", venueSchema);
