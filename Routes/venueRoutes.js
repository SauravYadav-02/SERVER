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

import RatingFeedback from "../models/RatingFeedbackModel.js";

// Helper to attach rating stats to an array of venues
const attachRatingStats = async (venues) => {
  if (venues.length === 0) return venues;

  const venueIds = venues.map(v => v._id);
  const stats = await RatingFeedback.aggregate([
    { $match: { venueId: { $in: venueIds }, status: "approved" } },
    {
      $group: {
        _id: "$venueId",
        averageRating: { $avg: "$rating" },
        ratingCount: { $sum: 1 },
      },
    },
  ]);

  const statsMap = stats.reduce((acc, stat) => {
    acc[stat._id.toString()] = {
      averageRating: Number(stat.averageRating.toFixed(1)),
      ratingCount: stat.ratingCount,
    };
    return acc;
  }, {});

  return venues.map(venue => {
    const venueObj = venue.toObject ? venue.toObject() : venue;
    const venueStats = statsMap[venue._id.toString()] || { averageRating: 0, ratingCount: 0 };
    return { ...venueObj, ...venueStats };
  });
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

    let venueTypes = [];
    if (venueData.venueTypes) {
      try {
        venueTypes = JSON.parse(venueData.venueTypes);
      } catch {
        venueTypes = typeof venueData.venueTypes === 'string' ? venueData.venueTypes.split(',').map(s => s.trim()) : venueData.venueTypes;
      }
    }

    let eventsSupported = [];
    if (venueData.eventsSupported) {
      try {
        eventsSupported = JSON.parse(venueData.eventsSupported);
      } catch {
        eventsSupported = typeof venueData.eventsSupported === 'string' ? venueData.eventsSupported.split(',').map(s => s.trim()) : venueData.eventsSupported;
      }
    }

    let amenities = [];
    if (venueData.amenities) {
      try {
        amenities = JSON.parse(venueData.amenities);
      } catch {
        amenities = typeof venueData.amenities === 'string' ? venueData.amenities.split(',').map(s => s.trim()) : venueData.amenities;
      }
    }

    const firstType = Array.isArray(venueTypes) && venueTypes.length > 0 ? venueTypes[0] : (venueData.type || "");

    const venue = new Venue({
      ...venueData,
      type: firstType,
      venueTypes: Array.isArray(venueTypes) ? venueTypes : [],
      eventsSupported: Array.isArray(eventsSupported) ? eventsSupported : [],
      amenities: Array.isArray(amenities) ? amenities : [],
      mediaFiles: imagePaths,
    });

    await venue.save();

    res.status(201).json(venue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ─────────────────────────────────────────────────────────────
// ✅ GET /venues/discover — Paginated, searchable, filterable
//    Query params:
//      page, limit, search, city, category,
//      minPrice, maxPrice, capacity, sort
// ─────────────────────────────────────────────────────────────
router.get("/discover", async (req, res) => {
  try {
    // ── Parse & validate query params ─────────────────────────
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 9));
    const skip  = (page - 1) * limit;

    const { search, city, category, minPrice, maxPrice, capacity, sort } = req.query;

    // ── Build Mongoose filter object ──────────────────────────
    // Start with the required base conditions
    const andConditions = [
      { status: "approved" },
      { isSubscriptionActive: true },
    ];

    // Full-text search: regex across name, description, city, type
    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), "i");
      andConditions.push({
        $or: [
          { name:        regex },
          { description: regex },
          { city:        regex },
          { type:        regex },
        ],
      });
    }

    // City filter (case-insensitive partial match)
    if (city && city.trim()) {
      andConditions.push({ city: new RegExp(city.trim(), "i") });
    }

    // Venue type/category filter
    if (category && category.trim()) {
      andConditions.push({ type: new RegExp(category.trim(), "i") });
    }

    // Price range filter
    if (minPrice || maxPrice) {
      const priceFilter = {};
      if (minPrice && !isNaN(Number(minPrice))) priceFilter.$gte = Number(minPrice);
      if (maxPrice && !isNaN(Number(maxPrice))) priceFilter.$lte = Number(maxPrice);
      if (Object.keys(priceFilter).length > 0) {
        andConditions.push({ pricePerDay: priceFilter });
      }
    }

    // Minimum capacity filter
    if (capacity && !isNaN(Number(capacity)) && Number(capacity) > 0) {
      andConditions.push({ capacity: { $gte: Number(capacity) } });
    }

    // Combine all conditions with $and
    const filter = { $and: andConditions };

    // ── Build sort object ─────────────────────────────────────
    let sortObj = {};
    switch (sort) {
      case "price_low":     sortObj = { pricePerDay: 1 };                          break;
      case "price_high":    sortObj = { pricePerDay: -1 };                         break;
      case "rating_high":   sortObj = { averageRating: -1, totalReviews: -1 };     break;
      case "capacity_high": sortObj = { capacity: -1 };                            break;
      case "oldest":        sortObj = { createdAt: 1 };                            break;
      default:              sortObj = { createdAt: -1 };   // newest
    }

    // ── Execute count + paginated query in parallel ───────────
    const [totalItems, rawVenues] = await Promise.all([
      Venue.countDocuments(filter),
      Venue.find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .populate("vendorId", "fullName email")
        .lean(),
    ]);

    // ── Attach live rating stats ──────────────────────────────
    const venues = await attachRatingStats(rawVenues);

    // ── Pagination metadata ───────────────────────────────────
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    const pagination = {
      totalItems,
      totalPages,
      currentPage: page,
      pageSize:    limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };

    res.json({ venues, pagination });
  } catch (err) {
    console.error("[/discover] Error:", err.message, err.stack);
    res.status(500).json({ error: err.message });
  }
});


// ✅ Get All Venues (subscription-filtered for public users)
router.get("/", async (req, res) => {
  try {
    // Admin bypass: pass ?admin=true to see all venues regardless of subscription
    if (req.query.admin === "true") {
      let venues = await Venue.find()
        .populate("vendorId", "fullName email");
      venues = await attachRatingStats(venues);
      return res.json(venues);
    }

    // Optimized query: filter directly in DB for better performance
    let visibleVenues = await Venue.find({
      status: "approved",
      isSubscriptionActive: true
    })
      .populate("vendorId", "fullName email");

    visibleVenues = await attachRatingStats(visibleVenues);

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

    let venues = await Venue.find(query);
    venues = await attachRatingStats(venues);

    res.json(venues);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});







// ✅ 4. GET Single Venue (Full Details — subscription-gated)
router.get("/:id", async (req, res) => {
  try {
    const venue = await Venue.findById(req.params.id);

    if (!venue) {
      return res.status(404).json({ message: "Venue not found" });
    }

    // Attach stats dynamically
    const venuesWithStats = await attachRatingStats([venue]);
    const finalVenue = venuesWithStats[0];

    // Admin bypass
    if (req.query.admin === "true") {
      return res.json(finalVenue);
    }

    // Check vendor's subscription status
    const subStatus = await getVendorSubscriptionStatus(venue.vendorId);

    if (subStatus === "expired" || subStatus === "none") {
      // Allow access if the requesting user has a booking for this venue
      const requestingUserId = req.query.userId;
      if (requestingUserId) {
        const hasBooking = await Booking.findOne({
          venueId: venue._id,
          userId: requestingUserId,
        });
        if (hasBooking) {
          return res.json(finalVenue); // Booked venue always accessible
        }
      }
      return res.status(403).json({
        message: "This venue is currently unavailable (vendor subscription expired).",
      });
    }

    res.json(finalVenue);
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

    let venueTypes = [];
    if (updateData.venueTypes) {
      try {
        venueTypes = JSON.parse(updateData.venueTypes);
      } catch {
        venueTypes = typeof updateData.venueTypes === 'string' ? updateData.venueTypes.split(',').map(s => s.trim()) : updateData.venueTypes;
      }
      updateData.venueTypes = Array.isArray(venueTypes) ? venueTypes : [];
      if (updateData.venueTypes.length > 0) {
        updateData.type = updateData.venueTypes[0];
      }
    }

    let eventsSupported = [];
    if (updateData.eventsSupported) {
      try {
        eventsSupported = JSON.parse(updateData.eventsSupported);
      } catch {
        eventsSupported = typeof updateData.eventsSupported === 'string' ? updateData.eventsSupported.split(',').map(s => s.trim()) : updateData.eventsSupported;
      }
      updateData.eventsSupported = Array.isArray(eventsSupported) ? eventsSupported : [];
    }

    let amenities = [];
    if (updateData.amenities) {
      try {
        amenities = JSON.parse(updateData.amenities);
      } catch {
        amenities = typeof updateData.amenities === 'string' ? updateData.amenities.split(',').map(s => s.trim()) : updateData.amenities;
      }
      updateData.amenities = Array.isArray(amenities) ? amenities : [];
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
