import Booking from "../models/BookingModel.js";
import UserVendorPayment from "../models/UserVendorPaymentModel.js";
import User from "../models/UserModel.js";
import Vendor from "../models/VendorModel.js";

const toMoney = (val) => Number(Number(val).toFixed(2));

// Helper to calculate outstanding balance for legacy or uninitialized bookings
const getRemainingAmount = (booking) => {
  const finalAmt = booking.finalAmount || booking.totalBookingAmount || booking.cost || 0;
  if (
    booking.remainingAmount === undefined ||
    booking.remainingAmount === null ||
    (booking.remainingAmount === 0 && booking.amountPaid < finalAmt && booking.balancePaymentStatus !== "paid")
  ) {
    return toMoney(finalAmt - booking.amountPaid);
  }
  return booking.remainingAmount;
};

export const vendorLogPayment = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { amount, method, note } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Amount must be a positive number." });
    }

    if (method !== "cash" && method !== "cheque") {
      return res.status(400).json({ success: false, message: "Method must be either 'cash' or 'cheque'." });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found." });
    }

    // Ownership check
    if (booking.vendorId.toString() !== req.vendorId) {
      return res.status(403).json({ success: false, message: "Forbidden: You do not own this booking." });
    }

    const remaining = getRemainingAmount(booking);
    if (amount > remaining) {
      return res.status(400).json({
        success: false,
        message: `Amount exceeds the remaining balance of ₹${remaining}.`,
      });
    }

    // Record the transaction log
    booking.transactions.push({
      amount: toMoney(amount),
      method,
      loggedBy: "vendor",
      note: note || "",
      paidAt: new Date(),
    });

    // Update balance and payment status fields
    booking.amountPaid = toMoney(booking.amountPaid + amount);
    booking.remainingAmount = toMoney(remaining - amount);
    booking.balancePaymentStatus = booking.remainingAmount === 0 ? "paid" : "partial";

    await booking.save();
    return res.status(200).json({ success: true, booking });
  } catch (error) {
    console.error("Error logging payment:", error);
    return res.status(500).json({ success: false, message: "Failed to log payment.", error: error.message });
  }
};

export const userPayOnline = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found." });
    }

    // Ownership check
    if (booking.userId.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: "Forbidden: This is not your booking." });
    }

    const remaining = getRemainingAmount(booking);
    if (remaining <= 0) {
      return res.status(400).json({ success: false, message: "No remaining balance due." });
    }

    const mockTransactionId = `MOCK-REMAIN-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

    // Record transaction
    booking.transactions.push({
      amount: remaining,
      method: "online",
      loggedBy: "user",
      note: `Online payment - Txn: ${mockTransactionId}`,
      paidAt: new Date(),
    });

    // Update balances
    booking.amountPaid = toMoney(booking.amountPaid + remaining);
    booking.remainingAmount = 0;
    booking.balancePaymentStatus = "paid";

    await booking.save();

    // Fetch details for UserVendorPayment logging
    const [user, vendor] = await Promise.all([
      User.findById(booking.userId).select("name email"),
      Vendor.findById(booking.vendorId).select("fullName email"),
    ]);

    // Create a UserVendorPayment record matching existing bookings pattern
    await UserVendorPayment.create({
      bookingId: booking._id,
      userId: booking.userId,
      userName: user?.name || "",
      userEmail: user?.email || "",
      vendorId: booking.vendorId,
      vendorName: vendor?.fullName || "",
      vendorEmail: vendor?.email || "",
      venueId: booking.venueId,
      amount: remaining,
      paymentStatus: "success",
      transactionId: mockTransactionId,
      paymentTimestamp: new Date(),
      description: `Online remaining balance payment for booking on ${booking.date}`,
    });

    return res.status(200).json({ success: true, booking });
  } catch (error) {
    console.error("Error processing online payment:", error);
    return res.status(500).json({ success: false, message: "Failed to process online payment.", error: error.message });
  }
};

export const getVendorBookingTransactions = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found." });
    }

    if (booking.vendorId.toString() !== req.vendorId) {
      return res.status(403).json({ success: false, message: "Forbidden: You do not own this booking." });
    }

    let txList = [...(booking.transactions || [])];
    const hasUpfront = txList.some(t => t.note && t.note.includes("Upfront payment"));
    if (!hasUpfront && (booking.paymentStatus === "success" || booking.amountPaid > 0)) {
      const finalAmt = booking.finalAmount || booking.totalBookingAmount || booking.cost || 0;
      const upfrontAmt = booking.upfrontPaymentAmount || toMoney(finalAmt * 0.2);
      txList.push({
        _id: `upfront-${booking._id}`,
        amount: upfrontAmt,
        method: "online",
        loggedBy: "user",
        note: `Upfront payment - Txn: ${booking.transactionId || 'LEGACY'}`,
        paidAt: booking.paymentTimestamp || booking.createdAt
      });
    }

    const transactions = txList.sort(
      (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()
    );

    return res.status(200).json({ success: true, transactions });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch transactions.", error: error.message });
  }
};

export const getUserBookingTransactions = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found." });
    }

    if (booking.userId.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: "Forbidden: This is not your booking." });
    }

    let txList = [...(booking.transactions || [])];
    const hasUpfront = txList.some(t => t.note && t.note.includes("Upfront payment"));
    if (!hasUpfront && (booking.paymentStatus === "success" || booking.amountPaid > 0)) {
      const finalAmt = booking.finalAmount || booking.totalBookingAmount || booking.cost || 0;
      const upfrontAmt = booking.upfrontPaymentAmount || toMoney(finalAmt * 0.2);
      txList.push({
        _id: `upfront-${booking._id}`,
        amount: upfrontAmt,
        method: "online",
        loggedBy: "user",
        note: `Upfront payment - Txn: ${booking.transactionId || 'LEGACY'}`,
        paidAt: booking.paymentTimestamp || booking.createdAt
      });
    }

    const transactions = txList.sort(
      (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()
    );

    return res.status(200).json({ success: true, transactions });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch transactions.", error: error.message });
  }
};
