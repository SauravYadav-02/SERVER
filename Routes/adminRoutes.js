import express from "express";
import Admin from "../models/AdminModel.js";
import Venue from "../models/VenueModel.js";
import RatingFeedback from "../models/RatingFeedbackModel.js";
import { isAdmin } from "../middleare/isAdmin.js";

const fixPath = (filePath = "") => filePath.replace(/\\/g, "/");

const buildVenueResponse = (venue, req) => ({
    ...venue._doc,
    mediaFiles: venue.mediaFiles?.map((file) =>
        file ? `${req.protocol}://${req.get("host")}/${fixPath(file)}` : null
    ),
});

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

// Admin: Get all venues with vendor details
router.get("/venues", async (req, res) => {
    try {
        const venues = await Venue.find().populate("vendorId", "fullName email phone businessName businessType address city state zip pincode status");
        const response = venues.map((venue) => buildVenueResponse(venue, req));
        res.json(response);
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

// Admin: Get all reviews across all venues
router.get("/reviews", isAdmin, async (req, res) => {
    try {
        const reviews = await RatingFeedback.find()
            .populate("userId", "name email")
            .populate("venueId", "name");
            
        const allReviews = reviews.map(r => ({
            ...r._doc,
            venueId: r.venueId?._id,
            venueName: r.venueId?.name
        }));
        
        // Sort by newest first
        allReviews.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.json(allReviews);
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
