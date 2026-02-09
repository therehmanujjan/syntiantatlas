import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';

/**
 * Verify JWT token and attach user to request
 */
export const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Fetch user from database to ensure they still exist and are active
        const result = await query(
            'SELECT id, email, first_name, last_name, role_id, kyc_status, kyc_level, wallet_balance, phone, created_at FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'User not found' });
        }

        const user = result.rows[0];

        // Check if user is active (not suspended or banned)
        if (user.status === 'suspended' || user.status === 'banned') {
            return res.status(403).json({ error: 'Account is suspended or banned' });
        }

        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }
        console.error('Auth middleware error:', error);
        return res.status(500).json({ error: 'Authentication failed' });
    }
};

/**
 * Role-based access control middleware
 * @param {string[]} allowedRoles - Array of roles that can access the route
 */
export const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!allowedRoles.includes(req.user.role_id)) {
            return res.status(403).json({
                error: 'Access denied. Insufficient permissions.',
                required: allowedRoles,
                current: req.user.role_id
            });
        }

        next();
    };
};

/**
 * Admin-only middleware
 */
export const requireAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.user.role_id !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }

    next();
};

/**
 * Rate limiting store (in-memory for now, use Redis in production for distributed systems)
 */
const rateLimitStore = new Map();

/**
 * Rate limiter middleware
 * @param {number} maxRequests - Maximum requests allowed
 * @param {number} windowMs - Time window in milliseconds
 */
export const rateLimiter = (maxRequests = 10, windowMs = 60000) => {
    return (req, res, next) => {
        const key = req.ip || req.connection.remoteAddress;
        const now = Date.now();

        if (!rateLimitStore.has(key)) {
            rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
            return next();
        }

        const record = rateLimitStore.get(key);

        if (now > record.resetTime) {
            // Window has passed, reset counter
            rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
            return next();
        }

        if (record.count >= maxRequests) {
            const retryAfter = Math.ceil((record.resetTime - now) / 1000);
            res.set('Retry-After', retryAfter);
            return res.status(429).json({
                error: 'Too many requests. Please try again later.',
                retryAfter
            });
        }

        record.count++;
        rateLimitStore.set(key, record);
        next();
    };
};

/**
 * Optional authentication - doesn't fail if no token, just doesn't set user
 */
export const optionalAuth = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return next();
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const result = await query(
            'SELECT id, email, first_name, last_name, role_id, kyc_status, kyc_level, wallet_balance, phone FROM users WHERE id = $1',
            [decoded.userId]
        );

        if (result.rows.length > 0) {
            req.user = result.rows[0];
        }
    } catch (error) {
        // Silently fail - user just won't be authenticated
    }

    next();
};

// Clean up old rate limit entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of rateLimitStore.entries()) {
        if (now > value.resetTime) {
            rateLimitStore.delete(key);
        }
    }
}, 60000); // Clean up every minute

// Alias for backward compatibility
export const authorize = requireRole;
