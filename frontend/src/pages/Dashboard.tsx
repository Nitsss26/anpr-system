"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Upload, FileVideo, Eye, Download, TrendingUp, Clock, CheckCircle, AlertCircle } from "lucide-react"
import { Link } from "react-router-dom"

interface DashboardStats {
  totalVideos: number
  totalPlatesDetected: number
  processingVideos: number
  completedVideos: number
  averageAccuracy: number
}

interface RecentJob {
  id: string
  filename: string
  status: "processing" | "completed" | "failed"
  progress: number
  platesDetected: number
  createdAt: string
}

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalVideos: 0,
    totalPlatesDetected: 0,
    processingVideos: 0,
    completedVideos: 0,
    averageAccuracy: 0,
  })
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
    const interval = setInterval(fetchDashboardData, 5000) // Refresh every 5 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchDashboardData = async () => {
    try {
      const [statsRes, jobsRes] = await Promise.all([
        fetch("/api/dashboard/stats", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }),
        fetch("/api/dashboard/recent-jobs", {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        }),
      ])

      const statsData = await statsRes.json()
      const jobsData = await jobsRes.json()

      setStats(statsData)
      setRecentJobs(jobsData)
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error)
    } finally {
      setIsLoading(false)
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">Monitor your ANPR system performance and recent activities</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Videos</CardTitle>
            <FileVideo className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalVideos}</div>
            <p className="text-xs text-muted-foreground">Videos processed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Plates Detected</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPlatesDetected}</div>
            <p className="text-xs text-muted-foreground">Number plates found</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.processingVideos}</div>
            <p className="text-xs text-muted-foreground">Videos in queue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Accuracy</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageAccuracy.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Average detection accuracy</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Get started with common tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link to="/upload">
              <Button className="w-full justify-start" size="lg">
                <Upload className="mr-2 h-4 w-4" />
                Upload New Video
              </Button>
            </Link>
            <Link to="/results">
              <Button variant="outline" className="w-full justify-start bg-transparent" size="lg">
                <FileVideo className="mr-2 h-4 w-4" />
                View All Results
              </Button>
            </Link>
            <Button variant="outline" className="w-full justify-start bg-transparent" size="lg">
              <Download className="mr-2 h-4 w-4" />
              Export Reports
            </Button>
          </CardContent>
        </Card>

        {/* Recent Jobs */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Jobs</CardTitle>
            <CardDescription>Latest video processing activities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentJobs.length === 0 ? (
                <p className="text-center text-gray-500 py-4">No recent jobs found</p>
              ) : (
                recentJobs.map((job) => (
                  <div key={job.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(job.status)}
                      <div>
                        <p className="font-medium text-sm">{job.filename}</p>
                        <p className="text-xs text-gray-500">{job.platesDetected} plates detected</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {job.status === "processing" && <Progress value={job.progress} className="w-20 mb-1" />}
                      <p className="text-xs text-gray-500">{new Date(job.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default Dashboard
