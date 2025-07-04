"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { SettingsIcon, Save, RefreshCw } from "lucide-react"

interface SystemSettings {
  defaultConfidenceThreshold: number
  maxConcurrentJobs: number
  enableDuplicateFiltering: boolean
  enableStateValidation: boolean
  processingMode: string
  ocrEngine: string
  enableLogging: boolean
  logLevel: string
  maxFileSize: number
  supportedFormats: string[]
}

const Settings = () => {
  const [settings, setSettings] = useState<SystemSettings>({
    defaultConfidenceThreshold: 0.5,
    maxConcurrentJobs: 3,
    enableDuplicateFiltering: true,
    enableStateValidation: true,
    processingMode: "standard",
    ocrEngine: "easyocr",
    enableLogging: true,
    logLevel: "info",
    maxFileSize: 2048,
    supportedFormats: ["mp4", "avi", "mov", "mkv"],
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/settings", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      })
      const data = await response.json()
      setSettings(data)
    } catch (error) {
      console.error("Failed to fetch settings:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const saveSettings = async () => {
    setIsSaving(true)
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(settings),
      })

      if (!response.ok) {
        throw new Error("Failed to save settings")
      }

      toast({
        title: "Settings saved",
        description: "Your settings have been updated successfully.",
      })
    } catch (error) {
      toast({
        title: "Save failed",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const resetSettings = async () => {
    try {
      const response = await fetch("/api/settings/reset", {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      })
      const data = await response.json()
      setSettings(data)

      toast({
        title: "Settings reset",
        description: "Settings have been reset to default values.",
      })
    } catch (error) {
      toast({
        title: "Reset failed",
        description: "Failed to reset settings. Please try again.",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
        <p className="text-gray-600 mt-2">Configure ANPR system parameters and preferences</p>
      </div>

      <div className="space-y-6">
        {/* Detection Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <SettingsIcon className="h-5 w-5" />
              <span>Detection Settings</span>
            </CardTitle>
            <CardDescription>Configure number plate detection parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="text-sm font-medium">
                Default Confidence Threshold: {settings.defaultConfidenceThreshold.toFixed(2)}
              </Label>
              <p className="text-xs text-gray-500 mb-3">Minimum confidence score for plate detection (0.1 - 1.0)</p>
              <Slider
                value={[settings.defaultConfidenceThreshold]}
                onValueChange={(value) => setSettings((prev) => ({ ...prev, defaultConfidenceThreshold: value[0] }))}
                max={1}
                min={0.1}
                step={0.05}
                className="w-full"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="processingMode">Processing Mode</Label>
                <Select
                  value={settings.processingMode}
                  onValueChange={(value) => setSettings((prev) => ({ ...prev, processingMode: value }))}
                >
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

              <div>
                <Label htmlFor="ocrEngine">OCR Engine</Label>
                <Select
                  value={settings.ocrEngine}
                  onValueChange={(value) => setSettings((prev) => ({ ...prev, ocrEngine: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easyocr">EasyOCR (Recommended)</SelectItem>
                    <SelectItem value="tesseract">Tesseract OCR</SelectItem>
                    <SelectItem value="paddleocr">PaddleOCR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Duplicate Filtering</Label>
                  <p className="text-xs text-gray-500">Remove duplicate plate detections</p>
                </div>
                <Switch
                  checked={settings.enableDuplicateFiltering}
                  onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, enableDuplicateFiltering: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">State Validation</Label>
                  <p className="text-xs text-gray-500">Validate Indian state formats</p>
                </div>
                <Switch
                  checked={settings.enableStateValidation}
                  onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, enableStateValidation: checked }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Settings */}
        <Card>
          <CardHeader>
            <CardTitle>System Configuration</CardTitle>
            <CardDescription>Configure system performance and file handling</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="maxConcurrentJobs">Max Concurrent Jobs</Label>
                <Input
                  id="maxConcurrentJobs"
                  type="number"
                  min="1"
                  max="10"
                  value={settings.maxConcurrentJobs}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, maxConcurrentJobs: Number.parseInt(e.target.value) }))
                  }
                />
                <p className="text-xs text-gray-500 mt-1">Maximum number of videos to process simultaneously</p>
              </div>

              <div>
                <Label htmlFor="maxFileSize">Max File Size (MB)</Label>
                <Input
                  id="maxFileSize"
                  type="number"
                  min="100"
                  max="10240"
                  value={settings.maxFileSize}
                  onChange={(e) => setSettings((prev) => ({ ...prev, maxFileSize: Number.parseInt(e.target.value) }))}
                />
                <p className="text-xs text-gray-500 mt-1">Maximum allowed file size for uploads</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logging Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Logging & Monitoring</CardTitle>
            <CardDescription>Configure system logging and monitoring</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Enable Logging</Label>
                <p className="text-xs text-gray-500">Enable system activity logging</p>
              </div>
              <Switch
                checked={settings.enableLogging}
                onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, enableLogging: checked }))}
              />
            </div>

            {settings.enableLogging && (
              <div>
                <Label htmlFor="logLevel">Log Level</Label>
                <Select
                  value={settings.logLevel}
                  onValueChange={(value) => setSettings((prev) => ({ ...prev, logLevel: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="error">Error</SelectItem>
                    <SelectItem value="warn">Warning</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="debug">Debug</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={resetSettings} className="flex items-center space-x-2 bg-transparent">
            <RefreshCw className="h-4 w-4" />
            <span>Reset to Defaults</span>
          </Button>

          <Button onClick={saveSettings} disabled={isSaving} className="flex items-center space-x-2">
            <Save className="h-4 w-4" />
            <span>{isSaving ? "Saving..." : "Save Settings"}</span>
          </Button>
        </div>
      </div>
    </div>
  )
}

export default Settings
