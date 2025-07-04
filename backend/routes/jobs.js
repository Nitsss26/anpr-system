const express = require("express")
const Job = require("../models/Job")
const { generateExcelReport } = require("../services/reportGenerator")

const router = express.Router()

// Get all jobs for user
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query

    const query = { userId: req.user.userId }

    // Add status filter
    if (status && status !== "all") {
      query.status = status
    }

    // Add search filter
    if (search) {
      query.$or = [
        { originalName: { $regex: search, $options: "i" } },
        { "detectedPlates.plateNumber": { $regex: search, $options: "i" } },
      ]
    }

    const jobs = await Job.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean()

    const total = await Job.countDocuments(query)

    res.json({
      jobs,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    })
  } catch (error) {
    console.error("Get jobs error:", error)
    res.status(500).json({ error: "Failed to fetch jobs" })
  }
})

// Get specific job details
router.get("/:jobId", async (req, res) => {
  try {
    const job = await Job.findOne({
      _id: req.params.jobId,
      userId: req.user.userId,
    })

    if (!job) {
      return res.status(404).json({ error: "Job not found" })
    }

    res.json(job)
  } catch (error) {
    console.error("Get job error:", error)
    res.status(500).json({ error: "Failed to fetch job details" })
  }
})

// Export job results to Excel
router.get("/:jobId/export", async (req, res) => {
  try {
    const job = await Job.findOne({
      _id: req.params.jobId,
      userId: req.user.userId,
    })

    if (!job) {
      return res.status(404).json({ error: "Job not found" })
    }

    if (job.status !== "completed" || job.detectedPlates.length === 0) {
      return res.status(400).json({ error: "No results available for export" })
    }

    const excelBuffer = await generateExcelReport(job)

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    res.setHeader("Content-Disposition", `attachment; filename="anpr-results-${job._id}.xlsx"`)
    res.send(excelBuffer)
  } catch (error) {
    console.error("Export error:", error)
    res.status(500).json({ error: "Failed to export results" })
  }
})

// Delete job
router.delete("/:jobId", async (req, res) => {
  try {
    const job = await Job.findOne({
      _id: req.params.jobId,
      userId: req.user.userId,
    })

    if (!job) {
      return res.status(404).json({ error: "Job not found" })
    }

    // Delete associated files
    const fs = require("fs").promises
    try {
      await fs.unlink(job.filePath)
    } catch (fileError) {
      console.warn("Failed to delete video file:", fileError)
    }

    // Delete job from database
    await Job.findByIdAndDelete(job._id)

    res.json({ message: "Job deleted successfully" })
  } catch (error) {
    console.error("Delete job error:", error)
    res.status(500).json({ error: "Failed to delete job" })
  }
})

// Retry failed job
router.post("/:jobId/retry", async (req, res) => {
  try {
    const job = await Job.findOne({
      _id: req.params.jobId,
      userId: req.user.userId,
    })

    if (!job) {
      return res.status(404).json({ error: "Job not found" })
    }

    if (job.status !== "failed") {
      return res.status(400).json({ error: "Only failed jobs can be retried" })
    }

    // Reset job status
    job.status = "queued"
    job.progress = 0
    job.errorMessage = null
    job.detectedPlates = []
    job.processingMetadata = {}
    await job.save()

    // Add back to queue
    const { addJobToQueue } = require("../services/queue")
    await addJobToQueue(job._id.toString())

    res.json({ message: "Job queued for retry" })
  } catch (error) {
    console.error("Retry job error:", error)
    res.status(500).json({ error: "Failed to retry job" })
  }
})

module.exports = router
