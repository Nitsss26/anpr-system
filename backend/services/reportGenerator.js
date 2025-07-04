const XLSX = require("xlsx")
const path = require("path")

// Generate Excel report from job data
const generateExcelReport = async (job) => {
  try {
    // Prepare data for Excel
    const reportData = job.detectedPlates.map((plate, index) => ({
      "S.No": index + 1,
      "Plate Number": plate.plateNumber,
      "Confidence Score": `${(plate.confidence * 100).toFixed(2)}%`,
      Timestamp: plate.timestamp,
      "Frame Number": plate.frameNumber,
      "State Code": plate.stateCode || "N/A",
      "Valid Format": plate.isValid ? "Yes" : "No",
      "Bounding Box X": plate.boundingBox.x,
      "Bounding Box Y": plate.boundingBox.y,
      "Bounding Box Width": plate.boundingBox.width,
      "Bounding Box Height": plate.boundingBox.height,
    }))

    // Create workbook
    const workbook = XLSX.utils.book_new()

    // Add main data sheet
    const worksheet = XLSX.utils.json_to_sheet(reportData)
    XLSX.utils.book_append_sheet(workbook, worksheet, "Detected Plates")

    // Add summary sheet
    const summaryData = [
      { Metric: "Video File", Value: job.originalName },
      { Metric: "Processing Date", Value: job.createdAt.toLocaleDateString() },
      { Metric: "Total Plates Detected", Value: job.detectedPlates.length },
      { Metric: "Unique Plates", Value: job.processingMetadata.uniquePlatesCount || 0 },
      { Metric: "Average Confidence", Value: `${((job.processingMetadata.averageConfidence || 0) * 100).toFixed(2)}%` },
      { Metric: "Video Duration", Value: `${job.videoMetadata.duration?.toFixed(2)} seconds` },
      { Metric: "Total Frames", Value: job.videoMetadata.totalFrames || 0 },
      { Metric: "Processing Time", Value: `${job.processingMetadata.processingTime?.toFixed(2)} seconds` || "N/A" },
    ]

    const summarySheet = XLSX.utils.json_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary")

    // Add state-wise breakdown if available
    const stateBreakdown = {}
    job.detectedPlates.forEach((plate) => {
      if (plate.stateCode) {
        stateBreakdown[plate.stateCode] = (stateBreakdown[plate.stateCode] || 0) + 1
      }
    })

    if (Object.keys(stateBreakdown).length > 0) {
      const stateData = Object.entries(stateBreakdown).map(([state, count]) => ({
        "State Code": state,
        Count: count,
        Percentage: `${((count / job.detectedPlates.length) * 100).toFixed(2)}%`,
      }))

      const stateSheet = XLSX.utils.json_to_sheet(stateData)
      XLSX.utils.book_append_sheet(workbook, stateSheet, "State Breakdown")
    }

    // Generate Excel buffer
    const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })

    return excelBuffer
  } catch (error) {
    console.error("Excel generation error:", error)
    throw new Error("Failed to generate Excel report")
  }
}

// Generate CSV report
const generateCSVReport = async (job) => {
  try {
    const reportData = job.detectedPlates.map((plate, index) => ({
      "S.No": index + 1,
      "Plate Number": plate.plateNumber,
      "Confidence Score": (plate.confidence * 100).toFixed(2),
      Timestamp: plate.timestamp,
      "Frame Number": plate.frameNumber,
      "State Code": plate.stateCode || "",
      "Valid Format": plate.isValid ? "Yes" : "No",
    }))

    const worksheet = XLSX.utils.json_to_sheet(reportData)
    const csvBuffer = XLSX.utils.sheet_to_csv(worksheet)

    return Buffer.from(csvBuffer)
  } catch (error) {
    console.error("CSV generation error:", error)
    throw new Error("Failed to generate CSV report")
  }
}

module.exports = {
  generateExcelReport,
  generateCSVReport,
}
