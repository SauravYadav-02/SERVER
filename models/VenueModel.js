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

    // ✅ Per-plate catering cost (veg / non-veg only)
    vegPrice: {
      type: Number,
      default: null,
    },
    nonVegPrice: {
      type: Number,
      default: null,
    },

    address: String,
    city: String,
    state: String,
    zip: String,
    country: String,

    lat: String,
    lng: String,

    venueTypes: [String],
    eventsSupported: [String],
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
    ratingCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// ─── Performance Indexes for /discover endpoint ───────────────────────────────

// Compound index: every discover query starts with these two fields
venueSchema.index({ status: 1, isSubscriptionActive: 1 });

// Sorting & filtering indexes
venueSchema.index({ pricePerDay: 1 });
venueSchema.index({ averageRating: -1 });
venueSchema.index({ capacity: -1 });
venueSchema.index({ createdAt: -1 });
venueSchema.index({ city: 1 });
venueSchema.index({ type: 1 });
venueSchema.index({ venueTypes: 1 });
venueSchema.index({ eventsSupported: 1 });

// NOTE: No $text index — we use case-insensitive $or regex search instead,
//       which is incompatible with MongoDB text indexes in the same query.

export default mongoose.model("Venue", venueSchema);
