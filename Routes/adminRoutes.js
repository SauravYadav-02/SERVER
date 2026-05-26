import express from "express";
import Admin from "../models/AdminModel.js";
import Venue from "../models/VenueModel.js";
import RatingFeedback from "../models/RatingFeedbackModel.js";
import { isAdmin } from "../middleare/isAdmin.js";
import { paginate } from "../utils/pagination.js";

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
    const {username,password} = req.body;

    const admin = await Admin.findOne({username});

    if(!admin || admin.password !== password){
        return res.status(400).json({message:"Invalid credentials"});
    }

    res.json({message:"Login success", admin});
});

// Admin: Get all venues with vendor details (Paginated)
router.get("/venues", isAdmin, async (req, res) => {
    try {
        const { page, limit, search, status } = req.query;
        
        const query = {};
        if (status) query.status = status;
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { city: { $regex: search, $options: "i" } },
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
            req.params.reviewId,
            { status },
            { new: true }
        );
        
        if (!review) return res.status(404).json({ message: "Review not found" });

        res.json({ message: "Review status updated", review });
    } catch(err) {
        res.status(500).json({ message: err.message });
    }
});

export default router;
