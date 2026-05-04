/**
 * isVendor middleware
 * Validates that the request carries a vendorId header (set after login).
 * Mirrors the isAdmin / isUser pattern already in the project.
 */
export const isVendor = (req, res, next) => {
  const vendorId = req.headers.vendorid || req.headers["vendorid"];

  if (!vendorId) {
    return res.status(401).json({ message: "Vendor not authenticated. Missing vendorid header." });
  }

  req.vendorId = vendorId;
  next();
};
