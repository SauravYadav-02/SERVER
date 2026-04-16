import express from "express";
import Venue from "../models/VenueModel.js";
import venueUpload from "../middleare/venueUpload.js";
import fs from "fs/promises";

const router = express.Router();

// ✅ Create Venue (with images)
router.post("/add", venueUpload.array("mediaFiles", 10), async (req, res) => {
  try {
    const imagePaths = req.files?.map((file) => file.path);

    const venue = new Venue({
      ...req.body,
      mediaFiles: imagePaths,
    });

    await venue.save();

    res.status(201).json(venue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Get All Venues
router.get("/", async (req, res) => {
  try {
    const venues = await Venue.find();
    res.json(venues);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ 3. GET Venues by Vendor
router.get("/vendor/:vendorId", async (req, res) => {
  try {
    const venues = await Venue.find({
      vendorId: req.params.vendorId,
    });

    res.json(venues);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ 4. GET Single Venue (Full Details)
router.get("/:id", async (req, res) => {
  try {
    const venue = await Venue.findById(req.params.id);

    if (!venue) {
      return res.status(404).json({ message: "Venue not found" });
    }

    res.json(venue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ 5. UPDATE Venue (with optional new images)
router.put("/:id", venueUpload.array("mediaFiles", 10), async (req, res) => {
  try {
    const venue = await Venue.findById(req.params.id);

    // if (venue.vendorId !== req.body.vendorId) {
    //   return res.status(403).json({ message: "Unauthorized" });
    // }

    if (!venue) {
      return res.status(404).json({ message: "Venue not found" });
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

    // If the admin is not explicitly providing a status, reset it to pending (indicates vendor edit)
    if (!req.body.status) {
      updateData.status = "pending";
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
