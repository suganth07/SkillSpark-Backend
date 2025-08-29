import youtubeService from './src/services/youtubeService.js';

async function testTopicDetection() {
  try {
    console.log('🧪 Testing topic detection and fallback videos...');
    
    // Test React topic
    const reactTitle = "React Components and Props step by step";
    console.log(`\n📍 Testing: "${reactTitle}"`);
    const reactFallback = youtubeService.getFallbackVideo(reactTitle, []);
    console.log(`🔍 Detected React fallback: ${reactFallback.title}`);
    console.log(`📺 Channel: ${reactFallback.channelTitle}`);
    
    // Test Python topic  
    const pythonTitle = "Python variables and data types";
    console.log(`\n📍 Testing: "${pythonTitle}"`);
    const pythonFallback = youtubeService.getFallbackVideo(pythonTitle, []);
    console.log(`🔍 Detected Python fallback: ${pythonFallback.title}`);
    console.log(`📺 Channel: ${pythonFallback.channelTitle}`);
    
    // Test Java topic
    const javaTitle = "Java object oriented programming";
    console.log(`\n📍 Testing: "${javaTitle}"`);
    const javaFallback = youtubeService.getFallbackVideo(javaTitle, []);
    console.log(`🔍 Detected Java fallback: ${javaFallback.title}`);
    console.log(`📺 Channel: ${javaFallback.channelTitle}`);
    
    // Test non-programming topic
    const generalTitle = "Database design principles";
    console.log(`\n📍 Testing: "${generalTitle}"`);
    const generalFallback = youtubeService.getFallbackVideo(generalTitle, []);
    console.log(`🔍 Detected General fallback: ${generalFallback.title}`);
    console.log(`📺 Channel: ${generalFallback.channelTitle}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testTopicDetection();
