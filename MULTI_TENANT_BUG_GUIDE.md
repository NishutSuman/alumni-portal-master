# Multi-Tenant Bug Guide

This guide documents common bugs and fixes in the multi-tenant implementation.

## Common Bug Pattern: `req.tenantId` vs `req.tenant?.id`

### The Problem
The tenant middleware sets `req.tenant` object (not `req.tenantId`). Many places incorrectly use `req.tenantId` which is always `undefined`.

### How to Identify
Search for `req.tenantId` in the codebase - it's likely a bug.

### Correct Usage
```javascript
// WRONG - req.tenantId is always undefined
const tenantId = req.tenantId || 'global';

// CORRECT - tenant middleware sets req.tenant object
const tenantId = req.tenant?.id || null;
```

### Files Fixed
- `apm-server/src/middleware/cache/cache.middleware.js` - All cache key generators and invalidators
- `apm-server/src/middleware/cache/notification.cache.middleware.js` - Notification cache middleware

---

## Bug #1: Cache Keys Not Tenant-Isolated

### Symptom
- Users from different tenants seeing each other's data
- Comments/likes/posts not appearing for some users
- Data created by one user not visible to another in same tenant

### Root Cause
Cache keys were using `req.tenantId` (undefined) falling back to `'global'`, causing all tenants to share the same cache.

### Fix
Changed all cache key generators to use `req.tenant?.id`:
```javascript
// Cache posts list
const tenantId = req.tenant?.id || 'global';
return `tenant:${tenantId}:posts:...`;

// Cache post details
const tenantId = req.tenant?.id || 'global';
return `tenant:${tenantId}:post:${postId}`;

// Cache post comments
const tenantId = req.tenant?.id || 'global';
return `tenant:${tenantId}:post:comments:${postId}:...`;
```

---

## Bug #2: Post Images Stored in Wrong R2 Bucket

### Symptom
Post images stored in root bucket instead of tenant-specific folder (`tenants/${tenantCode}/posts/`)

### Root Cause
`post.controller.js` only checked `req.tenant?.tenantCode` and header, but multipart/form-data requests don't properly pass headers.

### Fix
Added DB fallback to get tenantCode from user's organization:
```javascript
let tenantCode = req.tenant?.tenantCode || req.headers['x-tenant-code'] || null;

if (!tenantCode) {
  const userWithOrg = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      organization: {
        select: { tenantCode: true }
      }
    }
  });
  tenantCode = userWithOrg?.organization?.tenantCode || null;
}
```

---

## Bug #3: Records Created Without `organizationId`

### Symptom
Records (posts, comments, etc.) created but not visible when fetched due to tenant filter mismatch.

### Root Cause
`getTenantData()` only checked `req.tenant?.id` but didn't fall back to `req.user?.organizationId`.

### Fix
Modified `tenant.util.js`:
```javascript
const getTenantData = (req) => {
  // Priority: req.tenant?.id > req.user?.organizationId > null
  const tenantId = req.tenant?.id || req.user?.organizationId || null;
  return tenantId ? { organizationId: tenantId } : {};
};
```

---

## Bug #4: Notification Cache Using Wrong Tenant Reference

### Symptom
Notification caches not properly isolated by tenant.

### Root Cause
`notification.cache.middleware.js` was using `req.tenantId` instead of `req.tenant?.id`.

### Fix
Changed all instances to use `req.tenant?.id || null`.

---

## Checklist for New Multi-Tenant Features

When implementing new features, check:

1. **Database Queries**: Use `getTenantFilter(req)` for read queries
2. **Database Creates**: Use `getTenantData(req)` for creating records
3. **Cache Keys**: Always include `req.tenant?.id` in cache key
4. **Cache Invalidation**: Pass tenant ID when invalidating caches
5. **File Uploads**: Get tenantCode with DB fallback for R2 storage paths
6. **Auth Middleware**: Ensure `organizationId` is in user select

### Tenant Utility Functions

```javascript
const { getTenantFilter, getTenantData, withTenant } = require('../utils/tenant.util');

// For reading records (returns { organizationId: tenantId } or {})
const filter = getTenantFilter(req);
const posts = await prisma.post.findMany({ where: { ...filter, ...otherConditions } });

// For creating records (returns { organizationId: tenantId } or {})
const tenantData = getTenantData(req);
const post = await prisma.post.create({ data: { ...postData, ...tenantData } });

// For merging with existing where clause
const where = withTenant(req, { isPublished: true });
```

---

## Quick Debug Commands

### Check if records have organizationId
```sql
-- Find records without organizationId
SELECT id, title, "organizationId" FROM posts WHERE "organizationId" IS NULL;
SELECT id, content, "postId" FROM comments WHERE "postId" IN (SELECT id FROM posts WHERE "organizationId" IS NULL);
```

### Clear Redis cache
```bash
redis-cli KEYS "*" | xargs redis-cli DEL
# Or specific pattern
redis-cli KEYS "tenant:global:*" | xargs redis-cli DEL
```

### Fix orphaned records
```javascript
// Script to fix posts with null organizationId
const posts = await prisma.post.findMany({
  where: { organizationId: null },
  include: { author: { select: { organizationId: true } } }
});

for (const post of posts) {
  if (post.author?.organizationId) {
    await prisma.post.update({
      where: { id: post.id },
      data: { organizationId: post.author.organizationId }
    });
  }
}
```

---

## File Reference

| File | Purpose |
|------|---------|
| `middleware/tenant.middleware.js` | Sets `req.tenant` object from X-Tenant-Code header |
| `utils/tenant.util.js` | Utility functions for tenant filtering/data |
| `middleware/cache/cache.middleware.js` | Post/comment/like caching |
| `middleware/cache/notification.cache.middleware.js` | Notification caching |
| `middleware/auth/auth.middleware.js` | Validates user belongs to tenant |
| `services/cloudflare-r2.service.js` | Tenant-aware file storage |
