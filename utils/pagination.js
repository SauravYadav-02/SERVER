/**
 * paginate
 * Helper function to handle MongoDB pagination.
 * 
 * @param {Object} model - Mongoose model
 * @param {Object} query - MongoDB query object
 * @param {Object} options - Pagination options (page, limit, populate, sort)
 * @returns {Object} - { data, page, limit, totalRecords, totalPages }
 */
export const paginate = async (model, query = {}, options = {}) => {
  const page = Math.max(1, parseInt(options.page) || 1);
  const limit = Math.max(1, parseInt(options.limit) || 10);
  const skip = (page - 1) * limit;

  // Sort support
  const allowedSortFields = options.allowedSortFields || ["createdAt", "updatedAt"];
  const sortBy = allowedSortFields.includes(options.sortBy) ? options.sortBy : "createdAt";
  const sortOrder = options.sortOrder === "asc" ? 1 : -1;
  const sort = options.sort || { [sortBy]: sortOrder };

  const populate = options.populate || "";

  const [totalRecords, data] = await Promise.all([
    model.countDocuments(query),
    model.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate(populate)
      .lean(),
  ]);

  const totalPages = Math.ceil(totalRecords / limit);

  return { data, page, limit, totalRecords, totalPages };
};
