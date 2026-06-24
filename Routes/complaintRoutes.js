import express from "express";
import mongoose from "mongoose";
import Complaint from "../models/ComplaintModel.js";
import ComplaintMessage from "../models/ComplaintMessageModel.js";
import User from "../models/UserModel.js";
import Vendor from "../models/VendorModel.js";
import Admin from "../models/AdminModel.js";
import Venue from "../models/VenueModel.js";
import complaintUpload from "../middleare/complaintUpload.js";
import { isUser } from "../middleare/isUser.js";
import { isAdmin } from "../middleare/isAdmin.js";
import { paginate } from "../utils/pagination.js";

const router = express.Router();

// Middleware to block suspended users/vendors using headers directly
const checkComplaintAuthStatus = async (req, res, next) => {
    const userId = req.headers.userid || req.headers["userid"];
    const vendorId = req.headers.vendorid || req.headers["vendorid"];

    try {
        if (userId) {
            const user = await User.findById(userId);
            if (user && user.status === "suspended") {
                return res.status(403).json({ message: "Access denied. Your account is suspended." });
            }
        }
        if (vendorId) {
            const vendor = await Vendor.findById(vendorId);
            if (vendor && vendor.status === "suspended") {
                return res.status(403).json({ message: "Access denied. Your vendor account is suspended." });
            }
        }
        next();
    } catch (err) {
        res.status(500).json({ message: "Auth validation error", error: err.message });
    }
};

router.use(checkComplaintAuthStatus);

// Helper to sanitize paths
const fixPath = (filePath = "") => filePath.replace(/\\/g, "/");

// 1. Submit Complaint (User Only)
router.post("/", isUser, complaintUpload.array("attachments", 5), async (req, res) => {
    try {
        const { title, description, vendor, venue } = req.body;
        const user = req.userId;

        // Auto-assign vendor if venue is specified but vendor is not
        let vendorId = vendor || null;
        if (venue && !vendorId) {
            try {
                const foundVenue = await Venue.findById(venue);
                if (foundVenue && foundVenue.vendorId) {
                    vendorId = foundVenue.vendorId;
                }
            } catch (err) {
                console.error("Venue auto-assignment lookup error:", err);
            }
        }

        const attachmentPaths = req.files ? req.files.map(file => fixPath(file.path)) : [];

        const complaint = new Complaint({
            title,
            description,
            user,
            vendor: vendorId || undefined,
            venue: venue || undefined,
            attachments: attachmentPaths
        });

        await complaint.save();
        res.status(201).json({ message: "Complaint submitted successfully", complaint });
    } catch (error) {
        console.error("COMPLAINT SUBMISSION ERROR:", error);
        res.status(400).json({ message: "Failed to submit complaint", error: error.message });
    }
});

// 2. Get All/Filter Complaints (User, Vendor, Admin RBAC)
router.get("/", async (req, res) => {
    try {
        const userId = req.headers.userid || req.headers["userid"];
        const vendorId = req.headers.vendorid || req.headers["vendorid"];
        const adminId = req.headers.adminid || req.headers["adminid"];

        let query = {};

        if (adminId) {
            // Admin can see everything
        } else if (vendorId) {
            query.vendor = vendorId;
        } else if (userId) {
            query.user = userId;
        } else {
            return res.status(401).json({ message: "Unauthorized. Missing identifier headers." });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const sortBy = req.query.sortBy || 'createdAt';
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
        const skip = (page - 1) * limit;

        if (search) {
            const regex = new RegExp(search.trim(), "i");
            query.$or = [
                { title: regex },
                { status: regex }
            ];
        }

        const [complaints, totalRecords] = await Promise.all([
            Complaint.find(query)
                .populate([
                    { path: "user", select: "name email phone" },
                    { path: "vendor", select: "fullName businessName email" },
                    { path: "venue", select: "name city" }
                ])
                .sort({ [sortBy]: sortOrder })
                .skip(skip)
                .limit(limit)
                .lean(),
            Complaint.countDocuments(query)
        ]);

        const data = complaints.map(complaint => {
            if (complaint.attachments) {
                complaint.attachments = complaint.attachments.map(att => 
                    att.startsWith("http") ? att : `${req.protocol}://${req.get("host")}/${att}`
                );
            }
            return complaint;
        });

        return res.status(200).json({
            data,
            page,
            limit,
            totalRecords,
            totalPages: Math.ceil(totalRecords / limit)
        });
    } catch (error) {
        res.status(500).json({ message: "Failed to retrieve complaints", error: error.message });
    }
});

// 3. Get Single Complaint Details (RBAC)
router.get("/:id", async (req, res) => {
    try {
        const userId = req.headers.userid || req.headers["userid"];
        const vendorId = req.headers.vendorid || req.headers["vendorid"];
        const adminId = req.headers.adminid || req.headers["adminid"];

        if (!userId && !vendorId && !adminId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const complaint = await Complaint.findById(req.params.id)
            .populate("user", "name email phone")
            .populate("vendor", "fullName businessName email")
            .populate("venue", "name city");

        if (!complaint) {
            return res.status(404).json({ message: "Complaint not found" });
        }

        // Validate access permissions
        if (adminId) {
            // Admin OK
        } else if (vendorId && String(complaint.vendor?._id || complaint.vendor) === vendorId) {
            // Vendor OK
        } else if (userId && String(complaint.user?._id || complaint.user) === userId) {
            // User OK
        } else {
            return res.status(403).json({ message: "Forbidden. You do not have access to this complaint." });
        }

        const compObj = complaint.toObject();
        if (compObj.attachments) {
            compObj.attachments = compObj.attachments.map(att => 
                att.startsWith("http") ? att : `${req.protocol}://${req.get("host")}/${att}`
            );
        }

        res.json(compObj);
    } catch (error) {
        res.status(500).json({ message: "Failed to retrieve complaint", error: error.message });
    }
});

// 4. Update Complaint Status (Vendor and Admin Only)
router.put("/:id/status", async (req, res) => {
    try {
        const vendorId = req.headers.vendorid || req.headers["vendorid"];
        const adminId = req.headers.adminid || req.headers["adminid"];
        const { status } = req.body;

        if (!vendorId && !adminId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        if (!["Open", "In Progress", "Resolved", "Closed", "Rejected"].includes(status)) {
            return res.status(400).json({ message: "Invalid status value" });
        }

        const complaint = await Complaint.findById(req.params.id);
        if (!complaint) {
            return res.status(404).json({ message: "Complaint not found" });
        }

        // Validate modification permissions
        if (adminId) {
            // Admin OK
        } else if (vendorId && String(complaint.vendor?._id || complaint.vendor) === vendorId) {
            // Vendor OK
            if (status === "Rejected") {
                return res.status(403).json({ message: "Forbidden. Only administrators can reject complaints." });
            }
        } else {
            return res.status(403).json({ message: "Forbidden. Cannot update status." });
        }

        complaint.status = status;
        await complaint.save();

        res.json({ message: `Complaint status updated to ${status}`, complaint });
    } catch (error) {
        res.status(500).json({ message: "Failed to update status", error: error.message });
    }
});

// 5. Assign Complaint to Vendor (Admin Only)
router.put("/:id/assign", isAdmin, async (req, res) => {
    try {
        const { vendorId } = req.body;
        const complaint = await Complaint.findById(req.params.id);
        if (!complaint) {
            return res.status(404).json({ message: "Complaint not found" });
        }

        complaint.vendor = vendorId || undefined;
        await complaint.save();

        res.json({ message: "Complaint assigned successfully", complaint });
    } catch (error) {
        res.status(500).json({ message: "Failed to assign complaint", error: error.message });
    }
});

// 6. Get Thread Messages
router.get("/:id/messages", async (req, res) => {
    try {
        const userId = req.headers.userid || req.headers["userid"];
        const vendorId = req.headers.vendorid || req.headers["vendorid"];
        const adminId = req.headers.adminid || req.headers["adminid"];

        if (!userId && !vendorId && !adminId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const complaint = await Complaint.findById(req.params.id);
        if (!complaint) {
            return res.status(404).json({ message: "Complaint not found" });
        }

        // Validate access permissions
        if (adminId) {
            // Admin OK
        } else if (vendorId && String(complaint.vendor?._id || complaint.vendor) === vendorId) {
            // Vendor OK
        } else if (userId && String(complaint.user?._id || complaint.user) === userId) {
            // User OK
        } else {
            return res.status(403).json({ message: "Forbidden" });
        }

        const messages = await ComplaintMessage.find({ complaintId: req.params.id })
            .sort({ createdAt: 1 });

        const populatedMessages = [];
        for (const msg of messages) {
            const msgObj = msg.toObject();
            let senderName = "Unknown";
            
            if (msg.senderModel === "User") {
                const u = await User.findById(msg.senderId).select("name");
                if (u) senderName = u.name;
            } else if (msg.senderModel === "Vendor") {
                const v = await Vendor.findById(msg.senderId).select("fullName businessName");
                if (v) senderName = v.fullName || v.businessName;
            } else if (msg.senderModel === "Admin") {
                const a = await Admin.findById(msg.senderId).select("username");
                if (a) senderName = a.username || "Admin";
            }
            
            msgObj.senderName = senderName;
            populatedMessages.push(msgObj);
        }

        res.json(populatedMessages);
    } catch (error) {
        res.status(500).json({ message: "Failed to get messages", error: error.message });
    }
});

// 7. Post Message to Thread
router.post("/:id/messages", async (req, res) => {
    try {
        const userId = req.headers.userid || req.headers["userid"];
        const vendorId = req.headers.vendorid || req.headers["vendorid"];
        const adminId = req.headers.adminid || req.headers["adminid"];
        const { message } = req.body;

        if (!userId && !vendorId && !adminId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        if (!message || !message.trim()) {
            return res.status(400).json({ message: "Message content is required" });
        }

        const complaint = await Complaint.findById(req.params.id);
        if (!complaint) {
            return res.status(404).json({ message: "Complaint not found" });
        }

        let senderId, senderModel;

        if (adminId) {
            senderId = adminId;
            senderModel = "Admin";
        } else if (vendorId && String(complaint.vendor?._id || complaint.vendor) === vendorId) {
            senderId = vendorId;
            senderModel = "Vendor";
        } else if (userId && String(complaint.user?._id || complaint.user) === userId) {
            senderId = userId;
            senderModel = "User";
        } else {
            return res.status(403).json({ message: "Forbidden" });
        }

        const newMessage = new ComplaintMessage({
            complaintId: req.params.id,
            senderId,
            senderModel,
            message
        });

        await newMessage.save();

        const msgObj = newMessage.toObject();
        let senderName = "Unknown";
        if (senderModel === "User") {
            const u = await User.findById(senderId).select("name");
            senderName = u?.name || "User";
        } else if (senderModel === "Vendor") {
            const v = await Vendor.findById(senderId).select("fullName");
            senderName = v?.fullName || "Vendor";
        } else if (senderModel === "Admin") {
            const a = await Admin.findById(senderId).select("username");
            senderName = a?.username || "Admin";
        }
        msgObj.senderName = senderName;

        res.status(201).json(msgObj);
    } catch (error) {
        res.status(500).json({ message: "Failed to send message", error: error.message });
    }
});

export default router;
