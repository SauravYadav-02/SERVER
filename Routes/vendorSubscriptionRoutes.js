import express from "express";
import { listActivePlans, subscribePlan, getSubscriptionStatus } from "../controllers/vendorSubscriptionController.js";
import { isVendor } from "../middleare/isVendor.js";

const router = express.Router();

router.get("/plans", listActivePlans);
router.post("/subscribe", isVendor, subscribePlan);
router.get("/", isVendor, getSubscriptionStatus);

export default router;
