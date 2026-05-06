import { createPaymentHistory, getPaymentHistoryForVendor, getAllPaymentHistory } from "../services/paymentHistoryService.js";

export const createPaymentHistoryEntry = async (req, res) => {
  try {
    const paymentHistory = await createPaymentHistory(req.body);
    res.status(201).json({
      success: true,
      message: "Payment history entry created successfully",
      data: paymentHistory,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getVendorPaymentHistory = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const filters = req.query;
    const paymentHistories = await getPaymentHistoryForVendor(vendorId, filters);
    res.status(200).json({
      success: true,
      data: paymentHistories,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getAllPayments = async (req, res) => {
  try {
    const filters = req.query;
    const paymentHistories = await getAllPaymentHistory(filters);
    res.status(200).json({
      success: true,
      data: paymentHistories,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};