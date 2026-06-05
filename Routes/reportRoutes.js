import express from "express";
import Report from "../models/ReportModel.js";
import User from "../models/UserModel.js";
import Venue from "../models/VenueModel.js";
import reportUpload from "../middleare/reportUpload.js";
import { isUser } from "../middleare/isUser.js";
import { isAdmin } from "../middleare/isAdmin.js";

const router = express.Router();

// Helper to sanitize paths
const fixPath = (filePath = "") => filePath.replace(/\\/g, "/");

// Helper to format report attachments to full URLs
const formatAttachments = (report, req) => {
    const reportObj = report.toObject ? report.toObject() : report;
    if (reportObj.attachments) {
        reportObj.attachments = reportObj.attachments.map(att => 
            att.startsWith("http") ? att : `${req.protocol}://${req.get("host")}/${fixPath(att)}`
        );
    }
    return reportObj;
};

// 1. Submit Report (User Only)
router.post("/", isUser, reportUpload.array("attachments", 5), async (req, res) => {
    try {
        const { title, description, venue } = req.body;
        const user = req.userId;

        if (!venue) {
            return res.status(400).json({ message: "Venue ID is required to file a report" });
        }

        // Verify venue exists
        const foundVenue = await Venue.findById(venue);
        if (!foundVenue) {
            return res.status(404).json({ message: "Venue not found" });
        }

        const attachmentPaths = req.files ? req.files.map(file => fixPath(file.path)) : [];

        const report = new Report({
            title,
            description,
            user,
            venue,
            attachments: attachmentPaths
        });

        await report.save();
        res.status(201).json({ message: "Report submitted successfully", report: formatAttachments(report, req) });
    } catch (error) {
        console.error("REPORT SUBMISSION ERROR:", error);
        res.status(400).json({ message: "Failed to submit report", error: error.message });
    }
});

// 2. Get All/Filter Reports (RBAC: Admin sees all, User sees own, Vendor gets 403)
router.get("/", async (req, res) => {
    try {
        const userId = req.headers.userid || req.headers["userid"];
        const vendorId = req.headers.vendorid || req.headers["vendorid"];
        const adminId = req.headers.adminid || req.headers["adminid"];

        if (vendorId) {
            return res.status(403).json({ message: "Forbidden. Vendors do not have access to reports." });
        }

        let query = {};

        if (adminId) {
            // Admin sees everything
        } else if (userId) {
            query.user = userId;
        } else {
            return res.status(401).json({ message: "Unauthorized. Missing identifier headers." });
        }

        const reports = await Report.find(query)
            .populate("user", "name email phone")
            .populate({
                path: "venue",
                select: "name city vendorId",
                populate: {
                    path: "vendorId",
                    select: "fullName businessName email"
                }
            })
            .sort({ createdAt: -1 });

        const formattedReports = reports.map(report => formatAttachments(report, req));
        res.json(formattedReports);
    } catch (error) {
        res.status(500).json({ message: "Failed to retrieve reports", error: error.message });
    }
});

// 3. Get Single Report Details (RBAC: Admin or owning User only, Vendor gets 403)
router.get("/:id", async (req, res) => {
    try {
        const userId = req.headers.userid || req.headers["userid"];
        const vendorId = req.headers.vendorid || req.headers["vendorid"];
        const adminId = req.headers.adminid || req.headers["adminid"];

        if (vendorId) {
            return res.status(403).json({ message: "Forbidden. Vendors do not have access to reports." });
        }

        if (!userId && !adminId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const report = await Report.findById(req.params.id)
            .populate("user", "name email phone")
            .populate({
                path: "venue",
                select: "name city vendorId",
                populate: {
                    path: "vendorId",
                    select: "fullName businessName email"
                }
            });

        if (!report) {
            return res.status(404).json({ message: "Report not found" });
        }

        // Validate access
        if (adminId) {
            // Admin OK
        } else if (userId && String(report.user?._id) === userId) {
            // Owner User OK
        } else {
            return res.status(403).json({ message: "Forbidden. You do not have access to this report." });
        }

        res.json(formatAttachments(report, req));
    } catch (error) {
        res.status(500).json({ message: "Failed to retrieve report", error: error.message });
    }
});

// 4. Update Report Status (Admin Only)
router.put("/:id/status", isAdmin, async (req, res) => {
    try {
        const { status } = req.body;

        if (!["Open", "In Progress", "Resolved", "Closed"].includes(status)) {
            return res.status(400).json({ message: "Invalid status value" });
        }

        const report = await Report.findById(req.params.id);
        if (!report) {
            return res.status(404).json({ message: "Report not found" });
        }

        report.status = status;
        await report.save();

        res.json({ message: `Report status updated to ${status}`, report: formatAttachments(report, req) });
    } catch (error) {
        res.status(500).json({ message: "Failed to update report status", error: error.message });
    }
});

export default router;
