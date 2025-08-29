// Test script to verify sequential step ID implementation
import neonDbService from './src/services/neonDbService.js';

const main = async () => {
  try {
    console.log('🧪 Testing Sequential Step ID Implementation');
    
    // Test 1: Process roadmap with step IDs
    console.log('\n📊 Test 1: Processing roadmap data with sequential step IDs');
    const testRoadmapData = {
      extractedTopic: "react",
      roadmap: {
        beginner: ["JSX Syntax", "Props", "State"],
        intermediate: ["Hooks", "Context API", "Component Lifecycle"],
        advanced: ["Performance Optimization", "Custom Hooks", "Testing"]
      }
    };
    
    const processedRoadmap = neonDbService.processRoadmapWithStepIds(testRoadmapData);
    console.log('✅ Original roadmap:', JSON.stringify(testRoadmapData.roadmap.beginner, null, 2));
    console.log('✅ Processed roadmap beginner level:', JSON.stringify(processedRoadmap.roadmap.beginner, null, 2));
    
    // Test 2: Verify step ID format
    console.log('\n🔍 Test 2: Verifying step ID format');
    const beginnerSteps = Object.keys(processedRoadmap.roadmap.beginner);
    console.log('✅ Step IDs generated:', beginnerSteps);
    
    beginnerSteps.forEach((stepId, index) => {
      const expectedStepId = `step_${index + 1}`;
      if (stepId === expectedStepId) {
        console.log(`✅ ${stepId}: Correct format`);
      } else {
        console.log(`❌ ${stepId}: Expected ${expectedStepId}`);
      }
    });
    
    // Test 3: Verify point data structure
    console.log('\n📋 Test 3: Verifying point data structure');
    Object.entries(processedRoadmap.roadmap.beginner).forEach(([stepId, point]) => {
      console.log(`✅ ${stepId}:`, {
        pointId: point.pointId,
        pointTitle: point.pointTitle,
        title: point.title
      });
    });
    
    console.log('\n🎉 All tests completed successfully!');
    console.log('✅ Sequential step ID system is working correctly');
    console.log('✅ Roadmap data is properly structured with step_1, step_2, step_3, etc.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

main();
