const express = require("express")
const jwt = require("jsonwebtoken")
const { body, validationResult } = require("express-validator")
const User = require("../models/User")
const authMiddleware = require("../middleware/auth")

const router = express.Router()

// Register user (admin only for now)
router.post(
  "/register",
  [
    body("name").trim().isLength({ min: 2 }).withMessage("Name must be at least 2 characters"),
    body("email").isEmail().withMessage("Please provide a valid email"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const { name, email, password, role = "user" } = req.body

      // Check if user already exists
      const existingUser = await User.findOne({ email })
      if (existingUser) {
        return res.status(400).json({ error: "User already exists with this email" })
      }

      // Create new user
      const user = new User({ name, email, password, role })
      await user.save()

      // Generate JWT token
      const token = jwt.sign(
        { userId: user._id, email: user.email, role: user.role },
        process.env.JWT_SECRET || "fallback-secret",
        { expiresIn: "7d" },
      )

      res.status(201).json({
        message: "User created successfully",
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      })
    } catch (error) {
      console.error("Registration error:", error)
      res.status(500).json({ error: "Server error during registration" })
    }
  },
)

// Login user
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Please provide a valid email"),
    body("password").exists().withMessage("Password is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const { email, password } = req.body

      // Find user by email
      const user = await User.findOne({ email, isActive: true })
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" })
      }

      // Check password
      const isPasswordValid = await user.comparePassword(password)
      if (!isPasswordValid) {
        return res.status(401).json({ error: "Invalid credentials" })
      }

      // Update last login
      user.lastLogin = new Date()
      await user.save()

      // Generate JWT token
      const token = jwt.sign(
        { userId: user._id, email: user.email, role: user.role },
        process.env.JWT_SECRET || "fallback-secret",
        { expiresIn: "7d" },
      )

      res.json({
        message: "Login successful",
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      })
    } catch (error) {
      console.error("Login error:", error)
      res.status(500).json({ error: "Server error during login" })
    }
  },
)

// Verify token
router.get("/verify", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password")
    if (!user || !user.isActive) {
      return res.status(401).json({ error: "User not found or inactive" })
    }

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    })
  } catch (error) {
    console.error("Token verification error:", error)
    res.status(500).json({ error: "Server error during token verification" })
  }
})

// Create default admin user if none exists
router.post("/init", async (req, res) => {
  try {
    const adminExists = await User.findOne({ role: "admin" })
    if (adminExists) {
      return res.status(400).json({ error: "Admin user already exists" })
    }

    const admin = new User({
      name: "Administrator",
      email: "admin@anpr.com",
      password: "admin123",
      role: "admin",
    })

    await admin.save()

    res.json({ message: "Default admin user created successfully" })
  } catch (error) {
    console.error("Admin initialization error:", error)
    res.status(500).json({ error: "Server error during admin initialization" })
  }
})

module.exports = router
