/**
 * Calculate refund amount and tier based on days before event
 * @param {string} eventDate - "YYYY-MM-DD"
 * @param {number} amountPaid - total amount user has paid
 * @param {number} upfrontPaymentAmount - the initial deposit/upfront amount
 * @returns {{ refundAmount: number, tier: string, daysBeforeEvent: number }}
 */
export const calculateRefund = (eventDate, amountPaid, upfrontPaymentAmount) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const [year, month, day] = eventDate.split("-").map(Number);
  // Construct date in local timezone to match user view
  const event = new Date(year, month - 1, day);
  event.setHours(0, 0, 0, 0);
  
  const daysBeforeEvent = Math.floor((event - today) / (1000 * 60 * 60 * 24));

  let refundAmount = 0;
  let tier = "none";

  if (daysBeforeEvent > 45) {
    // Full refund minus deposit
    refundAmount = Math.max(0, amountPaid - upfrontPaymentAmount);
    tier = "full";
  } else if (daysBeforeEvent >= 30) {
    refundAmount = Math.round(amountPaid * 0.5);
    tier = "50%";
  } else if (daysBeforeEvent >= 15) {
    refundAmount = Math.round(amountPaid * 0.25);
    tier = "25%";
  } else {
    refundAmount = 0;
    tier = "none";
  }

  return { refundAmount, tier, daysBeforeEvent };
};
