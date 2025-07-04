"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { useToast } from "@/hooks/use-toast"
import { UploadIcon, FileVideo, X, Play, Settings, AlertCircle } from "lucide-react"

interface UploadFile {
  file: File
  preview: string
  duration?: string
  size: string
}

const Upload = () => {
  const [files, setFiles] = useState<UploadFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [confidenceThreshold, setConfidenceThreshold] = useState([0.5])
  const [processingMode, setProcessingMode] = useState("standard")
  const { toast } = useToast()

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      size: formatFileSize(file.size),
    }))
    setFiles((prev) => [...prev, ...newFiles])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "video/*": [".mp4", ".avi", ".mov", ".mkv", ".wmv"],
    },
    maxSize: 2 * 1024 * 1024 * 1024, // 2GB
    multiple: true,
  })

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const newFiles = [...prev]
      URL.revokeObjectURL(newFiles[index].preview)
      newFiles.splice(index, 1)
      return newFiles
    })
  }

  const handleUpload = async () => {
    if (files.length === 0) {
      toast({
        title: "No files selected",
        description: "Please select at least one video file to upload.",
        variant: "destructive",
      })
      return
    }

    setIsUploading(true)
    setUploadProgress(0)

    try {
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData()
        formData.append("video", files[i].file)
        formData.append("confidenceThreshold", confidenceThreshold[0].toString())
        formData.append("processingMode", processingMode)

        const response = await fetch("/api/upload", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: formData,
        })

        if (!response.ok) {
          throw new Error(`Failed to upload ${files[i].file.name}`)
        }

        setUploadProgress(((i + 1) / files.length) * 100)
      }

      toast({
        title: "Upload successful",
        description: `${files.length} video(s) uploaded and queued for processing.`,
      })

      // Clear files after successful upload
      files.forEach((file) => URL.revokeObjectURL(file.preview))
      setFiles([])
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "An error occurred during upload.",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Upload Videos</h1>
        <p className="text-gray-600 mt-2">Upload video files for automatic number plate recognition</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upload Area */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Video Upload</CardTitle>
              <CardDescription>
                Drag and drop video files or click to browse. Supported formats: MP4, AVI, MOV, MKV, WMV
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
                }`}
              >
                <input {...getInputProps()} />
                <UploadIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                {isDragActive ? (
                  <p className="text-blue-600">Drop the files here...</p>
                ) : (
                  <div>
                    <p className="text-gray-600 mb-2">Drag & drop video files here, or click to select files</p>
                    <p className="text-sm text-gray-500">Maximum file size: 2GB per file</p>
                  </div>
                )}
              </div>

              {/* File List */}
              {files.length > 0 && (
                <div className="mt-6 space-y-3">
                  <h3 className="font-medium text-gray-900">Selected Files</h3>
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <FileVideo className="h-5 w-5 text-blue-500" />
                        <div>
                          <p className="font-medium text-sm">{file.file.name}</p>
                          <p className="text-xs text-gray-500">{file.size}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button variant="outline" size="sm" onClick={() => window.open(file.preview)}>
                          <Play className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => removeFile(index)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload Progress */}
              {isUploading && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Uploading...</span>
                    <span className="text-sm text-gray-500">{uploadProgress.toFixed(0)}%</span>
                  </div>
                  <Progress value={uploadProgress} />
                </div>
              )}

              {/* Upload Button */}
              <div className="mt-6">
                <Button
                  onClick={handleUpload}
                  disabled={files.length === 0 || isUploading}
                  className="w-full"
                  size="lg"
                >
                  {isUploading ? "Uploading..." : `Upload ${files.length} File(s)`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Settings Panel */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5" />
                <span>Processing Settings</span>
              </CardTitle>
              <CardDescription>Configure detection parameters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Confidence Threshold */}
              <div>
                <Label className="text-sm font-medium">Confidence Threshold: {confidenceThreshold[0].toFixed(2)}</Label>
                <p className="text-xs text-gray-500 mb-3">Minimum confidence score for plate detection</p>
                <Slider
                  value={confidenceThreshold}
                  onValueChange={setConfidenceThreshold}
                  max={1}
                  min={0.1}
                  step={0.05}
                  className="w-full"
                />
              </div>

              {/* Processing Mode */}
              <div>
                <Label className="text-sm font-medium">Processing Mode</Label>
                <p className="text-xs text-gray-500 mb-3">Choose processing speed vs accuracy</p>
                <Select value={processingMode} onValueChange={setProcessingMode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fast">Fast (Lower accuracy)</SelectItem>
                    <SelectItem value="standard">Standard (Balanced)</SelectItem>
                    <SelectItem value="accurate">Accurate (Slower)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-medium text-blue-900">Processing Info</h4>
                    <p className="text-xs text-blue-700 mt-1">
                      Videos will be processed in the background. You'll receive notifications when processing is
                      complete.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default Upload
