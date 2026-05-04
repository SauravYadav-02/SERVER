import User from "../models/UserModel.js";

// GET /api/wishlist
export const getWishlist = async (req, res) => {
    try {
        const userId = req.userId; // From isUser middleware
        const user = await User.findById(userId).populate("wishlist");

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({ wishlist: user.wishlist });
    } catch (error) {
        console.error("Error getting wishlist:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// POST /api/wishlist/:venueId
export const addToWishlist = async (req, res) => {
    try {
        const userId = req.userId;
        const { venueId } = req.params;

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Avoid duplicates
        if (user.wishlist.includes(venueId)) {
            return res.status(400).json({ message: "Venue already in wishlist" });
        }

        user.wishlist.push(venueId);
        await user.save();

        res.status(200).json({ message: "Venue added to wishlist", wishlist: user.wishlist });
    } catch (error) {
        console.error("Error adding to wishlist:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// DELETE /api/wishlist/:venueId
export const removeFromWishlist = async (req, res) => {
    try {
        const userId = req.userId;
        const { venueId } = req.params;

        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        user.wishlist = user.wishlist.filter(id => id.toString() !== venueId);
        await user.save();

        res.status(200).json({ message: "Venue removed from wishlist", wishlist: user.wishlist });
    } catch (error) {
        console.error("Error removing from wishlist:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};
