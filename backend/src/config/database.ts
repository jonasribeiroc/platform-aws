import { Pool, PoolConfig } from 'pg';

let pool: Pool | null = null;

export function getDatabasePool(): Pool {
  if (!pool) {
    const config: PoolConfig = {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    };

    pool = new Pool(config);
  }

  return pool;
}

export async function initializeDatabase(): Promise<void> {
  const db = getDatabasePool();
  
  // Create table if it doesn't exist
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      cognito_sub VARCHAR(255) UNIQUE NOT NULL,
      first_name VARCHAR(100),
      last_name VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

