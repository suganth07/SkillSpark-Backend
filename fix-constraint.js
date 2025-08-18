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

async function fixLevelConstraint() {
  try {
    console.log('🔧 Fixing level constraint in user_videos table...');
    
    // Read the SQL file
    const sqlPath = join(__dirname, 'fix-level-constraint.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
    
    for (const statement of statements) {
      console.log(`Executing: ${statement.trim().substring(0, 50)}...`);
      const result = await pool.query(statement.trim());
      console.log('✅ Statement executed successfully');
      if (result.rows && result.rows.length > 0) {
        console.log('Result:', result.rows);
      }
    }
    
    console.log('🎉 Level constraint fixed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing constraint:', error);
  } finally {
    await pool.end();
  }
}

fixLevelConstraint();
