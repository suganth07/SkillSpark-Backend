import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function addPaginationSupport() {
  try {
    console.log('📄 Adding pagination support to user_videos table...');
    
    // Read the SQL file
    const sqlPath = join(__dirname, 'add-pagination.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
    
    for (const statement of statements) {
      if (statement.trim().startsWith('SELECT') || statement.trim().startsWith('--')) {
        continue; // Skip verification and comment statements
      }
      console.log(`Executing: ${statement.trim().substring(0, 50)}...`);
      const result = await pool.query(statement.trim());
      console.log('✅ Statement executed successfully');
    }
    
    console.log('🎉 Pagination support added successfully!');
    
  } catch (error) {
    console.error('❌ Error adding pagination:', error);
  } finally {
    await pool.end();
  }
}

addPaginationSupport();
