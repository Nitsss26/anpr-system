"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Download, Search, Filter, Eye, Calendar, FileText, CheckCircle, Clock, AlertCircle } from "lucide-react"

interface DetectedPlate {
  id: string
  plateNumber: string
  confidence: number
  timestamp: string
  frameNumber: number
  boundingBox: {
    x: number
    y: number
    width: number
    height: number
  }
}

interface ProcessingJob {
  id: string
  filename: string
  status: "processing" | "completed" | "failed"
  progress: number
  createdAt: string
  completedAt?: string
  detectedPlates: DetectedPlate[]
  totalFrames: number
  processedFrames: number
  averageConfidence: number
}

const Results = () => {
  const [jobs, setJobs] = useState<ProcessingJob[]>([])
  const [filteredJobs, setFilteredJobs] = useState<ProcessingJob[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [isLoading, setIsLoading] = useState(true)
  const [selectedJob, setSelectedJob] = useState<ProcessingJob | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchJobs()
    const interval = setInterval(fetchJobs, 5000) // Refresh every 5 seconds
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    filterJobs()
  }, [jobs, searchTerm, statusFilter])

  const fetchJobs = async () => {
    try {
      const response = await fetch("/api/jobs", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      })
      const data = await response.json()
      setJobs(data)
    } catch (error) {
      console.error("Failed to fetch jobs:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const filterJobs = () => {
    let filtered = jobs

    if (searchTerm) {
      filtered = filtered.filter(
        (job) =>
          job.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
          job.detectedPlates.some((plate) => plate.plateNumber.toLowerCase().includes(searchTerm.toLowerCase())),
      )
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((job) => job.status === statusFilter)
    }

    setFilteredJobs(filtered)
  }

  const exportToExcel = async (jobId: string) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/export`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      })

      if (!response.ok) {
        throw new Error("Export failed")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.style.display = "none"
      a.href = url
      a.download = `anpr-results-${jobId}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)

      toast({
        title: "Export successful",
        description: "Results have been exported to Excel file.",
      })
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export results. Please try again.",
        variant: "destructive",
      })
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "processing":
        return <Clock className="h-4 w-4 text-blue-500" />
      case "failed":
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800"
      case "processing":
        return "bg-blue-100 text-blue-800"
      case "failed":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading results...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Processing Results</h1>
        <p className="text-gray-600 mt-2">View and manage your video processing results</p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by filename or plate number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="sm:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredJobs.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
            <p className="text-gray-600">
              {jobs.length === 0
                ? "No videos have been processed yet. Upload a video to get started."
                : "No results match your current filters."}
            </p>
          </div>
        ) : (
          filteredJobs.map((job) => (
            <Card key={job.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg truncate">{job.filename}</CardTitle>
                  {getStatusIcon(job.status)}
                </div>
                <CardDescription>
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4" />
                    <span>{new Date(job.createdAt).toLocaleDateString()}</span>
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Status Badge */}
                  <Badge className={getStatusColor(job.status)}>
                    {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                  </Badge>

                  {/* Progress for processing jobs */}
                  {job.status === "processing" && (
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Progress</span>
                        <span>{job.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${job.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Plates Detected</p>
                      <p className="font-semibold">{job.detectedPlates.length}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Avg. Confidence</p>
                      <p className="font-semibold">
                        {job.averageConfidence ? `${(job.averageConfidence * 100).toFixed(1)}%` : "N/A"}
                      </p>
                    </div>
                  </div>

                  {/* Detected Plates Preview */}
                  {job.detectedPlates.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Recent Detections:</p>
                      <div className="space-y-1">
                        {job.detectedPlates.slice(0, 3).map((plate, index) => (
                          <div key={index} className="flex justify-between text-xs bg-gray-50 p-2 rounded">
                            <span className="font-mono">{plate.plateNumber}</span>
                            <span className="text-gray-500">{(plate.confidence * 100).toFixed(1)}%</span>
                          </div>
                        ))}
                        {job.detectedPlates.length > 3 && (
                          <p className="text-xs text-gray-500 text-center">+{job.detectedPlates.length - 3} more</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex space-x-2 pt-2">
                    <Button variant="outline" size="sm" onClick={() => setSelectedJob(job)} className="flex-1">
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    {job.status === "completed" && job.detectedPlates.length > 0 && (
                      <Button variant="outline" size="sm" onClick={() => exportToExcel(job.id)} className="flex-1">
                        <Download className="h-4 w-4 mr-1" />
                        Export
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Detailed View Modal would go here */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{selectedJob.filename}</CardTitle>
                <Button variant="outline" onClick={() => setSelectedJob(null)}>
                  ✕
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Job Details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <Badge className={getStatusColor(selectedJob.status)}>{selectedJob.status}</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Plates</p>
                    <p className="font-semibold">{selectedJob.detectedPlates.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Avg. Confidence</p>
                    <p className="font-semibold">
                      {selectedJob.averageConfidence ? `${(selectedJob.averageConfidence * 100).toFixed(1)}%` : "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Processed</p>
                    <p className="font-semibold">{new Date(selectedJob.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>

                {/* Detected Plates Table */}
                {selectedJob.detectedPlates.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Detected Plates</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-gray-300">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="border border-gray-300 px-4 py-2 text-left">Plate Number</th>
                            <th className="border border-gray-300 px-4 py-2 text-left">Confidence</th>
                            <th className="border border-gray-300 px-4 py-2 text-left">Timestamp</th>
                            <th className="border border-gray-300 px-4 py-2 text-left">Frame</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedJob.detectedPlates.map((plate, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="border border-gray-300 px-4 py-2 font-mono">{plate.plateNumber}</td>
                              <td className="border border-gray-300 px-4 py-2">
                                {(plate.confidence * 100).toFixed(1)}%
                              </td>
                              <td className="border border-gray-300 px-4 py-2">{plate.timestamp}</td>
                              <td className="border border-gray-300 px-4 py-2">{plate.frameNumber}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Export Button */}
                {selectedJob.status === "completed" && selectedJob.detectedPlates.length > 0 && (
                  <div className="flex justify-end">
                    <Button onClick={() => exportToExcel(selectedJob.id)}>
                      <Download className="h-4 w-4 mr-2" />
                      Export to Excel
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default Results
