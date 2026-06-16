import mongoose from "mongoose";
import User from "./models/UserModel.js";
import Vendor from "./models/VendorModel.js";
import Venue from "./models/VenueModel.js";
import Complaint from "./models/ComplaintModel.js";

async function main() {
  try {
    await mongoose.connect("mongodb://localhost:27017/Book_My_Venue");
    console.log("Connected to MongoDB");

    const complaints = await Complaint.find()
      .populate("user", "name email phone")
      .populate("vendor", "fullName businessName email")
      .populate("venue", "name city")
      .lean();

    console.log(`Found ${complaints.length} complaints:`);
    for (const c of complaints) {
      console.log({
        id: c._id,
        title: c.title,
        description: c.description,
        status: c.status,
        user: c.user,
        vendor: c.vendor,
        venue: c.venue,
        attachments: c.attachments,
        createdAt: c.createdAt
      });
    }

  } catch (error) {
    console.error("Error inspecting complaints:", error);
  } finally {
    await mongoose.disconnect();
  }
}

main();
