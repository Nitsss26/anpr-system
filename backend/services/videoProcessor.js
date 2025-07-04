const ffmpeg = require("fluent-ffmpeg")
const ffmpegStatic = require("ffmpeg-static")
const path = require("path")
const fs = require("fs").promises
const { spawn } = require("child_process")
const Job = require("../models/Job")

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic)

// Process video for ANPR
const processVideo = async (jobId, progressCallback) => {
  let job

  try {
    // Get job from database
    job = await Job.findById(jobId)
    if (!job) {
      throw new Error("Job not found")
    }

    // Update job status
    job.status = "processing"
    job.processingMetadata.startTime = new Date()
    await job.save()

    console.log(`Starting video processing for job ${jobId}: ${job.originalName}`)

    // Extract video metadata
    const metadata = await extractVideoMetadata(job.filePath)
    job.videoMetadata = metadata
    job.processingMetadata.totalFrames = metadata.totalFrames
    await job.save()

    // Create temporary directory for frames
    const tempDir = path.join(__dirname, "../temp", jobId)
    await fs.mkdir(tempDir, { recursive: true })

    try {
      // Extract frames from video
      await extractFrames(job.filePath, tempDir, metadata, progressCallback)

      // Process frames for number plate detection
      const detectedPlates = await processFrames(tempDir, job.processingSettings, progressCallback)

      // Filter duplicates if enabled
      const filteredPlates = job.processingSettings.enableDuplicateFiltering
        ? filterDuplicatePlates(detectedPlates)
        : detectedPlates

      // Validate Indian number plates if enabled
      const validatedPlates = job.processingSettings.enableStateValidation
        ? validateIndianPlates(filteredPlates)
        : filteredPlates

      // Update job with results
      job.detectedPlates = validatedPlates
      job.status = "completed"
      job.progress = 100
      job.processingMetadata.endTime = new Date()
      job.processingMetadata.processedFrames = metadata.totalFrames

      // Calculate statistics
      if (validatedPlates.length > 0) {
        const confidences = validatedPlates.map((p) => p.confidence)
        job.processingMetadata.averageConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length

        const uniquePlates = new Set(validatedPlates.map((p) => p.plateNumber))
        job.processingMetadata.uniquePlatesCount = uniquePlates.size
      }

      await job.save()

      console.log(`Video processing completed for job ${jobId}. Found ${validatedPlates.length} plates.`)
    } finally {
      // Clean up temporary files
      try {
        await fs.rmdir(tempDir, { recursive: true })
      } catch (cleanupError) {
        console.warn("Failed to clean up temp directory:", cleanupError)
      }
    }
  } catch (error) {
    console.error(`Video processing failed for job ${jobId}:`, error)

    if (job) {
      job.status = "failed"
      job.errorMessage = error.message
      job.processingMetadata.endTime = new Date()
      await job.save()
    }

    throw error
  }
}

// Extract video metadata
const extractVideoMetadata = (videoPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(err)
        return
      }

      const videoStream = metadata.streams.find((stream) => stream.codec_type === "video")
      if (!videoStream) {
        reject(new Error("No video stream found"))
        return
      }

      const duration = Number.parseFloat(metadata.format.duration)
      const fps = eval(videoStream.r_frame_rate) // e.g., "30/1" -> 30
      const totalFrames = Math.floor(duration * fps)

      resolve({
        duration,
        fps,
        width: videoStream.width,
        height: videoStream.height,
        totalFrames,
      })
    })
  })
}

// Extract frames from video
const extractFrames = (videoPath, outputDir, metadata, progressCallback) => {
  return new Promise((resolve, reject) => {
    // Extract frames at 1 FPS for processing (adjust based on requirements)
    const extractionFps = Math.min(1, metadata.fps)

    ffmpeg(videoPath)
      .fps(extractionFps)
      .output(path.join(outputDir, "frame_%04d.jpg"))
      .outputOptions(["-q:v", "2"]) // High quality JPEG
      .on("progress", (progress) => {
        if (progressCallback) {
          // Frame extraction is 50% of total progress
          const frameProgress = Math.min(50, (progress.percent || 0) * 0.5)
          progressCallback(frameProgress)
        }
      })
      .on("end", () => {
        console.log("Frame extraction completed")
        resolve()
      })
      .on("error", (err) => {
        console.error("Frame extraction failed:", err)
        reject(err)
      })
      .run()
  })
}

// Process extracted frames for number plate detection
const processFrames = async (framesDir, settings, progressCallback) => {
  const detectedPlates = []

  try {
    // Get list of frame files
    const frameFiles = await fs.readdir(framesDir)
    const imageFiles = frameFiles.filter((file) => file.endsWith(".jpg")).sort()

    console.log(`Processing ${imageFiles.length} frames for ANPR`)

    for (let i = 0; i < imageFiles.length; i++) {
      const framePath = path.join(framesDir, imageFiles[i])
      const frameNumber = i + 1

      try {
        // Process frame with Python ANPR script
        const plates = await processFrameWithPython(framePath, frameNumber, settings)
        detectedPlates.push(...plates)

        // Update progress (frame processing is 50% of total, starting from 50%)
        if (progressCallback) {
          const frameProgress = 50 + ((i + 1) / imageFiles.length) * 50
          progressCallback(Math.min(100, frameProgress))
        }
      } catch (frameError) {
        console.warn(`Failed to process frame ${frameNumber}:`, frameError)
      }
    }

    return detectedPlates
  } catch (error) {
    console.error("Frame processing failed:", error)
    throw error
  }
}

// Process single frame with Python ANPR script
const processFrameWithPython = (framePath, frameNumber, settings) => {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, "../python/anpr_processor.py")
    const args = [
      pythonScript,
      framePath,
      frameNumber.toString(),
      settings.confidenceThreshold.toString(),
      settings.processingMode,
    ]

    const pythonProcess = spawn("python3", args)
    let output = ""
    let errorOutput = ""

    pythonProcess.stdout.on("data", (data) => {
      output += data.toString()
    })

    pythonProcess.stderr.on("data", (data) => {
      errorOutput += data.toString()
    })

    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Python script failed: ${errorOutput}`))
        return
      }

      try {
        const result = JSON.parse(output)
        resolve(result.plates || [])
      } catch (parseError) {
        reject(new Error(`Failed to parse Python output: ${parseError.message}`))
      }
    })

    pythonProcess.on("error", (error) => {
      reject(new Error(`Failed to start Python process: ${error.message}`))
    })
  })
}

// Filter duplicate plates
const filterDuplicatePlates = (plates) => {
  const uniquePlates = new Map()

  plates.forEach((plate) => {
    const key = `${plate.plateNumber}_${Math.floor(plate.frameNumber / 30)}` // Group by ~1 second intervals

    if (!uniquePlates.has(key) || uniquePlates.get(key).confidence < plate.confidence) {
      uniquePlates.set(key, plate)
    }
  })

  return Array.from(uniquePlates.values())
}

// Validate Indian number plates
const validateIndianPlates = (plates) => {
  const indianPlatePatterns = [
    // New BH series: BH01AB1234
    /^BH\d{2}[A-Z]{2}\d{4}$/,
    // Old format: MH01AB1234
    /^[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}$/,
    // Commercial: MH01A1234
    /^[A-Z]{2}\d{2}[A-Z]\d{4}$/,
    // Two-wheeler: MH01AB123
    /^[A-Z]{2}\d{2}[A-Z]{2}\d{3}$/,
  ]

  return plates.map((plate) => {
    const isValid = indianPlatePatterns.some((pattern) => pattern.test(plate.plateNumber))

    // Extract state code for old format plates
    let stateCode = null
    if (isValid && !plate.plateNumber.startsWith("BH")) {
      stateCode = plate.plateNumber.substring(0, 2)
    }

    return {
      ...plate,
      isValid,
      stateCode,
    }
  })
}

module.exports = {
  processVideo,
  extractVideoMetadata,
}
