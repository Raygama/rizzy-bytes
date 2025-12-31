"use client"

import { useState, useRef } from "react"
import { Save, X, Upload, FileText } from "lucide-react"
import Swal from "sweetalert2"

export default function AddKbModal({ isOpen, onClose, onAdded }) {
  const [fileLoaderName, setFileLoaderName] = useState("")
  const [description, setDescription] = useState("")
  const [type, setType] = useState("")
  const [file, setFile] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [saving, setSaving] = useState(false)

  const fileInputRef = useRef(null)

  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return

    const allowedExtensions = ["pdf", "doc", "docx", "xls", "xlsx", "csv"]
    const ext = selectedFile.name.split(".").pop().toLowerCase()

    if (!allowedExtensions.includes(ext)) {
      Swal.fire("Error", "Only PDF, Word, Excel, or CSV files are allowed", "error")
      return
    }

    setFile(selectedFile)
  }

  const handleInputChange = (e) => {
    handleFileSelect(e.target.files[0])
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileSelect(e.dataTransfer.files[0])
  }

  const handleRemoveFile = () => {
    setFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleSave = async () => {
    if (!file) {
      Swal.fire("Error", "Please upload a file", "error")
      return
    }

    if (!fileLoaderName.trim()) {
      Swal.fire("Error", "File Loader Name is required", "error")
      return
    }

    setSaving(true)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("name", fileLoaderName)
      formData.append("description", description)
      formData.append("type", type)

      const res = await fetch("http://localhost:3000/api/kb/loaders", {
        method: "POST",
        body: formData,
        headers: {
          authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      })

      if (!res.ok) throw new Error("Upload failed")

      Swal.fire("Success", "Knowledge base entry created!", "success")
      resetForm()
      onAdded?.()
    } catch (error) {
      console.error(error)
      Swal.fire("Error", "Failed to create entry", "error")
    } finally {
      setSaving(false)
    }
  }

  const resetForm = () => {
    setFileLoaderName("")
    setDescription("")
    setType("")
    setFile(null)
  }

  const handleDiscard = () => {
    resetForm()
    onClose?.()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/30" aria-hidden onClick={handleDiscard} />

      <div className="relative z-50 flex justify-center items-center min-h-screen p-4 overflow-y-auto">
        <div className="w-full max-w-2xl rounded-2xl bg-white p-6 md:p-8 shadow-xl my-auto">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Add New Entry</h2>
              <p className="mt-1 text-sm text-gray-500">Fill details to create new knowledge base entry</p>
            </div>
            <button
              onClick={handleDiscard}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
              aria-label="Close"
            >
              <X size={24} />
            </button>
          </div>

          <div className="space-y-6">
            {/* File Upload Dropzone */}
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`rounded-2xl border-2 border-dashed p-8 md:p-12 bg-white transition-colors ${
                isDragging ? "border-red-500 bg-red-50" : "border-red-400"
              }`}
            >
              {!file ? (
                <div className="flex flex-col items-center text-center">
                  <div className="mb-4 rounded-full bg-red-50 p-4">
                    <Upload className="h-8 w-8 text-red-500" />
                  </div>

                  <h3 className="mb-2 text-base md:text-lg font-medium text-gray-900">Drag & drop our files here</h3>
                  <p className="mb-6 text-sm text-gray-500">or click to browse</p>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-6 py-2.5 text-sm font-medium text-red-500 hover:bg-red-100 transition-colors"
                  >
                    <span className="text-lg">+</span>
                    Browse Files
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-red-500" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{file.name}</p>
                      <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>

                  <button
                    onClick={handleRemoveFile}
                    className="rounded-full p-2 text-gray-500 hover:bg-gray-100 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv"
                onChange={handleInputChange}
              />
            </div>

            {/* Form Fields */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-900">File Loader Name</label>
              <input
                value={fileLoaderName}
                onChange={(e) => setFileLoaderName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Placeholder"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-900">Description</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Placeholder"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-900">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
              >
                <option value="" disabled>
                  Select type...
                </option>
                <option value="ta">Tugas Akhir</option>
                <option value="kp">Kerja Praktik</option>
                <option value="general">Other</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-8 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
            <button
              onClick={handleDiscard}
              className="rounded-lg bg-gray-300 px-6 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-400 transition-colors"
            >
              Discard
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-red-600 transition-colors disabled:opacity-60"
            >
              <Save size={16} />
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
