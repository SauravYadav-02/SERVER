import mongoose from "mongoose";

const complaintSchema = new mongoose.Schema({
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
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Vendor"
  },
  venue: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Venue"
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

export default mongoose.model("Complaint", complaintSchema);
