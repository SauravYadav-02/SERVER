import Booking from "../models/BookingModel.js";
import Notification from "../models/NotificationModel.js";

const formatDate = (date) => {
  if (!date) return "";
  if (typeof date === "string") return date.split("T")[0];
  if (date instanceof Date) return date.toISOString().split("T")[0];
  return new Date(date).toISOString().split("T")[0];
};

export const cancelBookingsForDeactivatedVenue = async (venue) => {
  const activeStatuses = ["pending", "approved", "success"];
  const bookings = await Booking.find({
    venueId: venue._id,
    status: { $in: activeStatuses }
  });

  let cancelledCount = 0;
  const affectedBookingIds = [];

  for (const booking of bookings) {
    let isAffected = false;

    if (venue.deactivatedBy === "admin") {
      // If admin set a date range, only cancel bookings within that range
      if (venue.suspensionStart && venue.suspensionEnd) {
        const startStr = formatDate(venue.suspensionStart);
        const endStr = formatDate(venue.suspensionEnd);
        const bDate = booking.date; // "YYYY-MM-DD" string
        if (bDate >= startStr && bDate <= endStr) {
          isAffected = true;
        }
      } else {
        // No date range = indefinite deactivation, cancel ALL bookings
        isAffected = true;
      }
    } else if (venue.deactivatedBy === "vendor") {
      // Convert dates to YYYY-MM-DD strings for comparison
      const startStr = formatDate(venue.suspensionStart);
      const endStr = formatDate(venue.suspensionEnd);
      const bDate = booking.date; // booking.date is already "YYYY-MM-DD" string

      if (startStr && endStr && bDate >= startStr && bDate <= endStr) {
        isAffected = true;
      }
    }

    if (isAffected) {
      // 1. Update Booking status to "cancelled"
      booking.status = "cancelled";
      await booking.save();

      // 2. Create Notification
      const reasonMsg = venue.deactivatedBy === "vendor"
        ? ` Reason: ${venue.deactivationReason || "Vendor unavailability"}`
        : "";

      await Notification.create({
        userId: booking.userId,
        type: "booking_cancelled",
        title: "Booking Cancelled",
        message: `Your booking for ${venue.name} on ${booking.date} has been cancelled because the venue is currently unavailable.${reasonMsg}`,
        relatedBookingId: booking._id,
        relatedVenueId: venue._id,
      });

      cancelledCount++;
      affectedBookingIds.push(booking._id);
    }
  }

  return { cancelledCount, affectedBookingIds };
};
