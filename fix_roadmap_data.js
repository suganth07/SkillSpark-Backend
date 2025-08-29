// Script to fix existing roadmap data to use sequential step IDs
import neonDbService from './src/services/neonDbService.js';

const main = async () => {
  try {
    console.log('🔧 Fixing existing roadmap data to use sequential step IDs');
    
    // Get all roadmaps from database
    const roadmaps = await neonDbService.sql`
      SELECT id, roadmap_data FROM user_roadmaps ORDER BY id
    `;
    
    console.log(`Found ${roadmaps.length} roadmaps to fix`);
    
    for (const roadmap of roadmaps) {
      console.log(`\n🔄 Processing roadmap ${roadmap.id}`);
      
      let roadmapData;
      try {
        roadmapData = typeof roadmap.roadmap_data === 'string' 
          ? JSON.parse(roadmap.roadmap_data) 
          : roadmap.roadmap_data;
      } catch (e) {
        console.log(`❌ Failed to parse roadmap data for ${roadmap.id}`);
        continue;
      }
      
      console.log('Original structure:', {
        hasPoints: !!roadmapData.points,
        pointsCount: roadmapData.points ? roadmapData.points.length : 0,
        hasRoadmap: !!roadmapData.roadmap
      });
      
      let needsUpdate = false;
      
      // Check if it has the old points structure with random IDs
      if (roadmapData.points && Array.isArray(roadmapData.points)) {
        console.log('🔄 Converting points structure to step-based format');
        
        // Group points by level and convert to new structure
        const newRoadmapStructure = {
          beginner: {},
          intermediate: {},
          advanced: {}
        };
        
        // Group points by level
        const pointsByLevel = {
          beginner: [],
          intermediate: [],
          advanced: []
        };
        
        roadmapData.points.forEach(point => {
          if (pointsByLevel[point.level]) {
            pointsByLevel[point.level].push(point);
          }
        });
        
        // Convert each level to step-based structure
        ['beginner', 'intermediate', 'advanced'].forEach(level => {
          const levelPoints = pointsByLevel[level].sort((a, b) => a.order - b.order);
          levelPoints.forEach((point, index) => {
            const stepId = `step_${index + 1}`;
            newRoadmapStructure[level][stepId] = {
              pointId: stepId,
              pointTitle: point.title,
              title: point.title,
              description: point.description,
              level: point.level,
              order: point.order
            };
          });
          
          console.log(`  ${level}: ${levelPoints.length} points converted to step format`);
        });
        
        // Update roadmap data structure
        roadmapData.roadmap = newRoadmapStructure;
        
        // Keep the points array for now but update IDs
        roadmapData.points.forEach((point, globalIndex) => {
          const level = point.level;
          const levelPoints = pointsByLevel[level];
          const levelIndex = levelPoints.findIndex(p => p.title === point.title);
          point.id = `step_${levelIndex + 1}`;
        });
        
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        // Update the database
        await neonDbService.sql`
          UPDATE user_roadmaps 
          SET roadmap_data = ${JSON.stringify(roadmapData)}, updated_at = NOW()
          WHERE id = ${roadmap.id}
        `;
        
        console.log('✅ Updated roadmap structure with sequential step IDs');
      } else {
        console.log('✅ Roadmap already has correct structure');
      }
    }
    
    console.log('\n🎉 Roadmap data fix completed!');
    console.log('All roadmaps now use sequential step IDs (step_1, step_2, step_3, etc.)');
    
    // Also update any existing video records to use step IDs
    console.log('\n🔧 Updating video records to use step IDs...');
    
    const videoRecords = await neonDbService.sql`
      SELECT * FROM user_videos WHERE point_id LIKE 'point_%'
    `;
    
    console.log(`Found ${videoRecords.length} video records with old point IDs`);
    
    for (const video of videoRecords) {
      // Get the roadmap to find the correct step ID
      const roadmapResult = await neonDbService.sql`
        SELECT roadmap_data FROM user_roadmaps WHERE id = ${video.user_roadmap_id}
      `;
      
      if (roadmapResult.length > 0) {
        const roadmapData = typeof roadmapResult[0].roadmap_data === 'string' 
          ? JSON.parse(roadmapResult[0].roadmap_data) 
          : roadmapResult[0].roadmap_data;
        
        // Find the matching point by title or order
        if (roadmapData.points) {
          const matchingPoint = roadmapData.points.find(p => p.id === video.point_id);
          if (matchingPoint) {
            const newStepId = matchingPoint.id; // This should now be step_X
            
            await neonDbService.sql`
              UPDATE user_videos 
              SET point_id = ${newStepId}
              WHERE id = ${video.id}
            `;
            
            console.log(`✅ Updated video record: ${video.point_id} → ${newStepId}`);
          }
        }
      }
    }
    
    console.log('\n🎉 All data migration completed!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
};

main();
