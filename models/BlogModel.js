import mongoose from "mongoose";

const commentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  userName: { type: String, default: "" },
  text: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now },
});

const blogSchema = new mongoose.Schema({
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Vendor",
    required: true,
  },
  title: { type: String, required: true, trim: true },
  content: { type: String, required: true, trim: true },
  tags: [{ type: String, trim: true }],
  coverImage: { type: String, default: null },
  images: [{ type: String }],
  videoUrl: { type: String, default: null },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected", "suspended"],
    default: "pending",
  },
  adminNote: { type: String, default: "" },
  deleted: { type: Boolean, default: false },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  comments: [commentSchema],
}, { timestamps: true });

blogSchema.index({ vendorId: 1, createdAt: -1 });
blogSchema.index({ status: 1, deleted: 1 });

export default mongoose.model("Blog", blogSchema);
