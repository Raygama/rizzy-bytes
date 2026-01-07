"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  Search,
} from "lucide-react";
import Swal from "sweetalert2";
import AddKbModal from "@/components/AddKbModal";
import EditKb from "@/components/editKB";
import { flowiseUrl } from "@/lib/apiConfig";

import { redirect } from "next/navigation";
import { jwtDecode } from "jwt-decode";

export default function KnowledgeBasePage() {
  const [dataKB, setDataKB] = useState([]);
  const [fetchStatus, setFetchStatus] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingData, setEditingData] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const pageSize = 5;

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredKB = dataKB.filter((entry) => {
    const fileName = (entry?.name ?? "").toString().toLowerCase();
    return fileName.includes(normalizedQuery);
  });

  const total = filteredKB.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, total);
  const pageData = filteredKB.slice(startIndex, endIndex);

  useEffect(() => {
    // setiap kali search berubah, balik ke halaman 1
    setCurrentPage(1);
  }, [searchQuery]);

  useEffect(() => {
    // kalau filter mengecil dan currentPage jadi out-of-range, adjust
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const getPaginationItems = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const raw = [
      1,
      2,
      3,
      totalPages,
      totalPages - 1,
      currentPage,
      currentPage - 1,
      currentPage + 1,
    ]
      .filter((n) => n >= 1 && n <= totalPages)
      .filter((n, i, arr) => arr.indexOf(n) === i)
      .sort((a, b) => a - b);

    const out = [];
    for (let i = 0; i < raw.length; i++) {
      const n = raw[i];
      if (i === 0) {
        out.push(n);
        continue;
      }
      const prev = raw[i - 1];
      if (n - prev === 1) out.push(n);
      else {
        out.push("…");
        out.push(n);
      }
    }

    // rapikan: kalau ada duplikat ellipsis berurutan
    return out.filter((item, idx) => !(item === "…" && out[idx - 1] === "…"));
  };

    useEffect(() => {
      if (!fetchStatus) return;
      const fetchDataKB = async () => {
        try {
          const response = await fetch(flowiseUrl("/api/kb/entries"), {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          });
          const result = await response.json();
          const fetchOnlySyncData = result;
          setDataKB(fetchOnlySyncData);
        } catch (error) {
          console.error("Error fetching knowledge base data:", error);
        } finally {
          setFetchStatus(false);
        }
      };
      fetchDataKB();
    }, [fetchStatus, setFetchStatus]);

  const handleAddNewEntry = () => {
    setShowAddModal(true);
  };

  const handleEditEntry = (entry) => {
    setEditingData(entry);
    setShowEditModal(true);
  };

  const handleDelete = async (loaderId) => {
    const confirm = await Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#9ca3af",
      confirmButtonText: "Yes, delete it!",
      cancelButtonText: "Cancel",
    });

    if (!confirm.isConfirmed) return;

    try {
      const res = await fetch(flowiseUrl(`/api/kb/loaders/${loaderId}`), {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Delete failed: ${res.status}`);
      }

      setDataKB((prev) => prev.filter((e) => e.loaderId !== loaderId));

      await Swal.fire({
        title: "Deleted!",
        text: "Your entry has been deleted.",
        icon: "success",
      });
    } catch (error) {
      console.error("Error deleting knowledge base entry:", error);
      Swal.fire({
        title: "Error",
        text: "Failed to delete entry. Please try again.",
        icon: "error",
      });
    }
  };

  const token = localStorage.getItem("token");
  if (
    jwtDecode(token)?.role.toLowerCase() !== "admin" &&
    jwtDecode(token)?.role.toLowerCase() !== "staff"
  )
    redirect("/chat");

  const paginationItems = getPaginationItems();

  return (
    <div className="relative min-h-screen bg-[#F5F5F7] p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header Section */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 md:text-3xl lg:text-4xl">
              Knowledge Base Management
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              View, Add, and Manage interconnected Q&A entries for the chatbot.
            </p>
          </div>
          <button
            onClick={handleAddNewEntry}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-red-500 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-red-600 transition-colors"
          >
            <Plus size={18} />
            Add New Entry
          </button>
        </div>

        {/* Search Bar */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search knowledge base by file name"
              className="w-full rounded-full border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        </div>

        {/* Table Card */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 md:px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                    ID
                  </th>
                  <th className="px-4 md:px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Name
                  </th>
                  <th className="hidden sm:table-cell px-4 md:px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Description
                  </th>
                  <th className="hidden lg:table-cell px-4 md:px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Type
                  </th>
                  <th className="hidden lg:table-cell px-4 md:px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Status
                  </th>
                  <th className="px-4 md:px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {total === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 md:px-6 py-32">
                      <div className="flex items-center justify-center">
                        <p className="text-sm text-gray-400">
                          You haven&apos;t input any data
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pageData.map((entry) => (
                    <tr
                      key={entry.kbId}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 md:px-6 py-4 text-xs md:text-sm text-gray-900">
                        {entry.kbId}
                      </td>
                      <td className="px-4 md:px-6 py-4 text-xs md:text-sm text-gray-900">
                        {entry.name}
                      </td>
                      <td className="hidden sm:table-cell px-4 md:px-6 py-4 text-xs md:text-sm text-gray-500">
                        {entry.description}
                      </td>
                      <td className="hidden lg:table-cell px-4 md:px-6 py-4 text-xs md:text-sm text-gray-500">
                        {entry.type === "ta"
                          ? "Tugas Akhir"
                          : entry.type === "kp"
                          ? "Kerja Praktik"
                          : entry.type === "tak"
                          ? "TAK"
                          : "General"}
                      </td>
                      <td className="hidden sm:table-cell px-4 md:px-6 py-4 text-xs md:text-sm text-gray-500">
                        {entry.status}
                      </td>
                      <td className="px-4 md:px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditEntry(entry)}
                            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                            aria-label="Edit entry"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(entry.loaderId)}
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
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-t border-gray-200 bg-white px-4 md:px-6 py-4">
            <div className="text-xs md:text-sm text-gray-500">
              {total === 0
                ? "Show 0 to 0 of 0 results"
                : `Show ${startIndex + 1} to ${endIndex} of ${total} results`}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex items-center justify-center text-gray-400 transition-colors hover:text-gray-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Previous page"
              >
                <ChevronLeft size={20} />
              </button>

              {paginationItems.map((item, idx) =>
                item === "…" ? (
                  <span
                    key={`ellipsis-${idx}`}
                    className="px-2 text-sm text-gray-500"
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={`page-${item}`}
                    onClick={() => setCurrentPage(item)}
                    className={
                      item === currentPage
                        ? "flex items-center justify-center rounded-sm bg-red-600 px-3 py-1 text-sm font-medium text-white"
                        : "flex items-center justify-center rounded-sm px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                    }
                    aria-label={`Page ${item}`}
                  >
                    {item}
                  </button>
                )
              )}

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center justify-center text-gray-400 transition-colors hover:text-gray-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Next page"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <AddKbModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdded={(newEntry) => {
          setShowAddModal(false);

          // realtime: langsung masuk ke tabel (di paling atas)
          setDataKB((prev) => {
            const exists = prev.some(
              (e) =>
                (newEntry?.loaderId && e.loaderId === newEntry.loaderId) ||
                (newEntry?.kbId && e.kbId === newEntry.kbId)
            );
            if (exists) return prev;

            return [newEntry, ...prev];
          });
          setFetchStatus(true);
        }}
      />

        <EditKb
          isEditing={showEditModal}
          kbData={editingData}
          onClose={() => {
            setShowEditModal(false);
            setEditingData(null);
          }}
          onUpdated={(updated) => {
            setDataKB((prev) =>
              prev.map((e) =>
                e.loaderId === updated.loaderId
                  ? {
                      ...e,
                      name: updated.name,
                      description: updated.description,
                    }
                  : e
              )
            );
            if (updated?.refresh) {
              setFetchStatus(true);
            }
            setShowEditModal(false);
            setEditingData(null);
          }}
        />
    </div>
  );
}
