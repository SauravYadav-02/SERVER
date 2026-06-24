import express from "express";
import Contact from "../models/ContactModel.js";
import { isAdmin } from "../middleare/isAdmin.js";
import { paginate } from "../utils/pagination.js";

const router = express.Router();

// 1. Submit Contact Form (Public, guest-friendly)
router.post("/", async (req, res) => {
  try {
    const { name, email, subject, category, message } = req.body;
    const userId = req.headers.userid || req.headers["userid"] || null;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Name is required" });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ message: "Email is required" });
    }
    if (!subject || !subject.trim()) {
      return res.status(400).json({ message: "Subject is required" });
    }
    if (!category || !category.trim()) {
      return res.status(400).json({ message: "Category is required" });
    }
    if (!message || !message.trim()) {
      return res.status(400).json({ message: "Message is required" });
    }

    if (message.length > 500) {
      return res.status(400).json({ message: "Message cannot exceed 500 characters" });
    }

    const contact = new Contact({
      name: name.trim(),
      email: email.trim(),
      subject: subject.trim(),
      category: category.trim(),
      message: message.trim(),
      userId
    });

    await contact.save();
    res.status(201).json({ message: "Inquiry submitted successfully", contact });
  } catch (error) {
    console.error("CONTACT SUBMISSION ERROR:", error);
    res.status(500).json({ message: "Failed to submit inquiry", error: error.message });
  }
});

// 2. Get All Contact Inquiries (Admin only, paginated)
router.get("/", isAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search ? req.query.search.trim() : "";

    let query = {};
    if (search) {
      const regex = new RegExp(search, "i");
      query.$or = [
        { name: regex },
        { email: regex },
        { subject: regex },
        { category: regex },
        { message: regex }
      ];
    }

    const paginationResult = await paginate(Contact, query, {
      page,
      limit,
      sortBy: "createdAt",
      sortOrder: "desc",
      allowedSortFields: ["createdAt", "category", "subject"],
      populate: { path: "userId", select: "name email phone" }
    });

    res.status(200).json(paginationResult);
  } catch (error) {
    console.error("GET CONTACTS ERROR:", error);
    res.status(500).json({ message: "Failed to fetch inquiries", error: error.message });
  }
});

export default router;
