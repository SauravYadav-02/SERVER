import mongoose from "mongoose";

const customCategorySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  value: {
    type: String,
    required: true,
  },
  label: {
    type: String,
    required: true,
  },
  color: {
    type: String,
    required: true,
  },
}, { timestamps: true });

// Ensure unique values per user
customCategorySchema.index({ user: 1, value: 1 }, { unique: true });

export default mongoose.model("CustomCategory", customCategorySchema);
