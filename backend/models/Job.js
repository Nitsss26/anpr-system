const mongoose = require("mongoose")

const detectedPlateSchema = new mongoose.Schema({
  plateNumber: {
    type: String,
    required: true,
  },
  confidence: {
    type: Number,
    required: true,
    min: 0,
    max: 1,
  },
  timestamp: {
    type: String,
    required: true,
  },
  frameNumber: {
    type: Number,
    required: true,
  },
  boundingBox: {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
  },
  stateCode: {
    type: String,
    default: null,
  },
  vehicleType: {
    type: String,
    enum: ["car", "motorcycle", "truck", "bus", "unknown"],
    default: "unknown",
  },
  isValid: {
    type: Boolean,
    default: true,
  },
})

const jobSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    filename: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    filePath: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["queued", "processing", "completed", "failed"],
      default: "queued",
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    processingSettings: {
      confidenceThreshold: {
        type: Number,
        default: 0.5,
      },
      processingMode: {
        type: String,
        enum: ["fast", "standard", "accurate"],
        default: "standard",
      },
      enableDuplicateFiltering: {
        type: Boolean,
        default: true,
      },
      enableStateValidation: {
        type: Boolean,
        default: true,
      },
    },
    videoMetadata: {
      duration: Number,
      fps: Number,
      width: Number,
      height: Number,
      totalFrames: Number,
    },
    processingMetadata: {
      startTime: Date,
      endTime: Date,
      processedFrames: {
        type: Number,
        default: 0,
      },
      totalFrames: {
        type: Number,
        default: 0,
      },
      processingTime: Number, // in seconds
      averageConfidence: Number,
      uniquePlatesCount: Number,
    },
    detectedPlates: [detectedPlateSchema],
    errorMessage: {
      type: String,
      default: null,
    },
    exportedFiles: [
      {
        format: {
          type: String,
          enum: ["xlsx", "csv", "json"],
        },
        filePath: String,
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
)

// Index for efficient queries
jobSchema.index({ userId: 1, createdAt: -1 })
jobSchema.index({ status: 1 })
jobSchema.index({ "detectedPlates.plateNumber": 1 })

// Virtual for processing duration
jobSchema.virtual("processingDuration").get(function () {
  if (this.processingMetadata.startTime && this.processingMetadata.endTime) {
    return this.processingMetadata.endTime - this.processingMetadata.startTime
  }
  return null
})

// Method to add detected plate
jobSchema.methods.addDetectedPlate = function (plateData) {
  this.detectedPlates.push(plateData)

  // Update processing metadata
  const confidences = this.detectedPlates.map((p) => p.confidence)
  this.processingMetadata.averageConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length

  // Count unique plates
  const uniquePlates = new Set(this.detectedPlates.map((p) => p.plateNumber))
  this.processingMetadata.uniquePlatesCount = uniquePlates.size
}

// Method to update progress
jobSchema.methods.updateProgress = function (processedFrames, totalFrames) {
  this.processingMetadata.processedFrames = processedFrames
  this.processingMetadata.totalFrames = totalFrames
  this.progress = Math.round((processedFrames / totalFrames) * 100)
}

module.exports = mongoose.model("Job", jobSchema)
