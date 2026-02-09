import { query } from '../config/database.js';

// User Model
export const User = {
    async findById(id) {
        const result = await query('SELECT * FROM users WHERE id = $1', [id]);
        return result.rows[0];
    },

    async findByEmail(email) {
        const result = await query('SELECT * FROM users WHERE email = $1', [email]);
        return result.rows[0];
    },

    async create(userData) {
        const { email, phone, password_hash, first_name, last_name, role_id } = userData;
        const result = await query(
            `INSERT INTO users (email, phone, password_hash, first_name, last_name, role_id, kyc_status, wallet_balance, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', 0, NOW(), NOW()) RETURNING *`,
            [email, phone, password_hash, first_name, last_name, role_id || 2]
        );
        return result.rows[0];
    },

    async update(id, data) {
        const { first_name, last_name, kyc_status, kyc_level, wallet_balance } = data;
        const result = await query(
            `UPDATE users SET first_name = COALESCE($2, first_name), last_name = COALESCE($3, last_name),
       kyc_status = COALESCE($4, kyc_status), kyc_level = COALESCE($5, kyc_level),
       wallet_balance = COALESCE($6, wallet_balance), updated_at = NOW() WHERE id = $1 RETURNING *`,
            [id, first_name, last_name, kyc_status, kyc_level, wallet_balance]
        );
        return result.rows[0];
    },

    async findAll(filters = {}) {
        let queryText = 'SELECT id, email, first_name, last_name, phone, role_id, kyc_status, kyc_level, wallet_balance, created_at FROM users WHERE 1=1';
        const params = [];
        let paramCount = 0;

        if (filters.role_id) {
            paramCount++;
            queryText += ` AND role_id = $${paramCount}`;
            params.push(filters.role_id);
        }

        if (filters.kyc_status) {
            paramCount++;
            queryText += ` AND kyc_status = $${paramCount}`;
            params.push(filters.kyc_status);
        }

        queryText += ' ORDER BY created_at DESC';

        if (filters.limit) {
            paramCount++;
            queryText += ` LIMIT $${paramCount}`;
            params.push(filters.limit);
        }

        const result = await query(queryText, params);
        return result.rows;
    }
};

// Property Model
export const Property = {
    async findById(id) {
        const result = await query('SELECT * FROM properties WHERE id = $1', [id]);
        return result.rows[0];
    },

    async findAll(filters = {}) {
        let queryText = 'SELECT * FROM properties WHERE 1=1';
        const params = [];
        let paramCount = 0;

        if (filters.status) {
            paramCount++;
            queryText += ` AND status = $${paramCount}`;
            params.push(filters.status);
        }

        if (filters.city) {
            paramCount++;
            queryText += ` AND city = $${paramCount}`;
            params.push(filters.city);
        }

        queryText += ' ORDER BY created_at DESC';

        if (filters.limit) {
            paramCount++;
            queryText += ` LIMIT $${paramCount}`;
            params.push(filters.limit);
        }

        const result = await query(queryText, params);
        return result.rows;
    },

    async create(data) {
        const {
            seller_id, title, description, location, address, city, property_type,
            area_sqft, total_value, funding_target, min_investment, max_investment,
            expected_returns_annual, rental_yield
        } = data;

        const result = await query(
            `INSERT INTO properties (seller_id, title, description, location, address, city, property_type,
       area_sqft, total_value, funding_target, min_investment, max_investment, expected_returns_annual,
       rental_yield, status, funding_raised, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'pending', 0, NOW(), NOW()) RETURNING *`,
            [seller_id, title, description, location, address, city, property_type,
                area_sqft, total_value, funding_target, min_investment, max_investment,
                expected_returns_annual, rental_yield]
        );
        return result.rows[0];
    },

    async update(id, data) {
        const { status, funding_raised } = data;
        const result = await query(
            `UPDATE properties SET status = COALESCE($2, status), funding_raised = COALESCE($3, funding_raised),
       updated_at = NOW() WHERE id = $1 RETURNING *`,
            [id, status, funding_raised]
        );
        return result.rows[0];
    }
};

// Investment Model
export const Investment = {
    async findById(id) {
        const result = await query('SELECT * FROM investments WHERE id = $1', [id]);
        return result.rows[0];
    },

    async findByUser(userId) {
        const result = await query(
            `SELECT i.*, p.title as property_title, p.city, p.expected_returns_annual
       FROM investments i JOIN properties p ON i.property_id = p.id
       WHERE i.user_id = $1 ORDER BY i.created_at DESC`,
            [userId]
        );
        return result.rows;
    },

    async findByProperty(propertyId) {
        const result = await query('SELECT * FROM investments WHERE property_id = $1', [propertyId]);
        return result.rows;
    },

    async create(data) {
        const { user_id, property_id, amount, token_count, unit_price } = data;
        const result = await query(
            `INSERT INTO investments (user_id, property_id, amount, token_count, unit_price, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'active', NOW()) RETURNING *`,
            [user_id, property_id, amount, token_count, unit_price]
        );
        return result.rows[0];
    },

    async findAll(filters = {}) {
        let queryText = 'SELECT i.*, u.first_name, u.last_name, p.title as property_title FROM investments i LEFT JOIN users u ON i.user_id = u.id LEFT JOIN properties p ON i.property_id = p.id WHERE 1=1';
        const params = [];
        let paramCount = 0;

        if (filters.status) {
            paramCount++;
            queryText += ` AND i.status = $${paramCount}`;
            params.push(filters.status);
        }

        queryText += ' ORDER BY i.created_at DESC';

        if (filters.limit) {
            paramCount++;
            queryText += ` LIMIT $${paramCount}`;
            params.push(filters.limit);
        }

        const result = await query(queryText, params);
        return result.rows;
    }
};

// Transaction Model
export const Transaction = {
    async findById(id) {
        const result = await query('SELECT * FROM transactions WHERE id = $1', [id]);
        return result.rows[0];
    },

    async findByUser(userId) {
        const result = await query(
            'SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC',
            [userId]
        );
        return result.rows;
    },

    async create(data) {
        const { user_id, type, amount, status, reference_id, description } = data;
        const result = await query(
            `INSERT INTO transactions (user_id, type, amount, status, reference_id, description, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
            [user_id, type, amount, status || 'pending', reference_id, description]
        );
        return result.rows[0];
    },

    async update(id, data) {
        const { status } = data;
        const result = await query(
            'UPDATE transactions SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *',
            [id, status]
        );
        return result.rows[0];
    },

    async findAll(filters = {}) {
        let queryText = 'SELECT t.*, u.first_name, u.last_name FROM transactions t LEFT JOIN users u ON t.user_id = u.id WHERE 1=1';
        const params = [];
        let paramCount = 0;

        if (filters.type) {
            paramCount++;
            queryText += ` AND t.type = $${paramCount}`;
            params.push(filters.type);
        }

        if (filters.status) {
            paramCount++;
            queryText += ` AND t.status = $${paramCount}`;
            params.push(filters.status);
        }

        queryText += ' ORDER BY t.created_at DESC';

        if (filters.limit) {
            paramCount++;
            queryText += ` LIMIT $${paramCount}`;
            params.push(filters.limit);
        }

        const result = await query(queryText, params);
        return result.rows;
    }
};
