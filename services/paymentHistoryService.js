import mongoose from "mongoose";
import PaymentHistory from "../models/PaymentHistoryModel.js";
import Vendor from "../models/VendorModel.js";
import User from "../models/UserModel.js";
import Admin from "../models/AdminModel.js";
import UserVendorPayment from "../models/UserVendorPaymentModel.js";

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);
const TRANSACTION_TYPES = ["booking", "subscription", "full payment"];
const PAYMENT_STATUSES = ["pending", "success", "failed"];
const ADMIN_VENDOR_TYPES = ["subscription", "full payment"];

const VENDOR_SELECT = "fullName email phone businessName businessType address state pincode status";
const USER_SELECT = "name username email phone";
const ADMIN_SELECT = "username name fullName";

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

export const createPaymentHistory = async (payload) => {
  const {
    vendorId,
    userId,
    adminId,
    type,
    relatedId,
    amount,
    paymentStatus,
    transactionId,
    description,
  } = payload;

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

  if (adminId && !isValidObjectId(adminId)) {
    throw createError("adminId must be a valid MongoDB ObjectId if provided");
  }

  if (!TRANSACTION_TYPES.includes(type)) {
    throw createError("type must be one of: booking, subscription, full payment");
  }

  if (paymentStatus && !PAYMENT_STATUSES.includes(paymentStatus)) {
    throw createError("paymentStatus must be one of: pending, success, failed");
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

const applyCommonFilters = (query, filters = {}, allowedTypes = TRANSACTION_TYPES) => {
  if (filters.vendorId) {
    if (!isValidObjectId(filters.vendorId)) {
      throw createError("vendorId must be a valid MongoDB ObjectId");
    }
    query.vendorId = filters.vendorId;
  }

  if (filters.userId) {
    if (!isValidObjectId(filters.userId)) {
      throw createError("userId must be a valid MongoDB ObjectId");
    }
    query.userId = filters.userId;
  }

  if (filters.adminId) {
    if (!isValidObjectId(filters.adminId)) {
      throw createError("adminId must be a valid MongoDB ObjectId");
    }
    query.adminId = filters.adminId;
  }

  if (filters.type) {
    if (!allowedTypes.includes(filters.type)) {
      throw createError("Invalid type filter");
    }
    query.type = filters.type;
  }

  if (filters.paymentStatus) {
    if (!PAYMENT_STATUSES.includes(filters.paymentStatus)) {
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

  return query;
};

const populateTransactionParties = (query) =>
  query
    .populate("vendorId", VENDOR_SELECT)
    .populate("userId", USER_SELECT)
    .populate("adminId", ADMIN_SELECT);

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

  const { vendorId: _ignoredVendorId, ...safeFilters } = filters;
  
  // 1. Fetch from PaymentHistory (Subscriptions, Full Payments, etc.)
  const phQuery = applyCommonFilters({ vendorId }, safeFilters, TRANSACTION_TYPES);
  const phRecords = await populateTransactionParties(PaymentHistory.find(phQuery));

  // 2. Fetch from UserVendorPayment (Bookings)
  // Only fetch if type is "booking" or "all"
  let uvpRecords = [];
  if (!filters.type || filters.type === "booking") {
    const uvpQuery = { vendorId };
    if (filters.userId) uvpQuery.userId = filters.userId;
    if (filters.paymentStatus) uvpQuery.paymentStatus = filters.paymentStatus;
    if (filters.startDate || filters.endDate) {
      uvpQuery.paymentTimestamp = {};
      if (filters.startDate) uvpQuery.paymentTimestamp.$gte = new Date(filters.startDate);
      if (filters.endDate) uvpQuery.paymentTimestamp.$lte = new Date(filters.endDate);
    }

    uvpRecords = await UserVendorPayment.find(uvpQuery)
      .populate("vendorId", VENDOR_SELECT)
      .populate("userId", USER_SELECT)
      .populate("venueId", "name");
  }

  // 3. Map UserVendorPayment to match PaymentHistory structure
  const mappedUVP = uvpRecords.map(rec => {
    const data = rec.toObject ? rec.toObject() : rec;
    return {
      ...data,
      type: "booking",
      relatedId: data.bookingId,
      // description is already there
    };
  });

  // 4. Combine and sort
  const combined = [...phRecords, ...mappedUVP].sort((a, b) => {
    const dateA = new Date(a.paymentTimestamp || a.createdAt);
    const dateB = new Date(b.paymentTimestamp || b.createdAt);
    return dateB.getTime() - dateA.getTime();
  });

  return combined;
};

export const getAllPaymentHistory = async (filters = {}) => {
  const { page = 1, limit = 10 } = filters;
  const p = Math.max(1, parseInt(page));
  const l = Math.max(1, parseInt(limit));
  const skip = (p - 1) * l;

  const query = applyCommonFilters({}, filters);

  // Since we are combining two models, true DB-level pagination is tricky without aggregation.
  // For now, we'll fetch enough records to satisfy the page/limit, but for optimization,
  // we should use a more advanced approach. 
  // However, for "Large datasets" requirement, we'll use a simpler paginated fetch for each and combine.
  
  const phRecords = await populateTransactionParties(PaymentHistory.find(query).sort({ createdAt: -1 }));

  let uvpRecords = [];
  if (!filters.type || filters.type === "booking") {
    const cleanUvpQuery = {};
    if (filters.vendorId) cleanUvpQuery.vendorId = filters.vendorId;
    if (filters.userId) cleanUvpQuery.userId = filters.userId;
    if (filters.paymentStatus) cleanUvpQuery.paymentStatus = filters.paymentStatus;
    if (filters.startDate || filters.endDate) {
      cleanUvpQuery.paymentTimestamp = {};
      if (filters.startDate) cleanUvpQuery.paymentTimestamp.$gte = new Date(filters.startDate);
      if (filters.endDate) cleanUvpQuery.paymentTimestamp.$lte = new Date(filters.endDate);
    }

    uvpRecords = await UserVendorPayment.find(cleanUvpQuery)
      .populate("vendorId", VENDOR_SELECT)
      .populate("userId", USER_SELECT)
      .populate("venueId", "name")
      .sort({ createdAt: -1 });
  }

  const mappedUVP = uvpRecords.map(rec => {
    const data = rec.toObject ? rec.toObject() : rec;
    return {
      ...data,
      type: "booking",
      relatedId: data.bookingId,
    };
  });

  const combined = [...phRecords, ...mappedUVP].sort((a, b) => {
    const dateA = new Date(a.paymentTimestamp || a.createdAt);
    const dateB = new Date(b.paymentTimestamp || b.createdAt);
    return dateB.getTime() - dateA.getTime();
  });

  const totalRecords = combined.length;
  const data = combined.slice(skip, skip + l);
  const totalPages = Math.ceil(totalRecords / l);

  return { data, page: p, limit: l, totalRecords, totalPages };
};

export const getAdminVendorPaymentHistory = async (filters = {}) => {
  const { page = 1, limit = 10 } = filters;
  const p = Math.max(1, parseInt(page));
  const l = Math.max(1, parseInt(limit));
  const skip = (p - 1) * l;

  const query = applyCommonFilters({ type: { $in: ADMIN_VENDOR_TYPES } }, filters, ADMIN_VENDOR_TYPES);

  const [totalRecords, records] = await Promise.all([
    PaymentHistory.countDocuments(query),
    populateTransactionParties(PaymentHistory.find(query))
      .sort({ paymentTimestamp: -1, createdAt: -1 })
      .skip(skip)
      .limit(l)
      .lean()
  ]);

  return {
    data: records,
    page: p,
    limit: l,
    totalRecords,
    totalPages: Math.ceil(totalRecords / l)
  };
};

export const getUserVendorPaymentHistory = async (filters = {}) => {
  const { page = 1, limit = 10 } = filters;
  const p = Math.max(1, parseInt(page));
  const l = Math.max(1, parseInt(limit));
  const skip = (p - 1) * l;

  const uvpQuery = {};
  if (filters.vendorId) uvpQuery.vendorId = filters.vendorId;
  if (filters.userId) uvpQuery.userId = filters.userId;
  if (filters.paymentStatus) uvpQuery.paymentStatus = filters.paymentStatus;
  if (filters.startDate || filters.endDate) {
    uvpQuery.paymentTimestamp = {};
    if (filters.startDate) uvpQuery.paymentTimestamp.$gte = new Date(filters.startDate);
    if (filters.endDate) uvpQuery.paymentTimestamp.$lte = new Date(filters.endDate);
  }

  const [totalRecords, records] = await Promise.all([
    UserVendorPayment.countDocuments(uvpQuery),
    UserVendorPayment.find(uvpQuery)
      .populate("vendorId", VENDOR_SELECT)
      .populate("userId", USER_SELECT)
      .populate("venueId", "name")
      .sort({ paymentTimestamp: -1, createdAt: -1 })
      .skip(skip)
      .limit(l)
      .lean()
  ]);

  const mappedData = records.map(rec => ({
    ...rec,
    type: "booking",
    relatedId: rec.bookingId,
  }));

  return {
    data: mappedData,
    page: p,
    limit: l,
    totalRecords,
    totalPages: Math.ceil(totalRecords / l)
  };
};
