import { query } from '../config/database.js';

/**
 * Get all system settings
 */
export const getAllSettings = async (req, res) => {
    try {
        const result = await query(`
      SELECT 
        s.*,
        u.first_name as updated_by_first_name,
        u.last_name as updated_by_last_name
      FROM system_settings s
      LEFT JOIN users u ON s.updated_by = u.id
      ORDER BY s.key ASC
    `);

        // Group settings by category
        const settings = {};
        result.rows.forEach(row => {
            const category = row.key.split('_')[0];
            if (!settings[category]) {
                settings[category] = [];
            }
            settings[category].push({
                key: row.key,
                value: row.value,
                description: row.description,
                updatedAt: row.updated_at,
                updatedBy: row.updated_by_first_name
                    ? `${row.updated_by_first_name} ${row.updated_by_last_name}`
                    : null
            });
        });

        res.json({ settings, raw: result.rows });
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
};

/**
 * Get single setting
 */
export const getSetting = async (req, res) => {
    try {
        const { key } = req.params;

        const result = await query(`
      SELECT * FROM system_settings WHERE key = $1
    `, [key]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Setting not found' });
        }

        res.json({ setting: result.rows[0] });
    } catch (error) {
        console.error('Get setting error:', error);
        res.status(500).json({ error: 'Failed to fetch setting' });
    }
};

/**
 * Update single setting
 */
export const updateSetting = async (req, res) => {
    try {
        const { key } = req.params;
        const { value, description } = req.body;
        const adminId = req.user.id;

        if (value === undefined) {
            return res.status(400).json({ error: 'Value is required' });
        }

        // Get old value for audit
        const oldResult = await query(`
      SELECT * FROM system_settings WHERE key = $1
    `, [key]);

        const oldValue = oldResult.rows.length > 0 ? oldResult.rows[0].value : null;

        // Upsert setting
        const result = await query(`
      INSERT INTO system_settings (key, value, description, updated_by, updated_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (key) DO UPDATE SET
        value = $2,
        description = COALESCE($3, system_settings.description),
        updated_by = $4,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [key, JSON.stringify(value), description, adminId]);

        // Audit log
        await query(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_values, new_values, ip_address)
      VALUES ($1, 'setting_updated', 'system_settings', NULL, $2, $3, $4)
    `, [adminId, JSON.stringify({ key, value: oldValue }), JSON.stringify({ key, value }), req.ip]);

        res.json({
            success: true,
            setting: result.rows[0],
            message: `Setting "${key}" updated successfully`
        });
    } catch (error) {
        console.error('Update setting error:', error);
        res.status(500).json({ error: 'Failed to update setting' });
    }
};

/**
 * Update multiple settings at once
 */
export const updateMultipleSettings = async (req, res) => {
    try {
        const { settings } = req.body;
        const adminId = req.user.id;

        if (!settings || !Array.isArray(settings)) {
            return res.status(400).json({ error: 'Settings array is required' });
        }

        const updated = [];

        for (const setting of settings) {
            if (!setting.key || setting.value === undefined) continue;

            await query(`
        INSERT INTO system_settings (key, value, description, updated_by, updated_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE SET
          value = $2,
          description = COALESCE($3, system_settings.description),
          updated_by = $4,
          updated_at = CURRENT_TIMESTAMP
      `, [setting.key, JSON.stringify(setting.value), setting.description, adminId]);

            updated.push(setting.key);
        }

        // Audit log
        await query(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, ip_address)
      VALUES ($1, 'settings_bulk_update', 'system_settings', NULL, $2, $3)
    `, [adminId, JSON.stringify({ updated_keys: updated }), req.ip]);

        res.json({
            success: true,
            updatedKeys: updated,
            message: `${updated.length} settings updated successfully`
        });
    } catch (error) {
        console.error('Update multiple settings error:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
};

/**
 * Reset setting to default
 */
export const resetSetting = async (req, res) => {
    try {
        const { key } = req.params;
        const adminId = req.user.id;

        // Default values
        const defaults = {
            platform_fee_percentage: 2.5,
            min_investment_amount: 10000,
            max_investment_amount: 50000000,
            kyc_expiry_days: 365,
            referral_reward_amount: 500,
            maintenance_mode: false
        };

        if (!defaults.hasOwnProperty(key)) {
            return res.status(400).json({ error: 'No default value available for this setting' });
        }

        const result = await query(`
      UPDATE system_settings 
      SET value = $1, updated_by = $2, updated_at = CURRENT_TIMESTAMP
      WHERE key = $3
      RETURNING *
    `, [JSON.stringify(defaults[key]), adminId, key]);

        // Audit log
        await query(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, ip_address)
      VALUES ($1, 'setting_reset', 'system_settings', NULL, $2, $3)
    `, [adminId, JSON.stringify({ key, reset_to: defaults[key] }), req.ip]);

        res.json({
            success: true,
            setting: result.rows[0],
            message: `Setting "${key}" reset to default value`
        });
    } catch (error) {
        console.error('Reset setting error:', error);
        res.status(500).json({ error: 'Failed to reset setting' });
    }
};

/**
 * Get maintenance mode status
 */
export const getMaintenanceStatus = async (req, res) => {
    try {
        const result = await query(`
      SELECT value FROM system_settings WHERE key = 'maintenance_mode'
    `);

        const isMaintenanceMode = result.rows.length > 0
            ? JSON.parse(result.rows[0].value) === true
            : false;

        res.json({ maintenanceMode: isMaintenanceMode });
    } catch (error) {
        console.error('Get maintenance status error:', error);
        res.status(500).json({ error: 'Failed to fetch maintenance status' });
    }
};

/**
 * Toggle maintenance mode
 */
export const toggleMaintenanceMode = async (req, res) => {
    try {
        const { enabled, message } = req.body;
        const adminId = req.user.id;

        await query(`
      INSERT INTO system_settings (key, value, description, updated_by, updated_at)
      VALUES ('maintenance_mode', $1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (key) DO UPDATE SET
        value = $1,
        description = $2,
        updated_by = $3,
        updated_at = CURRENT_TIMESTAMP
    `, [JSON.stringify(enabled), message || 'System maintenance in progress', adminId]);

        // Audit log
        await query(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, ip_address)
      VALUES ($1, $2, 'system_settings', NULL, $3, $4)
    `, [
            adminId,
            enabled ? 'maintenance_enabled' : 'maintenance_disabled',
            JSON.stringify({ enabled, message }),
            req.ip
        ]);

        res.json({
            success: true,
            maintenanceMode: enabled,
            message: enabled ? 'Maintenance mode enabled' : 'Maintenance mode disabled'
        });
    } catch (error) {
        console.error('Toggle maintenance mode error:', error);
        res.status(500).json({ error: 'Failed to toggle maintenance mode' });
    }
};

/**
 * Get platform statistics for settings page
 */
export const getPlatformStats = async (req, res) => {
    try {
        const stats = {};

        // Database size (approximate)
        const tableCount = await query(`
      SELECT COUNT(*) 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
        stats.tables = parseInt(tableCount.rows[0].count);

        // Total rows estimate
        const totalRows = await query(`
      SELECT SUM(n_live_tup) as total_rows
      FROM pg_stat_user_tables
    `);
        stats.totalRows = parseInt(totalRows.rows[0].total_rows) || 0;

        // Active sessions (last 24h)
        const activeSessions = await query(`
      SELECT COUNT(*) FROM sessions 
      WHERE last_used_at > NOW() - INTERVAL '24 hours' AND is_valid = true
    `);
        stats.activeSessions = parseInt(activeSessions.rows[0].count);

        // Recent audit logs
        const recentAuditLogs = await query(`
      SELECT COUNT(*) FROM audit_logs 
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `);
        stats.recentActions = parseInt(recentAuditLogs.rows[0].count);

        res.json({ stats });
    } catch (error) {
        console.error('Get platform stats error:', error);
        res.status(500).json({ error: 'Failed to fetch platform statistics' });
    }
};
