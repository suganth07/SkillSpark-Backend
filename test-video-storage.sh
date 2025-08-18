#!/bin/bash

# Test script to verify video storage functionality

echo "🧪 Testing video storage system..."

# Set the backend URL
BACKEND_URL="http://localhost:8001"

# Test parameters
USER_ID="a0a5a946-28f5-4307-8ee6-b0100b409fcb"
ROADMAP_ID="fc2a8ac0-bdbe-4aba-bb31-c9f86ac1f651"

echo "📹 Testing video generation and storage..."

# Generate videos (this should now store them in Supabase)
curl -X POST "${BACKEND_URL}/api/playlists/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "python",
    "pointTitle": "Python Basics: Variables, Data Types",
    "userPreferences": {
      "depth": "Balanced",
      "videoLength": "Medium"
    },
    "userRoadmapId": "'$ROADMAP_ID'",
    "level": "beginner"
  }' | jq '.'

echo "🔍 Checking if videos were stored..."

# Check if videos were stored in Supabase
curl -X GET "${BACKEND_URL}/api/users/videos/${ROADMAP_ID}?level=beginner&userId=${USER_ID}" \
  -H "Content-Type: application/json" | jq '.'

echo "✅ Test completed!"
