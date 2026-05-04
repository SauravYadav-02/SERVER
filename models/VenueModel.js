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

    reviews: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        rating: {
          type: Number,
          required: true,
          min: 1,
          max: 5,
        },
        feedback: {
          type: String,
          trim: true,
          maxlength: 500,
          default: "",
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    ratingCount: {
      type: Number,
      default: 0,
    },

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
  },
  { timestamps: true }
);

export default mongoose.model("Venue", venueSchema);
