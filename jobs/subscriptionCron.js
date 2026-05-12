import cron from "node-cron";
import {
  handleExpiry,
  activateQueuedPlans,
  sendSubscriptionNotifications,
} from "../services/subscriptionService.js";

/**
 * registerSubscriptionCronJobs
 * Registers all subscription-related background jobs.
 * Runs every day at midnight (00:00).
 *
 * Call this function once during server startup.
 */
export const registerSubscriptionCronJobs = () => {
  // Daily at midnight
  cron.schedule("0 0 * * *", async () => {
    console.log("\n[Cron] ─── Running daily subscription jobs ───");

    try {
      // 1. Handle expiry transitions (active→grace, grace→expired)
      const { processed } = await handleExpiry();
      console.log(`[Cron] Expiry handled: ${processed} subscriptions transitioned.`);

      // 2. Activate next queued plan for vendors whose sub just expired
      const { activated } = await activateQueuedPlans();
      console.log(`[Cron] Queue activations: ${activated} plan(s) activated.`);

      // 3. Send email notifications
      const { sent } = await sendSubscriptionNotifications();
      console.log(`[Cron] Notifications: ${sent} email(s) sent.`);

    } catch (err) {
      console.error("[Cron] Error in subscription jobs:", err.message);
    }

    console.log("[Cron] ─── Daily jobs complete ───\n");
  });

  console.log("[Cron] Subscription cron jobs registered (daily at midnight).");
};
