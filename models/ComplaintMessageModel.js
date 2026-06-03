import mongoose from "mongoose";

const complaintMessageSchema = new mongoose.Schema({
  complaintId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Complaint",
    required: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  senderModel: {
    type: String,
    enum: ["User", "Vendor", "Admin"],
    required: true
  },
  message: {
    type: String,
    required: [true, "Message is required"],
    trim: true
  }
}, {
  timestamps: true
});

export default mongoose.model("ComplaintMessage", complaintMessageSchema);
