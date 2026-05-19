import {
  assignSubscriptionByAdmin,
  confirmSubscriptionPayment,
  createSubscriptionPayment,
  fullPaymentSubscriptionByAdmin,
  getAllSubscriptionsForAdmin,
  getQueue,
  getSubscription,
  getVendorSubscriptionForAdmin,
} from "../services/subscriptionService.js";

const sendError = (res, error) =>
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || "Something went wrong",
  });

export const createSubscriptionPaymentIntent = async (req, res) => {
  try {
    const { planId } = req.body;

    if (!planId || typeof planId !== "string" || planId.trim() === "") {
      return res.status(400).json({ success: false, message: "planId is required." });
    }

    const result = await createSubscriptionPayment(req.vendorId, planId.trim());
    res.status(201).json({ success: true, ...result });
  } catch (error) {
    sendError(res, error);
  }
};

export const confirmSubscriptionPaymentIntent = async (req, res) => {
  try {
    const { transactionId } = req.body;

    if (!transactionId) {
      return res.status(400).json({ success: false, message: "transactionId is required." });
    }

    const result = await confirmSubscriptionPayment(req.vendorId, transactionId);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    sendError(res, error);
  }
};

export const getMySubscription = async (req, res) => {
  try {
    const subscription = await getSubscription(req.vendorId);
    res.json({ success: true, subscription });
  } catch (error) {
    sendError(res, error);
  }
};

export const getMySubscriptionQueue = async (req, res) => {
  try {
    const queue = await getQueue(req.vendorId);
    res.json({ success: true, count: queue.length, queue });
  } catch (error) {
    sendError(res, error);
  }
};

export const getAllSubscriptions = async (req, res) => {
  try {
    const { page, limit, search, status } = req.query;
    const result = await getAllSubscriptionsForAdmin({ page, limit, search, status });
    
    res.json({ 
      success: true, 
      warningWindowDays: 15, 
      ...result 
    });
  } catch (error) {
    sendError(res, error);
  }
};

export const getExpiringSubscriptions = async (req, res) => {
  try {
    const { page, limit, search } = req.query;
    const result = await getAllSubscriptionsForAdmin({ expiringSoonOnly: true, page, limit, search });
    
    res.json({
      success: true,
      warningWindowDays: 15,
      ...result
    });
  } catch (error) {
    sendError(res, error);
  }
};

export const getVendorSubscription = async (req, res) => {
  try {
    const subscription = await getVendorSubscriptionForAdmin(req.params.vendorId);
    res.json({ success: true, subscription });
  } catch (error) {
    sendError(res, error);
  }
};

export const assignSubscription = async (req, res) => {
  try {
    const { vendorId, planId, startDate, endDate } = req.body;

    if (!vendorId || !planId) {
      return res.status(400).json({ success: false, message: "vendorId and planId are required." });
    }

    const result = await assignSubscriptionByAdmin({
      vendorId,
      planId,
      startDate,
      endDate,
      adminId: req.adminId,
    });
    res.status(201).json({ success: true, ...result });
  } catch (error) {
    sendError(res, error);
  }
};

export const assignFullPayment = async (req, res) => {
  try {
    const { vendorId, planId, startDate, endDate } = req.body;

    if (!vendorId || !planId) {
      return res.status(400).json({ success: false, message: "vendorId and planId are required." });
    }

    const result = await fullPaymentSubscriptionByAdmin({
      vendorId,
      planId,
      startDate,
      endDate,
      adminId: req.adminId,
    });
    res.status(201).json({ success: true, ...result });
  } catch (error) {
    sendError(res, error);
  }
};
