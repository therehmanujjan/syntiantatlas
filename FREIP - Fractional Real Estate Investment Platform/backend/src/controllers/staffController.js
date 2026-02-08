import { query } from '../config/database.js';

/**
 * Get Operations Manager dashboard overview
 */
export const getDashboardOverview = async (req, res) => {
    try {
        const staffId = req.user.id;

        // KYC Queue Stats
        const kycStats = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'under_review') as under_review,
        COUNT(*) FILTER (WHERE status = 'approved' AND DATE(verified_at) = CURRENT_DATE) as approved_today,
        COUNT(*) FILTER (WHERE verified_by = $1 AND DATE(verified_at) = CURRENT_DATE) as my_verifications_today
      FROM kyc_verifications
    `, [staffId]);

        // Support Tickets Stats
        const ticketStats = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'open') as open,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE assigned_to = $1 AND status != 'closed') as my_tickets,
        COUNT(*) FILTER (WHERE priority = 'critical' AND status != 'closed') as critical
      FROM support_tickets
    `, [staffId]);

        // Property Stats
        const propertyStats = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') as pending_approval,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'funded') as funded
      FROM properties
    `);

        // Recent activities by this staff
        const recentActivity = await query(`
      SELECT action, entity_type, entity_id, created_at
      FROM audit_logs
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 10
    `, [staffId]);

        res.json({
            kyc: kycStats.rows[0],
            tickets: ticketStats.rows[0],
            properties: propertyStats.rows[0],
            recentActivity: recentActivity.rows
        });
    } catch (error) {
        console.error('Get staff dashboard error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
};

/**
 * Get support tickets assigned to or available for staff
 */
export const getTickets = async (req, res) => {
    try {
        const { status = 'open', assigned = 'all', page = 1, limit = 20 } = req.query;
        const staffId = req.user.id;
        const offset = (page - 1) * limit;

        let assignedFilter = '';
        const params = [status, limit, offset];

        if (assigned === 'mine') {
            assignedFilter = ' AND assigned_to = $4';
            params.push(staffId);
        } else if (assigned === 'unassigned') {
            assignedFilter = ' AND assigned_to IS NULL';
        }

        const result = await query(`
      SELECT 
        t.*,
        u.email as user_email,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        a.first_name as assigned_first_name,
        a.last_name as assigned_last_name
      FROM support_tickets t
      JOIN users u ON t.user_id = u.id
      LEFT JOIN users a ON t.assigned_to = a.id
      WHERE t.status = $1 ${assignedFilter}
      ORDER BY 
        CASE t.priority 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          ELSE 4 
        END,
        t.created_at ASC
      LIMIT $2 OFFSET $3
    `, params);

        const countResult = await query(`
      SELECT COUNT(*) FROM support_tickets WHERE status = $1 ${assignedFilter}
    `, assigned === 'mine' ? [status, staffId] : [status]);

        res.json({
            tickets: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(countResult.rows[0].count)
            }
        });
    } catch (error) {
        console.error('Get tickets error:', error);
        res.status(500).json({ error: 'Failed to fetch tickets' });
    }
};

/**
 * Assign ticket to self
 */
export const assignTicket = async (req, res) => {
    try {
        const { id } = req.params;
        const staffId = req.user.id;

        const result = await query(`
      UPDATE support_tickets 
      SET assigned_to = $1, 
          status = 'in_progress',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [staffId, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        // Audit log
        await query(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, ip_address)
      VALUES ($1, 'ticket_assigned', 'support_ticket', $2, $3, $4)
    `, [staffId, id, JSON.stringify({ assigned_to: staffId }), req.ip]);

        res.json({ success: true, ticket: result.rows[0] });
    } catch (error) {
        console.error('Assign ticket error:', error);
        res.status(500).json({ error: 'Failed to assign ticket' });
    }
};

/**
 * Reply to ticket
 */
export const replyToTicket = async (req, res) => {
    try {
        const { id } = req.params;
        const { message, is_internal = false } = req.body;
        const staffId = req.user.id;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Add message
        const msgResult = await query(`
      INSERT INTO ticket_messages (ticket_id, user_id, message, is_internal)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [id, staffId, message, is_internal]);

        // Update first response time if not set
        await query(`
      UPDATE support_tickets 
      SET first_response_at = COALESCE(first_response_at, CURRENT_TIMESTAMP),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND first_response_at IS NULL
    `, [id]);

        // Create notification for user if not internal
        if (!is_internal) {
            const ticket = await query(`SELECT user_id, subject FROM support_tickets WHERE id = $1`, [id]);
            if (ticket.rows.length > 0) {
                await query(`
          INSERT INTO notifications (user_id, type, title, message, data)
          VALUES ($1, 'ticket_reply', 'Support Ticket Update', $2, $3)
        `, [
                    ticket.rows[0].user_id,
                    `Staff responded to your ticket: ${ticket.rows[0].subject}`,
                    JSON.stringify({ ticket_id: id })
                ]);
            }
        }

        res.json({ success: true, message: msgResult.rows[0] });
    } catch (error) {
        console.error('Reply to ticket error:', error);
        res.status(500).json({ error: 'Failed to send reply' });
    }
};

/**
 * Resolve ticket
 */
export const resolveTicket = async (req, res) => {
    try {
        const { id } = req.params;
        const { resolution } = req.body;
        const staffId = req.user.id;

        const result = await query(`
      UPDATE support_tickets 
      SET status = 'resolved',
          resolution = $1,
          resolved_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [resolution, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        // Notify user
        await query(`
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES ($1, 'ticket_resolved', 'Support Ticket Resolved', $2, $3)
    `, [
            result.rows[0].user_id,
            `Your ticket "${result.rows[0].subject}" has been resolved.`,
            JSON.stringify({ ticket_id: id, resolution })
        ]);

        // Audit log
        await query(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, ip_address)
      VALUES ($1, 'ticket_resolved', 'support_ticket', $2, $3, $4)
    `, [staffId, id, JSON.stringify({ resolution }), req.ip]);

        res.json({ success: true, ticket: result.rows[0] });
    } catch (error) {
        console.error('Resolve ticket error:', error);
        res.status(500).json({ error: 'Failed to resolve ticket' });
    }
};

/**
 * Get properties for review (Operations Manager)
 */
export const getPropertiesForReview = async (req, res) => {
    try {
        const { status = 'pending', page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        const result = await query(`
      SELECT 
        p.*,
        u.email as seller_email,
        u.first_name as seller_first_name,
        u.last_name as seller_last_name,
        u.phone as seller_phone
      FROM properties p
      JOIN users u ON p.seller_id = u.id
      WHERE p.status = $1
      ORDER BY p.created_at ASC
      LIMIT $2 OFFSET $3
    `, [status, limit, offset]);

        const countResult = await query(`
      SELECT COUNT(*) FROM properties WHERE status = $1
    `, [status]);

        res.json({
            properties: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(countResult.rows[0].count)
            }
        });
    } catch (error) {
        console.error('Get properties for review error:', error);
        res.status(500).json({ error: 'Failed to fetch properties' });
    }
};

/**
 * Add review note to property
 */
export const addPropertyNote = async (req, res) => {
    try {
        const { id } = req.params;
        const { note } = req.body;
        const staffId = req.user.id;

        // Get current documents/notes
        const property = await query(`SELECT documents FROM properties WHERE id = $1`, [id]);

        if (property.rows.length === 0) {
            return res.status(404).json({ error: 'Property not found' });
        }

        let documents = property.rows[0].documents || [];
        if (typeof documents === 'string') {
            documents = JSON.parse(documents);
        }

        // Add review note
        documents.push({
            type: 'review_note',
            note: note,
            added_by: staffId,
            added_at: new Date().toISOString()
        });

        await query(`
      UPDATE properties SET documents = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2
    `, [JSON.stringify(documents), id]);

        // Audit log
        await query(`
      INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values, ip_address)
      VALUES ($1, 'property_note_added', 'property', $2, $3, $4)
    `, [staffId, id, JSON.stringify({ note }), req.ip]);

        res.json({ success: true, message: 'Note added successfully' });
    } catch (error) {
        console.error('Add property note error:', error);
        res.status(500).json({ error: 'Failed to add note' });
    }
};

/**
 * Get my work statistics
 */
export const getMyStats = async (req, res) => {
    try {
        const staffId = req.user.id;

        // Today's work
        const todayKYC = await query(`
      SELECT COUNT(*) FROM kyc_verifications 
      WHERE verified_by = $1 AND DATE(verified_at) = CURRENT_DATE
    `, [staffId]);

        const todayTickets = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE DATE(resolved_at) = CURRENT_DATE) as resolved_today,
        COUNT(*) FILTER (WHERE assigned_to = $1 AND status != 'closed') as active_tickets
      FROM support_tickets
      WHERE assigned_to = $1 OR (DATE(resolved_at) = CURRENT_DATE AND assigned_to = $1)
    `, [staffId]);

        // This week
        const weeklyStats = await query(`
      SELECT 
        COUNT(*) as total_actions,
        COUNT(DISTINCT DATE(created_at)) as active_days
      FROM audit_logs
      WHERE user_id = $1 AND created_at > NOW() - INTERVAL '7 days'
    `, [staffId]);

        res.json({
            today: {
                kycVerified: parseInt(todayKYC.rows[0].count),
                ticketsResolved: parseInt(todayTickets.rows[0]?.resolved_today || 0),
                activeTickets: parseInt(todayTickets.rows[0]?.active_tickets || 0)
            },
            week: {
                totalActions: parseInt(weeklyStats.rows[0].total_actions),
                activeDays: parseInt(weeklyStats.rows[0].active_days)
            }
        });
    } catch (error) {
        console.error('Get my stats error:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
};
