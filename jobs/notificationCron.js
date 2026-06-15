import cron from "node-cron";
import Venue from "../models/VenueModel.js";
import { cancelBookingsForDeactivatedVenue } from "../services/venueDeactivationService.js";

/**
 * registerNotificationCronJobs
 * Registers daily background jobs to handle vendor-deactivated venues
 * and cancel bookings within their suspension period.
 * Runs daily at midnight (0 0 * * *).
 */
export const registerNotificationCronJobs = () => {
  cron.schedule("0 0 * * *", async () => {
    console.log("\n[Cron] ─── Running daily venue deactivation & notification check ───");

    try {
      const now = new Date();

      // 1. Auto-reactivate expired suspensions first
      const reactivatedResult = await Venue.updateMany(
        {
          deactivated: true,
          deactivatedBy: "vendor",
          suspensionEnd: { $lt: now }
        },
        {
          $set: {
            deactivated: false,
            deactivatedBy: null,
            suspensionStart: null,
            suspensionEnd: null,
            deactivationReason: ""
          }
        }
      );
      if (reactivatedResult.modifiedCount > 0) {
        console.log(`[Cron] Auto-reactivated ${reactivatedResult.modifiedCount} venue(s) with expired suspensions.`);
      }

      // 2. Fetch all currently deactivated vendor venues
      const vendorSuspendedVenues = await Venue.find({
        deactivated: true,
        deactivatedBy: "vendor"
      });

      console.log(`[Cron] Checking cancellations for ${vendorSuspendedVenues.length} suspended vendor venue(s).`);

      let totalCancelledBookings = 0;
      for (const venue of vendorSuspendedVenues) {
        const result = await cancelBookingsForDeactivatedVenue(venue);
        if (result.cancelledCount > 0) {
          totalCancelledBookings += result.cancelledCount;
          console.log(`[Cron] Cancelled ${result.cancelledCount} booking(s) for venue: "${venue.name}" (ID: ${venue._id})`);
        }
      }

      console.log(`[Cron] Daily deactivation check completed. Total bookings cancelled: ${totalCancelledBookings}.`);

    } catch (err) {
      console.error("[Cron] Error in venue deactivation/notification jobs:", err.message);
    }

    console.log("[Cron] ─── Daily deactivation jobs complete ───\n");
  });

  console.log("[Cron] Venue deactivation and notification cron jobs registered (daily at midnight).");
};
