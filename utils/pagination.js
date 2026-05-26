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

  const sort = options.sort || { createdAt: -1 };
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

  return {
    data,
    page,
    limit,
    totalRecords,
    totalPages,
  };
};
