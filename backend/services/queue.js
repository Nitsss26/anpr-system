const Queue = require("bull")
const redis = require("redis")
const Job = require("../models/Job")
const { processVideo } = require("./videoProcessor")

// Create Redis connection
const redisClient = redis.createClient({
  host: process.env.REDIS_HOST || "localhost",
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
})

// Create job queue
const videoProcessingQueue = new Queue("video processing", {
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  },
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 5,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
  },
})

let io

// Initialize queue with socket.io instance
const initializeQueue = (socketIo) => {
  io = socketIo

  // Process jobs
  videoProcessingQueue.process("process-video", 3, async (job) => {
    const { jobId } = job.data

    try {
      await processVideo(jobId, (progress) => {
        // Update job progress
        job.progress(progress)

        // Emit progress to client
        if (io) {
          Job.findById(jobId).then((jobDoc) => {
            if (jobDoc) {
              io.to(`user-${jobDoc.userId}`).emit("job-progress", {
                jobId,
                progress,
                status: "processing",
              })
            }
          })
        }
      })

      return { success: true }
    } catch (error) {
      console.error("Job processing error:", error)
      throw error
    }
  })

  // Job event handlers
  videoProcessingQueue.on("completed", async (job, result) => {
    console.log(`Job ${job.id} completed successfully`)

    const jobDoc = await Job.findById(job.data.jobId)
    if (jobDoc && io) {
      io.to(`user-${jobDoc.userId}`).emit("job-completed", {
        jobId: job.data.jobId,
        status: "completed",
        detectedPlates: jobDoc.detectedPlates.length,
      })
    }
  })

  videoProcessingQueue.on("failed", async (job, err) => {
    console.error(`Job ${job.id} failed:`, err)

    const jobDoc = await Job.findById(job.data.jobId)
    if (jobDoc && io) {
      io.to(`user-${jobDoc.userId}`).emit("job-failed", {
        jobId: job.data.jobId,
        status: "failed",
        error: err.message,
      })
    }
  })

  videoProcessingQueue.on("stalled", (job) => {
    console.warn(`Job ${job.id} stalled`)
  })

  console.log("Video processing queue initialized")
}

// Add job to queue
const addJobToQueue = async (jobId) => {
  try {
    const job = await videoProcessingQueue.add(
      "process-video",
      { jobId },
      {
        priority: 1,
        delay: 1000, // Small delay to ensure job is saved to DB
      },
    )

    console.log(`Job ${jobId} added to queue with ID ${job.id}`)
    return job
  } catch (error) {
    console.error("Failed to add job to queue:", error)
    throw error
  }
}

// Get queue statistics
const getQueueStats = async () => {
  try {
    const [waiting, active, completed, failed] = await Promise.all([
      videoProcessingQueue.getWaiting(),
      videoProcessingQueue.getActive(),
      videoProcessingQueue.getCompleted(),
      videoProcessingQueue.getFailed(),
    ])

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
    }
  } catch (error) {
    console.error("Failed to get queue stats:", error)
    return { waiting: 0, active: 0, completed: 0, failed: 0 }
  }
}

module.exports = {
  initializeQueue,
  addJobToQueue,
  getQueueStats,
  videoProcessingQueue,
}
