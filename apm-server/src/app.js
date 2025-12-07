// src/app.js
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const config = require("./config");
const { PrismaClient } = require("@prisma/client");
const { asyncHandler } = require("./utils/response");

// Initialize Prisma client
const prisma = new PrismaClient();

// const emailManager = require("./services/email/EmailManager");

const app = express();

// Security middleware with relaxed CSP for testing and PDF.js support
app.use(
	helmet({
		contentSecurityPolicy: {
			directives: {
				defaultSrc: ["'self'"],
				styleSrc: ["'self'", "'unsafe-inline'"],
				scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Allow inline scripts and eval for PDF.js
				scriptSrcAttr: ["'self'", "'unsafe-inline'"], // Allow inline script attributes
				imgSrc: ["'self'", "data:", "https:", "blob:"], // Allow blob URLs for PDF.js
				connectSrc: ["'self'", "https://api.razorpay.com", "blob:"], // Allow Razorpay API and blob URLs
				objectSrc: ["'self'", "data:", "blob:"], // Allow objects for PDF rendering
				workerSrc: ["'self'", "blob:", "data:"], // Allow workers for PDF.js
				childSrc: ["'self'", "blob:", "data:"], // Allow child contexts
				frameSrc: ["'self'", "blob:", "data:"], // Allow frames
			},
		},
	})
);

// Important: For webhook handling, ensure raw body parsing for specific routes
app.use("/api/payments/webhook/*", express.raw({ type: "application/json" }));

// CORS configuration - Allow both development ports and mobile access
const allowedOrigins = [
	process.env.FRONTEND_URL,
	process.env.CORS_ORIGIN,
	"http://localhost",
	"http://localhost:3000",
	"http://localhost:5000",
	"http://localhost:3001",
	"http://localhost:5173",
	"http://localhost:5174",
	"http://localhost:4173",
	"http://192.168.1.3:3000",
	"capacitor://localhost",
	"ionic://localhost",
].filter(Boolean); // Remove undefined/null values

console.log("🌐 CORS allowed origins:", allowedOrigins);

app.use(
	cors({
		origin: function (origin, callback) {
			// Allow requests with no origin (mobile apps, curl, etc.)
			if (!origin) return callback(null, true);

			if (allowedOrigins.includes(origin)) {
				callback(null, true);
			} else {
				console.warn(`⚠️ CORS blocked origin: ${origin}`);
				callback(new Error("Not allowed by CORS"));
			}
		},
		credentials: true,
		methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
		allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
	})
);

// Rate limiting - DISABLED for testing (can be enabled later)
const limiter = rateLimit({
	windowMs: config.rateLimit.windowMs,
	max: config.rateLimit.max,
	message: {
		error: "Too many requests from this IP, please try again later.",
	},
	standardHeaders: true,
	legacyHeaders: false,
	skip: (req) => {
		// Skip rate limiting in development mode or for testing
		return config.nodeEnv === "development";
	},
});

// Apply rate limiting only in production
if (config.nodeEnv === "production") {
	app.use("/api/", limiter);
}

// Body parsing middleware with conditional parsing
app.use((req, res, next) => {
	// Check content type header for multipart data
	const contentType = req.get('Content-Type') || '';
	const isMultipartFormData = contentType.startsWith('multipart/form-data');
	
	// Skip JSON parsing for file upload routes or multipart data
	const isFileUploadRoute =
		req.path.includes('/upload/') ||
		req.path.includes('/profile-picture') ||
		isMultipartFormData ||
		// Specific post routes that handle file uploads
		((req.method === 'POST' || req.method === 'PUT') &&
		 (req.path === '/api/posts' || req.path.startsWith('/api/posts/')) &&
		 isMultipartFormData) ||
		// Event routes that handle file uploads
		((req.method === 'POST' || req.method === 'PUT') &&
		 (req.path === '/api/events' || req.path.startsWith('/api/events/')) &&
		 isMultipartFormData) ||
		// Album routes that handle file uploads (covers and photos)
		((req.method === 'POST' || req.method === 'PUT') &&
		 (req.path === '/api/albums' || req.path.startsWith('/api/albums/')) &&
		 isMultipartFormData);
	
	console.log('🔍 Middleware check:', {
		path: req.path,
		method: req.method,
		contentType: contentType,
		isMultipartFormData: isMultipartFormData,
		isFileUploadRoute: isFileUploadRoute,
		bodyLength: req.get('Content-Length')
	});
	
	if (isFileUploadRoute) {
		console.log('✅ Skipping JSON parser for file upload route');
		return next();
	}
	
	// Apply JSON parsing for other routes
	console.log('📄 Applying JSON parser');
	express.json({ limit: "10mb" })(req, res, next);
});

app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Logging middleware
if (config.nodeEnv === "development") {
	app.use(morgan("dev"));
} else {
	app.use(morgan("combined"));
}

// Health check endpoint - FIXED PATH
app.get("/health", (req, res) => {
	res.status(200).json({
		success: true,
		status: "OK",
		timestamp: new Date().toISOString(),
		environment: config.nodeEnv,
		port: config.port,
		payment: {
			provider: process.env.PAYMENT_PROVIDER || "not configured",
			configured: !!(
				process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
			),
		},
		database: {
			url: !!process.env.DATABASE_URL ? "configured" : "not configured",
		},
	});
});

// API health endpoint (for consistency with test)
app.get("/api/health", (req, res) => {
	res.redirect("/health");
});

// Serve static files from uploads directory
app.use("/uploads", express.static("public/uploads"));

// Serve test files - ENABLED for testing
app.use(express.static("public"));

// Initialize email system on app startup
const emailManager = require("./services/email/EmailManager");
emailManager
	.initialize()
	.then((result) => {
		if (result.success) {
			console.log("✅ Email system initialized successfully");
		} else {
			console.error("❌ Email system initialization failed:", result.error);
			console.log("💡 Please check your email configuration in .env file");
		}
	})
	.catch((error) => {
		console.error("❌ Email system initialization error:", error);
	});

// =============================================
// API ROUTES REGISTRATION
// =============================================

// Core routes
app.use("/api/auth", require("./routes/v1/auth.route"));
app.use("/api/users", require("./routes/alumni/users.route"));
app.use("/api/batches", require("./routes/batches.route"));

// Profile picture proxy route - serves profile pictures from R2
app.get("/api/users/profile-picture/:userId", asyncHandler(async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get user profile picture URL
    const user = await prisma.user.findUnique({
      where: { id: userId, isActive: true },
      select: { profileImage: true }
    });
    
    if (!user || !user.profileImage) {
      // Return placeholder image
      const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <rect width="100" height="100" fill="#f3f4f6"/>
        <circle cx="50" cy="50" r="25" fill="#6b7280"/>
      </svg>`;
      res.set('Content-Type', 'image/svg+xml');
      return res.send(placeholderSvg);
    }
    
    console.log(`Fetching profile picture from R2:`, user.profileImage);
    
    // Since R2 URLs are private, we need to fetch using the R2 service
    const { cloudflareR2Service } = require('./services/cloudflare-r2.service');
    
    try {
      // Extract the key from the URL
      const urlParts = user.profileImage.split('.com/');
      if (urlParts.length < 2) {
        throw new Error('Invalid R2 URL format');
      }
      
      const key = urlParts[1]; // e.g., "alumni-portal/profile-pictures/profile_xxx.png"
      console.log(`Fetching profile picture with key: ${key}`);
      
      // Get the file from R2
      const fileData = await cloudflareR2Service.getFile(key);
      
      if (!fileData.success) {
        console.error('R2 getFile failed:', fileData.error);
        throw new Error('Failed to get file from R2');
      }
      
      // Set appropriate headers for CORS and minimal caching
      res.set({
        'Content-Type': fileData.contentType || 'image/png',
        'Cache-Control': 'public, max-age=300', // 5 minutes instead of 1 hour
        'ETag': `"${Date.now()}"`, // Generate ETag based on current time
        'Access-Control-Allow-Origin': '*',
        'Cross-Origin-Resource-Policy': 'cross-origin'
      });
      
      // Send the file
      return res.send(fileData.data);
      
    } catch (r2Error) {
      console.error('R2 profile picture fetch error:', r2Error.message);
      
      // Return placeholder image if fetch fails
      const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <rect width="100" height="100" fill="#f3f4f6"/>
        <circle cx="50" cy="50" r="25" fill="#6b7280"/>
      </svg>`;
      res.set('Content-Type', 'image/svg+xml');
      return res.send(placeholderSvg);
    }
    
  } catch (error) {
    console.error('Profile picture proxy error:', error);
    res.status(500).json({ success: false, message: 'Failed to serve profile picture', error: error.message });
  }
}));

// Organization file proxy route - serves files from R2
// This route allows public access to organization files since they're meant to be displayed
app.get("/api/organization/files/:type", asyncHandler(async (req, res) => {
  try {
    const { type } = req.params;
    
    // Get organization
    const organization = await prisma.organization.findFirst({
      where: { isActive: true }
    });
    
    if (!organization) {
      return res.status(404).json({ success: false, message: 'Organization not found' });
    }
    
    console.log(`Organization file URLs:`, {
      logoUrl: organization.logoUrl,
      bylawDocumentUrl: organization.bylawDocumentUrl,
      registrationCertUrl: organization.registrationCertUrl
    });
    
    let fileUrl;
    let contentType = 'application/octet-stream';
    
    switch (type) {
      case 'logo':
        fileUrl = organization.logoUrl;
        contentType = 'image/png'; // Most logos are PNG
        break;
      case 'bylaw':
        fileUrl = organization.bylawDocumentUrl;
        contentType = 'application/pdf';
        break;
      case 'certificate':
        fileUrl = organization.registrationCertUrl;
        // Could be image or PDF
        if (fileUrl && fileUrl.includes('.pdf')) {
          contentType = 'application/pdf';
        } else {
          contentType = 'image/png';
        }
        break;
      default:
        return res.status(400).json({ success: false, message: 'Invalid file type' });
    }
    
    if (!fileUrl) {
      console.log(`No ${type} file found in organization data`);
      // Return a placeholder image for logos, 404 for documents
      if (type === 'logo') {
        const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
          <rect width="100" height="100" fill="#f3f4f6"/>
          <text x="50" y="50" text-anchor="middle" dy=".3em" fill="#6b7280" font-family="system-ui" font-size="12">LOGO</text>
        </svg>`;
        res.set('Content-Type', 'image/svg+xml');
        return res.send(placeholderSvg);
      }
      return res.status(404).json({ success: false, message: 'File not found' });
    }
    
    console.log(`Fetching ${type} from R2:`, fileUrl);
    
    // Since R2 URLs are private, we need to fetch using the R2 service
    const { cloudflareR2Service } = require('./services/cloudflare-r2.service');
    
    try {
      // Extract the key from the URL
      const urlParts = fileUrl.split('.com/');
      if (urlParts.length < 2) {
        throw new Error('Invalid R2 URL format');
      }
      
      const key = urlParts[1]; // e.g., "alumni-portal/organization/logos/logo_xxx.png"
      console.log(`Fetching file with key: ${key}`);
      
      // Get the file from R2
      const fileData = await cloudflareR2Service.getFile(key);
      
      if (!fileData.success) {
        console.error('R2 getFile failed:', fileData.error);
        throw new Error('Failed to get file from R2');
      }
      
      // Set appropriate headers for CORS and caching
      res.set({
        'Content-Type': fileData.contentType || contentType,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
        'Cross-Origin-Resource-Policy': 'cross-origin'
      });
      
      // Send the file
      return res.send(fileData.data);
      
    } catch (r2Error) {
      console.error('R2 fetch error:', r2Error.message);
      
      // Return placeholder image for images (logo/certificate) if fetch fails
      if (type === 'logo') {
        const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
          <rect width="100" height="100" fill="#f3f4f6"/>
          <text x="50" y="50" text-anchor="middle" dy=".3em" fill="#6b7280" font-family="system-ui" font-size="12">LOGO</text>
        </svg>`;
        res.set('Content-Type', 'image/svg+xml');
        return res.send(placeholderSvg);
      } else if (type === 'certificate') {
        const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60">
          <rect width="100" height="60" fill="#f9f9f9" stroke="#e5e5e5"/>
          <text x="50" y="30" text-anchor="middle" dy=".3em" fill="#6b7280" font-family="system-ui" font-size="10">CERTIFICATE</text>
        </svg>`;
        res.set('Content-Type', 'image/svg+xml');
        return res.send(placeholderSvg);
      }
      
      // For documents, return 404 with helpful message
      return res.status(404).json({ 
        success: false, 
        message: `${type.charAt(0).toUpperCase() + type.slice(1)} file not found in storage`,
        error: 'File may need to be re-uploaded'
      });
    }
    
  } catch (error) {
    console.error('File proxy error:', error);
    res.status(500).json({ success: false, message: 'Failed to serve file', error: error.message });
  }
}));

// Post image proxy routes - serves post images from R2
app.get("/api/posts/:postId/hero-image", asyncHandler(async (req, res) => {
  try {
    const { postId } = req.params;
    
    // Get post hero image URL
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { heroImage: true }
    });
    
    if (!post || !post.heroImage) {
      // Return placeholder image
      const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200">
        <rect width="400" height="200" fill="#f3f4f6"/>
        <text x="200" y="100" text-anchor="middle" dy=".3em" fill="#6b7280" font-family="system-ui" font-size="16">NO IMAGE</text>
      </svg>`;
      res.set('Content-Type', 'image/svg+xml');
      return res.send(placeholderSvg);
    }
    
    console.log(`Fetching post hero image from R2:`, post.heroImage);
    
    // Since R2 URLs are private, we need to fetch using the R2 service
    const { cloudflareR2Service } = require('./services/cloudflare-r2.service');
    
    try {
      // Extract the key from the URL
      const urlParts = post.heroImage.split('.com/');
      if (urlParts.length < 2) {
        throw new Error('Invalid R2 URL format');
      }
      
      const key = urlParts[1]; // e.g., "alumni-portal/post-images/hero_xxx.png"
      console.log(`Fetching post hero image with key: ${key}`);
      
      // Get the file from R2
      const fileData = await cloudflareR2Service.getFile(key);
      
      if (!fileData.success) {
        console.error('R2 getFile failed:', fileData.error);
        throw new Error('Failed to get file from R2');
      }
      
      // Set appropriate headers for CORS and minimal caching
      res.set({
        'Content-Type': fileData.contentType || 'image/png',
        'Cache-Control': 'public, max-age=300', // 5 minutes cache
        'ETag': `"${Date.now()}"`,
        'Access-Control-Allow-Origin': '*',
        'Cross-Origin-Resource-Policy': 'cross-origin'
      });
      
      // Send the file
      return res.send(fileData.data);
      
    } catch (r2Error) {
      console.error('R2 post hero image fetch error:', r2Error.message);
      
      // Return placeholder image if fetch fails
      const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200">
        <rect width="400" height="200" fill="#f3f4f6"/>
        <text x="200" y="100" text-anchor="middle" dy=".3em" fill="#6b7280" font-family="system-ui" font-size="16">IMAGE ERROR</text>
      </svg>`;
      res.set('Content-Type', 'image/svg+xml');
      return res.send(placeholderSvg);
    }
    
  } catch (error) {
    console.error('Post hero image proxy error:', error);
    res.status(500).json({ success: false, message: 'Failed to serve post hero image', error: error.message });
  }
}));

// Post additional images proxy route
app.get("/api/posts/:postId/images/:imageIndex", asyncHandler(async (req, res) => {
  try {
    const { postId, imageIndex } = req.params;
    const index = parseInt(imageIndex);
    
    // Get post images array
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { images: true }
    });
    
    if (!post || !post.images || !Array.isArray(post.images) || index >= post.images.length || index < 0) {
      // Return placeholder image
      const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
        <rect width="300" height="300" fill="#f3f4f6"/>
        <text x="150" y="150" text-anchor="middle" dy=".3em" fill="#6b7280" font-family="system-ui" font-size="14">NO IMAGE</text>
      </svg>`;
      res.set('Content-Type', 'image/svg+xml');
      return res.send(placeholderSvg);
    }
    
    const imageUrl = post.images[index];
    console.log(`Fetching post image ${index} from R2:`, imageUrl);
    
    // Since R2 URLs are private, we need to fetch using the R2 service
    const { cloudflareR2Service } = require('./services/cloudflare-r2.service');
    
    try {
      // Extract the key from the URL
      const urlParts = imageUrl.split('.com/');
      if (urlParts.length < 2) {
        throw new Error('Invalid R2 URL format');
      }
      
      const key = urlParts[1]; // e.g., "alumni-portal/post-images/image_xxx.png"
      console.log(`Fetching post image with key: ${key}`);
      
      // Get the file from R2
      const fileData = await cloudflareR2Service.getFile(key);
      
      if (!fileData.success) {
        console.error('R2 getFile failed:', fileData.error);
        throw new Error('Failed to get file from R2');
      }
      
      // Set appropriate headers for CORS and minimal caching
      res.set({
        'Content-Type': fileData.contentType || 'image/png',
        'Cache-Control': 'public, max-age=300', // 5 minutes cache
        'ETag': `"${Date.now()}"`,
        'Access-Control-Allow-Origin': '*',
        'Cross-Origin-Resource-Policy': 'cross-origin'
      });
      
      // Send the file
      return res.send(fileData.data);
      
    } catch (r2Error) {
      console.error('R2 post image fetch error:', r2Error.message);
      
      // Return placeholder image if fetch fails
      const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">
        <rect width="300" height="300" fill="#f3f4f6"/>
        <text x="150" y="150" text-anchor="middle" dy=".3em" fill="#6b7280" font-family="system-ui" font-size="14">IMAGE ERROR</text>
      </svg>`;
      res.set('Content-Type', 'image/svg+xml');
      return res.send(placeholderSvg);
    }
    
  } catch (error) {
    console.error('Post image proxy error:', error);
    res.status(500).json({ success: false, message: 'Failed to serve post image', error: error.message });
  }
}));

// Event image proxy route - serves event images with CORS support
app.get("/api/events/:eventId/hero-image", asyncHandler(async (req, res) => {
  try {
    const { eventId } = req.params;
    console.log(`🖼️ Event image proxy request for event ID: ${eventId}`);
    
    // Get event hero image URL
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { heroImage: true, title: true }
    });
    
    console.log(`📸 Event found:`, event);
    
    if (!event || !event.heroImage) {
      console.log(`❌ No event or no heroImage found for ID: ${eventId}`);
      // Return placeholder image
      const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200">
        <rect width="400" height="200" fill="#f3f4f6"/>
        <text x="200" y="100" text-anchor="middle" dy=".3em" fill="#6b7280" font-family="system-ui" font-size="16">NO IMAGE</text>
      </svg>`;
      res.set('Content-Type', 'image/svg+xml');
      return res.send(placeholderSvg);
    }
    
    console.log(`Fetching event hero image:`, event.heroImage);
    
    // Check if it's an R2 URL (contains bucket domain) or local URL
    if (event.heroImage.includes('.r2.cloudflarestorage.com')) {
      // Handle R2 URLs
      const { cloudflareR2Service } = require('./services/cloudflare-r2.service');
      
      try {
        // Extract the key from the URL
        const urlParts = event.heroImage.split('.com/');
        if (urlParts.length < 2) {
          throw new Error('Invalid R2 URL format');
        }
        
        const key = urlParts[1]; // e.g., "alumni-portal/event-images/hero_xxx.png"
        console.log(`Fetching event hero image with key: ${key}`);
        
        // Get the file from R2
        const fileData = await cloudflareR2Service.getFile(key);
        
        if (!fileData.success) {
          console.error('R2 getFile failed:', fileData.error);
          throw new Error('Failed to get file from R2');
        }
        
        // Set appropriate headers for CORS and caching
        res.set({
          'Content-Type': fileData.contentType || 'image/png',
          'Cache-Control': 'public, max-age=300', // 5 minutes cache
          'ETag': `"${Date.now()}"`,
          'Access-Control-Allow-Origin': '*',
          'Cross-Origin-Resource-Policy': 'cross-origin'
        });
        
        // Send the file
        return res.send(fileData.data);
        
      } catch (r2Error) {
        console.error('R2 event hero image fetch error:', r2Error.message);
        
        // Return placeholder image if fetch fails
        const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200">
          <rect width="400" height="200" fill="#f3f4f6"/>
          <text x="200" y="100" text-anchor="middle" dy=".3em" fill="#6b7280" font-family="system-ui" font-size="16">IMAGE ERROR</text>
        </svg>`;
        res.set('Content-Type', 'image/svg+xml');
        return res.send(placeholderSvg);
      }
    } else {
      // Handle local file URLs (legacy support)
      const fs = require('fs');
      const path = require('path');
      const mime = require('mime-types');
      
      try {
        // Extract the file path from URL (e.g., /uploads/events/filename.png)
        const urlParts = event.heroImage.split('/uploads/');
        if (urlParts.length < 2) {
          throw new Error('Invalid local URL format');
        }
        
        const relativePath = urlParts[1]; // e.g., "events/filename.png"
        const filePath = path.join(__dirname, '..', 'public', 'uploads', relativePath);
        
        console.log(`Serving local event hero image from: ${filePath}`);
        
        // Check if file exists
        if (!fs.existsSync(filePath)) {
          throw new Error('Local file not found');
        }
        
        // Read the file
        const fileBuffer = fs.readFileSync(filePath);
        const contentType = mime.lookup(filePath) || 'image/png';
        
        // Set appropriate headers for CORS and caching
        res.set({
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=300', // 5 minutes cache
          'ETag': `"${Date.now()}"`,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Cross-Origin-Resource-Policy': 'cross-origin'
        });
        
        // Send the file
        return res.send(fileBuffer);
        
      } catch (localError) {
        console.error('Local event hero image fetch error:', localError.message);
        
        // Return placeholder image if fetch fails
        const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200">
          <rect width="400" height="200" fill="#f3f4f6"/>
          <text x="200" y="100" text-anchor="middle" dy=".3em" fill="#6b7280" font-family="system-ui" font-size="16">FILE ERROR</text>
        </svg>`;
        res.set('Content-Type', 'image/svg+xml');
        return res.send(placeholderSvg);
      }
    }
    
  } catch (error) {
    console.error('Event hero image proxy error:', error);
    res.status(500).json({ success: false, message: 'Failed to serve event hero image', error: error.message });
  }
}));

app.use("/api/alumni", require("./routes/alumni/alumni.route"));
app.use("/api/posts", require("./routes/posts.route"));
app.use("/api/events", require("./routes/events.route"));
app.use("/api/admin", require("./routes/admin.route"));
app.use("/api/payments", require("./routes/payments.route"));
app.use("/api/treasury", require("./routes/treasury.route"));
app.use("/api/albums", require("./routes/albums.route"));
app.use("/api/photos", require("./routes/photos.route"));
app.use("/api/groups", require("./routes/group.route"));
app.use("/api/polls", require("./routes/polls.route"));
app.use("/api/lifelink", require("./routes/lifelink.route"));
app.use("/api/tickets", require("./routes/tickets.route"));
app.use("/api/membership", require("./routes/membership.route"));
app.use(
	"/api/admin/membership",
	require("./routes/admin/membershipAdmin.route")
);
app.use("/api/merchandise", require("./routes/merchandise.route"));
app.use("/api/donations", require("./routes/donation.route"));
app.use("/api/admin", require("./routes/admin.route"));
app.use("/api/celebrations", require("./routes/celebrations.route"));

// Organization public endpoint
const organizationController = require("./controllers/admin/organization.controller");
app.get("/api/organization", asyncHandler(organizationController.getOrganizationDetails));
app.use(
	"/api/admin/verification",
	require("./routes/admin/alumniVerification.route")
);
// Organization routes - Admin endpoints only
app.use(
	"/api/admin/organization",
	require("./routes/admin/organization.route")
);

// 🎫 TICKET SYSTEM BACKGROUND JOBS INITIALIZATION
console.log("🚀 Initializing ticket system background jobs...");

try {
	// Initialize email system first
	//   const EmailManager = require('./services/email/EmailManager');
	//   await EmailManager.initialize();
	//   console.log('✅ Email system initialized');

	// Setup ticket notification background jobs
	const TicketNotificationService = require("./services/ticket/ticketNotification.service");
	TicketNotificationService.setupDelayedNotificationCheck();

	// Setup performance optimization jobs
	const TicketPerformanceService = require("./services/ticket/ticketPerformance.service");
	TicketPerformanceService.setupPerformanceJobs();

	console.log("✅ Ticket system background jobs ready");
} catch (error) {
	console.error("❌ Ticket background jobs initialization failed:", error);
}

// PAYMENT ROUTES - ENABLED (was commented out)
try {
	app.use("/api/payments", require("./routes/payments.route"));
	console.log("✅ Payment routes registered successfully");
} catch (error) {
	console.error("❌ Failed to register payment routes:", error.message);
	console.error("💡 Make sure src/routes/payments.route.js exists");
}

// Email Routes
app.use("/api", require("./routes/email.route"));

// Additional routes (disabled for now)
// app.use('/api/transactions', require('./routes/transactions.route'));
app.use('/api/notifications', require('./routes/notifications.route'));

// =============================================
// ERROR HANDLING
// =============================================

// 404 handler
app.use("*", (req, res) => {
	res.status(404).json({
		success: false,
		message: `Route ${req.originalUrl} not found`,
		suggestion: req.originalUrl.includes("/api/")
			? "Check if the API endpoint exists and is properly registered"
			: "This might be a static file request - check the public directory",
	});
});

// Global error handler
app.use((err, req, res, next) => {
	console.error("Error details:", {
		message: err.message,
		stack: config.nodeEnv === "development" ? err.stack : undefined,
		url: req.originalUrl,
		method: req.method,
		body: req.body,
		params: req.params,
	});

	// Prisma errors
	if (err.code === "P2002") {
		return res.status(409).json({
			success: false,
			message: "Duplicate entry found",
			error:
				config.nodeEnv === "development" ? err.message : "Database conflict",
		});
	}

	// Validation errors
	if (err.isJoi) {
		return res.status(400).json({
			success: false,
			message: "Validation error",
			errors: err.details.map((detail) => detail.message),
		});
	}

	// JWT errors
	if (err.name === "JsonWebTokenError") {
		return res.status(401).json({
			success: false,
			message: "Invalid token",
		});
	}

	if (err.name === "TokenExpiredError") {
		return res.status(401).json({
			success: false,
			message: "Token expired",
		});
	}

	// Payment-specific errors
	if (err.name === "PaymentError") {
		return res.status(err.statusCode || 400).json({
			success: false,
			message: err.message,
			errorCode: err.code || "PAYMENT_ERROR",
		});
	}

	// Razorpay errors
	if (err.error && err.error.code) {
		return res.status(400).json({
			success: false,
			message: "Payment gateway error",
			errorCode: err.error.code,
			error:
				config.nodeEnv === "development" ? err.error.description : undefined,
		});
	}

	// Default error
	res.status(err.status || 500).json({
		success: false,
		message: err.message || "Internal server error",
		error: config.nodeEnv === "development" ? err.stack : undefined,
	});
});

// Export the app
module.exports = app;
