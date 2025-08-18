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

async function updateDatabase() {
  try {
    console.log('🔧 Adding pagination support to user_videos table...');
    
    // Read the SQL file
    const sqlPath = join(__dirname, 'add-pagination-columns.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0 && !stmt.trim().startsWith('\\d'));
    
    for (const statement of statements) {
      console.log(`Executing: ${statement.trim().substring(0, 50)}...`);
      const result = await pool.query(statement.trim());
      console.log('✅ Statement executed successfully');
      if (result.rows && result.rows.length > 0) {
        console.log('Result:', result.rows);
      }
    }
    
    console.log('🎉 Database updated successfully!');
    
  } catch (error) {
    console.error('❌ Error updating database:', error);
  } finally {
    await pool.end();
  }
}

updateDatabase();
