import express from "express";
import mongoose from "mongoose";
import Admin from "../models/AdminModel.js";
import Venue from "../models/VenueModel.js";
import RatingFeedback from "../models/RatingFeedbackModel.js";
import { isAdmin } from "../middleare/isAdmin.js";
import { paginate } from "../utils/pagination.js";
import { suspendVendor, unsuspendVendor } from "../services/vendorService.js";
import { suspendUser, unsuspendUser } from "../services/userService.js";
import { cancelBookingsForDeactivatedVenue } from "../services/venueDeactivationService.js";

const fixPath = (filePath = "") => filePath.replace(/\\/g, "/");

const buildVenueResponse = (venue, req) => {
    const venueObj = venue.toObject ? venue.toObject() : venue;
    return {
        ...venueObj,
        mediaFiles: venueObj.mediaFiles?.map((file) =>
            file ? `${req.protocol}://${req.get("host")}/${fixPath(file)}` : null
        ),
    };
};

const router = express.Router();

// Create Admin
router.post("/register", async (req,res)=>{
    const admin = new Admin(req.body);
    await admin.save();
    res.json({message:"Admin Created", admin});
});

// Login
router.post("/login", async (req,res)=>{
    try {
        const {username,password} = req.body;

        if (!username || !password) {
            return res.status(400).json({message:"Username and password are required"});
        }

        const admin = await Admin.findOne({username});

        if(!admin || admin.password !== password){
            return res.status(400).json({message:"Invalid credentials"});
        }

        console.log(`[Audit] Admin ${username} logged in successfully.`);
        res.json({message:"Login success", admin});
    } catch (error) {
        console.error("Admin login error:", error);
        res.status(500).json({message:"Server error during login", error: error.message});
    }
});

// Admin: Get all venues with vendor details (Paginated)
router.get("/venues", isAdmin, async (req, res) => {
    try {
        const { page, limit, search, status } = req.query;
        
        const query = {};
        if (status) query.status = status;
        if (search) {
            const regex = new RegExp(search.trim(), "i");
            const matchingVendors = await mongoose.model("Vendor").find({
                fullName: regex
            }).select("_id");
            const vendorIds = matchingVendors.map(v => v._id);

            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { city: { $regex: search, $options: "i" } },
                { vendorId: { $in: vendorIds } },
            ];
        }

        const paginationResult = await paginate(Venue, query, {
            page,
            limit,
            populate: { path: "vendorId", select: "fullName email phone businessName businessType address city state zip pincode status" },
            sort: { createdAt: -1 }
        });

        paginationResult.data = paginationResult.data.map((venue) => buildVenueResponse(venue, req));
        
        res.json(paginationResult);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Admin: Get single venue with vendor details
router.get("/venues/:id", isAdmin, async (req, res) => {
    try {
        const venue = await Venue.findById(req.params.id).populate("vendorId", "fullName email phone businessName businessType address city state zip pincode status");

        if (!venue) {
            return res.status(404).json({ message: "Venue not found" });
        }

        res.json(buildVenueResponse(venue, req));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Admin: Update venue statusr
router.put("/venues/:id/status", isAdmin, async (req, res) => {
    try {
        const { status } = req.body;

        const venue = await Venue.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        ).populate("vendorId", "fullName email phone businessName businessType address city state zip pincode status");

        if (!venue) {
            return res.status(404).json({ message: "Venue not found" });
        }

        res.json(buildVenueResponse(venue, req));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Admin: Deactivate Venue (soft-delete)
router.patch("/venues/:id/deactivate", isAdmin, async (req, res) => {
    try {
        const { reason, suspensionStart, suspensionEnd } = req.body;
        // Validate date range if provided
        let parsedStart = null;
        let parsedEnd = null;
        if (suspensionStart && suspensionEnd) {
            parsedStart = new Date(suspensionStart);
            parsedEnd = new Date(suspensionEnd);
            if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
                return res.status(400).json({ message: "Invalid suspension dates." });
            }
            if (parsedEnd < parsedStart) {
                return res.status(400).json({ message: "Suspension end date must be >= start date." });
            }
        }
        const venue = await Venue.findByIdAndUpdate(
            req.params.id,
            {
                deactivated: true,
                deactivatedBy: "admin",
                deactivationReason: reason || "Deactivated by admin",
                suspensionStart: parsedStart,
                suspensionEnd: parsedEnd
            },
            { new: true }
        ).populate("vendorId", "fullName email phone businessName businessType address city state zip pincode status");

        if (!venue) {
            return res.status(404).json({ message: "Venue not found" });
        }

        const result = await cancelBookingsForDeactivatedVenue(venue);
        res.json({
            ...buildVenueResponse(venue, req),
            cancelledBookings: result.cancelledCount
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Admin: Reactivate Venue
router.patch("/venues/:id/reactivate", isAdmin, async (req, res) => {
    try {
        const venue = await Venue.findByIdAndUpdate(
            req.params.id,
            {
                deactivated: false,
                deactivatedBy: null,
                deactivationReason: "",
                suspensionStart: null,
                suspensionEnd: null
            },
            { new: true }
        ).populate("vendorId", "fullName email phone businessName businessType address city state zip pincode status");

        if (!venue) {
            return res.status(404).json({ message: "Venue not found" });
        }

        res.json(buildVenueResponse(venue, req));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Admin: Get all reviews across all venues (Paginated)
router.get("/reviews", isAdmin, async (req, res) => {
    try {
        const { page, limit, search, status } = req.query;

        const query = {};
        if (status) query.status = status;
        if (search) {
            query.feedback = { $regex: search, $options: "i" };
        }

        const paginationResult = await paginate(RatingFeedback, query, {
            page,
            limit,
            populate: [
                { path: "userId", select: "name email" },
                { path: "venueId", select: "name" }
            ],
            sort: { createdAt: -1 }
        });

        paginationResult.data = paginationResult.data.map(r => ({
            ...r,
            venueId: r.venueId?._id,
            venueName: r.venueId?.name
        }));
        
        res.json(paginationResult);
    } catch(err) {
        res.status(500).json({ message: err.message });
    }
});

// Admin: Approve/Reject review
router.patch("/reviews/:venueId/:reviewId/status", isAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        const review = await RatingFeedback.findByIdAndUpdate(
            { _id: req.params.reviewId },
            { status },
            { new: true }
        );
        
        if (!review) return res.status(404).json({ message: "Review not found" });

        res.json({ message: "Review status updated", review });
    } catch(err) {
        res.status(500).json({ message: err.message });
    }
});

// Admin: Suspend Vendor
router.put("/vendors/:id/suspend", isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const vendor = await suspendVendor(id);
        res.json({ message: "Vendor suspended successfully", vendor });
    } catch (err) {
        if (err.message === "Vendor not found or deleted") {
            return res.status(404).json({ message: err.message });
        }
        res.status(500).json({ message: "Error suspending vendor", error: err.message });
    }
});

// Admin: Unsuspend Vendor
router.put("/vendors/:id/unsuspend", isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { vendor, activeSubscriptionExists } = await unsuspendVendor(id);
        res.json({ 
            message: "Vendor unsuspended successfully", 
            vendor,
            activeSubscriptionExists 
        });
    } catch (err) {
        if (err.message === "Vendor not found or deleted") {
            return res.status(404).json({ message: err.message });
        }
        res.status(500).json({ message: "Error unsuspending vendor", error: err.message });
    }
});

// Admin: Suspend User
router.put("/users/:id/suspend", isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const user = await suspendUser(id);
        res.json({ message: "User suspended successfully", user });
    } catch (err) {
        if (err.message === "User not found or deleted") {
            return res.status(404).json({ message: err.message });
        }
        res.status(500).json({ message: "Error suspending user", error: err.message });
    }
});

// Admin: Unsuspend User
router.put("/users/:id/unsuspend", isAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const user = await unsuspendUser(id);
        res.json({ message: "User unsuspended successfully", user });
    } catch (err) {
        if (err.message === "User not found or deleted") {
            return res.status(404).json({ message: err.message });
        }
        res.status(500).json({ message: "Error unsuspending user", error: err.message });
    }
});

export default router;
