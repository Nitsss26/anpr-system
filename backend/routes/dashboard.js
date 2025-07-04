const express = require("express")
const Job = require("../models/Job")

const router = express.Router()

// Get dashboard statistics
router.get("/stats", async (req, res) => {
  try {
    const userId = req.user.userId

    // Get basic counts
    const [totalVideos, totalPlatesDetected, processingVideos, completedVideos, failedVideos] = await Promise.all([
      Job.countDocuments({ userId }),
      Job.aggregate([
        { $match: { userId: userId } },
        { $group: { _id: null, total: { $sum: { $size: "$detectedPlates" } } } },
      ]),
      Job.countDocuments({ userId, status: "processing" }),
      Job.countDocuments({ userId, status: "completed" }),
      Job.countDocuments({ userId, status: "failed" }),
    ])

    // Calculate average accuracy
    const accuracyResult = await Job.aggregate([
      { $match: { userId: userId, status: "completed" } },
      { $group: { _id: null, avgAccuracy: { $avg: "$processingMetadata.averageConfidence" } } },
    ])

    const stats = {
      totalVideos,
      totalPlatesDetected: totalPlatesDetected[0]?.total || 0,
      processingVideos,
      completedVideos,
      failedVideos,
      averageAccuracy: (accuracyResult[0]?.avgAccuracy || 0) * 100,
    }

    res.json(stats)
  } catch (error) {
    console.error("Dashboard stats error:", error)
    res.status(500).json({ error: "Failed to fetch dashboard statistics" })
  }
})

// Get recent jobs
router.get("/recent-jobs", async (req, res) => {
  try {
    const recentJobs = await Job.find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .select("filename originalName status progress detectedPlates createdAt")
      .lean()

    const formattedJobs = recentJobs.map((job) => ({
      id: job._id,
      filename: job.originalName || job.filename,
      status: job.status,
      progress: job.progress,
      platesDetected: job.detectedPlates.length,
      createdAt: job.createdAt,
    }))

    res.json(formattedJobs)
  } catch (error) {
    console.error("Recent jobs error:", error)
    res.status(500).json({ error: "Failed to fetch recent jobs" })
  }
})

// Get processing activity (for charts)
router.get("/activity", async (req, res) => {
  try {
    const { days = 7 } = req.query
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - Number.parseInt(days))

    const activity = await Job.aggregate([
      {
        $match: {
          userId: req.user.userId,
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          totalJobs: { $sum: 1 },
          completedJobs: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
          },
          totalPlates: { $sum: { $size: "$detectedPlates" } },
        },
      },
      { $sort: { _id: 1 } },
    ])

    res.json(activity)
  } catch (error) {
    console.error("Activity data error:", error)
    res.status(500).json({ error: "Failed to fetch activity data" })
  }
})

module.exports = router
