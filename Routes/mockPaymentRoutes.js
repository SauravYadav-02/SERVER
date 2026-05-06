import express from "express";
import {
  createBooking,
  payBooking,
  vendorBookings,
} from "../controllers/mockPaymentController.js";

const router = express.Router();

router.post("/create-booking", createBooking);
router.post("/pay", payBooking);
router.get("/vendor/bookings", vendorBookings);

export default router;
