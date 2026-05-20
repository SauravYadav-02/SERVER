import mongoose from "mongoose";
import Booking from "../models/BookingModel.js";
import User from "../models/UserModel.js";
import Vendor from "../models/VendorModel.js";
import Venue from "../models/VenueModel.js";
import { createPaymentHistory } from "./paymentHistoryService.js";
import UserVendorPayment from "../models/UserVendorPaymentModel.js";
import { getVendorSubscriptionStatus } from "./subscriptionService.js";

const VALID_PAYMENT_OUTCOMES = ["success", "failure", "failed"];

const toMoney = (value) => Number(Number(value).toFixed(2));

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const isValidBookingDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  return (
    parsedDate.getUTCFullYear() === year &&
    parsedDate.getUTCMonth() === month - 1 &&
    parsedDate.getUTCDate() === day
  );
};

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeTotalAmount = (body) => {
  const rawAmount = body.bookingAmount ?? body.totalBookingAmount ?? body.totalAmount ?? body.cost;
  const totalBookingAmount = Number(rawAmount);

  if (!Number.isFinite(totalBookingAmount) || totalBookingAmount <= 0) {
    throw createError("bookingAmount must be a positive number");
  }

  return toMoney(totalBookingAmount);
};

const normalizePaymentOutcome = (outcome) => {
  if (!outcome) {
    throw createError("payment outcome is required (must be 'success' or 'failure')");
  }

  const normalizedOutcome = String(outcome).trim().toLowerCase();
  if (!VALID_PAYMENT_OUTCOMES.includes(normalizedOutcome)) {
    throw createError("payment outcome must be either 'success' or 'failure'");
  }

  return normalizedOutcome === "success" ? "success" : "failed";
};

export const calculateUpfrontPayment = (totalBookingAmount) => {
  return toMoney(totalBookingAmount * 0.2);
};

export const generateMockTransactionId = () => {
  const randomPart = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `MOCK-${Date.now()}-${randomPart}`;
};

export const createBookingWithUpfrontPayment = async (payload) => {
  const { userId, vendorId, venueId, date } = payload;
  const bookingDate = String(date || "").trim();

  if (!userId || !vendorId || !venueId || !date) {
    throw createError("userId, vendorId, venueId and date are required");
  }

  if (![userId, vendorId, venueId].every(isValidObjectId)) {
    throw createError("userId, vendorId and venueId must be valid MongoDB ObjectIds");
  }

  if (!isValidBookingDate(bookingDate)) {
    throw createError("date must be a valid date in YYYY-MM-DD format");
  }

  // ✅ NEW: SECURE SUBSCRIPTION VALIDATION (Requirement)
  const subStatus = await getVendorSubscriptionStatus(vendorId);
  if (subStatus === "expired" || subStatus === "none") {
    throw createError("Venue is not available for booking yet.", 403);
  }

  const totalBookingAmount = normalizeTotalAmount(payload);
  const upfrontPaymentAmount = calculateUpfrontPayment(totalBookingAmount);

  const [user, vendor, venue] = await Promise.all([
    User.findById(userId).select("_id"),
    Vendor.findById(vendorId).select("_id"),
    Venue.findById(venueId).select("_id vendorId isSubscriptionActive availableFrom"),
  ]);

  if (!user) {
    throw createError("User not found", 404);
  }

  if (!vendor) {
    throw createError("Vendor not found", 404);
  }

  if (!venue) {
    throw createError("Venue not found", 404);
  }

  if (venue.vendorId.toString() !== vendorId) {
    throw createError("venueId does not belong to the supplied vendorId");
  }

  // Also check the flag on the venue itself (cached status)
  if (!venue.isSubscriptionActive) {
    throw createError("Venue is not available for booking yet.", 403);
  }

  if (venue.availableFrom) {
    const parsedBookingDate = new Date(bookingDate);
    const parsedAvailableFrom = new Date(venue.availableFrom);

    parsedBookingDate.setUTCHours(0, 0, 0, 0);
    parsedAvailableFrom.setUTCHours(0, 0, 0, 0);

    if (parsedBookingDate < parsedAvailableFrom) {
      throw createError("Venue is not open for that date.", 400);
    }
  }

  const existingBooking = await Booking.findOne({
    venueId,
    date: bookingDate,
    status: { $nin: ["rejected", "failed", "cancelled"] },
  });

  if (existingBooking) {
    throw createError("Venue is already booked on this date", 409);
  }

  const booking = await Booking.create({
    userId,
    vendorId,
    venueId,
    date: bookingDate,
    cost: totalBookingAmount,
    totalBookingAmount,
    upfrontPaymentAmount,
    amountPaid: 0,
    paymentStatus: "pending",
    transactionId: null,
    paymentTimestamp: null,
    status: "pending",
  });

  return booking;
};

export const simulatePayment = async ({ bookingId, outcome, status, paymentStatus }) => {
  if (!bookingId) {
    throw createError("bookingId is required");
  }

  if (!isValidObjectId(bookingId)) {
    throw createError("bookingId must be a valid MongoDB ObjectId");
  }

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw createError("Booking not found", 404);
  }

  if (booking.paymentStatus === "success") {
    throw createError("Payment has already been completed for this booking", 409);
  }

  const simulatedPaymentStatus = normalizePaymentOutcome(outcome ?? paymentStatus ?? status);
  const transactionId = generateMockTransactionId();
  const paymentTimestamp = new Date();
  const upfrontPaymentAmount = booking.upfrontPaymentAmount || calculateUpfrontPayment(booking.cost);

  booking.totalBookingAmount = booking.totalBookingAmount || booking.cost;
  booking.upfrontPaymentAmount = upfrontPaymentAmount;
  booking.paymentStatus = simulatedPaymentStatus;
  booking.status = simulatedPaymentStatus === "success" ? "success" : "failed";
  booking.transactionId = transactionId;
  booking.paymentTimestamp = paymentTimestamp;
  booking.amountPaid = simulatedPaymentStatus === "success" ? upfrontPaymentAmount : 0;

  await booking.save();

  // Create transaction record
  try {
    // New UserVendorPayment (Specific as requested)
    await UserVendorPayment.create({
      bookingId: booking._id,
      userId: booking.userId,
      vendorId: booking.vendorId,
      venueId: booking.venueId,
      amount: upfrontPaymentAmount,
      paymentStatus: simulatedPaymentStatus,
      transactionId,
      description: `Transaction between User and Vendor for booking on ${booking.date}`,
    });

  } catch (error) {
    console.error("Failed to create transaction records:", error.message);
    // Don't fail the payment if transaction creation fails
  }

  return booking;
};

export const getVendorBookings = async (vendorId) => {
  const query = {};

  if (vendorId) {
    if (!isValidObjectId(vendorId)) {
      throw createError("vendorId must be a valid MongoDB ObjectId");
    }

    const vendor = await Vendor.findById(vendorId).select("_id");
    if (!vendor) {
      throw createError("Vendor not found", 404);
    }

    query.vendorId = vendorId;
  }

  const bookings = await Booking.find(query)
    .populate("userId", "name username email")
    .populate("venueId", "name")
    .sort({ createdAt: -1 });

  return bookings.map((booking) => {
    const totalAmount = booking.totalBookingAmount || booking.cost || 0;
    const amountPaid = booking.amountPaid || 0;

    return {
      bookingId: booking._id,
      user: booking.userId,
      venue: booking.venueId,
      date: booking.date,
      totalAmount,
      amountPaid,
      remainingAmount: toMoney(Math.max(totalAmount - amountPaid, 0)),
      upfrontPaymentAmount: booking.upfrontPaymentAmount || calculateUpfrontPayment(totalAmount),
      paymentStatus: booking.paymentStatus || "pending",
      transactionId: booking.transactionId,
      timestamp: booking.paymentTimestamp || booking.createdAt,
      bookingStatus: booking.status,
    };
  });
};

export const getUserPayments = async (userId) => {
  if (!userId || !isValidObjectId(userId)) {
    throw createError("A valid userId is required");
  }

  const payments = await UserVendorPayment.find({ userId })
    .populate("vendorId", "name businessName")
    .populate("venueId", "name")
    .sort({ createdAt: -1 });

  return payments;
};

export const getVendorPayments = async (vendorId) => {
  if (!vendorId || !isValidObjectId(vendorId)) {
    throw createError("A valid vendorId is required");
  }

  const payments = await UserVendorPayment.find({ vendorId })
    .populate("userId", "name email profilePhoto")
    .populate("venueId", "name")
    .sort({ createdAt: -1 });

  return payments;
};
