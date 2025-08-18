import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function analyzeUserVideosTable() {
  try {
    console.log('🔍 Analyzing user_videos table structure...');
    
    // Check current primary key
    const pkQuery = `
      SELECT 
        tc.constraint_name, 
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.constraint_type = 'PRIMARY KEY' 
        AND tc.table_name = 'user_videos';
    `;
    
    const pkResult = await pool.query(pkQuery);
    console.log('Current Primary Key:', pkResult.rows);
    
    // Check foreign key relationships TO user_videos (other tables referencing user_videos)
    const fkToQuery = `
      SELECT 
        tc.table_name as referencing_table,
        kcu.column_name as referencing_column,
        ccu.table_name as referenced_table,
        ccu.column_name as referenced_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu 
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND ccu.table_name = 'user_videos';
    `;
    
    const fkToResult = await pool.query(fkToQuery);
    console.log('Tables referencing user_videos:', fkToResult.rows);
    
    // Check foreign key relationships FROM user_videos (user_videos referencing other tables)
    const fkFromQuery = `
      SELECT 
        kcu.column_name as column_name,
        ccu.table_name as referenced_table,
        ccu.column_name as referenced_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu 
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_name = 'user_videos';
    `;
    
    const fkFromResult = await pool.query(fkFromQuery);
    console.log('Tables that user_videos references:', fkFromResult.rows);
    
    // Check table columns
    const columnsQuery = `
      SELECT 
        column_name, 
        data_type, 
        is_nullable, 
        column_default
      FROM information_schema.columns 
      WHERE table_name = 'user_videos'
      ORDER BY ordinal_position;
    `;
    
    const columnsResult = await pool.query(columnsQuery);
    console.log('Table columns:', columnsResult.rows);
    
    console.log('\n📝 Analysis Summary:');
    console.log('===================');
    
    if (fkToResult.rows.length === 0) {
      console.log('✅ NO other tables reference user_videos.id');
      console.log('✅ Safe to remove id column and create composite primary key');
      console.log('✅ Suggested composite key: (user_roadmap_id, level, page_number, generation_number)');
    } else {
      console.log('⚠️  Other tables reference user_videos.id');
      console.log('⚠️  Need to update references before removing id column');
    }
    
  } catch (error) {
    console.error('❌ Error analyzing table:', error);
  } finally {
    await pool.end();
  }
}

analyzeUserVideosTable();
