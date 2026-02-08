import express from 'express';
import * as staffController from '../controllers/staffController.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// All staff routes require authentication
router.use(authenticateToken);

// Staff and Operations Manager can access these routes
router.use(requireRole(['admin', 'operations_manager', 'staff']));

/**
 * @route GET /api/staff/dashboard
 * @desc Get staff dashboard overview
 * @access Staff, Operations Manager, Admin
 */
router.get('/dashboard', staffController.getDashboardOverview);

/**
 * @route GET /api/staff/my-stats
 * @desc Get personal work statistics
 * @access Staff, Operations Manager, Admin
 */
router.get('/my-stats', staffController.getMyStats);

/**
 * @route GET /api/staff/tickets
 * @desc Get support tickets
 * @access Staff, Operations Manager, Admin
 */
router.get('/tickets', staffController.getTickets);

/**
 * @route POST /api/staff/tickets/:id/assign
 * @desc Assign ticket to self
 * @access Staff, Operations Manager, Admin
 */
router.post('/tickets/:id/assign', staffController.assignTicket);

/**
 * @route POST /api/staff/tickets/:id/reply
 * @desc Reply to ticket
 * @access Staff, Operations Manager, Admin
 */
router.post('/tickets/:id/reply', staffController.replyToTicket);

/**
 * @route POST /api/staff/tickets/:id/resolve
 * @desc Resolve ticket
 * @access Staff, Operations Manager, Admin
 */
router.post('/tickets/:id/resolve', staffController.resolveTicket);

/**
 * @route GET /api/staff/properties
 * @desc Get properties for review
 * @access Operations Manager, Admin
 */
router.get('/properties', requireRole(['admin', 'operations_manager']), staffController.getPropertiesForReview);

/**
 * @route POST /api/staff/properties/:id/note
 * @desc Add review note to property
 * @access Operations Manager, Admin
 */
router.post('/properties/:id/note', requireRole(['admin', 'operations_manager']), staffController.addPropertyNote);

export default router;
