import mongoose from "mongoose";

const reportSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, "Title is required"],
    trim: true
  },
  description: {
    type: String,
    required: [true, "Description is required"],
    trim: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  venue: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Venue",
    required: true
  },
  status: {
    type: String,
    enum: ["Open", "In Progress", "Resolved", "Closed"],
    default: "Open"
  },
  attachments: [{
    type: String
  }]
}, {
  timestamps: true
});

export default mongoose.model("Report", reportSchema);
