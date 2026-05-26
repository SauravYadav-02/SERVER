import express from "express";
import User from "../models/UserModel.js";
import userUpload from "../middleare/userUpload.js";
import { isAdmin } from "../middleare/isAdmin.js";
import { paginate } from "../utils/pagination.js";

const router = express.Router();

const fixPath = (filePath = "") => filePath.replace(/\\/g, "/");

const buildUserResponse = (user, req) => {
    const response = user.toObject ? user.toObject() : user;

    if (response.profilePhoto && !response.profilePhoto.startsWith("http")) {
        response.profilePhoto = `${req.protocol}://${req.get("host")}/${fixPath(response.profilePhoto)}`;
    }

    return response;
};

// Register with profile photo
router.post("/register", userUpload.single("profilePhoto"), async (req, res) => {
    try {
        console.log("=== INCOMING REGISTRATION ===");
        console.log("BODY:", req.body);
        console.log("FILE:", req.file);
        
        const userData = req.body;
        
        // Ensure terms are accepted
        if (!userData.acceptedTermsVersion) {
            return res.status(400).json({ message: "You must accept the terms and conditions and provide the accepted terms version." });
        }
        
        // Add profile photo path if file was uploaded
        if (req.file) {
            userData.profilePhoto = req.file.path.replace(/\\/g, "/");
        }

        const user = new User(userData);
        await user.save();
        const response = buildUserResponse(user, req);
        delete response.password;
        res.status(201).json({ message: "User registered", user: response });
    } catch (error) {
        console.error("REGISTRATION ERROR:", error);
        res.status(400).json({ message: "Registration failed", error: error.message });
    }
});

// Login
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email }).select("+password");

        if (!user || user.password !== password) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        const response = buildUserResponse(user, req);
        delete response.password;
        res.json({ message: "Login success", user: response });
    } catch (error) {
        res.status(500).json({ message: "Login failed", error: error.message });
    }
});

// Get all users (Admin - Paginated)
router.get("/", isAdmin, async (req, res) => {
    try {
        const { page, limit, search } = req.query;
        
        const query = { deleted: { $ne: true } };
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
            ];
        }

        const paginationResult = await paginate(User, query, {
            page,
            limit,
            sort: { createdAt: -1 }
        });

        paginationResult.data = paginationResult.data.map((user) => {
            const u = buildUserResponse(user, req);
            delete u.password;
            return u;
        });
        
        res.json(paginationResult);
    } catch (error) {
        res.status(500).json({ message: "Failed to retrieve users", error: error.message });
    }
});

// Get a specific user by ID
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id).select("-password");

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json(buildUserResponse(user, req));
    } catch (error) {
        res.status(500).json({ message: "Failed to retrieve user", error: error.message });
    }
});

// Update a specific user by ID with profile photo
router.put("/:id", userUpload.single("profilePhoto"), async (req, res) => {
    try {
        const { id } = req.params;
        const allowedUpdates = ["name", "email", "phone", "address", "city", "pinCode", "profilePhoto"];
        const updates = {};

        allowedUpdates.forEach((field) => {
            if (field === "profilePhoto" && req.file) {
                updates[field] = req.file.path.replace(/\\/g, "/");
            } else if (req.body[field] !== undefined && field !== "profilePhoto") {
                updates[field] = req.body[field];
            }
        });

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: "No valid fields provided for update" });
        }

        const user = await User.findByIdAndUpdate(id, updates, {
            new: true,
            runValidators: true,
            context: "query"
        }).select("-password");

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({ message: "User updated", user: buildUserResponse(user, req) });
    } catch (error) {
        res.status(500).json({ message: "Failed to update user", error: error.message });
    }
});

// Soft delete a specific user by ID
router.delete("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findByIdAndUpdate(id, { deleted: true }, { new: true });
        res.json({ message: "User soft deleted", user });
    } catch (error) {
        res.status(500).json({ message: "Failed to soft delete user", error: error.message });
    }
});
export default router;
