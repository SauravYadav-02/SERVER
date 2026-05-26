import express from "express";
import Terms from "../models/TermsModel.js";
import { isAdmin } from "../middleare/isAdmin.js";

const router = express.Router();

// ─────────────────────────────────────────────────────────────
// GET /terms/active  ── Public: Users can fetch the active terms
// ─────────────────────────────────────────────────────────────
router.get("/active", async (req, res) => {
  try {
    const activeTerms = await Terms.findOne({ isActive: true });
    
    if (!activeTerms) {
      return res.status(404).json({ success: false, message: "No active terms and conditions found." });
    }
    
    res.json({ success: true, terms: activeTerms });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch active terms.", error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /terms  ── Admin: Get all terms (versions)
// ─────────────────────────────────────────────────────────────
router.get("/", isAdmin, async (req, res) => {
  try {
    const terms = await Terms.find().sort({ createdAt: -1 });
    res.json({ success: true, terms });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch terms.", error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /terms  ── Admin: Create new terms
// ─────────────────────────────────────────────────────────────
router.post("/", isAdmin, async (req, res) => {
  try {
    const { content, version, isActive } = req.body;

    if (!content || !version) {
      return res.status(400).json({ success: false, message: "Content and version are required." });
    }

    // Check if version already exists
    const existing = await Terms.findOne({ version: version.trim() });
    if (existing) {
      return res.status(409).json({ success: false, message: `Version ${version} already exists.` });
    }

    // If making this one active, deactivate all others
    if (isActive) {
      await Terms.updateMany({}, { isActive: false });
    }

    const newTerms = await Terms.create({
      content: content.trim(),
      version: version.trim(),
      isActive: isActive || false,
    });

    res.status(201).json({ success: true, message: "Terms created successfully.", terms: newTerms });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to create terms.", error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// PUT /terms/:id  ── Admin: Update specific terms
// ─────────────────────────────────────────────────────────────
router.put("/:id", isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { content, version, isActive } = req.body;

    const terms = await Terms.findById(id);
    if (!terms) {
      return res.status(404).json({ success: false, message: "Terms not found." });
    }

    if (content) terms.content = content.trim();
    if (version && version !== terms.version) {
      // Check for duplicate version
      const existing = await Terms.findOne({ version: version.trim() });
      if (existing) {
        return res.status(409).json({ success: false, message: `Version ${version} already exists.` });
      }
      terms.version = version.trim();
    }

    if (isActive !== undefined) {
      // If setting this one to active, deactivate all others
      if (isActive === true && !terms.isActive) {
         await Terms.updateMany({}, { isActive: false });
      }
      terms.isActive = isActive;
    }

    await terms.save();
    res.json({ success: true, message: "Terms updated successfully.", terms });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to update terms.", error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// DELETE /terms/:id  ── Admin: Delete specific terms
// ─────────────────────────────────────────────────────────────
router.delete("/:id", isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const deletedTerms = await Terms.findByIdAndDelete(id);

    if (!deletedTerms) {
      return res.status(404).json({ success: false, message: "Terms not found." });
    }

    res.json({ success: true, message: "Terms deleted successfully." });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to delete terms.", error: err.message });
  }
});

export default router;
