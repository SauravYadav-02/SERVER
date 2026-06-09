import VendorPlan from "../models/VendorPlanModel.js";

// Helper for error handling
const handleError = (res, error) => {
  console.error("Admin Plan Controller Error:", error);
  res.status(500).json({
    message: error.message || "An error occurred while processing your request.",
  });
};

// Create a new vendor plan
export const createPlan = async (req, res) => {
  try {
    const { name, monthlyPrice, yearlyPrice, maxVenues, visibilityBoost, customBranding, supportTier, isActive } = req.body;
    
    // Check if a plan with the same name already exists
    const existingPlan = await VendorPlan.findOne({ name });
    if (existingPlan) {
      return res.status(400).json({ message: `Plan with name '${name}' already exists.` });
    }

    const newPlan = new VendorPlan({
      name,
      monthlyPrice,
      yearlyPrice,
      maxVenues,
      visibilityBoost,
      customBranding,
      supportTier,
      isActive,
    });

    const savedPlan = await newPlan.save();
    res.status(201).json(savedPlan);
  } catch (error) {
    handleError(res, error);
  }
};

// Update an existing vendor plan
export const updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const updatedPlan = await VendorPlan.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!updatedPlan) {
      return res.status(404).json({ message: "Plan not found." });
    }

    res.status(200).json(updatedPlan);
  } catch (error) {
    handleError(res, error);
  }
};

// List all vendor plans (including inactive ones for admin view)
export const listAllPlans = async (req, res) => {
  try {
    const plans = await VendorPlan.find().sort({ createdAt: -1 });
    res.status(200).json(plans);
  } catch (error) {
    handleError(res, error);
  }
};
