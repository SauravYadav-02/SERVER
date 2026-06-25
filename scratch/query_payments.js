import mongoose from "mongoose";
import PaymentHistory from "../models/PaymentHistoryModel.js";

await mongoose.connect("mongodb://localhost:27017/Book_My_Venue");
console.log("Connected to DB");

const records = await PaymentHistory.find();
console.log("Total records in PaymentHistory:", records.length);
records.forEach((r, i) => {
  console.log(`${i+1}: _id=${r._id} type=${r.type} desc="${r.description}" amount=${r.amount} status=${r.paymentStatus}`);
});

await mongoose.disconnect();
