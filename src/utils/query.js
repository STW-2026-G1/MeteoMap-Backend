/** Parse ?page and ?limit from query string with safe defaults */
function parsePagination(query) {
  const page  = Math.max(1, parseInt(query.page  || "1",  10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || "20", 10)));
  const skip  = (page - 1) * limit;
  return { page, limit, skip };
}

/** Wrap a data array + total count into the standard paginated response shape */
function paginate(data, total, { page, limit }) {
  return {
    data,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  };
}

/** Build a MongoDB filter from common movie query params */
function buildMovieFilter(query) {
  const filter = {};

  if (query.genre) {
    filter.genres = query.genre; // exact match inside array
  }

  if (query.yearFrom || query.yearTo) {
    filter.startYear = {};
    if (query.yearFrom) filter.startYear.$gte = parseInt(query.yearFrom, 10);
    if (query.yearTo)   filter.startYear.$lte = parseInt(query.yearTo, 10);
  }

  if (query.minRating) {
    filter["rating.averageRating"] = {
      ...(filter["rating.averageRating"] || {}),
      $gte: parseFloat(query.minRating),
    };
  }

  if (query.maxRating) {
    filter["rating.averageRating"] = {
      ...(filter["rating.averageRating"] || {}),
      $lte: parseFloat(query.maxRating),
    };
  }

  if (query.minVotes) {
    filter["rating.numVotes"] = { $gte: parseInt(query.minVotes, 10) };
  }

  if (query.minRuntime || query.maxRuntime) {
    filter.runtimeMinutes = {};
    if (query.minRuntime) filter.runtimeMinutes.$gte = parseInt(query.minRuntime, 10);
    if (query.maxRuntime) filter.runtimeMinutes.$lte = parseInt(query.maxRuntime, 10);
  }

  if (query.isAdult !== undefined) {
    filter.isAdult = query.isAdult === "true";
  }

  return filter;
}

/** Parse a ?sort=field:asc|desc string into a MongoDB sort object */
function parseSort(sortStr, allowed) {
  if (!sortStr) return null;
  const [field, dir] = sortStr.split(":");
  if (!allowed.includes(field)) return null;
  return { [field]: dir === "desc" ? -1 : 1 };
}

module.exports = { parsePagination, paginate, buildMovieFilter, parseSort };
