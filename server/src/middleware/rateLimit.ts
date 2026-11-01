import rateLimit from 'express-rate-limit';

// Strict rate limit for auth login and password attempts
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 1000 : 20, // Keep integration fixtures below production throttles.
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many authentication attempts from this IP, please try again after 15 minutes',
  },
});

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'test' ? 5000 : 120,
  standardHeaders: true,
  legacyHeaders: false,
});

// Uploads are more expensive than ordinary API requests. This limiter is
// installed after authentication on each upload endpoint.
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many uploads from this IP. Please try again later.' },
});

export const demoRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.DEMO_REQUEST_MAX_PER_HOUR) || (process.env.NODE_ENV === 'test' ? 5 : 5),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many demo requests. Please try again later.' },
  // Allow deterministic, isolated limiter tests without trusting client IP headers in production.
  ...(process.env.NODE_ENV === 'test' ? {
    keyGenerator: (req: import('express').Request) => req.get('x-test-rate-limit-key') || req.ip || 'unknown',
  } : {}),
});
