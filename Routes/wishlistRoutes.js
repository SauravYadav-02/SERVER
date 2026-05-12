import express from "express";
import { getWishlist, addToWishlist, removeFromWishlist } from "../controllers/wishlistController.js";
import { isUser } from "../middleare/isUser.js";

const router = express.Router();

// Apply auth middleware to all routes
router.use(isUser);

// GET /api/wishlist -> return all wishlisted venues
router.get("/", getWishlist);

// POST /api/wishlist/:venueId -> add venue to wishlist
router.post("/:venueId", addToWishlist);

// DELETE /api/wishlist/:venueId -> remove venue from wishlist
router.delete("/:venueId", removeFromWishlist);

export default router;
