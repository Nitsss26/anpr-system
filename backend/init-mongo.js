// MongoDB initialization script
const db = db.getSiblingDB("anpr")

// Create collections
db.createCollection("users")
db.createCollection("jobs")
db.createCollection("systemsettings")

// Create indexes for better performance
db.users.createIndex({ email: 1 }, { unique: true })
db.jobs.createIndex({ userId: 1 })
db.jobs.createIndex({ status: 1 })
db.jobs.createIndex({ createdAt: -1 })

// Create default admin user
db.users.insertOne({
  name: "Administrator",
  email: "admin@anpr.com",
  password: "$2b$10$8K1p/a0dclxKoNqIiVHb.eL7q5/UgWQfCVMnwxrjwTA.OjZLjjO2.", // admin123
  role: "admin",
  createdAt: new Date(),
  updatedAt: new Date(),
})

// Create default system settings
db.systemsettings.insertOne({
  confidenceThreshold: 0.7,
  maxFileSize: 500,
  allowedFormats: ["mp4", "avi", "mov", "mkv", "wmv"],
  processingMode: "balanced",
  enableDuplicateFilter: true,
  enableStateValidation: true,
  retentionDays: 30,
  createdAt: new Date(),
  updatedAt: new Date(),
})

print("Database initialized successfully!")
