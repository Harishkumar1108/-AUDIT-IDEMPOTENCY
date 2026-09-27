"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
function errorHandler(err, _req, res, _next) {
    console.error('[Error Handler]', err);
    const statusCode = err.status || err.statusCode || 500;
    res.status(statusCode).json({
        error: err.name || 'InternalServerError',
        message: err.message || 'An unexpected error occurred.',
        ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
    });
}
