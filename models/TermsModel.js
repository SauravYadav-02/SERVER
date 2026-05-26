import mongoose from "mongoose";

const termsSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: [true, "Terms content is required"],
      trim: true,
    },
    version: {
      type: String,
      required: [true, "Version identifier is required"],
      trim: true,
      unique: true,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Optional: you can add a pre-save hook to ensure only one active terms exists if desired,
// but usually this is handled in the controller.

export default mongoose.model("Terms", termsSchema);
