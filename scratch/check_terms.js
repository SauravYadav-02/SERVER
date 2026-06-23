import mongoose from "mongoose";
import Terms from "../models/TermsModel.js";

async function check() {
  try {
    await mongoose.connect("mongodb://localhost:27017/Book_My_Venue");
    console.log("Connected to DB");
    const count = await Terms.countDocuments();
    console.log(`Total Terms documents: ${count}`);
    const active = await Terms.findOne({ isActive: true });
    console.log("Active Terms:", active);
    const all = await Terms.find();
    console.log("All Terms:", all);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

check();
