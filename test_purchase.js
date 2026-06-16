import mongoose from "mongoose";

// Schemas for query
const Plan = mongoose.model("Plan", new mongoose.Schema({}, { strict: false }));
const Vendor = mongoose.model("Vendor", new mongoose.Schema({}, { strict: false }));
const PaymentHistory = mongoose.model("PaymentHistory", new mongoose.Schema({}, { strict: false }));

async function main() {
  try {
    await mongoose.connect("mongodb://localhost:27017/Book_My_Venue");
    console.log("Connected to MongoDB");

    // 1. Fetch available plans
    const plans = await Plan.find().lean();
    console.log("\n--- Plans in database ---");
    plans.forEach(p => {
      console.log({
        id: p._id,
        name: p.name,
        price: p.price,
        is_active: p.is_active,
        planType: p.planType,
        deletedAt: p.deletedAt
      });
    });

    // 2. Fetch vendors
    const vendors = await Vendor.find().lean();
    console.log("\n--- Vendors in database ---");
    vendors.forEach(v => {
      console.log({
        id: v._id,
        name: v.name || v.username || v.email,
        status: v.status,
        deleted: v.deleted
      });
    });

    if (vendors.length === 0 || plans.length === 0) {
      console.log("No vendors or plans found to simulate purchase.");
      return;
    }

    const testVendor = vendors[0];
    const testPlan = plans.find(p => p.is_active && !p.deletedAt);

    if (!testPlan) {
      console.log("No active non-deleted plan found to purchase.");
      return;
    }

    console.log(`\nTesting purchase of plan '${testPlan.name}' (${testPlan._id}) by vendor '${testVendor.name || testVendor.username || testVendor.email}' (${testVendor._id})...`);

    // 3. Make HTTP request to local server
    const response = await fetch("http://localhost:3000/subscription/create-payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "vendorid": testVendor._id.toString()
      },
      body: JSON.stringify({ planId: testPlan._id.toString() })
    });

    const data = await response.json();
    console.log("API Response Code:", response.status);
    console.log("API Response Body:", data);

  } catch (error) {
    console.error("Error running test purchase:", error.message);
  } finally {
    await mongoose.disconnect();
  }
}

main();
