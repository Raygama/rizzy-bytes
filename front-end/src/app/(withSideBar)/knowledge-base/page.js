"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, ChevronLeft, ChevronRight, Pencil, Trash2, ArrowLeft, Upload, Save } from "lucide-react"
import Swal from "sweetalert2"

export default function KnowledgeBasePage() {
  const router = useRouter()
  const [data, setData] = useState(null)
  const [entries, setEntries] = useState([
    {
      id: "KB-001",
      question: "Placeholder",
      answer: "Placeholder",
      fileName: "Document 1.pdf",
      description: "Sample description for KB-001",
    },
    {
      id: "KB-002",
      question: "Placeholder",
      answer: "Placeholder",
      fileName: "Document 2.pdf",
      description: "Sample description for KB-002",
    },
    {
      id: "KB-003",
      question: "Placeholder",
      answer: "Placeholder",
      fileName: "Document 3.pdf",
      description: "Sample description for KB-003",
    },
    {
      id: "KB-004",
      question: "Placeholder",
      answer: "Placeholder",
      fileName: "Document 4.pdf",
      description: "Sample description for KB-004",
    },
    {
      id: "KB-005",
      question: "Placeholder",
      answer: "Placeholder",
      fileName: "Document 5.pdf",
      description: "Sample description for KB-005",
    },
    {
      id: "KB-006",
      question: "Placeholder",
      answer: "Placeholder",
      fileName: "Document 6.pdf",
      description: "Sample description for KB-006",
    },
    {
      id: "KB-007",
      question: "Placeholder",
      answer: "Placeholder",
      fileName: "Document 7.pdf",
      description: "Sample description for KB-007",
    },
    {
      id: "KB-008",
      question: "Placeholder",
      answer: "Placeholder",
      fileName: "Document 8.pdf",
      description: "Sample description for KB-008",
    },
    {
      id: "KB-009",
      question: "Placeholder",
      answer: "Placeholder",
      fileName: "Document 9.pdf",
      description: "Sample description for KB-009",
    },
    {
      id: "KB-010",
      question: "Placeholder",
      answer: "Placeholder",
      fileName: "Document 10.pdf",
      description: "Sample description for KB-010",
    },
  ])

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState("add") // "add" or "edit"
  const [editingEntry, setEditingEntry] = useState(null)
  const [hasFile, setHasFile] = useState(false)
  const [formData, setFormData] = useState({
    fileName: "",
    description: "",
    option1: false,
    option2: false,
  })

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log("token:", localStorage.getItem("token"))
        const response = await fetch("http://localhost:3006/api/kb", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            authorization: "Bearer pTnZk73MAtw2YhSYUw28urAeKa4dSTGHlZKwOVPVoy4",
          },
        })
        const result = await response.json()
        setData(result)
        console.log("Fetched knowledge base entries:", result)
        console.log(response)
      } catch (error) {
        console.error("Error fetching knowledge base entries:", error)
      }
    }
    fetchData()
  }, [])

  const handleAddNewEntry = () => {
    setModalMode("add")
    setEditingEntry(null)
    setHasFile(false)
    setFormData({
      fileName: "",
      description: "",
      option1: false,
      option2: false,
    })
    setIsModalOpen(true)
  }

  const handleEdit = (entry) => {
    setModalMode("edit")
    setEditingEntry(entry)
    setHasFile(true) // Simulate that file exists for edit mode
    setFormData({
      fileName: entry.fileName,
      description: entry.description,
      option1: false,
      option2: false,
    })
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingEntry(null)
    setHasFile(false)
    setFormData({
      fileName: "",
      description: "",
      option1: false,
      option2: false,
    })
  }

  const handleFileSelect = () => {
    setHasFile(true)
  }

  const handleSave = () => {
    if (modalMode === "add") {
      Swal.fire({
        title: "Success!",
        text: "New entry has been added.",
        icon: "success",
        confirmButtonColor: "#ef4444",
      })
    } else {
      Swal.fire({
        title: "Updated!",
        text: "Entry has been updated.",
        icon: "success",
        confirmButtonColor: "#ef4444",
      })
    }
    handleCloseModal()
  }

  const handleDelete = (id) => {
    Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#9ca3af",
      confirmButtonText: "Yes, delete it!",
      cancelButtonText: "Cancel",
    }).then((result) => {
      if (result.isConfirmed) {
        setEntries(entries.filter((entry) => entry.id !== id))
        Swal.fire({
          title: "Deleted!",
          text: "Your entry has been deleted.",
          icon: "success",
          confirmButtonColor: "#ef4444",
        })
      }
    })
  }

  const chunks = [
    {
      title: "Chunk 1",
      content:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
    },
    {
      title: "Chunk 2",
      content:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
    },
    {
      title: "Chunk 3",
      content:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
    },
    {
      title: "Chunk 4",
      content:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
    },
    {
      title: "Chunk 5",
      content:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
    },
    {
      title: "Chunk 6",
      content:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
    },
  ]

  return (
    <div className="min-h-screen bg-[#F5F5F7] p-6 md:p-8 lg:p-12">
      <div className="mx-auto max-w-7xl">
        {/* Header Section */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 lg:text-4xl">Knowledge Base Management</h1>
            <p className="mt-2 text-sm text-gray-500">
              View, Add, and Manage interconnected Q&A entries for the chatbot.
            </p>
          </div>
          <button
            onClick={handleAddNewEntry}
            className="inline-flex items-center gap-2 rounded-full bg-red-500 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-red-600 transition-colors"
          >
            <Plus size={18} />
            Add New Entry
          </button>
        </div>

        {/* Table Card */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                    ID
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Question
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Answer
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-32">
                      <div className="flex items-center justify-center">
                        <p className="text-sm text-gray-400">You haven&apos;t input any data</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-900">{entry.id}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{entry.question}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{entry.answer}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEdit(entry)}
                            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                            aria-label="Edit entry"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="rounded-lg p-2 text-red-500 hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                            aria-label="Delete entry"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer / Pagination */}
          <div className="flex items-center justify-between border-t border-gray-200 bg-white px-6 py-4">
            <div className="text-sm text-gray-500">Show 1 to 10 of 110 results</div>
            <div className="flex items-center gap-2">
              <button
                className="flex items-center justify-center text-gray-400 transition-colors hover:text-gray-600 focus:outline-none"
                aria-label="Previous page"
              >
                <ChevronLeft size={20} />
              </button>
              <button className="flex items-center justify-center rounded-sm bg-red-600 px-3 py-1 text-sm font-medium text-white">
                1
              </button>
              <button className="flex items-center justify-center rounded-sm px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">
                2
              </button>
              <button className="flex items-center justify-center rounded-sm px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">
                3
              </button>
              <span className="px-2 text-sm text-gray-500">…</span>
              <button className="flex items-center justify-center rounded-sm px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">
                9
              </button>
              <button className="flex items-center justify-center rounded-sm px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">
                10
              </button>
              <button
                className="flex items-center justify-center text-gray-400 transition-colors hover:text-gray-600 focus:outline-none"
                aria-label="Next page"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={handleCloseModal}>
          <div
            className="relative w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
              <button
                onClick={handleCloseModal}
                className="flex items-center justify-center rounded-lg p-2 text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label="Close modal"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSave}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-6 py-2 text-sm font-medium text-white hover:bg-red-600 transition-colors"
                >
                  <Save size={16} />
                  {modalMode === "add" ? "Save" : "Update"}
                </button>
                <button
                  onClick={handleCloseModal}
                  className="rounded-lg bg-gray-300 px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-400 transition-colors"
                >
                  Discard
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className={`p-6 ${hasFile ? "lg:grid lg:grid-cols-2 lg:gap-6" : ""}`}>
              {/* Left Column - Form */}
              <div className="space-y-6">
                {/* Dropzone */}
                <div className="rounded-xl border-2 border-dashed border-red-300 bg-red-50/30 p-8">
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="mb-4 rounded-full bg-white p-4 shadow-sm">
                      <Upload className="h-8 w-8 text-red-500" />
                    </div>
                    <p className="mb-2 text-base font-medium text-gray-700">Drag & drop our files here</p>
                    <p className="mb-4 text-sm text-gray-500">or click to browse</p>
                    <input type="file" id="file-upload" className="hidden" onChange={handleFileSelect} />
                    <label
                      htmlFor="file-upload"
                      className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-red-100 px-6 py-2.5 text-sm font-medium text-red-600 hover:bg-red-200 transition-colors"
                    >
                      <Plus size={16} />
                      Browse Files
                    </label>
                  </div>
                </div>

                {/* File Loader Name */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">File Loader Name</label>
                  <input
                    type="text"
                    value={formData.fileName}
                    onChange={(e) => setFormData({ ...formData, fileName: e.target.value })}
                    placeholder="Placeholder"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Description</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Placeholder"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  />
                </div>

                {/* Advance Option */}
                <div>
                  <label className="mb-3 block text-sm font-medium text-gray-700">Advance Option</label>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg border border-gray-300 px-4 py-3">
                      <span className="text-sm text-gray-600">Placeholder</span>
                      <button
                        onClick={() => setFormData({ ...formData, option1: !formData.option1 })}
                        className={`relative h-6 w-11 rounded-full transition-colors ${
                          formData.option1 ? "bg-gray-400" : "bg-gray-300"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                            formData.option1 ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-gray-300 px-4 py-3">
                      <span className="text-sm text-gray-600">Placeholder</span>
                      <button
                        onClick={() => setFormData({ ...formData, option2: !formData.option2 })}
                        className={`relative h-6 w-11 rounded-full transition-colors ${
                          formData.option2 ? "bg-gray-400" : "bg-gray-300"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                            formData.option2 ? "translate-x-5" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Chunks Preview (only if hasFile) */}
              {hasFile && (
                <div className="mt-6 lg:mt-0">
                  <div className="space-y-4 rounded-lg bg-gray-50 p-4 max-h-[600px] overflow-y-auto">
                    {chunks.map((chunk, index) => (
                      <div key={index} className="rounded-lg bg-white p-4 shadow-sm">
                        <h3 className="mb-2 text-sm font-semibold text-red-600">{chunk.title}</h3>
                        <p className="text-sm leading-relaxed text-gray-600">{chunk.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
