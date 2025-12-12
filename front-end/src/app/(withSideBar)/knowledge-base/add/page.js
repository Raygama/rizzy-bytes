"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, Upload, Save } from "lucide-react"

export default function AddNewEntryPage() {
  const router = useRouter()
  const [fileLoaderName, setFileLoaderName] = useState("")
  const [description, setDescription] = useState("")
  const [option1, setOption1] = useState(false)
  const [option2, setOption2] = useState(false)

  const handleSave = () => {
    console.log("Save clicked")
    // TODO: Implement save logic
  }

  const handleDiscard = () => {
    router.back()
  }

  const handleBack = () => {
    router.back()
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] p-6 md:p-8 lg:p-12">
      {/* Top Bar */}
      <div className="mb-8 flex items-center justify-between">
        <button
          onClick={handleBack}
          className="flex items-center justify-center rounded-lg p-2 text-red-500 hover:bg-red-50 transition-colors"
          aria-label="Go back"
        >
          <ChevronLeft size={24} />
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-red-600 transition-colors"
          >
            <Save size={16} />
            Save
          </button>
          <button
            onClick={handleDiscard}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-300 px-6 py-2.5 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-400 transition-colors"
          >
            Discard
          </button>
        </div>
      </div>

      {/* Main Content - Two Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column - Upload and Form */}
        <div className="lg:col-span-5 space-y-6">
          {/* Upload Dropzone */}
          <div className="rounded-2xl border-2 border-dashed border-red-400 bg-white p-12">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="mb-4 flex items-center justify-center">
                <div className="rounded-full bg-red-50 p-4">
                  <Upload className="h-8 w-8 text-red-500" />
                </div>
              </div>
              <h3 className="mb-2 text-lg font-medium text-gray-900">Drag & drop our files here</h3>
              <p className="mb-6 text-sm text-gray-500">or click to browse</p>
              <button className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-6 py-2.5 text-sm font-medium text-red-500 hover:bg-red-100 transition-colors">
                <span className="text-lg">+</span>
                Browse Files
              </button>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-5">
            {/* File Loader Name */}
            <div>
              <label htmlFor="fileLoaderName" className="mb-2 block text-sm font-medium text-gray-900">
                File Loader Name
              </label>
              <input
                type="text"
                id="fileLoaderName"
                value={fileLoaderName}
                onChange={(e) => setFileLoaderName(e.target.value)}
                placeholder="Placeholder"
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors"
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="mb-2 block text-sm font-medium text-gray-900">
                Description
              </label>
              <input
                type="text"
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Placeholder"
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors"
              />
            </div>

            {/* Advance Option */}
            <div>
              <label className="mb-3 block text-sm font-medium text-gray-900">Advance Option</label>
              <div className="space-y-3">
                {/* Option 1 */}
                <div className="flex items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-3">
                  <input
                    type="text"
                    placeholder="Placeholder"
                    className="flex-1 border-none bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
                  />
                  <button
                    onClick={() => setOption1(!option1)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ${
                      option1 ? "bg-red-500" : "bg-gray-300"
                    }`}
                    role="switch"
                    aria-checked={option1}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        option1 ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                {/* Option 2 */}
                <div className="flex items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-3">
                  <input
                    type="text"
                    placeholder="Placeholder"
                    className="flex-1 border-none bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
                  />
                  <button
                    onClick={() => setOption2(!option2)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ${
                      option2 ? "bg-red-500" : "bg-gray-300"
                    }`}
                    role="switch"
                    aria-checked={option2}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        option2 ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Chunks Preview */}
        <div className="lg:col-span-7">
          <div className="space-y-6 rounded-lg bg-white p-6 shadow-sm">
            {[1, 2, 3, 4, 5, 6].map((chunkNum) => (
              <div key={chunkNum} className="border-b border-gray-100 pb-6 last:border-b-0 last:pb-0">
                <h3 className="mb-2 text-sm font-semibold text-red-500">Chunk {chunkNum}</h3>
                <p className="text-sm leading-relaxed text-gray-700">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et
                  dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut
                  aliquip ex ea commodo consequat.
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
