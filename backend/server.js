const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
const helmet = require("helmet")
const rateLimit = require("express-rate-limit")
const dotenv = require("dotenv")
const path = require("path")
const { createServer } = require("http")
const { Server } = require("socket.io")
const winston = require("winston")

// Load environment variables
dotenv.config()

// Import routes
const authRoutes = require("./routes/auth")
const uploadRoutes = require("./routes/upload")
const jobRoutes = require("./routes/jobs")
const dashboardRoutes = require("./routes/dashboard")
const settingsRoutes = require("./routes/settings")

// Import middleware
const authMiddleware = require("./middleware/auth")

// Import job queue
const { initializeQueue } = require("./services/queue")

// Initialize Express app
const app = express()
const server = createServer(app)
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
})

// Configure Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: { service: "anpr-backend" },
  transports: [
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
})

// Middleware
app.use(helmet())
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
)

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
})
app.use("/api/", limiter)

// Body parsing middleware
app.use(express.json({ limit: "50mb" }))
app.use(express.urlencoded({ extended: true, limit: "50mb" }))

// Static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")))

// Socket.IO connection handling
io.on("connection", (socket) => {
  logger.info(`Client connected: ${socket.id}`)

  socket.on("join-room", (userId) => {
    socket.join(`user-${userId}`)
    logger.info(`User ${userId} joined room`)
  })

  socket.on("disconnect", () => {
    logger.info(`Client disconnected: ${socket.id}`)
  })
})

// Make io available to routes
app.set("io", io)

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/upload", authMiddleware, uploadRoutes)
app.use("/api/jobs", authMiddleware, jobRoutes)
app.use("/api/dashboard", authMiddleware, dashboardRoutes)
app.use("/api/settings", authMiddleware, settingsRoutes)

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(err.stack)
  res.status(500).json({
    error: "Something went wrong!",
    message: process.env.NODE_ENV === "development" ? err.message : "Internal server error",
  })
})

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" })
})

// Database connection
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/anpr", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    logger.info("Connected to MongoDB")

    // Initialize job queue after DB connection
    initializeQueue(io)

    // Start server
    const PORT = process.env.PORT || 6001
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`)
    })
  })
  .catch((error) => {
    logger.error("Database connection error:", error)
    process.exit(1)
  })

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully")
  server.close(() => {
    mongoose.connection.close()
    process.exit(0)
  })
})

module.exports = app
