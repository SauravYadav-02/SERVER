import {
  createPaymentHistory,
  getAdminVendorPaymentHistory,
  getAllPaymentHistory,
  getPaymentHistoryForVendor,
  getUserVendorPaymentHistory,
  getSubscriptionPaymentHistoryForVendor,
} from "../services/paymentHistoryService.js";

const sendError = (res, error) =>
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || "Something went wrong",
  });

const toObject = (record) => (record?.toObject ? record.toObject() : record);

const formatAdminVendorTransaction = (record) => {
  const data = toObject(record);
  const admin = data.adminId || null;
  return {
    ...data,
    adminName: admin?.name || admin?.fullName || admin?.username || null,
    vendorDetails: data.vendorId || null,
  };
};

// POST /payments — create entry (admin or system)
export const createPaymentHistoryEntry = async (req, res) => {
  try {
    const paymentHistory = await createPaymentHistory({
      ...req.body,
      adminId: req.body.adminId || req.adminId,
    });
    res.status(201).json({
      success: true,
      message: "Payment history entry created successfully",
      data: paymentHistory,
    });
  } catch (error) {
    sendError(res, error);
  }
};

// GET /payments/vendor/:vendorId — vendor can only see THEIR OWN history
export const getVendorPaymentHistory = async (req, res) => {
  try {
    const { vendorId } = req.params;

    // ── Ownership check ─────────────────────────────────────────────────────
    if (req.vendorId !== vendorId) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You can only access your own payment history.",
      });
    }

    const paymentHistories = await getPaymentHistoryForVendor(vendorId, req.query);
    res.status(200).json({
      success: true,
      count: paymentHistories.length,
      data: paymentHistories,
    });
  } catch (error) {
    sendError(res, error);
  }
};

// GET /payments/my/subscriptions — subscription payments for the logged-in vendor
export const getMySubscriptionPayments = async (req, res) => {
  try {
    // vendorId comes from isVendor middleware header — cannot be spoofed via URL param
    const result = await getSubscriptionPaymentHistoryForVendor(req.vendorId, req.query);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    sendError(res, error);
  }
};

// GET /payments — all payment history (admin only)
export const getAllPayments = async (req, res) => {
  try {
    const result = await getAllPaymentHistory(req.query);
    res.status(200).json({
      success: true,
      ...result,
      data: result.data.map(formatAdminVendorTransaction),
    });
  } catch (error) {
    sendError(res, error);
  }
};

// GET /payments/admin-vendor — admin-vendor subscription transactions
export const getAdminVendorPayments = async (req, res) => {
  try {
    const result = await getAdminVendorPaymentHistory(req.query);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    sendError(res, error);
  }
};

// GET /payments/user-vendor — user-vendor booking transactions
export const getUserVendorPayments = async (req, res) => {
  try {
    const result = await getUserVendorPaymentHistory(req.query);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    sendError(res, error);
  }
};
