import mongoose from "mongoose";
import PaymentHistory from "../models/PaymentHistoryModel.js";
import Vendor from "../models/VendorModel.js";

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export const createPaymentHistory = async (payload) => {
  const { vendorId, userId, type, relatedId, amount, paymentStatus, transactionId, description } = payload;

  if (!vendorId || !type || !relatedId || amount === undefined) {
    throw createError("vendorId, type, relatedId, and amount are required");
  }

  if (!isValidObjectId(vendorId) || !isValidObjectId(relatedId)) {
    throw createError("vendorId and relatedId must be valid MongoDB ObjectIds");
  }

  if (userId && !isValidObjectId(userId)) {
    throw createError("userId must be a valid MongoDB ObjectId if provided");
  }

  if (!["booking", "subscription", "full payment"].includes(type)) {
    throw createError("type must be one of: booking, subscription, full payment");
  }

  if (typeof amount !== "number" || amount < 0) {
    throw createError("amount must be a non-negative number");
  }

  const vendor = await Vendor.findById(vendorId).select("_id");
  if (!vendor) {
    throw createError("Vendor not found", 404);
  }

  const paymentHistory = await PaymentHistory.create({
    vendorId,
    userId: userId || null,
    type,
    relatedId,
    amount,
    paymentStatus: paymentStatus || "pending",
    transactionId: transactionId || null,
    paymentTimestamp: paymentStatus === "success" ? new Date() : null,
    description: description || "",
  });

  return paymentHistory;
};

export const getPaymentHistoryForVendor = async (vendorId, filters = {}) => {
  if (!vendorId) {
    throw createError("vendorId is required");
  }

  if (!isValidObjectId(vendorId)) {
    throw createError("vendorId must be a valid MongoDB ObjectId");
  }

  const vendor = await Vendor.findById(vendorId).select("_id");
  if (!vendor) {
    throw createError("Vendor not found", 404);
  }

  const query = { vendorId };

  if (filters.type) {
    if (!["booking", "subscription", "full payment"].includes(filters.type)) {
      throw createError("Invalid type filter");
    }
    query.type = filters.type;
  }

  if (filters.paymentStatus) {
    if (!["pending", "success", "failed"].includes(filters.paymentStatus)) {
      throw createError("Invalid paymentStatus filter");
    }
    query.paymentStatus = filters.paymentStatus;
  }

  if (filters.startDate || filters.endDate) {
    query.paymentTimestamp = {};
    if (filters.startDate) {
      query.paymentTimestamp.$gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      query.paymentTimestamp.$lte = new Date(filters.endDate);
    }
  }

  const paymentHistories = await PaymentHistory.find(query)
    .populate("userId", "name username email")
    .sort({ paymentTimestamp: -1, createdAt: -1 });

  return paymentHistories;
};

export const getAllPaymentHistory = async (filters = {}) => {
  const query = {};

  if (filters.vendorId) {
    if (!isValidObjectId(filters.vendorId)) {
      throw createError("vendorId must be a valid MongoDB ObjectId");
    }
    query.vendorId = filters.vendorId;
  }

  if (filters.type) {
    if (!["booking", "subscription", "full payment"].includes(filters.type)) {
      throw createError("Invalid type filter");
    }
    query.type = filters.type;
  }

  if (filters.paymentStatus) {
    if (!["pending", "success", "failed"].includes(filters.paymentStatus)) {
      throw createError("Invalid paymentStatus filter");
    }
    query.paymentStatus = filters.paymentStatus;
  }

  if (filters.startDate || filters.endDate) {
    query.paymentTimestamp = {};
    if (filters.startDate) {
      query.paymentTimestamp.$gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      query.paymentTimestamp.$lte = new Date(filters.endDate);
    }
  }

  const paymentHistories = await PaymentHistory.find(query)
    .populate("vendorId", "name email")
    .populate("userId", "name username email")
    .sort({ paymentTimestamp: -1, createdAt: -1 });

  return paymentHistories;
};