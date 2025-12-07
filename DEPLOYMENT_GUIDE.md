# GUILD Alumni Portal - Production Deployment Guide

## Quick Start Checklist

- [ ] Create Firebase project and get credentials
- [ ] Set up Neon PostgreSQL database
- [ ] Set up Upstash Redis
- [ ] Configure Cloudflare R2 storage
- [ ] Set up SendGrid for emails
- [ ] Deploy backend to Railway
- [ ] Deploy frontend to Vercel
- [ ] Build Android APK
- [ ] Create demo accounts
- [ ] Test push notifications

---

## 1. Firebase Setup (Push Notifications)

### Step 1: Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Project name: `guild-alumni-portal`
4. Enable Google Analytics (optional)

### Step 2: Add Android App
1. Click "Add app" → Android icon
2. Package name: `com.alumni.guild`
3. App nickname: `GUILD Alumni`
4. Download `google-services.json`
5. Place it in: `apm-client/android/app/google-services.json`

### Step 3: Get Server Credentials
1. Project Settings → Service Accounts
2. Click "Generate new private key"
3. Download JSON file
4. Extract these values for environment variables:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`

---

## 2. Database Setup (Neon PostgreSQL)

### Step 1: Create Account
1. Go to [neon.tech](https://neon.tech)
2. Sign up with GitHub

### Step 2: Create Database
1. Create new project: `guild-alumni`
2. Region: Choose closest to your users
3. Copy connection string

### Step 3: Initialize Database
```bash
cd apm-server
DATABASE_URL="your-neon-connection-string" npx prisma db push
DATABASE_URL="your-neon-connection-string" npm run db:seed
```

---

## 3. Redis Setup (Upstash)

### Step 1: Create Account
1. Go to [upstash.com](https://upstash.com)
2. Sign up

### Step 2: Create Database
1. Create new Redis database
2. Region: Same as your backend
3. Copy credentials:
   - `REDIS_HOST`
   - `REDIS_PORT`
   - `REDIS_PASSWORD`

---

## 4. File Storage (Cloudflare R2)

### Step 1: Create Account
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to R2

### Step 2: Create Bucket
1. Create bucket: `guild-alumni-files`
2. Location: Auto

### Step 3: Create API Token
1. Manage R2 API Tokens
2. Create token with Object Read & Write
3. Copy credentials:
   - `CLOUDFLARE_R2_ACCESS_KEY_ID`
   - `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
   - `CLOUDFLARE_R2_ENDPOINT`
   - `CLOUDFLARE_R2_BUCKET_NAME`

### Step 4: Configure Public Access (Optional)
For public file access, connect a custom domain or use R2 public URLs.

---

## 5. Email Service (SendGrid)

### Step 1: Create Account
1. Go to [sendgrid.com](https://sendgrid.com)
2. Sign up (free tier: 100 emails/day)

### Step 2: Create API Key
1. Settings → API Keys
2. Create key with Full Access
3. Copy `SENDGRID_API_KEY`

### Step 3: Verify Sender
1. Settings → Sender Authentication
2. Verify your sending domain or email
3. Set `SENDGRID_FROM_EMAIL`

---

## 6. Backend Deployment (Railway)

### Step 1: Create Account
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub

### Step 2: Create Project
1. New Project → Deploy from GitHub repo
2. Select `alumni-portal-master` repo
3. Set root directory: `apm-server`

### Step 3: Add Environment Variables
```env
# Core
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://your-vercel-domain.vercel.app

# Database
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require

# JWT
JWT_SECRET=your-super-secure-random-string-min-32-chars
JWT_REFRESH_SECRET=another-super-secure-random-string
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Redis
REDIS_HOST=your-upstash-host.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=your-upstash-password

# Cloudflare R2
CLOUDFLARE_R2_ENDPOINT=https://account-id.r2.cloudflarestorage.com
CLOUDFLARE_R2_ACCESS_KEY_ID=your-access-key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your-secret-key
CLOUDFLARE_R2_BUCKET_NAME=guild-alumni-files
CLOUDFLARE_R2_PUBLIC_URL=https://your-r2-public-url.com

# Firebase (Push Notifications)
FIREBASE_PROJECT_ID=guild-alumni-portal
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@guild-alumni-portal.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n"

# Email
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.your-api-key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
EMAIL_FROM_NAME=GUILD Alumni

# Payments (Test Mode)
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=your-test-secret
```

### Step 4: Deploy
Railway will auto-deploy on push to main branch.

---

## 7. Frontend Deployment (Vercel)

### Step 1: Create Account
1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub

### Step 2: Import Project
1. New Project → Import Git Repository
2. Select `alumni-portal-master` repo
3. Root Directory: `apm-client`
4. Framework Preset: Vite

### Step 3: Add Environment Variables
```env
VITE_API_BASE_URL=https://your-railway-domain.railway.app/api
```

### Step 4: Deploy
Vercel will auto-deploy on push.

---

## 8. Android APK Build

### Prerequisites
- Android Studio installed
- Java 17 JDK
- `google-services.json` in place

### Build Steps

```bash
# 1. Navigate to client
cd apm-client

# 2. Install dependencies
npm install

# 3. Update environment for production
echo "VITE_API_BASE_URL=https://your-backend.railway.app/api" > .env.production

# 4. Build web assets
npm run build

# 5. Sync with Capacitor
npx cap sync android

# 6. Open in Android Studio
npx cap open android
```

### In Android Studio:
1. Build → Generate Signed Bundle/APK
2. Select APK
3. Create new keystore (save it securely!)
4. Build release APK

### APK Location:
`android/app/build/outputs/apk/release/app-release.apk`

---

## 9. Demo Accounts Setup

Run the seed script with demo accounts:

```javascript
// Add to prisma/seed.js
const demoAccounts = [
  {
    email: 'superadmin@guild.demo',
    password: 'Demo@2024!',
    role: 'SUPER_ADMIN',
    fullName: 'Super Admin',
    isEmailVerified: true,
    isAlumniVerified: true
  },
  {
    email: 'admin@guild.demo',
    password: 'Demo@2024!',
    role: 'ADMIN',
    fullName: 'Admin User',
    isEmailVerified: true,
    isAlumniVerified: true
  },
  {
    email: 'alumni@guild.demo',
    password: 'Demo@2024!',
    role: 'ALUMNI',
    fullName: 'Alumni Member',
    isEmailVerified: true,
    isAlumniVerified: true
  }
];
```

---

## 10. Mass User Registration Strategy

### Option A: Self-Registration (Recommended)
1. Users download APK or visit web app
2. Register with email
3. Email verification sent
4. Admin approves alumni status

### Option B: Bulk Import
1. Admin uploads CSV of alumni
2. System sends invitation emails
3. Users set passwords on first login

### Option C: Invitation Codes
1. Generate batch-specific codes
2. Share codes with batch representatives
3. Users register with code for auto-verification

---

## 11. APK Distribution

### Option A: Direct Download
1. Host APK on your website
2. Share download link

### Option B: Google Play Store (Recommended for mass users)
1. Create Google Play Developer account ($25 one-time)
2. Submit app for review
3. Publish to store

### Option C: Firebase App Distribution
1. Upload APK to Firebase
2. Invite testers via email
3. Good for beta testing

---

## 12. Post-Deployment Checklist

- [ ] Verify all API endpoints work
- [ ] Test user registration flow
- [ ] Test email sending
- [ ] Test push notifications on Android
- [ ] Test file uploads (profile pictures, posts)
- [ ] Test payment flow (test mode)
- [ ] Monitor error logs in Railway
- [ ] Set up uptime monitoring (e.g., UptimeRobot)

---

## Troubleshooting

### Push Notifications Not Working
1. Verify `google-services.json` is in `android/app/`
2. Check Firebase credentials in backend env
3. Ensure `POST_NOTIFICATIONS` permission granted

### Database Connection Failed
1. Check `DATABASE_URL` format includes `?sslmode=require`
2. Verify Neon project is not paused

### Images Not Loading
1. Verify R2 bucket permissions
2. Check `CLOUDFLARE_R2_PUBLIC_URL` is correct

### Redis Connection Failed
1. App will work without Redis (just slower)
2. Check Upstash credentials
3. Verify TLS is enabled if required

---

## Support

For deployment issues, check:
- Railway logs: Project → Deployments → View Logs
- Vercel logs: Project → Deployments → Functions
- Database: Neon Dashboard → Query Console

---

## Environment Variables Template

Copy and customize:

```env
# ======================
# PRODUCTION ENVIRONMENT
# ======================

# Server
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://your-app.vercel.app
BACKEND_URL=https://your-api.railway.app

# Database (Neon)
DATABASE_URL=postgresql://user:password@host.neon.tech/dbname?sslmode=require

# JWT Secrets (generate with: openssl rand -base64 32)
JWT_SECRET=
JWT_REFRESH_SECRET=
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Redis (Upstash)
REDIS_HOST=
REDIS_PORT=6379
REDIS_PASSWORD=

# Cloudflare R2
CLOUDFLARE_R2_ENDPOINT=
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_BUCKET_NAME=
CLOUDFLARE_R2_PUBLIC_URL=

# Firebase (Push Notifications)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Email (SendGrid)
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=
EMAIL_FROM_NAME=GUILD Alumni

# Payments (Razorpay - use test keys for demo)
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```
