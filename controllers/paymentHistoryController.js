import {
  createPaymentHistory,
  getAdminVendorPaymentHistory,
  getAllPaymentHistory,
  getPaymentHistoryForVendor,
  getUserVendorPaymentHistory,
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

export const getVendorPaymentHistory = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const filters = req.query;
    const paymentHistories = await getPaymentHistoryForVendor(vendorId, filters);
    res.status(200).json({
      success: true,
      count: paymentHistories.length,
      data: paymentHistories,
    });
  } catch (error) {
    sendError(res, error);
  }
};

export const getAllPayments = async (req, res) => {
  try {
    const filters = req.query;
    const result = await getAllPaymentHistory(filters);
    res.status(200).json({
      success: true,
      ...result,
      data: result.data.map(formatAdminVendorTransaction),
    });
  } catch (error) {
    sendError(res, error);
  }
};

export const getAdminVendorPayments = async (req, res) => {
  try {
    const result = await getAdminVendorPaymentHistory(req.query);
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    sendError(res, error);
  }
};

export const getUserVendorPayments = async (req, res) => {
  try {
    const result = await getUserVendorPaymentHistory(req.query);
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    sendError(res, error);
  }
};
