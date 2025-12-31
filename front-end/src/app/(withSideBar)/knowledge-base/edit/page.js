"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Upload, Save, X, FileText } from "lucide-react";
import { flowiseEndpoint } from "@/lib/flowiseApi";

export default function AddNewEntryPage() {
  const router = useRouter();

  const [fileLoaderName, setFileLoaderName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef(null);

  /* =======================
     FILE HANDLING
  ======================= */

  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return;

    const allowedExtensions = ["pdf", "doc", "docx", "xls", "xlsx", "csv"];
    const ext = selectedFile.name.split(".").pop().toLowerCase();

    if (!allowedExtensions.includes(ext)) {
      alert("Only PDF, Word, Excel, or CSV files are allowed");
      return;
    }

    setFile(selectedFile);
  };

  const handleInputChange = (e) => {
    handleFileSelect(e.target.files[0]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files[0]);
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  /* =======================
     ACTIONS
  ======================= */

  const handleSave = async () => {
    if (!file) {
      alert("Please upload a file");
      return;
    }

    if (!fileLoaderName.trim()) {
      alert("File Loader Name is required");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", fileLoaderName);
    formData.append("description", description);

    try {
      const res = await fetch(flowiseEndpoint("/api/kb/loaders"), {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      const data = await res.json();
      console.log(data);

      router.push("/knowledge-base");
      router.refresh();
    } catch (err) {
      alert("Failed to save data");
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] p-6 md:p-8 lg:p-12">
      {/* Top Bar */}
      <div className="mb-8 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="flex items-center justify-center rounded-lg p-2 text-red-500 hover:bg-red-50"
        >
          <ChevronLeft size={24} />
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-red-600"
          >
            <Save size={16} />
            Save
          </button>
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-300 px-6 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-400"
          >
            Discard
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT */}
        <div className="lg:col-span-5 space-y-6">
          {/* UPLOAD */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`rounded-2xl border-2 border-dashed p-12 bg-white transition-colors ${
              isDragging ? "border-red-500 bg-red-50" : "border-red-400"
            }`}
          >
            {!file ? (
              <div className="flex flex-col items-center text-center">
                <div className="mb-4 rounded-full bg-red-50 p-4">
                  <Upload className="h-8 w-8 text-red-500" />
                </div>

                <h3 className="mb-2 text-lg font-medium text-gray-900">
                  Drag & drop our files here
                </h3>
                <p className="mb-6 text-sm text-gray-500">or click to browse</p>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-6 py-2.5 text-sm font-medium text-red-500 hover:bg-red-100"
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
                    <p className="text-sm font-medium text-gray-900">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleRemoveFile}
                  className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* hidden input */}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv"
              onChange={handleInputChange}
            />
          </div>

          {/* FORM */}
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-900">
                File Loader Name
              </label>
              <input
                value={fileLoaderName}
                onChange={(e) => setFileLoaderName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-red-500"
                placeholder="Placeholder"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-900">
                Description
              </label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-red-500"
                placeholder="Placeholder"
              />
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="lg:col-span-7">
          <div className="space-y-6 rounded-lg bg-white p-6 shadow-sm">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="border-b pb-6 last:border-b-0">
                <h3 className="mb-2 text-sm font-semibold text-red-500">
                  Chunk {i}
                </h3>
                <p className="text-sm text-gray-700">
                  Lorem ipsum dolor sit amet consectetur adipisicing elit.
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
