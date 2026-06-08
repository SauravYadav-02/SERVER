import express from "express";
import { isUser } from "../middleare/isUser.js";
import Todo from "../models/TodoModel.js";
import CustomCategory from "../models/CustomCategoryModel.js";

const router = express.Router();

// Apply user auth middleware to all checklist routes
router.use(isUser);

// ── Todo Routes ───────────────────────────────────────────────

// GET /todos - Fetch all checklist items for the authenticated user
router.get("/", async (req, res) => {
  try {
    const todos = await Todo.find({ user: req.userId }).sort({ createdAt: -1 });
    res.json(todos);
  } catch (error) {
    console.error("Error fetching todos:", error);
    res.status(500).json({ message: "Failed to fetch checklist items" });
  }
});

// POST /todos - Add a new checklist item
router.post("/", async (req, res) => {
  try {
    const { text, category, type, dueDate, amount, location } = req.body;
    if (!text || !category) {
      return res.status(400).json({ message: "Text and Category are required fields." });
    }

    const todo = new Todo({
      user: req.userId,
      text,
      category,
      type: type || "task",
      dueDate: dueDate || undefined,
      amount: amount !== undefined ? Number(amount) : undefined,
      location: location || undefined
    });

    await todo.save();
    res.status(201).json(todo);
  } catch (error) {
    console.error("Error creating todo:", error);
    res.status(400).json({ message: "Failed to create checklist item", error: error.message });
  }
});

// PUT /todos/:id - Update status or details of a checklist item
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { text, category, type, completed, dueDate, amount, location } = req.body;

    const todo = await Todo.findOne({ _id: id, user: req.userId });
    if (!todo) {
      return res.status(404).json({ message: "Checklist item not found or unauthorized" });
    }

    if (text !== undefined) todo.text = text;
    if (category !== undefined) todo.category = category;
    if (type !== undefined) todo.type = type;
    if (completed !== undefined) todo.completed = completed;
    if (dueDate !== undefined) todo.dueDate = dueDate || null;
    if (amount !== undefined) todo.amount = amount;
    if (location !== undefined) todo.location = location;

    await todo.save();
    res.json(todo);
  } catch (error) {
    console.error("Error updating todo:", error);
    res.status(400).json({ message: "Failed to update checklist item", error: error.message });
  }
});

// DELETE /todos/:id - Remove a checklist item
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Todo.findOneAndDelete({ _id: id, user: req.userId });
    if (!result) {
      return res.status(404).json({ message: "Checklist item not found or unauthorized" });
    }
    res.json({ message: "Checklist item removed successfully" });
  } catch (error) {
    console.error("Error deleting todo:", error);
    res.status(500).json({ message: "Failed to delete checklist item" });
  }
});

// ── Custom Category Routes ────────────────────────────────────

// GET /todos/categories - Fetch all custom categories for the authenticated user
router.get("/categories", async (req, res) => {
  try {
    const categories = await CustomCategory.find({ user: req.userId }).sort({ createdAt: 1 });
    res.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ message: "Failed to fetch custom categories" });
  }
});

// POST /todos/categories - Create a custom category
router.post("/categories", async (req, res) => {
  try {
    const { value, label, color } = req.body;
    if (!value || !label || !color) {
      return res.status(400).json({ message: "Value, label, and color are required for custom categories." });
    }

    // Check for duplicate value for this user
    const existing = await CustomCategory.findOne({ user: req.userId, value });
    if (existing) {
      return res.status(400).json({ message: "Category with this identifier already exists." });
    }

    const customCategory = new CustomCategory({
      user: req.userId,
      value,
      label,
      color
    });

    await customCategory.save();
    res.status(201).json(customCategory);
  } catch (error) {
    console.error("Error creating custom category:", error);
    res.status(400).json({ message: "Failed to create custom category", error: error.message });
  }
});

// DELETE /todos/categories/:id - Delete a custom category and reset associated todos to 'other'
router.delete("/categories/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const category = await CustomCategory.findOne({ _id: id, user: req.userId });
    
    if (!category) {
      return res.status(404).json({ message: "Custom category not found or unauthorized" });
    }

    // Delete custom category
    await CustomCategory.deleteOne({ _id: id });

    // Transition all todos that belong to this category value to 'other' for the user
    await Todo.updateMany(
      { user: req.userId, category: category.value },
      { $set: { category: "other" } }
    );

    res.json({ message: "Custom category deleted and associated tasks updated to 'Other'." });
  } catch (error) {
    console.error("Error deleting custom category:", error);
    res.status(500).json({ message: "Failed to delete custom category" });
  }
});

export default router;
