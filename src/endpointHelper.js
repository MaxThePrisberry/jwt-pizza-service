class StatusCodeError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

const asyncHandler = (fn) => (req, res, next) => {
  return Promise.resolve(fn(req, res, next)).catch(next);
};

function readPaging(req) {
  const page = Number(req.query.page ?? 0);
  const limit = Number(req.query.limit ?? 10);
  if (!Number.isInteger(page) || page < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new StatusCodeError('invalid page or limit', 400);
  }
  return { page, limit };
}

module.exports = {
  asyncHandler,
  StatusCodeError,
  readPaging,
};
