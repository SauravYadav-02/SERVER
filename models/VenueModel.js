import mongoose from "mongoose";

const venueSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },

    name: { type: String, required: true },
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
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    adminDescription: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Venue", venueSchema);