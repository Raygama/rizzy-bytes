"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react"
import Swal from "sweetalert2"

export default function KnowledgeBasePage() {
  const router = useRouter()
  const [entries, setEntries] = useState([
    { id: "KB-001", question: "Placeholder", answer: "Placeholder" },
    { id: "KB-002", question: "Placeholder", answer: "Placeholder" },
    { id: "KB-003", question: "Placeholder", answer: "Placeholder" },
    { id: "KB-004", question: "Placeholder", answer: "Placeholder" },
    { id: "KB-005", question: "Placeholder", answer: "Placeholder" },
    { id: "KB-006", question: "Placeholder", answer: "Placeholder" },
    { id: "KB-007", question: "Placeholder", answer: "Placeholder" },
    { id: "KB-008", question: "Placeholder", answer: "Placeholder" },
    { id: "KB-009", question: "Placeholder", answer: "Placeholder" },
    { id: "KB-010", question: "Placeholder", answer: "Placeholder" },
  ])

  const handleAddNewEntry = () => {
    router.push("/withSideBar/knowledge-base/add")
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
        // Remove the entry from the list
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
                            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                            aria-label="Edit entry"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
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
    </div>
  )
}
