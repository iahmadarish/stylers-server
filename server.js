import express from "express"
import dotenv from "dotenv"
import cors from "cors"
import mongoose from "mongoose"
import cookieParser from "cookie-parser"
import morgan from "morgan"
import passport from "passport"
import session from "express-session"
import cron from 'node-cron';
import Product from './models/Product.js';
import ParentCategory from './models/ParentCategory.js';
import SubCategory from './models/SubCategory.js';
import { startCronJobs } from './utils/cronJobs.js';
import heroSectionRoutes from './routes/heroSection.js';
import pageMetaRoutes from './routes/pageMeta.js';
import trendingOffersRoutes from './routes/trendingOffers.js';
import couponRoutes from "./routes/couponRoutes.js";
import adminCouponRoutes from "./routes/adminCouponRoutes.js";

// Load environment variables first
dotenv.config()

// Route imports
import authRoutes from "./routes/auth.routes.js"
import userRoutes from "./routes/user.routes.js"
import categoryRoutes from "./routes/category.routes.js"
import productRoutes from "./routes/product.routes.js"
import cartRoutes from "./routes/cart.routes.js"
import orderRoutes from "./routes/order.routes.js"
import campaignRoutes from "./routes/campaign.routes.js"
import paymentRoutes from "./routes/payment.routes.js"
import checkoutRoutes from "./routes/checkout.routes.js"
import reviewRoutes from "./routes/review.routes.js"
import stockNotificationRoutes from "./routes/stockNotifications.js"
import stockReportRoutes from "./routes/stockReports.js"
import blogRoutes from "./routes/blogRoutes.js"
// import reviewRoutes from "./routes/review.routes.js"
import "./config/passport.js"
import notificationRoutes from './routes/notification.routes.js';
import promotionalHeader from './routes/promotionalCampaignRoutes.js';

import permissionRoutes from './routes/permission.routes.js'
import contactRoutes from './routes/contact.js';
import quoteRoutes from './routes/quote.js';

// Middleware imports
import { errorHandler } from "./middleware/error.middleware.js"
import http from 'http';
import { initSocket } from "./utils/socket.js";
import topHeaderRoutes from './routes/topHeaderRoutes.js';
// Initialize express app
const app = express()
const PORT = process.env.PORT || 5000
const server = http.createServer(app);
// CORS Configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:3000",
      "https://stylersoutfit-dashboard-beta.vercel.app",
      "https://stylersoutfit-dashboard-amtv.vercel.app",
      "https://stylersoutfit-dashboard.vercel.app",
      "http://www.paarel.com",
      "http://paarel.com",
      "https://www.paarel.com",
      "https://paarel.com",

   "https://staging.paarel.com",
      "http://staging.paarel.com",
      "staging.paarel.com",

      "http://31.97.107.12",
      "http://31.97.107.12:5173",
      "https://stylers-5q83.vercel.app",
      "https://stylersoutfit.vercel.app",

      "https://admin.paarel.com",
      "http://admin.paarel.com",
      "admin.paarel.com",
  
    ];
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: [
    "Content-Type", 
    "Authorization", 
    "X-Requested-With", 
    "Accept", 
    "Origin",
    "Content-Disposition" // Add this for file uploads
  ],
  exposedHeaders: ["Content-Disposition"], // Add this for file downloads
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};

// Enable pre-flight requests for all routes
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Pre-flight requests

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || "ishaqmd",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
  sameSite: "none",   // important for cross-site login
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  }),
)


app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https' && process.env.NODE_ENV === 'production') {
        return res.redirect(`https://${req.hostname}${req.url}`);
    }
    next();
});

// Passport middleware
app.use(passport.initialize())
app.use(passport.session())

// Body parsing middleware
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))
app.use(cookieParser())

// Logging middleware
app.use(morgan("dev"))

// Request logging for debugging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, req.body)
  next()
})

// Checking discount each minutes
cron.schedule('*/10 * * * *', async () => {
  try {
    console.log('[CRON] Running discount status check...');
    await Product.updateDiscountPrices();
  } catch (error) {
    console.error('[CRON] Error in discount update:', error);
  }
});


// cron.schedule('* * * * *', async () => {
//   try {
//     console.log('[CRON] Running discount status check...');
//     await Product.updateDiscountPrices();
//   } catch (error) {
//     console.error('[CRON] Error in discount update:', error);
//   }
// });


startCronJobs();


// Checking server start up onces the server start
setTimeout(async () => {
  try {
    console.log('[STARTUP] Running initial discount status check...');
    await Product.updateDiscountPrices();
  } catch (error) {
    console.error('[STARTUP] Error in discount update:', error);
  }
}, 5000);


// Routes
app.use("/api/auth", authRoutes)
app.use("/api/users", userRoutes)
app.use("/api/categories", categoryRoutes)
app.use("/api/products", productRoutes)
app.use("/api/cart", cartRoutes)
app.use("/api/orders", orderRoutes)
app.use("/api/campaigns", campaignRoutes)
app.use("/api/payment", paymentRoutes)
app.use("/api/checkout", checkoutRoutes)
app.use("/api/reviews", reviewRoutes)
app.use("/api/stock/notifications", stockNotificationRoutes);
app.use("/api/stock/reports", stockReportRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/hero-section', heroSectionRoutes);
app.use('/api', promotionalHeader);
app.use('/api/page-meta', pageMetaRoutes);
app.use('/api/trending-offers', trendingOffersRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/admin/coupons", adminCouponRoutes); // Admin coupon management routes
app.use('/api/permissions', permissionRoutes) // Admin coupon management routes
app.use('/api', contactRoutes);
app.use('/api', quoteRoutes);
app.use('/api/top-header', topHeaderRoutes);

// Health check route
app.get("/", (req, res) => {
  res.json({
    message: "Stylers Outfit API is running...",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: "/api/auth",
      users: "/api/users",
      categories: "/api/categories",
      products: "/api/products",
      cart: "/api/cart",
      orders: "/api/orders",
      campaigns: "/api/campaigns",
      checkout: "/api/checkout",
      payments: "/api/payment",
      reviews: "/api/reviews",
    },
  })
})

// API health check
app.get("/api", (req, res) => {
  res.json({
    message: "API is working",
    timestamp: new Date().toISOString(),
  })
})



app.get("/api/sitemap-products.xml", async (req, res) => {
  try {
    const baseUrl = "https://paarel.com";
    const products = await Product.find({ isActive: true }, "slug updatedAt");

    let urls = "";
    products.forEach((p) => {
      urls += `
        <url>
          <loc>${baseUrl}/products/item/${p.slug}</loc>
          <lastmod>${p.updatedAt.toISOString()}</lastmod>
          <priority>0.8</priority>
        </url>
      `;
    });

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      ${urls}
      </urlset>
    `;

    res.header("Content-Type", "application/xml");
    res.send(sitemap);
  } catch (error) {
    console.error("Sitemap Error:", error);
    res.status(500).send("Error generating sitemap");
  }
});

app.get("/api/sitemap-categories.xml", async (req, res) => {
  try {
    const baseUrl = "https://paarel.com";
    const categories = await ParentCategory.find({}, "slug updatedAt");

    let urls = "";
    categories.forEach((c) => {
      urls += `
        <url>
          <loc>${baseUrl}/products/${c.slug}</loc>
          <lastmod>${c.updatedAt.toISOString()}</lastmod>
          <priority>0.7</priority>
        </url>
      `;
    });

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      ${urls}
      </urlset>
    `;

    res.header("Content-Type", "application/xml");
    res.send(sitemap);
  } catch (error) {
    console.error("Sitemap Error (Parent Categories):", error);
    res.status(500).send("Error generating category sitemap");
  }
});


// ===============================
// 📂 SubCategory Sitemap (Frontend path: /products/:parentSlug/:subSlug)
// ===============================
app.get("/api/sitemap-subcategories.xml", async (req, res) => {
  try {
    const baseUrl = "https://paarel.com";

    // parentCategoryId ফিল্ডটা ব্যবহার করে populate করা হচ্ছে
    const subcategories = await SubCategory.find({}, "slug updatedAt parentCategoryId")
      .populate("parentCategoryId", "slug");

    let urls = "";

    subcategories.forEach((s) => {
      if (s.parentCategoryId && s.parentCategoryId.slug && s.slug) {
        urls += `
          <url>
            <loc>${baseUrl}/products/${s.parentCategoryId.slug}/${s.slug}</loc>
            <lastmod>${s.updatedAt.toISOString()}</lastmod>
            <priority>0.6</priority>
          </url>
        `;
      }
    });

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      ${urls}
      </urlset>
    `;

    res.header("Content-Type", "application/xml");
    res.send(sitemap);
  } catch (error) {
    console.error("Sitemap Error (Subcategories):", error);
    res.status(500).send("Error generating subcategory sitemap");
  }
});


// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    status: "error",
    message: `Route ${req.originalUrl} not found`,
  })
})

// Error handling middleware
app.use(errorHandler)

// Connect to MongoDB and start server
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB")
    initSocket(server);
    server.listen(PORT, () => { // <--- CHANGE 'app.listen' to 'server.listen'
      console.log(`Server running on port ${PORT}`)
      console.log(`Environment: ${process.env.NODE_ENV || "development"}`)
      console.log(` Health check: http://localhost:${PORT}`)
    })
  })
  .catch((error) => {
    console.error("❌ MongoDB connection error:", error)
    process.exit(1)
  })

export default app
