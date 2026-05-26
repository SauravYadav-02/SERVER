import express from "express";
import Plan from "../models/PlanModel.js";
import { isAdmin } from "../middleare/isAdmin.js";
import { paginate } from "../utils/pagination.js";

const router = express.Router();

// ─────────────────────────────────────────────────────────────
// Validation helper
// ─────────────────────────────────────────────────────────────
const validatePlanBody = (body) => {
  const errors = [];
  const { name, duration_days, price, planType } = body;

  if (!name || typeof name !== "string" || name.trim() === "") {
    errors.push("name is required and must be a non-empty string.");
  }
  if (duration_days === undefined || isNaN(Number(duration_days)) || Number(duration_days) < 1) {
    errors.push("duration_days is required and must be a positive integer.");
  }
  if (price === undefined || isNaN(Number(price)) || Number(price) < 0) {
    errors.push("price is required and must be a non-negative number.");
  }
  if (planType !== undefined && !["base", "full payment"].includes(planType)) {
    errors.push('planType must be either "base" or "full payment".');
  }

  return errors;
};

// ─────────────────────────────────────────────────────────────
// GET /plans  ── Public: vendors & users can browse active plans
// ─────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const query = { is_active: true, deletedAt: null };
    if (req.query.type === "base") {
      query.$or = [{ planType: "base" }, { planType: { $exists: false } }];
    }
    if (req.query.type === "full payment") {
      query.planType = "full payment";
    }

    const plans = await Plan.find(query)
      .select("-deletedAt -__v")
      .sort({ price: 1 });

    res.json({ success: true, count: plans.length, plans });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch plans.", error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /plans/all  ── Admin: view ALL plans including inactive (Paginated)
// ─────────────────────────────────────────────────────────────
router.get("/all", isAdmin, async (req, res) => {
  try {
    const { page, limit, search } = req.query;
    const query = { deletedAt: null };
    
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    const paginationResult = await paginate(Plan, query, {
      page,
      limit,
      sort: { createdAt: -1 }
    });

    res.json({ success: true, ...paginationResult });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to fetch plans.", error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /plans  ── Admin: create a new plan
// ─────────────────────────────────────────────────────────────
router.post("/", isAdmin, async (req, res) => {
  try {
    const errors = validatePlanBody(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: "Validation failed.", errors });
    }

    const { name, duration_days, price, planType, is_active, features } = req.body;

    // Duplicate name check
    const exists = await Plan.findOne({ name: name.trim(), deletedAt: null });
    if (exists) {
      return res.status(409).json({ success: false, message: `Plan "${name}" already exists.` });
    }

    const plan = await Plan.create({
      name: name.trim(),
      duration_days: Number(duration_days),
      price: Number(price),
      planType: planType || "base",
      is_active: is_active !== undefined ? Boolean(is_active) : true,
      features: Array.isArray(features) ? features : [],
    });

    res.status(201).json({ success: true, message: "Plan created successfully.", plan });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to create plan.", error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// PUT /plans/:id  ── Admin: update a plan
// ─────────────────────────────────────────────────────────────
router.put("/:id", isAdmin, async (req, res) => {
  try {
    const plan = await Plan.findOne({ _id: req.params.id, deletedAt: null });
    if (!plan) {
      return res.status(404).json({ success: false, message: "Plan not found." });
    }

    const { name, duration_days, price, planType, is_active, features } = req.body;

    // Only update provided fields
    if (name !== undefined) {
      if (typeof name !== "string" || name.trim() === "") {
        return res.status(400).json({ success: false, message: "name must be a non-empty string." });
      }
      // Check uniqueness (excluding self)
      const duplicate = await Plan.findOne({ name: name.trim(), deletedAt: null, _id: { $ne: plan._id } });
      if (duplicate) {
        return res.status(409).json({ success: false, message: `Plan name "${name}" already exists.` });
      }
      plan.name = name.trim();
    }
    if (duration_days !== undefined) {
      if (isNaN(Number(duration_days)) || Number(duration_days) < 1) {
        return res.status(400).json({ success: false, message: "duration_days must be a positive integer." });
      }
      plan.duration_days = Number(duration_days);
    }
    if (price !== undefined) {
      if (isNaN(Number(price)) || Number(price) < 0) {
        return res.status(400).json({ success: false, message: "price must be a non-negative number." });
      }
      plan.price = Number(price);
    }
    if (planType !== undefined) {
      if (!["base", "full payment"].includes(planType)) {
        return res.status(400).json({ success: false, message: 'planType must be either "base" or "full payment".' });
      }
      plan.planType = planType;
    }
    if (is_active !== undefined) plan.is_active = Boolean(is_active);
    if (Array.isArray(features))  plan.features = features;

    await plan.save();

    res.json({ success: true, message: "Plan updated successfully.", plan });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to update plan.", error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// DELETE /plans/:id  ── Admin: soft-delete a plan
// ─────────────────────────────────────────────────────────────
router.delete("/:id", isAdmin, async (req, res) => {
  try {
    const plan = await Plan.findOne({ _id: req.params.id, deletedAt: null });
    if (!plan) {
      return res.status(404).json({ success: false, message: "Plan not found." });
    }

    plan.deletedAt = new Date();
    plan.is_active = false;
    await plan.save();

    res.json({ success: true, message: "Plan deleted (soft) successfully." });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to delete plan.", error: err.message });
  }
});

export default router;
