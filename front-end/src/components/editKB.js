"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, Save, X, Trash2 } from "lucide-react";
import { flowiseUrl } from "@/lib/apiConfig";

import Swal from "sweetalert2";

export default function EditKb({ isEditing, kbData, onClose, onUpdated }) {
  const loaderId = kbData?.loaderId;

  const [fileLoaderName, setFileLoaderName] = useState(kbData?.name ?? "");
  const [description, setDescription] = useState(kbData?.description ?? "");
  const [type, setType] = useState(kbData?.type ?? "");

  // chunks state
  const [chunks, setChunks] = useState([]);
  const [chunksLoading, setChunksLoading] = useState(false);
  const [chunksError, setChunksError] = useState("");
  const [deletingChunkIds, setDeletingChunkIds] = useState({});

  // chunk editor state
  const [chunkEditState, setChunkEditState] = useState({
    open: false,
    index: -1,
    chunk: null,
    pageContent: "",
    saving: false,
  });

  const resolveType = () => kbData?.type || type || "general";

  useEffect(() => {
    setFileLoaderName(kbData?.name ?? "");
    setDescription(kbData?.description ?? "");
    setType(kbData?.type ?? "");
  }, [kbData]);

  useEffect(() => {
    if (!isEditing) return;
    if (!loaderId) return;

    const fetchChunks = async () => {
      setChunksLoading(true);
      setChunksError("");

      try {
        const qpType = encodeURIComponent(resolveType());
        const res = await fetch(
          flowiseUrl(`/api/kb/loaders/${loaderId}/chunks?type=${qpType}`),
          {
            method: "GET",
            headers: {
              authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );

        if (!res.ok) throw new Error(`Failed to fetch chunks: ${res.status}`);

        const json = await res.json();
        const data = Array.isArray(json?.chunks) ? json.chunks : [];

        setChunks(data);
      } catch (err) {
        console.error(err);
        setChunksError("Failed to load chunks.");
        setChunks([]);
      } finally {
        setChunksLoading(false);
      }
    };

    fetchChunks();
  }, [isEditing, loaderId, kbData?.type, type]);

  /* =======================
     EDIT META (PATCH)
  ======================= */
  const handleSave = async () => {
    if (!loaderId) {
      alert("loaderId not found in kbData");
      return;
    }

    if (!fileLoaderName.trim()) {
      alert("File Loader Name is required");
      return;
    }

    try {
      const editData = {
        name: fileLoaderName,
        description: description,
        type: type,
      };

      const res = await fetch(flowiseUrl(`/api/kb/loaders/${loaderId}/meta`), {
        method: "PATCH",
        body: JSON.stringify(editData),
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!res.ok) throw new Error(`Update failed: ${res.status}`);

      if (typeof onUpdated === "function") {
        onUpdated({
          loaderId,
          name: fileLoaderName,
          description,
        });
      }

      onClose?.();
    } catch (err) {
      console.error(err);
      alert("Failed to save data");
    }
  };

  /* =======================
     CHUNK EDITOR
  ======================= */

  const getChunkText = (chunk) => {
    return (
      chunk?.pageContent ?? chunk?.content ?? chunk?.chunk ?? chunk?.data ?? ""
    );
  };

  const getChunkId = (chunk) => {
    return chunk?.chunkId ?? chunk?.id ?? chunk?._id ?? null;
  };

  const handleOpenChunkEditor = (chunk, index) => {
    const text = getChunkText(chunk);
    setChunkEditState({
      open: true,
      index,
      chunk,
      pageContent:
        typeof text === "string" ? text : JSON.stringify(text, null, 2),
      saving: false,
    });
  };

  const handleCloseChunkEditor = () => {
    setChunkEditState({
      open: false,
      index: -1,
      chunk: null,
      pageContent: "",
      saving: false,
    });
  };

  const handleSaveChunk = async () => {
    if (!loaderId) {
      alert("loaderId not found");
      return;
    }

    if (!chunkEditState.chunk) return;

    const chunkId = getChunkId(chunkEditState.chunk);
    if (!chunkId) {
      alert("chunkId not found");
      return;
    }

    const newText = chunkEditState.pageContent?.trim();
    if (!newText) {
      alert("Chunk content cannot be empty");
      return;
    }

    setChunkEditState((prev) => ({ ...prev, saving: true }));

    try {
      const qpType = encodeURIComponent(resolveType());
      const res = await fetch(
        flowiseUrl(`/api/kb/loaders/${loaderId}/chunks/${chunkId}?type=${qpType}`),
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({
            id: chunkId,
            docId: chunkEditState.chunk.docId,
            storeId: chunkEditState.chunk.storeId,
            chunkNo: chunkEditState.chunk.chunkNo,
            pageContent: newText,
            metadata: chunkEditState.chunk.metadata || {},
          }),
        }
      );

      if (!res.ok) throw new Error(`Patch chunk failed: ${res.status}`);

      let updatedChunk = null;
      try {
        updatedChunk = await res.json();
      } catch (_) {}

      setChunks((prev) => {
        const next = [...prev];
        const idx = chunkEditState.index;

        if (idx >= 0 && idx < next.length) {
          next[idx] = {
            ...next[idx],
            ...(updatedChunk && typeof updatedChunk === "object"
              ? updatedChunk
              : {}),
            pageContent: newText,
          };
        }
        return next;
      });

      handleCloseChunkEditor();
    } catch (err) {
      console.error(err);
      alert("Failed to save chunk");
      setChunkEditState((prev) => ({ ...prev, saving: false }));
    }
  };

  // delete chunk
  const markDeleting = (chunkId, isDeleting) => {
    setDeletingChunkIds((prev) => {
      const next = { ...prev };
      if (isDeleting) next[chunkId] = true;
      else delete next[chunkId];
      return next;
    });
  };

  const handleDeleteChunk = async (chunk, index) => {
    if (!loaderId) {
      alert("loaderId not found");
      return;
    }

    const chunkId = getChunkId(chunk);
    if (!chunkId) {
      alert("chunkId not found");
      return;
    }

    const ok = window.confirm(`Delete Chunk ${index + 1}?`);
    if (!ok) return;

    markDeleting(chunkId, true);

    try {
      const qpType = encodeURIComponent(resolveType());
      const res = await fetch(
        flowiseUrl(
          `/api/kb/loaders/${loaderId}/chunks/${chunkId}?type=${qpType}`
        ),
        {
          method: "DELETE",
          headers: {
            authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (!res.ok) throw new Error(`Delete chunk failed: ${res.status}`);

      setChunks((prev) => prev.filter((_, i) => i !== index));

      if (
        chunkEditState.open &&
        chunkEditState.chunk &&
        getChunkId(chunkEditState.chunk) === chunkId
      ) {
        handleCloseChunkEditor();
      }
    } catch (err) {
      console.error(err);
      alert("Failed to delete chunk");
    } finally {
      markDeleting(chunkId, false);
    }
  };

  if (!isEditing) return null;

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto">
      <div
        className="fixed inset-0 bg-black/30"
        aria-hidden
        onClick={onClose}
      />

      <div className="relative z-50 min-h-screen flex items-start justify-center py-10 px-4">
        <div className="w-full max-w-6xl rounded-2xl bg-[#F5F5F7] p-6 md:p-8 lg:p-12 shadow-xl">
          {/* Top Bar */}
          <div className="mb-8 flex items-center justify-between">
            <button
              onClick={onClose}
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
                onClick={onClose}
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
              <div className="space-y-6 rounded-lg bg-white p-6 shadow-sm max-h-96 overflow-y-auto">
                {chunksLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="border-b pb-6 last:border-b-0">
                      <div className="mb-2 h-4 w-24 rounded bg-gray-200" />
                      <div className="h-4 w-full rounded bg-gray-100" />
                      <div className="mt-2 h-4 w-5/6 rounded bg-gray-100" />
                    </div>
                  ))
                ) : chunksError ? (
                  <div className="text-sm text-gray-600">{chunksError}</div>
                ) : chunks.length === 0 ? (
                  <div className="text-sm text-gray-500">
                    No chunks found for this loader.
                  </div>
                ) : (
                  chunks.map((chunk, idx) => {
                    const text = getChunkText(chunk);
                    const preview =
                      typeof text === "string"
                        ? text.slice(0, 220)
                        : JSON.stringify(text).slice(0, 220);

                    const chunkId =
                      getChunkId(chunk) ?? chunk?.id ?? chunk?._id ?? idx;
                    const isDeleting = !!deletingChunkIds[getChunkId(chunk)];

                    return (
                      <div
                        key={chunkId}
                        className="relative border-b pb-6 last:border-b-0 rounded-lg hover:bg-gray-50 transition-colors p-2 -m-2"
                      >
                        <button
                          type="button"
                          onClick={() => handleOpenChunkEditor(chunk, idx)}
                          className="w-full text-left pr-12 focus:outline-none focus:ring-2 focus:ring-red-500 rounded-lg"
                          aria-label={`Edit chunk ${idx + 1}`}
                        >
                          <h3 className="mb-2 text-sm font-semibold text-red-500">
                            Chunk {idx + 1}
                          </h3>
                          <p className="text-sm text-gray-700">
                            {preview}
                            {typeof text === "string" && text.length > 220
                              ? "…"
                              : ""}
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteChunk(chunk, idx)}
                          disabled={isDeleting}
                          className="absolute top-2 right-2 rounded-md p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-60"
                          aria-label={`Delete chunk ${idx + 1}`}
                          title="Delete chunk"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chunk Editor Modal */}
      {chunkEditState.open && (
        <div className="fixed inset-0 z-[60]">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={handleCloseChunkEditor}
            aria-hidden
          />
          <div className="relative z-[70] flex justify-center items-center min-h-screen p-4">
            <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl border border-gray-200">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    Edit Chunk {chunkEditState.index + 1}
                  </h3>
                  <p className="text-xs text-gray-500">Update chunk content</p>
                </div>

                <button
                  onClick={handleCloseChunkEditor}
                  className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
                  aria-label="Close chunk editor"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="px-6 py-5">
                <label className="mb-2 block text-sm font-medium text-gray-900">
                  Chunk Content
                </label>
                <textarea
                  value={chunkEditState.pageContent}
                  onChange={(e) =>
                    setChunkEditState((prev) => ({
                      ...prev,
                      pageContent: e.target.value,
                    }))
                  }
                  rows={10}
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-red-500"
                  placeholder="Type chunk content..."
                />
              </div>

              <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-2xl">
                <button
                  onClick={handleCloseChunkEditor}
                  className="rounded-lg bg-gray-200 px-5 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-300"
                  disabled={chunkEditState.saving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveChunk}
                  className="rounded-lg bg-red-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-60"
                  disabled={chunkEditState.saving}
                >
                  {chunkEditState.saving ? "Saving..." : "Save Chunk"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
