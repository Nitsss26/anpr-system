const express = require("express")
const SystemSettings = require("../models/SystemSettings")

const router = express.Router()

// Get system settings
router.get("/", async (req, res) => {
  try {
    const settings = await SystemSettings.getSettings()
    res.json(settings)
  } catch (error) {
    console.error("Get settings error:", error)
    res.status(500).json({ error: "Failed to fetch settings" })
  }
})

// Update system settings
router.put("/", async (req, res) => {
  try {
    // Only admin users can update system settings
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" })
    }

    const settings = await SystemSettings.getSettings()

    // Update settings with provided values
    Object.keys(req.body).forEach((key) => {
      if (settings.schema.paths[key]) {
        settings[key] = req.body[key]
      }
    })

    await settings.save()
    res.json(settings)
  } catch (error) {
    console.error("Update settings error:", error)
    res.status(500).json({ error: "Failed to update settings" })
  }
})

// Reset settings to defaults
router.post("/reset", async (req, res) => {
  try {
    // Only admin users can reset settings
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" })
    }

    await SystemSettings.deleteMany({})
    const settings = await SystemSettings.getSettings()

    res.json(settings)
  } catch (error) {
    console.error("Reset settings error:", error)
    res.status(500).json({ error: "Failed to reset settings" })
  }
})

module.exports = router
