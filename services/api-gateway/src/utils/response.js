export function sendSuccess(req, res, data = {}, { status = 200, meta = {} } = {}) {
  return res.status(status).json({
    success: true,
    data,
    meta,
    requestId: req.id || null,
  });
}
