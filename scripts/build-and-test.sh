#!/bin/bash

# Build and Test Docker Engine Script

echo "🔨 Building main project..."
npm run build

echo "🐳 Building Docker image..."
npm run docker:build

echo "🧪 Running test..."
npm run test
