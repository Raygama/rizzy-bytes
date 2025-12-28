"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import Swal from "sweetalert2";
import EditKb from "@/components/editKB";

export default function KnowledgeBasePage() {
  const router = useRouter();
  const [dataKB, setDataKB] = useState([]);
  const [fetchStatus, setFetchStatus] = useState(true);
  const [editState, setEditState] = useState({
    isEditing: false,
    kbData: null,
  });
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
  ]);

  const handlePopup = (type, data = null) => {
    setEditState((prev) => ({
      ...prev,
      [type]: !prev[type],
      kbData: data,
    }));
  };

  const handleAddNewEntry = () => {
    router.push("/knowledge-base/add");
  };

  useEffect(() => {
    if (fetchStatus === true) {
      const fetchDataKB = async () => {
        try {
          const response = await fetch("http://localhost:4000/api/kb/entries", {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          });
          const result = await response.json();
          let fetchOnlySyncData = result.filter(
            (item) => item.status === "SYNC"
          );
          setDataKB(fetchOnlySyncData);
        } catch (error) {
          console.error("Error fetching knowledge base data:", error);
        }
      };
      fetchDataKB();
    }
  }, [fetchStatus, setFetchStatus]);

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
      const res = await fetch(
        `http://localhost:4000/api/kb/loaders/${loaderId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (!res.ok) {
        throw new Error(`Delete failed: ${res.status}`);
      }

      // ✅ update UI langsung
      setDataKB((prev) => prev.filter((e) => e.loaderId !== loaderId));

      await Swal.fire({
        title: "Deleted!",
        text: "Your entry has been deleted.",
        icon: "success",
        confirmButtonColor: "#ef4444",
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

  return (
    <div className="relative min-h-screen bg-[#F5F5F7] p-6 md:p-8 lg:p-12">
      <div className="mx-auto max-w-7xl">
        {/* Header Section */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 lg:text-4xl">
              Knowledge Base Management
            </h1>
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
                    Name
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Description
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Type
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {dataKB.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-32">
                      <div className="flex items-center justify-center">
                        <p className="text-sm text-gray-400">
                          You haven&apos;t input any data
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  dataKB.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {entry.kbId}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {entry.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {entry.description}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {entry.type}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handlePopup("isEditing", entry)}
                            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                            aria-label="Edit entry"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(entry.loaderId)}
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
            <div className="text-sm text-gray-500">
              Show 1 to 10 of 110 results
            </div>
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

      {/* Popup */}
      {editState.isEditing && (
        <EditKb
          isEditing={editState.isEditing}
          kbData={editState.kbData}
          onClose={() => handlePopup("isEditing")}
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
          }}
        />
      )}
    </div>
  );
}
