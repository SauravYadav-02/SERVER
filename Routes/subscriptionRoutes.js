import express from "express";
import {
  assignFullPayment,
  assignSubscription,
  confirmSubscriptionPaymentIntent,
  createSubscriptionPaymentIntent,
  getAllSubscriptions,
  getExpiringSubscriptions,
  getMySubscription,
  getMySubscriptionQueue,
  getVendorSubscription,
} from "../controllers/subscriptionController.js";
import { isAdmin } from "../middleare/isAdmin.js";
import { isVendor } from "../middleare/isVendor.js";

const router = express.Router();

router.post("/create-payment", isVendor, createSubscriptionPaymentIntent);
router.post("/confirm-payment", isVendor, confirmSubscriptionPaymentIntent);
router.get("/", isVendor, getMySubscription);
router.get("/queue", isVendor, getMySubscriptionQueue);

router.get("/all", isAdmin, getAllSubscriptions);
router.get("/expiring-soon", isAdmin, getExpiringSubscriptions);
router.get("/admin/vendor/:vendorId", isAdmin, getVendorSubscription);
router.post("/admin/assign", isAdmin, assignSubscription);
router.post("/admin/full-payment", isAdmin, assignFullPayment);

export default router;
