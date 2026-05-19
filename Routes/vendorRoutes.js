import express from "express";
import Vendor from "../models/VendorModel.js";
import { sendEmail } from "../utils/emailService.js";
import { isAdmin } from "../middleare/isAdmin.js";
import upload from "../middleare/upload.js";

import { paginate } from "../utils/pagination.js";

const router = express.Router();

// ============================
// 🔹 Generate Vendor ID
// ============================

// ============================
// 🔹 Get All Vendors (Admin - Paginated)
// ============================
router.get("/", isAdmin, async (req, res) => {
    try {
        const { page, limit, search, status } = req.query;

        const query = {};
        if (status) query.status = status;
        if (search) {
            query.$or = [
                { fullName: { $regex: search, $options: "i" } },
                { businessName: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
            ];
        }

        const paginationResult = await paginate(Vendor, query, {
            page,
            limit,
            sort: { createdAt: -1 }
        });

        paginationResult.data = paginationResult.data.map(vendor => ({
            ...vendor,
            governmentId: vendor.governmentId
                ? `${req.protocol}://${req.get("host")}/${vendor.governmentId.replace(/\\/g, "/")}`
                : null,
            licenseDoc: vendor.licenseDoc
                ? `${req.protocol}://${req.get("host")}/${vendor.licenseDoc.replace(/\\/g, "/")}`
                : null
        }));

        res.json(paginationResult);

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Error fetching vendors" });
    }
});

// ============================
// 🔹 Get Single Vendor (with files)
// ============================
const fixPath = (filePath) => filePath.replace(/\\/g, "/");

router.get("/:id", async (req, res) => {
    try {
        const vendor = await Vendor.findById(req.params.id);

        if (!vendor) {
            return res.status(404).json({ message: "Vendor not found" });
        }

        const result = {
            ...vendor._doc,

            governmentId: vendor.governmentId
                ? `${req.protocol}://${req.get("host")}/${fixPath(vendor.governmentId)}`
                : null,

            licenseDoc: vendor.licenseDoc
                ? `${req.protocol}://${req.get("host")}/${fixPath(vendor.licenseDoc)}`
                : null
        };  // ✅ FIXED HERE

        res.json(result);

    } catch (err) {
        res.status(500).json({ message: "Error fetching vendor" });
    }
});

// ============================
// 🔹 Vendor Register (with file upload)
// ============================
router.post(
    "/register",
    upload.fields([
        { name: "governmentId", maxCount: 1 },
        { name: "licenseDoc", maxCount: 1 }
    ]),
    async (req, res) => {
        try {
            

            const governmentIdFile = req.files?.governmentId?.[0]?.path;
            const licenseDocFile = req.files?.licenseDoc?.[0]?.path;

            if (!governmentIdFile || !licenseDocFile) {
                return res.status(400).json({
                    message: "Both governmentId and licenseDoc are required"
                });
            }

            const vendor = new Vendor({
                ...req.body,
                governmentId: governmentIdFile,
                licenseDoc: licenseDocFile,
                status: "pending"
            });

            await vendor.save();

            await sendEmail(
                vendor.email,
                "Vendor Registration",
                `Your Vendor ID Request is submitted. Wait for admin approval.`
            );

            res.status(201).json({
                message: "Vendor Registered",
                vendor
            });

        } catch (err) {
            console.log(err);
            res.status(500).json({
                message: err.message || "Server Error"
            });
        }
    }
);

// ============================
// 🔹 Admin Approve Vendor
// ============================
router.put("/approve/:id", async (req, res) => {
    try {
        const { username, password } = req.body;

        const vendor = await Vendor.findById(req.params.id);

        if (!vendor) {
            return res.status(404).json({ message: "Vendor not found" });
        }

        const exists = await Vendor.findOne({ username });
        if (exists) {
            return res.status(400).json({ message: "Username already exists" });
        }

        vendor.status = "approved";
        vendor.username = username;
        vendor.password = password;
        vendor.adminMessage = "Approved successfully";

        await vendor.save();

        await sendEmail(
            vendor.email,
            "Vendor Approved",
            `Username: ${username}\nPassword: ${password}`
        );

        res.json({ message: "Vendor Approved", vendor });

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Error" });
    }
});

// ============================
// 🔹 Reject Vendor
// ============================
router.put("/reject/:id", isAdmin, async (req, res) => {
    try {
        const vendor = await Vendor.findById(req.params.id);

        if (!vendor) {
            return res.status(404).json({ message: "Vendor not found" });
        }

        const { message } = req.body;

        vendor.status = "rejected";
        vendor.adminMessage = message || "Rejected by admin";

        await vendor.save();

        await sendEmail(
            vendor.email,
            "Rejected",
            message || "Your request is rejected"
        );

        res.json({ message: "Rejected", vendor });

    } catch (err) {
        res.status(500).json({ message: "Error" });
    }
});

// ============================
// 🔹 Vendor Login
// ============================
router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        const vendor = await Vendor.findOne({ username });

        if (!vendor) {
            return res.status(404).json({ message: "Vendor not found" });
        }

        if (vendor.status !== "approved") {
            return res.status(403).json({ message: "Not approved by admin" });
        }

        if (vendor.password !== password) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        res.status(200).json({ message: "Login success", vendor });
        console.log("Vendor logged in:", vendor.username);      

    } catch (err) {
        res.status(500).json({ message: "Error" });
    }
});

export default router;