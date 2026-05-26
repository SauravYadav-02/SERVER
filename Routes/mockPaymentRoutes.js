import express from "express";
import {
  createBooking,
  payBooking,
  vendorBookings,
  userPayments,
  vendorPayments,
} from "../controllers/mockPaymentController.js";

const router = express.Router();

router.post("/create-booking", createBooking);
router.post("/pay", payBooking);
router.get("/vendor/bookings", vendorBookings);
router.get("/user/:userId/payments", userPayments);
router.get("/vendor/:vendorId/payments", vendorPayments);

export default router;
