// import mongoose from "mongoose";
// import Subscription from "./models/SubscriptionModel.js";
// import Venue from "./models/VenueModel.js";
// import Plan from "./models/PlanModel.js";
// import Vendor from "./models/VendorModel.js";

// mongoose.connect("mongodb://localhost:27017/Book_My_Venue")
//   .then(async () => {
//     console.log("✅ DB Connected\n");
    
//     try {
//       // 1. Check all subscriptions
//       console.log("━━━ SUBSCRIPTIONS ━━━");
//       const subs = await Subscription.find().populate("vendorId", "name email");
//       console.log(`Total subscriptions: ${subs.length}`);
//       subs.forEach(sub => {
//         console.log(`  Vendor: ${sub.vendorId?.name || sub.vendorId} (${sub.vendorId?._id})`);
//         console.log(`    Plan: ${sub.planSnapshot?.name}`);
//         console.log(`    Status: ${sub.status}`);
//         console.log(`    Start: ${sub.startDate.toDateString()}`);
//         console.log(`    End: ${sub.endDate.toDateString()}`);
//         console.log(`    Grace End: ${sub.graceEndDate.toDateString()}`);
//         console.log("");
//       });

//       // 2. Check all venues
//       console.log("\n━━━ VENUES ━━━");
//       const venues = await Venue.find().populate("vendorId", "name email");
//       console.log(`Total venues: ${venues.length}`);
//       venues.forEach(venue => {
//         console.log(`  Venue: ${venue.name} (${venue._id})`);
//         console.log(`    Vendor: ${venue.vendorId?.name} (${venue.vendorId?._id})`);
//         console.log(`    Status: ${venue.status}`);
//         const vendorSub = subs.find(s => s.vendorId?._id?.toString() === venue.vendorId?._id?.toString());
//         const subStatus = vendorSub ? vendorSub.status : "NO_SUBSCRIPTION";
//         console.log(`    Subscription Status: ${subStatus}`);
//         const visible = venue.status === "approved" && (subStatus === "active" || subStatus === "grace");
//         console.log(`    ✅ VISIBLE: ${visible}`);
//         console.log("");
//       });

//       // 4. Check visibility with NEW logic
//       console.log("\n━━━ VISIBILITY WITH NEW LOGIC ━━━");
//       const visibleVenues = venues.filter(v => {
//         // Skip rejected venues
//         if (v.status === "rejected") {
//           return false;
//         }
        
//         // Show if admin-approved
//         if (v.status === "approved") {
//           return true;
//         }
        
//         // For pending venues, check if vendor has active subscription
//         const vendorSub = subs.find(s => s.vendorId?._id?.toString() === v.vendorId?._id?.toString());
//         const subStatus = vendorSub ? vendorSub.status : "none";
//         return subStatus === "active" || subStatus === "grace";
//       });
      
//       console.log(`Total visible venues: ${visibleVenues.length}`);
//       visibleVenues.forEach(v => {
//         const vendorSub = subs.find(s => s.vendorId?._id?.toString() === v.vendorId?._id?.toString());
//         console.log(`  ✅ ${v.name} (${v._id})`);
//         console.log(`     Vendor: ${v.vendorId?.name || "UNKNOWN"}`);
//         console.log(`     Venue Status: ${v.status}`);
//         console.log(`     Sub Status: ${vendorSub ? vendorSub.status : "NO_SUBSCRIPTION"}`);
//       });

//       // 5. Check all plans
//       console.log("\n━━━ PLANS ━━━");
//       const plans = await Plan.find();
//       console.log(`Total plans: ${plans.length}`);
//       plans.forEach(plan => {
//         console.log(`  Plan: ${plan.name}`);
//         console.log(`    Duration: ${plan.duration_days} days`);
//         console.log(`    Price: ${plan.price}`);
//         console.log(`    Active: ${plan.is_active}`);
//         console.log("");
//       });

//       // 6. Issues summary
//       console.log("\n━━━ ISSUES FOUND ━━━");
//       const orphanedVenues = venues.filter(v => !v.vendorId || !v.vendorId._id);
//       const rejectedVenues = venues.filter(v => v.status === "rejected");
//       const expiredSubs = subs.filter(s => s.status === "expired");

//       if (orphanedVenues.length > 0) {
//         console.log(`⚠️  ${orphanedVenues.length} orphaned venues (no vendor assigned)`);
//         orphanedVenues.forEach(v => console.log(`   - ${v.name} (ID: ${v._id})`));
//       }

//       if (rejectedVenues.length > 0) {
//         console.log(`⚠️  ${rejectedVenues.length} venues rejected (status="rejected")`);
//         rejectedVenues.forEach(v => console.log(`   - ${v.name}`));
//       }

//       if (expiredSubs.length > 0) {
//         console.log(`⚠️  ${expiredSubs.length} subscriptions expired (status="expired")`);
//         expiredSubs.forEach(s => console.log(`   - ${s.vendorId?.name}`));
//       }

//       console.log(`\n✅ With the NEW logic, ${visibleVenues.length} venue(s) are now visible!`);

//     } catch (err) {
//       console.error("Error:", err.message);
//     } finally {
//       process.exit(0);
//     }
//   })
//   .catch(() => console.log("DB Error"));
