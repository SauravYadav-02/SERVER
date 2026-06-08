import mongoose from "mongoose";

const todoSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ["task", "payment", "booking", "appointment"],
    default: "task",
  },
  completed: {
    type: Boolean,
    default: false,
  },
  dueDate: {
    type: Date,
  },
  amount: {
    type: Number,
  },
  location: {
    type: String,
  },
}, { timestamps: true });

export default mongoose.model("Todo", todoSchema);
