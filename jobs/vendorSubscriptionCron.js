import cron from "node-cron";
import VendorSubscription from "../models/VendorSubscriptionModel.js";
import Venue from "../models/VenueModel.js";

export const handleVendorSubscriptionExpiry = async () => {
  const now = new Date();

  // 1. active + expiresAt < now ──> set to grace
  const activeExpired = await VendorSubscription.find({
    status: "active",
    expiresAt: { $lt: now },
  });

  for (const sub of activeExpired) {
    sub.status = "grace";
    await sub.save();
    console.log(`[VendorCron] Subscription for vendor ${sub.vendorId} set to grace.`);
  }

  // 2. grace + expiresAt < now - 7 days ──> set to expired
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const graceExpired = await VendorSubscription.find({
    status: "grace",
    expiresAt: { $lt: sevenDaysAgo },
  });

  for (const sub of graceExpired) {
    sub.status = "expired";
    await sub.save();

    // Set isSubscriptionActive: false on the vendor's venues
    await Venue.updateMany(
      { vendorId: sub.vendorId },
      { isSubscriptionActive: false }
    );
    console.log(`[VendorCron] Subscription for vendor ${sub.vendorId} expired. Venues deactivated.`);
  }
};

export const registerVendorSubscriptionCronJobs = () => {
  // Daily at midnight: "0 0 * * *"
  cron.schedule("0 0 * * *", async () => {
    console.log("\n[VendorCron] ─── Running daily vendor subscription jobs ───");
    try {
      await handleVendorSubscriptionExpiry();
    } catch (err) {
      console.error("[VendorCron] Error in vendor subscription jobs:", err.message);
    }
    console.log("[VendorCron] ─── Daily jobs complete ───\n");
  });
  console.log("[VendorCron] Vendor subscription cron jobs registered (daily at midnight).");
};
