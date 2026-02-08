
import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error("❌ DATABASE_URL is not defined in .env");
    process.exit(1);
}

const pool = new Pool({
    connectionString,
    ssl: {
        rejectUnauthorized: false
    }
});

async function resetAdminPassword() {
    try {
        const email = 'admin@freip.com';
        const password = 'password123';
        const hashedPassword = await bcrypt.hash(password, 10);

        console.log(`🔌 Connecting to database...`);

        // Check if admin exists
        const res = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

        if (res.rows.length > 0) {
            // Update password
            await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [hashedPassword, email]);
            console.log(`✅ Password updated for ${email}`);
        } else {
            // Create admin if not exists
            await pool.query(
                'INSERT INTO users (first_name, last_name, email, password_hash, role_id, phone) VALUES ($1, $2, $3, $4, $5, $6)',
                ['Super', 'Admin', email, hashedPassword, 'admin', '0000000000']
            );
            console.log(`✅ Admin user created: ${email}`);
        }

        await pool.end();
        process.exit(0);
    } catch (err) {
        console.error('❌ Error resetting password:', err);
        process.exit(1);
    }
}

resetAdminPassword();
