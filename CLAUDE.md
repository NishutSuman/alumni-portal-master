# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

This is a full-stack Alumni Portal Management system with two main components:

- **apm-client**: React + TypeScript frontend with Vite, Tailwind CSS, Redux Toolkit, and Capacitor for mobile
- **apm-server**: Node.js/Express backend with Prisma ORM and PostgreSQL database

## Commands

### Frontend (apm-client)
```bash
cd apm-client

# Development
npm run dev              # Start development server
npm run build            # Build for production (includes TypeScript compilation)
npm run preview          # Preview production build

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint issues
npm run type-check       # Run TypeScript type checking
npm run format           # Format code with Prettier

# Mobile Development (Capacitor)
npm run cap:add:android  # Add Android platform
npm run cap:add:ios      # Add iOS platform
npm run cap:sync         # Sync web assets with native platforms
npm run cap:run:android  # Run on Android
npm run cap:run:ios      # Run on iOS
npm run cap:build        # Build and sync for mobile
```

### Backend (apm-server)
```bash
cd apm-server

# Development
npm run dev              # Start development server with nodemon
npm start                # Start production server

# Database (Prisma)
npm run db:generate      # Generate Prisma client
npm run db:push          # Push schema to database
npm run db:migrate       # Run database migrations
npm run db:studio        # Open Prisma Studio
npm run db:seed          # Seed database

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint issues
npm run format           # Format code with Prettier

# Documentation
npm run docs             # Generate documentation
npm run docs:generate    # Generate API docs
npm run docs:serve       # Serve documentation
```

## Architecture Overview

### Frontend Architecture
- **Framework**: React 19 with TypeScript and Vite
- **Styling**: Tailwind CSS with custom components
- **State Management**: Redux Toolkit with RTK Query for API calls
- **Routing**: React Router v7
- **Forms**: React Hook Form with Yup validation
- **Mobile**: Capacitor for native mobile apps
- **UI Components**: Headless UI, Heroicons, Framer Motion
- **Charts**: Recharts for data visualization

### Backend Architecture
- **Framework**: Express.js with Node.js
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT with bcryptjs
- **File Uploads**: Multer with Sharp for image processing
- **Email**: Multiple providers (SendGrid, Gmail)
- **Payments**: Razorpay integration
- **Caching**: Redis with ioredis
- **Security**: Helmet, CORS, rate limiting

### Key Features
- Alumni registration and verification system
- Event management with ticketing
- Membership management with payments
- Treasury and financial management
- Support ticket system
- Merchandise store with cart functionality
- Photo albums and galleries
- Social features (posts, likes, comments)
- Push notifications and email campaigns
- Mobile app support

### Database Schema
Uses PostgreSQL with Prisma ORM. Key entities include:
- Organization management
- User/Alumni profiles with batch information
- Event management with registrations and feedback
- Membership tiers and payments
- Treasury with categories and transactions
- Support ticket system with advanced features
- Merchandise with inventory and orders

### File Organization

**Frontend Structure:**
- `/components`: Reusable UI components (admin, common, user, public)
- `/pages`: Page components organized by user type
- `/hooks`: Custom React hooks
- `/store`: Redux store with API slices
- `/services`: API service functions
- `/types`: TypeScript type definitions
- `/utils`: Helper functions and constants

**Backend Structure:**
- `/controllers`: Request handlers organized by feature
- `/services`: Business logic and external integrations
- `/middleware`: Authentication, validation, caching
- `/routes`: API route definitions
- `/jobs`: Scheduled tasks and background jobs
- `/templates`: Email templates
- `/utils`: Helper utilities

## Development Guidelines

### Code Conventions
- Follow existing TypeScript/JavaScript patterns
- Use Prettier for formatting, ESLint for linting
- Frontend: Functional components with hooks
- Backend: Express.js with async/await patterns
- Database: Prisma schema-first approach

### State Management
- Use Redux Toolkit for global state
- RTK Query for API calls and caching
- Local component state for UI-only state
- Redux Persist for state persistence

### Authentication Flow
- JWT-based authentication
- Role-based access control (Admin, User, Alumni)
- Alumni verification system with approval workflow
- Session management with refresh tokens

### File Uploads
- Multer for handling multipart/form-data
- Sharp for image processing and optimization
- Organized folder structure in `/public/uploads/`
- Support for multiple file types (images, documents, PDFs)

### Payment Integration
- Razorpay for payment processing
- Support for multiple payment types (membership, events, merchandise)
- Invoice generation and transaction tracking
- Payment status webhooks

### Mobile Development
- Capacitor for cross-platform mobile apps
- Native features: Camera, Push Notifications, Filesystem
- Responsive design with mobile-first approach
- PWA capabilities

### API Design
- RESTful API structure
- Consistent response format with error handling
- Request validation with express-validator and Joi
- API documentation with Swagger

### Environment Configuration
Required environment variables are documented in the project. Key configurations include:
- Database connection strings
- JWT secrets
- Email provider credentials
- Payment gateway keys
- Redis connection details