#!/bin/bash

# Script to extract all API endpoints from backend routes
echo "=== BACKEND API ENDPOINTS AUDIT ==="
echo ""

# Function to extract routes from a file
extract_routes() {
    local file="$1"
    local prefix="$2"
    
    if [ -f "$file" ]; then
        echo "📁 File: $file"
        echo "🔗 Prefix: $prefix"
        grep -n "router\.\(get\|post\|put\|delete\|patch\)" "$file" | head -20
        echo ""
    fi
}

cd "/Users/johnsmac/Desktop/Code Stuffs/alumni-portal-master/apm-server"

# Main routes
extract_routes "src/routes/v1/auth.route.js" "/api/auth"
extract_routes "src/routes/alumni/users.route.js" "/api/users"
extract_routes "src/routes/alumni/alumni.route.js" "/api/alumni"
extract_routes "src/routes/posts.route.js" "/api/posts"
extract_routes "src/routes/events.route.js" "/api/events"
extract_routes "src/routes/payments.route.js" "/api/payments"
extract_routes "src/routes/treasury.route.js" "/api/treasury"
extract_routes "src/routes/albums.route.js" "/api/albums"
extract_routes "src/routes/photos.route.js" "/api/photos"
extract_routes "src/routes/group.route.js" "/api/groups"
extract_routes "src/routes/polls.route.js" "/api/polls"
extract_routes "src/routes/lifelink.route.js" "/api/lifelink"
extract_routes "src/routes/tickets.route.js" "/api/tickets"
extract_routes "src/routes/membership.route.js" "/api/membership"
extract_routes "src/routes/merchandise.route.js" "/api/merchandise"
extract_routes "src/routes/donations.route.js" "/api/donations"
extract_routes "src/routes/celebrations.route.js" "/api/celebrations"
extract_routes "src/routes/notifications.route.js" "/api/notifications"
extract_routes "src/routes/batches.route.js" "/api/batches"
extract_routes "src/routes/sponsors.route.js" "/api/sponsors"
extract_routes "src/routes/email.route.js" "/api/email"

# Admin routes
extract_routes "src/routes/admin.route.js" "/api/admin"
extract_routes "src/routes/admin/organization.route.js" "/api/admin/organization"
extract_routes "src/routes/admin/alumniVerification.route.js" "/api/admin/verification"
extract_routes "src/routes/admin/membershipAdmin.route.js" "/api/admin/membership"

echo "=== END OF BACKEND API AUDIT ==="