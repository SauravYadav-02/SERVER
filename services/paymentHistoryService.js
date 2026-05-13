import mongoose from "mongoose";
import PaymentHistory from "../models/PaymentHistoryModel.js";
import Vendor from "../models/VendorModel.js";
import User from "../models/UserModel.js";
import Admin from "../models/AdminModel.js";
import UserVendorPayment from "../models/UserVendorPaymentModel.js";

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export const createPaymentHistory = async (payload) => {
  const { vendorId, userId, adminId, type, relatedId, amount, paymentStatus, transactionId, description } = payload;

  if (!vendorId || !type || !relatedId || amount === undefined) {
    throw createError("vendorId, type, relatedId, and amount are required");
  }

  if (!isValidObjectId(vendorId) || !isValidObjectId(relatedId)) {
    throw createError("vendorId and relatedId must be valid MongoDB ObjectIds");
  }

  if (userId && !isValidObjectId(userId)) {
    throw createError("userId must be a valid MongoDB ObjectId if provided");
  }
  
  if (adminId && !isValidObjectId(adminId)) {
    throw createError("adminId must be a valid MongoDB ObjectId if provided");
  }

  if (!["booking", "subscription", "full payment"].includes(type)) {
    throw createError("type must be one of: booking, subscription, full payment");
  }

  if (typeof amount !== "number" || amount < 0) {
    throw createError("amount must be a non-negative number");
  }

  const [vendor, user, admin] = await Promise.all([
    Vendor.findById(vendorId).select("fullName email"),
    userId ? User.findById(userId).select("name email") : null,
    adminId ? Admin.findById(adminId).select("username") : null,
  ]);

  if (!vendor) {
    throw createError("Vendor not found", 404);
  }

  const descriptiveFields = {
    vendorName: vendor.fullName || "",
    vendorEmail: vendor.email || "",
    userName: user?.name || "",
    userEmail: user?.email || "",
    adminName: admin?.username || "",
  };

  const paymentTimestamp = paymentStatus === "success" ? new Date() : null;

  const paymentHistory = await PaymentHistory.create({
    vendorId,
    userId: userId || null,
    adminId: adminId || null,
    type,
    relatedId,
    amount,
    paymentStatus: paymentStatus || "pending",
    transactionId: transactionId || null,
    paymentTimestamp,
    description: description || "",
    ...descriptiveFields,
  });

  // If type is booking, also create a record in UserVendorPayment
  if (type === "booking") {
    try {
      await UserVendorPayment.create({
        userId,
        userName: descriptiveFields.userName,
        userEmail: descriptiveFields.userEmail,
        vendorId,
        vendorName: descriptiveFields.vendorName,
        vendorEmail: descriptiveFields.vendorEmail,
        adminId: adminId || null,
        adminName: descriptiveFields.adminName,
        bookingId: relatedId,
        amount,
        paymentStatus: paymentStatus || "pending",
        transactionId: transactionId || null,
        paymentTimestamp,
        description: description || "",
      });
    } catch (err) {
      console.error("Failed to create UserVendorPayment record:", err.message);
    }
  }

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
    .populate("adminId", "username")
    .populate("vendorId", "fullName email businessName")
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
    .populate("vendorId", "fullName email businessName businessType address state pincode status")
    .populate("userId", "name username email profilePhoto phone")
    .populate("adminId", "username")
    .sort({ paymentTimestamp: -1, createdAt: -1 });

  return paymentHistories;
};