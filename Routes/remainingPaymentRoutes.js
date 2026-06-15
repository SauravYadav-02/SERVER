import express from "express";
import {
  vendorLogPayment,
  userPayOnline,
  getVendorBookingTransactions,
  getUserBookingTransactions,
} from "../controllers/remainingPaymentController.js";
import { isVendor } from "../middleare/isVendor.js";
import { isUser } from "../middleare/isUser.js";

const router = express.Router();

router.post("/vendor/log/:bookingId", isVendor, vendorLogPayment);
router.post("/user/pay-online/:bookingId", isUser, userPayOnline);
router.get("/vendor/booking/:bookingId/transactions", isVendor, getVendorBookingTransactions);
router.get("/user/booking/:bookingId/transactions", isUser, getUserBookingTransactions);

export default router;
