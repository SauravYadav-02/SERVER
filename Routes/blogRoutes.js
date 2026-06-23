import express from "express";
import mongoose from "mongoose";
import Blog from "../models/BlogModel.js";
import { isVendor } from "../middleare/isVendor.js";
import { isUser } from "../middleare/isUser.js";
import { isAdmin } from "../middleare/isAdmin.js";
import { blogUpload } from "../middleare/blogUpload.js";
import { paginate } from "../utils/pagination.js";

const router = express.Router();

// Helper to sanitize and normalize paths
const fixPath = (filePath = "") => filePath.replace(/\\/g, "/");

const getImageUrl = (pathStr, req) => {
  if (!pathStr) return null;
  if (pathStr.startsWith("http")) return pathStr;
  return `${req.protocol}://${req.get("host")}/${fixPath(pathStr)}`;
};

const formatBlogResponse = (blog, req) => {
  const blogObj = blog.toObject ? blog.toObject() : blog;
  return {
    ...blogObj,
    coverImage: getImageUrl(blogObj.coverImage, req),
    images: blogObj.images ? blogObj.images.map(img => getImageUrl(img, req)) : []
  };
};

// ==========================================
// VENDOR ROUTES (isVendor middleware)
// ==========================================

// 1. Create Blog
router.post(
  "/vendor",
  isVendor,
  blogUpload.fields([
    { name: "coverImage", maxCount: 1 },
    { name: "images", maxCount: 10 }
  ]),
  async (req, res) => {
    try {
      const { title, content, tags, videoUrl } = req.body;
      const vendorId = req.vendorId;

      let parsedTags = [];
      if (tags) {
        try {
          parsedTags = JSON.parse(tags);
          if (!Array.isArray(parsedTags)) {
            parsedTags = [parsedTags.toString()];
          }
        } catch (e) {
          // If not valid JSON, treat as comma-separated or plain text
          parsedTags = tags.split(",").map(t => t.trim()).filter(Boolean);
        }
      }

      // Extract coverImage
      let coverImagePath = null;
      if (req.files && req.files.coverImage && req.files.coverImage[0]) {
        coverImagePath = fixPath(req.files.coverImage[0].path);
      }

      // Extract extra images
      let imagePaths = [];
      if (req.files && req.files.images) {
        imagePaths = req.files.images.map(img => fixPath(img.path));
      }

      const blog = new Blog({
        vendorId,
        title,
        content,
        tags: parsedTags,
        coverImage: coverImagePath,
        images: imagePaths,
        videoUrl: videoUrl || null,
        status: "pending"
      });

      await blog.save();
      res.status(201).json(formatBlogResponse(blog, req));
    } catch (error) {
      console.error("CREATE BLOG ERROR:", error);
      res.status(400).json({ message: "Failed to create blog", error: error.message });
    }
  }
);

// 2. Update Blog
router.put(
  "/vendor/:id",
  isVendor,
  blogUpload.fields([
    { name: "coverImage", maxCount: 1 },
    { name: "images", maxCount: 10 }
  ]),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { title, content, tags, videoUrl, existingImages } = req.body;
      const vendorId = req.vendorId;

      const blog = await Blog.findById(id);
      if (!blog || blog.deleted) {
        return res.status(404).json({ message: "Blog not found" });
      }

      // Ownership Check
      if (blog.vendorId.toString() !== vendorId) {
        return res.status(403).json({ message: "Forbidden: You do not own this blog" });
      }

      let parsedTags = [];
      if (tags) {
        try {
          parsedTags = JSON.parse(tags);
          if (!Array.isArray(parsedTags)) {
            parsedTags = [parsedTags.toString()];
          }
        } catch (e) {
          parsedTags = tags.split(",").map(t => t.trim()).filter(Boolean);
        }
      }

      // Update basic fields
      blog.title = title || blog.title;
      blog.content = content || blog.content;
      blog.tags = parsedTags;
      blog.videoUrl = videoUrl !== undefined ? videoUrl : blog.videoUrl;

      // Handle Cover Image
      if (req.files && req.files.coverImage && req.files.coverImage[0]) {
        blog.coverImage = fixPath(req.files.coverImage[0].path);
      }

      // Handle Images updates
      let baseImages = [];
      if (existingImages) {
        try {
          baseImages = JSON.parse(existingImages);
          if (!Array.isArray(baseImages)) {
            baseImages = [baseImages];
          }
        } catch (e) {
          baseImages = [];
        }
      }

      // Remove URL prefixes if any, keeping relative path for storage
      baseImages = baseImages.map(img => {
        if (typeof img !== "string") return img;
        const index = img.indexOf("uploads/");
        return index !== -1 ? img.substring(index) : img;
      });

      let newImages = [];
      if (req.files && req.files.images) {
        newImages = req.files.images.map(img => fixPath(img.path));
      }

      blog.images = [...baseImages, ...newImages];
      blog.status = "pending"; // Reset to pending for re-approval

      await blog.save();
      res.json(formatBlogResponse(blog, req));
    } catch (error) {
      console.error("UPDATE BLOG ERROR:", error);
      res.status(450).json({ message: "Failed to update blog", error: error.message });
    }
  }
);

// 3. Soft Delete Blog
router.delete("/vendor/:id", isVendor, async (req, res) => {
  try {
    const { id } = req.params;
    const vendorId = req.vendorId;

    const blog = await Blog.findById(id);
    if (!blog || blog.deleted) {
      return res.status(404).json({ message: "Blog not found" });
    }

    // Ownership Check
    if (blog.vendorId.toString() !== vendorId) {
      return res.status(403).json({ message: "Forbidden: You do not own this blog" });
    }

    blog.deleted = true;
    await blog.save();

    res.json({ success: true, message: "Blog deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete blog", error: error.message });
  }
});

// 4. Get Vendor's own blogs (Paginated)
router.get("/vendor/my", isVendor, async (req, res) => {
  try {
    const { page, limit } = req.query;
    const vendorId = req.vendorId;

    const query = { vendorId, deleted: false };
    
    const paginationResult = await paginate(Blog, query, {
      page,
      limit,
      populate: { path: "vendorId", select: "fullName businessName" },
      sort: { createdAt: -1 }
    });

    paginationResult.data = paginationResult.data.map(blog => formatBlogResponse(blog, req));
    res.json(paginationResult);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch vendor blogs", error: error.message });
  }
});

// ==========================================
// ADMIN ROUTES (isAdmin middleware)
// ==========================================

// 1. Fetch Blogs (with filters/search/pagination)
router.get("/admin", isAdmin, async (req, res) => {
  try {
    const { page, limit, search, status } = req.query;

    const query = {};
    if (status) {
      query.status = status;
    }

    if (search) {
      const regex = new RegExp(search.trim(), "i");
      const matchingVendors = await mongoose.model("Vendor").find({
        $or: [
          { fullName: regex },
          { businessName: regex }
        ]
      }).select("_id");
      const vendorIds = matchingVendors.map(v => v._id);

      query.$or = [
        { title: { $regex: regex } },
        { tags: { $regex: regex } },
        { vendorId: { $in: vendorIds } }
      ];
    }

    if (req.query.deleted !== undefined) {
      query.deleted = req.query.deleted === "true";
    }

    const paginationResult = await paginate(Blog, query, {
      page,
      limit,
      populate: { path: "vendorId", select: "fullName businessName email phone" },
      sort: { createdAt: -1 }
    });

    paginationResult.data = paginationResult.data.map(blog => formatBlogResponse(blog, req));
    res.json(paginationResult);
  } catch (error) {
    console.error("ADMIN FETCH BLOGS ERROR:", error);
    res.status(500).json({ message: "Failed to fetch blogs for admin", error: error.message });
  }
});

// 2. Approve a Blog
router.patch("/admin/:id/approve", isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const blog = await Blog.findByIdAndUpdate(
      id,
      { status: "approved", adminNote: "" },
      { new: true }
    ).populate("vendorId", "fullName businessName email phone");

    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    res.json(formatBlogResponse(blog, req));
  } catch (error) {
    res.status(500).json({ message: "Failed to approve blog", error: error.message });
  }
});

// 3. Reject a Blog
router.patch("/admin/:id/reject", isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const blog = await Blog.findByIdAndUpdate(
      id,
      { status: "rejected", adminNote: reason || "Rejected by admin" },
      { new: true }
    ).populate("vendorId", "fullName businessName email phone");

    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    res.json(formatBlogResponse(blog, req));
  } catch (error) {
    res.status(500).json({ message: "Failed to reject blog", error: error.message });
  }
});

// 4. Suspend a Blog
router.patch("/admin/:id/suspend", isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const blog = await Blog.findByIdAndUpdate(
      id,
      { status: "suspended", adminNote: reason || "Suspended by admin" },
      { new: true }
    ).populate("vendorId", "fullName businessName email phone");

    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    res.json(formatBlogResponse(blog, req));
  } catch (error) {
    res.status(500).json({ message: "Failed to suspend blog", error: error.message });
  }
});

// 5. Restore to Pending
router.patch("/admin/:id/restore", isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const blog = await Blog.findByIdAndUpdate(
      id,
      { status: "pending", adminNote: "" },
      { new: true }
    ).populate("vendorId", "fullName businessName email phone");

    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    res.json(formatBlogResponse(blog, req));
  } catch (error) {
    res.status(500).json({ message: "Failed to restore blog status", error: error.message });
  }
});

// 6. Soft Delete
router.patch("/admin/:id/delete", isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const blog = await Blog.findByIdAndUpdate(
      id,
      { deleted: true },
      { new: true }
    ).populate("vendorId", "fullName businessName email phone");

    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    res.json(formatBlogResponse(blog, req));
  } catch (error) {
    res.status(500).json({ message: "Failed to soft delete blog", error: error.message });
  }
});

// 7. Undelete
router.patch("/admin/:id/undelete", isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const blog = await Blog.findByIdAndUpdate(
      id,
      { deleted: false },
      { new: true }
    ).populate("vendorId", "fullName businessName email phone");

    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    res.json(formatBlogResponse(blog, req));
  } catch (error) {
    res.status(500).json({ message: "Failed to undelete blog", error: error.message });
  }
});

// ==========================================
// PUBLIC ROUTES (No Auth Required)
// ==========================================

// 1. Get all approved blogs (Paginated with search / tags)
router.get("/", async (req, res) => {
  try {
    const { page, limit, search, tag } = req.query;

    const query = { status: "approved", deleted: false };

    if (search) {
      const regex = new RegExp(search.trim(), "i");
      query.$or = [
        { title: { $regex: regex } },
        { tags: { $regex: regex } }
      ];
    }

    if (tag) {
      query.tags = tag;
    }

    const paginationResult = await paginate(Blog, query, {
      page,
      limit,
      populate: { path: "vendorId", select: "fullName businessName" },
      sort: { createdAt: -1 }
    });

    paginationResult.data = paginationResult.data.map(blog => formatBlogResponse(blog, req));
    res.json(paginationResult);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch blogs", error: error.message });
  }
});

// 2. Get single approved blog
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const blog = await Blog.findById(id).populate("vendorId", "fullName businessName");

    if (!blog || blog.deleted || blog.status !== "approved") {
      return res.status(404).json({ message: "Blog not found or not published" });
    }

    res.json(formatBlogResponse(blog, req));
  } catch (error) {
    res.status(500).json({ message: "Failed to retrieve blog", error: error.message });
  }
});

// ==========================================
// USER INTERACTION ROUTES (isUser middleware)
// ==========================================

// 1. Toggle Like
router.post("/:id/like", isUser, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const blog = await Blog.findById(id);
    if (!blog || blog.deleted || blog.status !== "approved") {
      return res.status(404).json({ message: "Blog not found" });
    }

    const hasLiked = blog.likes.includes(userId);
    if (hasLiked) {
      // Unlike (pull)
      blog.likes = blog.likes.filter(uid => uid.toString() !== userId);
    } else {
      // Like (push)
      blog.likes.push(userId);
    }

    await blog.save();
    res.json({
      liked: !hasLiked,
      likeCount: blog.likes.length
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to toggle like", error: error.message });
  }
});

// 2. Add Comment
router.post("/:id/comment", isUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { text, userName } = req.body;
    const userId = req.userId;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Comment text is required" });
    }

    const blog = await Blog.findById(id);
    if (!blog || blog.deleted || blog.status !== "approved") {
      return res.status(404).json({ message: "Blog not found" });
    }

    const newComment = {
      userId,
      userName: userName || "Anonymous User",
      text: text.trim(),
      createdAt: new Date()
    };

    blog.comments.push(newComment);
    await blog.save();

    // Retrieve the newly created comment (last element of array)
    const addedComment = blog.comments[blog.comments.length - 1];
    res.status(201).json(addedComment);
  } catch (error) {
    res.status(500).json({ message: "Failed to add comment", error: error.message });
  }
});

// 3. Delete Own Comment
router.delete("/:id/comment/:commentId", isUser, async (req, res) => {
  try {
    const { id, commentId } = req.params;
    const userId = req.userId;

    const blog = await Blog.findById(id);
    if (!blog || blog.deleted || blog.status !== "approved") {
      return res.status(404).json({ message: "Blog not found" });
    }

    const comment = blog.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    // Verify ownership of the comment
    if (comment.userId.toString() !== userId && req.headers.userid !== comment.userId.toString()) {
      return res.status(403).json({ message: "Forbidden: You can only delete your own comments" });
    }

    blog.comments.pull(commentId);
    await blog.save();

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete comment", error: error.message });
  }
});

export default router;
