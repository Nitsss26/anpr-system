const express = require("express")
const multer = require("multer")
const path = require("path")
const fs = require("fs").promises
const Job = require("../models/Job")
const { addJobToQueue } = require("../services/queue")

const router = express.Router()

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../uploads/videos")
    try {
      await fs.mkdir(uploadDir, { recursive: true })
      cb(null, uploadDir)
    } catch (error) {
      cb(error)
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    const ext = path.extname(file.originalname)
    cb(null, `video-${uniqueSuffix}${ext}`)
  },
})

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["video/mp4", "video/avi", "video/mov", "video/quicktime", "video/x-msvideo", "video/x-matroska"]
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error("Invalid file type. Only video files are allowed."), false)
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024, // 2GB limit
  },
})

// Upload video endpoint
router.post("/", upload.single("video"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No video file uploaded" })
    }

    const { confidenceThreshold = 0.5, processingMode = "standard" } = req.body

    // Create job record
    const job = new Job({
      userId: req.user.userId,
      filename: req.file.filename,
      originalName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      processingSettings: {
        confidenceThreshold: Number.parseFloat(confidenceThreshold),
        processingMode,
        enableDuplicateFiltering: true,
        enableStateValidation: true,
      },
    })

    await job.save()

    // Add job to processing queue
    await addJobToQueue(job._id.toString())

    res.json({
      message: "Video uploaded successfully and queued for processing",
      jobId: job._id,
      filename: job.originalName,
    })
  } catch (error) {
    console.error("Upload error:", error)

    // Clean up uploaded file if job creation failed
    if (req.file) {
      try {
        await fs.unlink(req.file.path)
      } catch (unlinkError) {
        console.error("Failed to clean up uploaded file:", unlinkError)
      }
    }

    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File too large. Maximum size is 2GB." })
    }

    res.status(500).json({ error: "Failed to upload video" })
  }
})

// Get upload progress (for future use with chunked uploads)
router.get("/progress/:jobId", async (req, res) => {
  try {
    const job = await Job.findOne({
      _id: req.params.jobId,
      userId: req.user.userId,
    })

    if (!job) {
      return res.status(404).json({ error: "Job not found" })
    }

    res.json({
      jobId: job._id,
      status: job.status,
      progress: job.progress,
      filename: job.originalName,
    })
  } catch (error) {
    console.error("Progress check error:", error)
    res.status(500).json({ error: "Failed to get upload progress" })
  }
})

module.exports = router
