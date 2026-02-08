import express from 'express';
import * as settingsController from '../controllers/settingsController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// All settings routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * @route GET /api/settings
 * @desc Get all system settings
 * @access Admin only
 */
router.get('/', settingsController.getAllSettings);

/**
 * @route GET /api/settings/stats
 * @desc Get platform statistics
 * @access Admin only
 */
router.get('/stats', settingsController.getPlatformStats);

/**
 * @route GET /api/settings/maintenance
 * @desc Get maintenance mode status
 * @access Admin only
 */
router.get('/maintenance', settingsController.getMaintenanceStatus);

/**
 * @route POST /api/settings/maintenance
 * @desc Toggle maintenance mode
 * @access Admin only
 */
router.post('/maintenance', settingsController.toggleMaintenanceMode);

/**
 * @route PUT /api/settings/bulk
 * @desc Update multiple settings at once
 * @access Admin only
 */
router.put('/bulk', settingsController.updateMultipleSettings);

/**
 * @route GET /api/settings/:key
 * @desc Get single setting
 * @access Admin only
 */
router.get('/:key', settingsController.getSetting);

/**
 * @route PUT /api/settings/:key
 * @desc Update single setting
 * @access Admin only
 */
router.put('/:key', settingsController.updateSetting);

/**
 * @route POST /api/settings/:key/reset
 * @desc Reset setting to default
 * @access Admin only
 */
router.post('/:key/reset', settingsController.resetSetting);

export default router;
