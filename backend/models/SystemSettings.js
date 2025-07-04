const mongoose = require("mongoose")

const systemSettingsSchema = new mongoose.Schema(
  {
    defaultConfidenceThreshold: {
      type: Number,
      default: 0.5,
      min: 0.1,
      max: 1.0,
    },
    maxConcurrentJobs: {
      type: Number,
      default: 3,
      min: 1,
      max: 10,
    },
    enableDuplicateFiltering: {
      type: Boolean,
      default: true,
    },
    enableStateValidation: {
      type: Boolean,
      default: true,
    },
    processingMode: {
      type: String,
      enum: ["fast", "standard", "accurate"],
      default: "standard",
    },
    ocrEngine: {
      type: String,
      enum: ["easyocr", "tesseract", "paddleocr"],
      default: "easyocr",
    },
    enableLogging: {
      type: Boolean,
      default: true,
    },
    logLevel: {
      type: String,
      enum: ["error", "warn", "info", "debug"],
      default: "info",
    },
    maxFileSize: {
      type: Number,
      default: 2048, // MB
      min: 100,
      max: 10240,
    },
    supportedFormats: {
      type: [String],
      default: ["mp4", "avi", "mov", "mkv", "wmv"],
    },
    retentionPeriod: {
      type: Number,
      default: 30, // days
      min: 1,
      max: 365,
    },
    enableAutoCleanup: {
      type: Boolean,
      default: true,
    },
    notificationSettings: {
      enableEmailNotifications: {
        type: Boolean,
        default: false,
      },
      smtpSettings: {
        host: String,
        port: Number,
        secure: Boolean,
        username: String,
        password: String,
      },
    },
  },
  {
    timestamps: true,
  },
)

// Ensure only one settings document exists
systemSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne()
  if (!settings) {
    settings = await this.create({})
  }
  return settings
}

module.exports = mongoose.model("SystemSettings", systemSettingsSchema)
