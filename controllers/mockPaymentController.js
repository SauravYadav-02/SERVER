import {
  createBookingWithUpfrontPayment,
  getVendorBookings,
  simulatePayment,
  getUserPayments,
  getVendorPayments,
} from "../services/mockPaymentService.js";

const handleError = (res, error) => {
  console.error("Payment Error:", error);
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({
    message: error.message || "Server error",
  });
};

export const createBooking = async (req, res) => {
  try {
    const booking = await createBookingWithUpfrontPayment(req.body);

    res.status(201).json({
      message: "Booking created successfully. Upfront payment is pending.",
      booking,
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const payBooking = async (req, res) => {
  try {
    const booking = await simulatePayment(req.body);

    res.status(200).json({
      message:
        booking.paymentStatus === "success"
          ? "Mock payment completed successfully"
          : "Mock payment failed",
      booking,
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const vendorBookings = async (req, res) => {
  try {
    const bookings = await getVendorBookings(req.query.vendorId);

    res.status(200).json({
      bookings,
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const userPayments = async (req, res) => {
  try {
    const payments = await getUserPayments(req.params.userId);

    res.status(200).json({
      payments,
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const vendorPayments = async (req, res) => {
  try {
    const payments = await getVendorPayments(req.params.vendorId);

    res.status(200).json({
      payments,
    });
  } catch (error) {
    handleError(res, error);
  }
};
