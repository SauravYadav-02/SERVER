import mongoose from "mongoose";
import ComplaintMessage from "../models/ComplaintMessageModel.js";

async function checkComplaints() {
  try {
    await mongoose.connect("mongodb://localhost:27017/Book_My_Venue");
    console.log("Connected to DB");

    const ComplaintSchema = new mongoose.Schema({}, { strict: false });
    const Complaint = mongoose.model("complaints", ComplaintSchema);

    const complaints = await Complaint.find({});
    console.log(`Total complaints: ${complaints.length}`);
    for (const c of complaints) {
      console.log(`\n- Complaint ID: ${c._id}`);
      console.log(`  Title: ${c.title}`);
      console.log(`  Description: ${c.description}`);
      console.log(`  Status: ${c.status}`);
      
      const msgs = await ComplaintMessage.find({ complaintId: c._id });
      console.log(`  Messages (${msgs.length}):`);
      for (const m of msgs) {
        console.log(`    - Msg ID: ${m._id}`);
        console.log(`      Sender: ${m.senderName} (${m.senderModel})`);
        console.log(`      Content: "${m.message}"`);
        console.log(`      SenderID: ${m.senderId}`);
      }
    }

    mongoose.disconnect();
  } catch (err) {
    console.error("Error:", err);
  }
}

checkComplaints();
