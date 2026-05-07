import Subscription from "../models/SubscriptionModel.js";
import SubscriptionQueue from "../models/SubscriptionQueueModel.js";
import Plan from "../models/PlanModel.js";
import { sendEmail } from "../utils/emailService.js";
import Vendor from "../models/VendorModel.js";
import Venue from "../models/VenueModel.js";
import { createPaymentHistory } from "./paymentHistoryService.js";
import PaymentHistory from "../models/PaymentHistoryModel.js";

const GRACE_DAYS = 15;
const EXPIRY_WARNING_DAYS = 15;
const DAY_MS = 24 * 60 * 60 * 1000;

const createError = (statusCode, message) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const buildPlanSnapshot = (plan) => ({
  name: plan.name,
  duration_days: plan.duration_days,
  price: plan.price,
  features: Array.isArray(plan.features) ? plan.features : [],
});

const buildDates = (startDate, durationDays, explicitEndDate = null) => {
  const start = new Date(startDate || Date.now());
  const end = explicitEndDate ? new Date(explicitEndDate) : addDays(start, durationDays);

  if (Number.isNaN(start.getTime())) {
    throw createError(400, "startDate must be a valid date.");
  }

  if (Number.isNaN(end.getTime()) || end <= start) {
    throw createError(400, "endDate must be a valid date after startDate.");
  }

  return {
    startDate: start,
    endDate: end,
    graceEndDate: addDays(end, GRACE_DAYS),
  };
};

const getDaysRemaining = (endDate, now = new Date()) => {
  if (!endDate) return null;
  return Math.ceil((new Date(endDate).getTime() - now.getTime()) / DAY_MS);
};

const buildWarning = (endDate, status, now = new Date()) => {
  const daysRemaining = getDaysRemaining(endDate, now);

  return {
    windowDays: EXPIRY_WARNING_DAYS,
    daysRemaining,
    expiresWithin15Days:
      status === "active" &&
      daysRemaining !== null &&
      daysRemaining >= 0 &&
      daysRemaining <= EXPIRY_WARNING_DAYS,
    isExpired: daysRemaining !== null && daysRemaining < 0,
  };
};

const inactiveWarning = (endDate, now = new Date()) => ({
  ...buildWarning(endDate, "inactive", now),
  expiresWithin15Days: false,
});

const getDocumentId = (value) => value?._id || value;

const isBasePlan = (plan) => !plan.planType || plan.planType === "base";
const isFullPaymentPlan = (plan) => plan.planType === "full payment";

const getActivePlan = async (planId) => {
  const plan = await Plan.findOne({ _id: planId, is_active: true, deletedAt: null });
  if (!plan) {
    throw createError(404, "Plan not found or is inactive.");
  }

  return plan;
};

const syncSubscriptionStatus = async (sub) => {
  const now = new Date();
  let changed = false;
  let shouldDeactivateVenues = false;

  if (sub.status === "active" && now > sub.endDate) {
    sub.status = "grace";
    changed = true;
  }

  if (sub.status === "grace" && now > sub.graceEndDate) {
    sub.status = "expired";
    changed = true;
    shouldDeactivateVenues = true;
  }

  for (const fullPayment of sub.fullPayments || []) {
    if (fullPayment.status === "active" && now > fullPayment.endDate) {
      fullPayment.status = "expired";
      changed = true;
    }
  }

  if (changed) {
    await sub.save();
  }

  if (shouldDeactivateVenues) {
    await Venue.updateMany({ vendorId: getDocumentId(sub.vendorId) }, { isSubscriptionActive: false });
  }

  return sub;
};

export const activatePlan = async (vendorId, plan, startDate = new Date(), endDate = null) => {
  const { startDate: sd, endDate: ed, graceEndDate: ged } = buildDates(
    startDate,
    plan.duration_days,
    endDate
  );

  const subscription = await Subscription.findOneAndUpdate(
    { vendorId },
    {
      vendorId,
      planId: plan._id,
      planSnapshot: buildPlanSnapshot(plan),
      status: "active",
      startDate: sd,
      endDate: ed,
      graceEndDate: ged,
      notifiedExpiry15Days: false,
      notifiedExpiry5Days: false,
      notifiedExpiryDay: false,
      notifiedGraceEnd: false,
    },
    { upsert: true, new: true }
  ).populate("planId", "name price duration_days features planType");

  await Venue.updateMany({ vendorId }, { isSubscriptionActive: true });

  // Create payment history for subscription
  try {
    await createPaymentHistory({
      vendorId,
      type: "subscription",
      relatedId: subscription._id,
      amount: plan.price,
      paymentStatus: "success",
      transactionId: `SUB-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      description: `Payment for ${plan.name} subscription`,
    });
  } catch (error) {
    console.error("Failed to create payment history for subscription:", error.message);
  }

  return subscription;
};

export const getQueue = async (vendorId) => {
  return SubscriptionQueue.find({ vendorId, isActivated: false })
    .sort({ position: 1 })
    .populate("planId", "name price duration_days features planType");
};

export const buildSubscriptionData = async (sub, { includeQueue = true } = {}) => {
  const now = new Date();
  const data = sub.toObject ? sub.toObject() : sub;
  const vendorId = getDocumentId(data.vendorId);
  const fullPayments = (data.fullPayments || []).map((fullPayment) => ({
    ...fullPayment,
    expirationWarning: buildWarning(fullPayment.endDate, fullPayment.status, now),
  }));

  return {
    ...data,
    fullPayments,
    expirationWarning: buildWarning(data.endDate, data.status, now),
    graceExpirationWarning:
      data.status === "grace"
        ? buildWarning(data.graceEndDate, "active", now)
        : inactiveWarning(data.graceEndDate, now),
    pendingQueue: includeQueue ? await getQueue(vendorId) : undefined,
  };
};

export const getSubscription = async (vendorId) => {
  const sub = await Subscription.findOne({ vendorId }).populate(
    "planId",
    "name price duration_days features planType"
  );

  if (!sub) {
    throw createError(404, "No subscription found for this vendor.");
  }

  await syncSubscriptionStatus(sub);
  return buildSubscriptionData(sub);
};


export const createSubscriptionPayment = async (vendorId, planId) => {
  const plan = await getActivePlan(planId);

  const isFullPayment = isFullPaymentPlan(plan);
  if (!isBasePlan(plan) && !isFullPayment) {
    throw createError(400, "Invalid plan type.");
  }

  // Create pending payment history
  const paymentRecord = await createPaymentHistory({
    vendorId,
    type: isBasePlan(plan) ? "subscription" : "full payment",
    relatedId: plan._id, // temporarily use planId as relatedId until activated
    amount: plan.price,
    paymentStatus: "pending",
    transactionId: `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    description: `Pending payment for ${plan.name}`,
  });

  return {
    message: "Payment intent created successfully.",
    transactionId: paymentRecord.transactionId,
    amount: plan.price,
  };
};

export const confirmSubscriptionPayment = async (vendorId, transactionId) => {
  const paymentRecord = await PaymentHistory.findOne({ vendorId, transactionId, paymentStatus: "pending" });
  if (!paymentRecord) {
    throw createError(404, "Pending payment not found or already processed.");
  }

  const planId = paymentRecord.relatedId;
  const plan = await getActivePlan(planId);

  paymentRecord.paymentStatus = "success";
  paymentRecord.paymentTimestamp = new Date();
  await paymentRecord.save();

  if (isBasePlan(plan)) {
    const existingSub = await Subscription.findOne({ vendorId });
    if (existingSub) {
      await syncSubscriptionStatus(existingSub);
    }
    const hasActiveSub = existingSub && existingSub.status !== "expired";

    if (!hasActiveSub) {
      const sub = await activatePlan(vendorId, plan);
      paymentRecord.relatedId = sub._id;
      await paymentRecord.save();
      return {
        message: "Payment successful. Plan activated immediately.",
        subscription: await buildSubscriptionData(sub),
        queued: false,
      };
    }

    const lastQueueItem = await SubscriptionQueue.findOne(
      { vendorId, isActivated: false },
      null,
      { sort: { position: -1 } }
    );
    const nextPosition = lastQueueItem ? lastQueueItem.position + 1 : 1;

    const queueEntry = await SubscriptionQueue.create({
      vendorId,
      planId: plan._id,
      planSnapshot: buildPlanSnapshot(plan),
      position: nextPosition,
      isActivated: false,
      paymentStatus: "success",
      purchasedAt: new Date(),
    });

    paymentRecord.relatedId = queueEntry._id;
    await paymentRecord.save();

    return {
      message: "Payment successful. Plan added to queue.",
      queueEntry,
      queued: true,
    };
  } else {
    // Full payment
    const sub = await Subscription.findOne({ vendorId }).populate(
      "planId",
      "name price duration_days features planType"
    );

    if (!sub) {
      throw createError(404, "Vendor must have a base subscription before purchasing full-payments.");
    }

    await syncSubscriptionStatus(sub);
    if (sub.status === "expired") {
      throw createError(400, "Cannot add full-payments to an expired subscription.");
    }

    const { startDate: sd, endDate: ed } = buildDates(new Date(), plan.duration_days, null);

    sub.fullPayments.push({
      planId: plan._id,
      planSnapshot: buildPlanSnapshot(plan),
      status: "active",
      startDate: sd,
      endDate: ed,
      purchasedAt: new Date(),
    });

    await sub.save();
    await sub.populate("planId", "name price duration_days features planType");

    const addedFullPayment = sub.fullPayments[sub.fullPayments.length - 1];
    paymentRecord.relatedId = addedFullPayment._id;
    await paymentRecord.save();

    return {
      message: "Payment successful. Full payment activated.",
      subscription: await buildSubscriptionData(sub),
    };
  }
};

export const assignSubscriptionByAdmin = async ({ vendorId, planId, startDate, endDate }) => {
  const vendor = await Vendor.findById(vendorId);
  if (!vendor) {
    throw createError(404, "Vendor not found.");
  }

  const plan = await getActivePlan(planId);
  if (!isBasePlan(plan)) {
    throw createError(400, "Admin assignment requires a base subscription plan.");
  }

  const sub = await activatePlan(vendorId, plan, startDate || new Date(), endDate || null);

  return {
    message: "Subscription assigned successfully.",
    subscription: await buildSubscriptionData(sub),
  };
};

export const fullPaymentSubscriptionByAdmin = async ({ vendorId, planId, startDate, endDate }) => {
  const vendor = await Vendor.findById(vendorId);
  if (!vendor) {
    throw createError(404, "Vendor not found.");
  }

  return fullPaymentSubscription(vendorId, planId, startDate || new Date(), endDate || null);
};

export const getAllSubscriptionsForAdmin = async ({ expiringSoonOnly = false } = {}) => {
  const subscriptions = await Subscription.find()
    .populate("vendorId", "fullName email phone businessName businessType address state pincode status")
    .populate("planId", "name price duration_days features planType")
    .sort({ createdAt: -1 });

  const completeData = [];

  for (const sub of subscriptions) {
    await syncSubscriptionStatus(sub);
    const data = await buildSubscriptionData(sub);
    const hasWarning =
      data.expirationWarning.expiresWithin15Days ||
      data.graceExpirationWarning.expiresWithin15Days ||
      data.fullPayments.some((fullPayment) => fullPayment.expirationWarning.expiresWithin15Days);

    if (!expiringSoonOnly || hasWarning) {
      completeData.push(data);
    }
  }

  return completeData;
};

export const getVendorSubscriptionForAdmin = async (vendorId) => {
  const sub = await Subscription.findOne({ vendorId })
    .populate("vendorId", "fullName email phone businessName businessType address state pincode status")
    .populate("planId", "name price duration_days features planType");

  if (!sub) {
    throw createError(404, "No subscription found for this vendor.");
  }

  await syncSubscriptionStatus(sub);
  return buildSubscriptionData(sub);
};

export const handleExpiry = async () => {
  const now = new Date();
  let processed = 0;

  const expiredActives = await Subscription.find({
    status: "active",
    endDate: { $lte: now },
  });

  for (const sub of expiredActives) {
    sub.status = "grace";
    await sub.save();
    processed++;
    console.log(`[Cron] Vendor ${sub.vendorId} moved to grace period.`);
  }

  const expiredGraces = await Subscription.find({
    status: "grace",
    graceEndDate: { $lte: now },
  });

  for (const sub of expiredGraces) {
    sub.status = "expired";
    await sub.save();

    const result = await Venue.updateMany({ vendorId: sub.vendorId }, { isSubscriptionActive: false });
    console.log(`[Cron] Vendor ${sub.vendorId} expired. ${result.modifiedCount} venues hidden.`);

    processed++;
  }

  const subscriptionsWithExpiredFullPayments = await Subscription.find({
    "fullPayments.status": "active",
    "fullPayments.endDate": { $lte: now },
  });

  for (const sub of subscriptionsWithExpiredFullPayments) {
    let changed = false;
    for (const fullPayment of sub.fullPayments) {
      if (fullPayment.status === "active" && fullPayment.endDate <= now) {
        fullPayment.status = "expired";
        changed = true;
      }
    }

    if (changed) {
      await sub.save();
      processed++;
    }
  }

  return { processed };
};

export const activateQueuedPlans = async () => {
  let activated = 0;
  const expiredSubs = await Subscription.find({ status: "expired" });

  for (const sub of expiredSubs) {
    const vendorId = sub.vendorId;
    const nextInQueue = await SubscriptionQueue.findOne(
      { vendorId, isActivated: false },
      null,
      { sort: { position: 1 } }
    );

    if (!nextInQueue) continue;

    const plan = await Plan.findOne({ _id: nextInQueue.planId, is_active: true, deletedAt: null });
    if (!plan || !isBasePlan(plan)) {
      console.warn(`[Cron] Queued plan ${nextInQueue.planId} is no longer an active base plan. Skipping.`);
      continue;
    }

    await activatePlan(vendorId, plan, new Date());

    nextInQueue.isActivated = true;
    nextInQueue.activatedAt = new Date();
    await nextInQueue.save();

    activated++;
    console.log(`[Cron] Vendor ${vendorId} queue plan activated: ${plan.name}`);
  }

  return { activated };
};

export const sendSubscriptionNotifications = async () => {
  const now = new Date();
  let sent = 0;

  const fifteenDaysFromNow = addDays(now, EXPIRY_WARNING_DAYS);
  const warning15 = await Subscription.find({
    status: "active",
    notifiedExpiry15Days: false,
    endDate: { $gte: now, $lte: fifteenDaysFromNow },
  });

  for (const sub of warning15) {
    try {
      const vendor = await Vendor.findById(sub.vendorId).select("email fullName");
      if (!vendor) continue;

      await sendEmail(
        vendor.email,
        "Your subscription expires in 15 days",
        `Hi ${vendor.fullName},\n\nYour "${sub.planSnapshot.name}" plan expires on ${sub.endDate.toDateString()}.\n\nRenew soon to keep your venues visible.\n\n- Book My Venue Team`
      );

      sub.notifiedExpiry15Days = true;
      await sub.save();
      sent++;
    } catch (err) {
      console.error(`[Cron] Email error (15-day warning) for vendor ${sub.vendorId}:`, err.message);
    }
  }

  const fiveDaysFromNow = addDays(now, 5);
  const warning5 = await Subscription.find({
    status: "active",
    notifiedExpiry5Days: false,
    endDate: { $gte: now, $lte: fiveDaysFromNow },
  });

  for (const sub of warning5) {
    try {
      const vendor = await Vendor.findById(sub.vendorId).select("email fullName");
      if (!vendor) continue;

      await sendEmail(
        vendor.email,
        "Your subscription expires in 5 days",
        `Hi ${vendor.fullName},\n\nYour "${sub.planSnapshot.name}" plan expires on ${sub.endDate.toDateString()}.\n\nRenew now to keep your venues visible.\n\n- Book My Venue Team`
      );

      sub.notifiedExpiry5Days = true;
      await sub.save();
      sent++;
    } catch (err) {
      console.error(`[Cron] Email error (5-day warning) for vendor ${sub.vendorId}:`, err.message);
    }
  }

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const expiringToday = await Subscription.find({
    status: "active",
    notifiedExpiryDay: false,
    endDate: { $gte: todayStart, $lte: todayEnd },
  });

  for (const sub of expiringToday) {
    try {
      const vendor = await Vendor.findById(sub.vendorId).select("email fullName");
      if (!vendor) continue;

      await sendEmail(
        vendor.email,
        "Your subscription expires today",
        `Hi ${vendor.fullName},\n\nYour "${sub.planSnapshot.name}" plan expires today. You will enter a 15-day grace period after expiry.\n\n- Book My Venue Team`
      );

      sub.notifiedExpiryDay = true;
      await sub.save();
      sent++;
    } catch (err) {
      console.error(`[Cron] Email error (expiry day) for vendor ${sub.vendorId}:`, err.message);
    }
  }

  const gracePeriodEndSoon = await Subscription.find({
    status: "grace",
    notifiedGraceEnd: false,
    graceEndDate: { $gte: now, $lte: addDays(now, 2) },
  });

  for (const sub of gracePeriodEndSoon) {
    try {
      const vendor = await Vendor.findById(sub.vendorId).select("email fullName");
      if (!vendor) continue;

      await sendEmail(
        vendor.email,
        "Grace period ending soon",
        `Hi ${vendor.fullName},\n\nYour 15-day grace period for "${sub.planSnapshot.name}" ends on ${sub.graceEndDate.toDateString()}.\n\nAfter this, your venues will be hidden from users.\n\n- Book My Venue Team`
      );

      sub.notifiedGraceEnd = true;
      await sub.save();
      sent++;
    } catch (err) {
      console.error(`[Cron] Email error (grace end) for vendor ${sub.vendorId}:`, err.message);
    }
  }

  return { sent };
};

export const getVendorSubscriptionStatus = async (vendorId) => {
  const sub = await Subscription.findOne({ vendorId });
  if (!sub) return "none";

  await syncSubscriptionStatus(sub);
  return sub.status;
};
