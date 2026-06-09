import express from "express";
import { createPlan, updatePlan, listAllPlans } from "../controllers/adminPlanController.js";
import { isAdmin } from "../middleare/isAdmin.js";

const router = express.Router();

router.post("/", isAdmin, createPlan);
router.put("/:id", isAdmin, updatePlan);
router.get("/", isAdmin, listAllPlans);

export default router;
