import express from "express";
import RatingFeedback from "../models/RatingFeedbackModel.js";
import Venue from "../models/VenueModel.js";
import User from "../models/UserModel.js";

const router = express.Router();

// Helper to calculate rating stats for a venue
const getRatingStats = async (venueId) => {
  const result = await RatingFeedback.aggregate([
    { $match: { venueId: venueId, status: "approved" } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: "$rating" },
        ratingCount: { $sum: 1 },
      },
    },
  ]);

  if (result.length > 0) {
    return {
      averageRating: Number(result[0].averageRating.toFixed(1)),
      ratingCount: result[0].ratingCount,
    };
  }
  return { averageRating: 0, ratingCount: 0 };
};

// GET ratings for a venue (public)
router.get("/venue/:venueId", async (req, res) => {
  try {
    const { venueId } = req.params;
    const { admin, vendorId, userId } = req.query;

    const venue = await Venue.findById(venueId);
    if (!venue) {
      return res.status(404).json({ message: "Venue not found" });
    }

    const isAdmin = admin === "true";
    const isOwner = vendorId === venue.vendorId?.toString();

    let query = { venueId: venue._id };

    if (!isAdmin && !isOwner) {
      if (userId) {
        query.$or = [{ status: "approved" }, { userId: userId }];
      } else {
        query.status = "approved";
      }
    }

    const reviews = await RatingFeedback.find(query)
      .populate("userId", "name email profilePhoto")
      .sort({ createdAt: -1 });

    const stats = await getRatingStats(venue._id);

    res.json({
      reviews,
      averageRating: stats.averageRating,
      ratingCount: stats.ratingCount,
    });
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(400).json({ message: "Invalid venueId" });
    }
    res.status(500).json({ error: err.message });
  }
});

// POST Add or update a review
router.post("/venue/:venueId", async (req, res) => {
  try {
    const { venueId } = req.params;
    const { userId, rating, feedback } = req.body;

    const numericRating = Number(rating);
    const feedbackText = typeof feedback === "string" ? feedback : "";

    if (!userId) return res.status(400).json({ message: "userId is required" });
    if (!numericRating || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }
    if (feedbackText.length > 500) {
      return res.status(400).json({ message: "Feedback cannot exceed 500 characters" });
    }

    const [venue, user] = await Promise.all([
      Venue.findById(venueId),
      User.findById(userId),
    ]);

    if (!venue) return res.status(404).json({ message: "Venue not found" });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Check for existing review
    let review = await RatingFeedback.findOne({ venueId: venue._id, userId: user._id });

    let message = "";
    if (review) {
      review.rating = numericRating;
      review.feedback = feedbackText;
      review.status = "pending";
      await review.save();
      message = "Review updated successfully";
    } else {
      review = new RatingFeedback({
        venueId: venue._id,
        userId: user._id,
        rating: numericRating,
        feedback: feedbackText,
        status: "pending",
      });
      await review.save();
      message = "Review added successfully";
    }

    const stats = await getRatingStats(venue._id);

    // Return the updated reviews list to the user
    const query = { venueId: venue._id, $or: [{ status: "approved" }, { userId: user._id }] };
    const reviews = await RatingFeedback.find(query)
      .populate("userId", "name email profilePhoto")
      .sort({ createdAt: -1 });

    res.json({
      message,
      averageRating: stats.averageRating,
      ratingCount: stats.ratingCount,
      reviews,
    });
  } catch (err) {
    if (err.name === "CastError") {
      return res.status(400).json({ message: "Invalid venueId or userId" });
    }
    res.status(500).json({ error: err.message });
  }
});

// GET all reviews for a vendor's venues with filtering, sorting, pagination and analytics
router.get("/vendor/:vendorId", async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { sort, venueId, page = 1, limit = 10 } = req.query;

    const venues = await Venue.find({ vendorId }).select("_id name");
    if (!venues || venues.length === 0) {
      return res.json({ reviews: [], analytics: null, totalPages: 0, currentPage: 1 });
    }

    const venueIds = venues.map((v) => v._id);
    const query = { venueId: { $in: venueIds } };

    // Filter by specific venue if provided
    if (venueId && venueId !== "all") {
      query.venueId = venueId;
    }

    // Sorting
    let sortOptions = { createdAt: -1 }; // Default: latest
    if (sort === "highest") sortOptions = { rating: -1, createdAt: -1 };
    if (sort === "lowest") sortOptions = { rating: 1, createdAt: -1 };

    // Pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Fetch paginated reviews
    const reviews = await RatingFeedback.find(query)
      .populate("userId", "name email profilePhoto")
      .populate("venueId", "name")
      .sort(sortOptions)
      .skip(skip)
      .limit(Number(limit));

    const totalReviewsCount = await RatingFeedback.countDocuments(query);

    // Analytics: Calculate across ALL venues of this vendor (ignoring specific venue filter for overall vendor analytics)
    const allVendorReviewsQuery = { venueId: { $in: venueIds } };
    const analyticsData = await RatingFeedback.aggregate([
      { $match: allVendorReviewsQuery },
      {
        $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          totalReviews: { $sum: 1 },
          ratings: { $push: "$rating" },
        },
      },
    ]);

    let analytics = {
      averageRating: 0,
      totalReviews: 0,
      distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    };

    if (analyticsData.length > 0) {
      const data = analyticsData[0];
      analytics.averageRating = Number(data.averageRating.toFixed(1));
      analytics.totalReviews = data.totalReviews;

      data.ratings.forEach((r) => {
        if (analytics.distribution[r] !== undefined) {
          analytics.distribution[r]++;
        }
      });
    }

    res.json({
      reviews,
      analytics,
      totalPages: Math.ceil(totalReviewsCount / Number(limit)),
      currentPage: Number(page),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all reviews (admin use)
router.get("/", async (req, res) => {
  try {
    const query = {};
    if (req.query.status) {
      query.status = req.query.status;
    }
    const reviews = await RatingFeedback.find(query)
      .populate("userId", "name email profilePhoto")
      .populate("venueId", "name vendorId")
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH Approve a review
router.patch("/:id/approve", async (req, res) => {
  try {
    const review = await RatingFeedback.findByIdAndUpdate(
      req.params.id,
      { status: "approved" },
      { new: true }
    );
    if (!review) return res.status(404).json({ message: "Review not found" });
    res.json(review);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH Reject a review
router.patch("/:id/reject", async (req, res) => {
  try {
    const review = await RatingFeedback.findByIdAndUpdate(
      req.params.id,
      { status: "rejected" },
      { new: true }
    );
    if (!review) return res.status(404).json({ message: "Review not found" });
    res.json(review);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE a review
router.delete("/:id", async (req, res) => {
  try {
    const review = await RatingFeedback.findByIdAndDelete(req.params.id);
    if (!review) return res.status(404).json({ message: "Review not found" });
    res.json({ message: "Review deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
