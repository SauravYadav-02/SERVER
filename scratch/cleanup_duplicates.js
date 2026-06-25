import mongoose from "mongoose";
import PaymentHistory from "../models/PaymentHistoryModel.js";

await mongoose.connect("mongodb://localhost:27017/Book_My_Venue");
console.log("Connected to DB");

const records = await PaymentHistory.find();
console.log("Total records before cleanup:", records.length);

const toDelete = [];
const seenPending = new Set();
const successPendingDescriptions = new Set();

// Pass 1: Identify "Pending payment for ..." that are success
records.forEach(r => {
  if (r.type === "subscription" && r.paymentStatus === "success" && r.description.startsWith("Pending payment for")) {
    successPendingDescriptions.add(r.description.replace("Pending payment for ", ""));
  }
});

// Pass 2: Find duplicates
records.forEach(r => {
  if (r.type === "subscription") {
    // If it's a "Payment for ... subscription" and we already have a success "Pending payment for ..."
    if (r.paymentStatus === "success" && r.description.startsWith("Payment for ") && r.description.endsWith(" subscription")) {
      const planName = r.description.replace("Payment for ", "").replace(" subscription", "");
      if (successPendingDescriptions.has(planName)) {
        console.log(`Deleting duplicate success record: _id=${r._id} desc="${r.description}"`);
        toDelete.push(r._id);
      }
    }
    
    // If it is pending, check for duplicates (same vendor, same type, same description, same amount, status pending)
    if (r.paymentStatus === "pending") {
      const key = `${r.vendorId}_${r.description}_${r.amount}`;
      if (seenPending.has(key)) {
        console.log(`Deleting duplicate pending record: _id=${r._id} desc="${r.description}"`);
        toDelete.push(r._id);
      } else {
        seenPending.add(key);
      }
    }
  }
});

if (toDelete.length > 0) {
  const res = await PaymentHistory.deleteMany({ _id: { $in: toDelete } });
  console.log(`Deleted ${res.deletedCount} duplicate records.`);
} else {
  console.log("No duplicate records found.");
}

const remaining = await PaymentHistory.find();
console.log("Total records after cleanup:", remaining.length);

await mongoose.disconnect();
