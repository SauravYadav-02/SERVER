import express from "express";
import Venue from "../models/VenueModel.js";
import "../models/VendorModel.js";
import User from "../models/UserModel.js";
import Booking from "../models/BookingModel.js";
import venueUpload from "../middleare/venueUpload.js";
import fs from "fs/promises";
import { getVendorSubscriptionStatus } from "../services/subscriptionService.js";

const router = express.Router();

// ─────────────────────────────────────────────────────────────
// Helper: Resolve visibility for an array of venues.
// A venue is public-visible when:
//   1. Status is "approved", OR
//   2. Vendor's subscription status is "active" or "grace"
// Rejected venues are never shown.
// Returns only visible venues.
// ─────────────────────────────────────────────────────────────
const filterVisibleVenues = async (venues) => {
  return venues.filter(venue => {
    // 1. Rejected venues are NEVER shown
    if (venue.status === "rejected") return false;

    // 2. MUST have an active subscription (or be in grace period)
    if (!venue.isSubscriptionActive) return false;

    // 3. Show if admin-approved, OR if it's pending (since sub is active)
    //    Actually, usually users only see approved venues. 
    //    If business rule is: only approved + active sub, then:
    return venue.status === "approved";
  });
};

const updateRatingSummary = (venue) => {
  const totalRating = venue.reviews.reduce((sum, review) => sum + review.rating, 0);
  venue.ratingCount = venue.reviews.length;
  venue.averageRating = venue.ratingCount ? Number((totalRating / venue.ratingCount).toFixed(1)) : 0;
};

// ✅ Create Venue (with images)
router.post("/add", venueUpload.array("mediaFiles", 10), async (req, res) => {
  try {
    const { vendorId } = req.body;
    
    // ✅ Safeguard: Check subscription before allowing new venue creation
    const subStatus = await getVendorSubscriptionStatus(vendorId);
    if (subStatus === "expired" || subStatus === "none") {
      return res.status(403).json({ 
        message: "Action forbidden: You need an active subscription to list new venues." 
      });
    }

    const imagePaths = req.files?.map((file) => file.path);
    const { reviews, averageRating, ratingCount, ...venueData } = req.body;

    const venue = new Venue({
      ...venueData,
      mediaFiles: imagePaths,
    });

    await venue.save();

    res.status(201).json(venue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ✅ Get All Venues (subscription-filtered for public users)
router.get("/", async (req, res) => {
  try {
    // Admin bypass: pass ?admin=true to see all venues regardless of subscription
    if (req.query.admin === "true") {
      const venues = await Venue.find()
        .populate("vendorId", "fullName email")
        .populate("reviews.userId", "name email");
      return res.json(venues);
    }

    // Optimized query: filter directly in DB for better performance
    const visibleVenues = await Venue.find({
      status: "approved",
      isSubscriptionActive: true
    })
      .populate("vendorId", "fullName email")
      .populate("reviews.userId", "name email profilePhoto");

    res.json(visibleVenues);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// router.get("/", async (req, res) => {
//   try {
//     // Admin bypass: pass ?admin=true to see all venues regardless of subscription
//     if (req.query.admin === "true") {
//       const venues = await Venue.find().populate("reviews.userId", "name email");
//       return res.json(venues);
//     }

//     // Optimized query: filter directly in DB for better performance
//     const visibleVenues = await Venue.find({
//       status: "approved",
//       isSubscriptionActive: true
//     }).populate("reviews.userId", "name email");

//     res.json(visibleVenues);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });



// ✅ 3. GET Venues by Vendor (filtered for public view)
router.get("/vendor/:vendorId", async (req, res) => {
  try {
    const query = { vendorId: req.params.vendorId };

    // Admin/Owner bypass: if requesting user is the vendor themselves or an admin, show all
    const isOwner = req.query.ownerId === req.params.vendorId;
    const isAdmin = req.query.admin === "true";

    if (!isOwner && !isAdmin) {
      query.status = "approved";
      query.isSubscriptionActive = true;
    }

    const venues = await Venue.find(query).populate("reviews.userId", "name email profilePhoto");
    res.json(venues);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});




// ✅ GET reviews for a venue (public — no subscription gate)
router.get("/:id/reviews", async (req, res) => {
  try {
    const venue = await Venue.findById(req.params.id)
      .select("reviews averageRating ratingCount")
      .populate("reviews.userId", "name email profilePhoto");

    if (!venue) {
      return res.status(404).json({ message: "Venue not found" });
    }

    res.json({
      reviews: venue.reviews,
      averageRating: venue.averageRating,
      ratingCount: venue.ratingCount,
    });
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(400).json({ message: "Invalid venueId" });
    }
    res.status(500).json({ error: err.message });
  }
});

// Add or update a venue rating and feedback
router.post("/:id/review", async (req, res) => {
  try {
    const { userId, rating, feedback } = req.body;
    const numericRating = Number(rating);
    const feedbackText = typeof feedback === "string" ? feedback : "";

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    if (!numericRating || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }

    if (feedbackText.length > 500) {
      return res.status(400).json({ message: "Feedback cannot exceed 500 characters" });
    }

    const [venue, user] = await Promise.all([
      Venue.findById(req.params.id),
      User.findById(userId),
    ]);

    if (!venue) {
      return res.status(404).json({ message: "Venue not found" });
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const existingReview = venue.reviews.find(
      (review) => review.userId.toString() === userId
    );

    if (existingReview) {
      existingReview.rating = numericRating;
      existingReview.feedback = feedbackText;
      existingReview.createdAt = new Date();
    } else {
      venue.reviews.push({
        userId,
        rating: numericRating,
        feedback: feedbackText,
      });
    }

    updateRatingSummary(venue);
    await venue.save();
    await venue.populate("reviews.userId", "name email profilePhoto");

    res.json({
      message: existingReview ? "Review updated successfully" : "Review added successfully",
      averageRating: venue.averageRating,
      ratingCount: venue.ratingCount,
      reviews: venue.reviews,
    });
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(400).json({ message: "Invalid venueId or userId" });
    }

    res.status(500).json({ error: err.message });
  }
});


// ✅ 4. GET Single Venue (Full Details — subscription-gated)
router.get("/:id", async (req, res) => {
  try {
    const venue = await Venue.findById(req.params.id).populate("reviews.userId", "name email profilePhoto");

    if (!venue) {
      return res.status(404).json({ message: "Venue not found" });
    }

    // Admin bypass
    if (req.query.admin === "true") {
      return res.json(venue);
    }

    // Check vendor's subscription status
    const subStatus = await getVendorSubscriptionStatus(venue.vendorId);

    if (subStatus === "expired" || subStatus === "none") {
      // Allow access if the requesting user has a booking for this venue
      // (pass ?userId=<id> to indicate a logged-in user with a possible booking)
      const requestingUserId = req.query.userId;
      if (requestingUserId) {
        const hasBooking = await Booking.findOne({
          venueId: venue._id,
          userId: requestingUserId,
        });
        if (hasBooking) {
          return res.json(venue); // Booked venue always accessible
        }
      }
      return res.status(403).json({
        message: "This venue is currently unavailable (vendor subscription expired).",
      });
    }

    res.json(venue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});




// ✅ 5. UPDATE Venue (with optional new images)
router.put("/:id", venueUpload.array("mediaFiles", 10), async (req, res) => {
  try {
    const venue = await Venue.findById(req.params.id);

    if (!venue) {
      return res.status(404).json({ message: "Venue not found" });
    }

    // ✅ Safeguard: Check subscription before allowing updates (prevent reactivation)
    const subStatus = await getVendorSubscriptionStatus(venue.vendorId);
    if (subStatus === "expired" || subStatus === "none") {
       return res.status(403).json({ 
         message: "Action forbidden: Your subscription has expired. Please renew to manage your venues." 
       });
    }

    // ✅ Ownership check — only the venue's vendor can update it
    if (req.body.vendorId && venue.vendorId.toString() !== req.body.vendorId) {
      return res.status(403).json({ message: "Unauthorized: You do not own this venue" });
    }

    let imagePaths = venue.mediaFiles;

    // Only modify images if it's a multipart request (vendor form submission)
    if (req.is('multipart/form-data') || req.body.updateImages === 'true' || req.files?.length > 0 || req.body.mediaFiles !== undefined) {
      let keptImages = req.body.mediaFiles || [];
      if (!Array.isArray(keptImages)) {
        keptImages = [keptImages];
      }

      // Identify images that were removed by the user
      const imagesToDelete = venue.mediaFiles.filter((oldFile) => !keptImages.includes(oldFile));

      // Delete removed images from disk
      await Promise.all(
        imagesToDelete.map(async (file) => {
          try {
            await fs.unlink(file);
          } catch {
            // ignore error if file doesn't exist
          }
        })
      );
      // Get newly uploaded image paths
      const newImagePaths = req.files ? req.files.map((file) => file.path) : [];

      // Final list of images
      imagePaths = [...keptImages, ...newImagePaths];
    }

    const updateData = {
      ...req.body,
      mediaFiles: imagePaths,
    };
    delete updateData.reviews;
    delete updateData.averageRating;
    delete updateData.ratingCount;

    // If the admin is not explicitly providing a status, reset it to pending (indicates vendor edit)
    if (!req.body.status) {
      updateData.status = "pending";
    }

    const updatedVenue = await Venue.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true },
    );

    res.json(updatedVenue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});





// ✅ 6. DELETE Single Venue (with images)
router.delete("/:id", async (req, res) => {
  try {
    const venue = await Venue.findById(req.params.id);

    if (!venue) {
      return res.status(404).json({ message: "Venue not found" });
    }

    // ✅ Ownership check — only the venue's vendor can delete it
    const requestingVendorId = req.query.vendorId || req.body.vendorId;
    if (requestingVendorId && venue.vendorId.toString() !== requestingVendorId) {
      return res.status(403).json({ message: "Unauthorized: You do not own this venue" });
    }

    // delete images from folder
    await Promise.all(
      venue.mediaFiles.map(async (file) => {
        try {
          await fs.unlink(file);
        } catch {
          // ignore error if file doesn't exist
        }
      })
    );

    await Venue.findByIdAndDelete(req.params.id);

    res.json({ message: "Venue deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});




// ✅ 7. PATCH Approve Venue
router.patch("/:id/approve", async (req, res) => {
  try {
    const venue = await Venue.findByIdAndUpdate(
      req.params.id,
      { status: "approved", adminDescription: "" },
      { new: true }
    );
    if (!venue) return res.status(404).json({ message: "Venue not found" });
    res.json(venue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});




// ✅ 8. PATCH Reject Venue
router.patch("/:id/reject", async (req, res) => {
  try {
    const { adminDescription } = req.body;
    const venue = await Venue.findByIdAndUpdate(
      req.params.id,
      { status: "rejected", adminDescription: adminDescription || "Rejected by admin" },
      { new: true }
    );
    if (!venue) return res.status(404).json({ message: "Venue not found" });
    res.json(venue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
