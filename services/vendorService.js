import Vendor from "../models/VendorModel.js";
import Venue from "../models/VenueModel.js";
import Subscription from "../models/SubscriptionModel.js";

// Suspend a vendor and hide all of their venue listings
export const suspendVendor = async (vendorId) => {
    const vendor = await Vendor.findOneAndUpdate(
        { _id: vendorId, deleted: { $ne: true } },
        { status: "suspended" },
        { new: true }
    );

    if (!vendor) {
        throw new Error("Vendor not found or deleted");
    }

    // Hide all venues belonging to this vendor
    await Venue.updateMany(
        { vendorId },
        { isSubscriptionActive: false }
    );

    return vendor;
};

// Restore a vendor and reactivate venues only if they have an active base subscription
export const unsuspendVendor = async (vendorId) => {
    const vendor = await Vendor.findOne({ _id: vendorId, deleted: { $ne: true } });

    if (!vendor) {
        throw new Error("Vendor not found or deleted");
    }

    // Restore status to approved and clear suspension tracking fields if present
    vendor.status = "approved";
    vendor.suspendedAt = undefined;
    vendor.suspensionReason = undefined;
    await vendor.save();

    // Verify if the vendor has a valid active base subscription
    const now = new Date();
    const activeSub = await Subscription.findOne({
        vendorId,
        status: { $in: ["active", "ACTIVE"] },
        endDate: { $gt: now }
    });

    // Reactivate venues ONLY if active base plan exists
    if (activeSub) {
        await Venue.updateMany(
            { vendorId },
            { isSubscriptionActive: true }
        );
    }

    return {
        vendor,
        activeSubscriptionExists: !!activeSub
    };
};
