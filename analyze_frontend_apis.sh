#!/bin/bash

# Script to analyze frontend API integrations
echo "=== FRONTEND API INTEGRATIONS ANALYSIS ==="
echo ""

cd "/Users/johnsmac/Desktop/Code Stuffs/alumni-portal-master/apm-client/src/store/api"

# Function to extract endpoints from API files
analyze_api_file() {
    local file="$1"
    echo "📱 Frontend API File: $file"
    echo "🔗 Analyzing API endpoints..."
    
    # Extract endpoint names and URLs
    grep -n -A 5 -B 1 "builder\.\(query\|mutation\)" "$file" | grep -E "(query|mutation|url)" | head -30
    echo ""
}

# Analyze all API files
for file in *.ts; do
    if [ "$file" != "apiSlice.ts" ]; then
        analyze_api_file "$file"
    fi
done

echo "=== ROUTING ANALYSIS ==="
echo ""

# Check router configuration
cd "/Users/johnsmac/Desktop/Code Stuffs/alumni-portal-master/apm-client/src"

# Look for route definitions
echo "📍 Main App Routes:"
grep -n -A 3 -B 1 "path.*=" App.tsx | head -20
echo ""

# Check for page imports and routes
echo "📄 Page Component Analysis:"
find pages/ -name "*.tsx" | while read file; do
    echo "📄 $file"
    grep -l "useGet\|usePost\|usePut\|useDelete\|useMutation\|useQuery" "$file" >/dev/null 2>&1 && echo "  ✅ Has API calls" || echo "  ❌ No API calls detected"
done

echo ""
echo "=== END OF FRONTEND ANALYSIS ==="