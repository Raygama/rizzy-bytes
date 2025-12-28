"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Upload, Save, X, FileText } from "lucide-react";

export default function EditKb({ isEditing, kbData, onClose, onUpdated }) {
  const loaderId = kbData?.loaderId;

  const [fileLoaderName, setFileLoaderName] = useState(kbData?.name ?? "");
  const [description, setDescription] = useState(kbData?.description ?? "");
  const [type, setType] = useState(kbData?.type ?? "");
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // chunks state
  const [chunks, setChunks] = useState([]);
  const [chunksLoading, setChunksLoading] = useState(false);
  const [chunksError, setChunksError] = useState("");

  // chunk editor state
  const [chunkEditState, setChunkEditState] = useState({
    open: false,
    index: -1,
    chunk: null,
    pageContent: "",
    saving: false,
  });

  const fileInputRef = useRef(null);

  // reset fields when kbData changes
  useEffect(() => {
    setFileLoaderName(kbData?.name ?? "");
    setDescription(kbData?.description ?? "");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [kbData]);

  // FETCH CHUNKS (GET)
  useEffect(() => {
    if (!isEditing) return;
    if (!loaderId) return;

    const fetchChunks = async () => {
      setChunksLoading(true);
      setChunksError("");

      try {
        const res = await fetch(
          `http://localhost:4000/api/kb/loaders/${loaderId}/chunks`,
          {
            method: "GET",
            headers: {
              authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );

        if (!res.ok) throw new Error(`Failed to fetch chunks: ${res.status}`);

        const json = await res.json();

        // kamu bilang response: { chunks: [...] }
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
  }, [isEditing, loaderId]);

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
    handleFileSelect(e.target.files?.[0]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files?.[0]);
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

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

      // NOTE: kamu sebelumnya ada formData.append("file") tapi formData ga dibuat.
      // Kalau backend meta pakai JSON, file upload harus endpoint lain / multipart.
      // Untuk sekarang aku fokus PATCH meta JSON dulu.

      const res = await fetch(
        `http://localhost:4000/api/kb/loaders/${loaderId}/meta`,
        {
          method: "PATCH",
          body: JSON.stringify(editData),
          headers: {
            "Content-Type": "application/json",
            authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

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
    // sesuaikan kalau nanti field chunk kamu beda
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

  // Dummy PATCH API (nanti kamu ganti ke endpoint asli)

  const handleSaveChunk = async () => {
    console.log("SAVE CHUNK CLICKED", {
      loaderId,
      chunk: chunkEditState.chunk,
      text: chunkEditState.pageContent,
    });

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
      const res = await fetch(
        `http://localhost:4000/api/kb/loaders/${loaderId}/chunks/${chunkId}`,
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
            pageContent: newText, // <-- kalau backend pakai field lain, ganti di sini
            metadata: chunkEditState.chunk.metadata || {},
          }),
        }
      );

      if (!res.ok) throw new Error(`Patch chunk failed: ${res.status}`);

      // optional: kalau API ngembaliin chunk terbaru, bisa dipakai
      let updatedChunk = null;
      try {
        updatedChunk = await res.json();
      } catch (_) {
        // kalau PATCH tidak mengembalikan JSON, aman diabaikan
      }

      // ✅ update state chunks real-time
      setChunks((prev) => {
        const next = [...prev];
        const idx = chunkEditState.index;

        if (idx >= 0 && idx < next.length) {
          next[idx] = {
            ...next[idx],
            ...(updatedChunk && typeof updatedChunk === "object"
              ? updatedChunk
              : {}),
            pageContent: newText, // pastikan tampilan langsung berubah
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

  if (!isEditing) return null;

  return (
    <div className="absolute inset-0 z-40">
      <div
        className="absolute inset-0 bg-black/30"
        aria-hidden
        onClick={onClose}
      />

      <div className="relative z-50 flex justify-center overflow-y-auto py-10 px-4">
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
                    <p className="mb-6 text-sm text-gray-500">
                      or click to browse (optional on edit)
                    </p>

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

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900">
                    Type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:ring-2 focus:ring-red-500"
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
            </div>

            {/* RIGHT */}
            <div className="lg:col-span-7">
              <div className="space-y-6 rounded-lg bg-white p-6 shadow-sm">
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

                    return (
                      <button
                        type="button"
                        key={chunk?.id ?? chunk?._id ?? idx}
                        onClick={() => handleOpenChunkEditor(chunk, idx)}
                        className="w-full text-left pb-6 last:border-b-0 rounded-lg hover:bg-gray-50 transition-colors p-2 -m-2 focus:outline-none focus:ring-2 focus:ring-red-500"
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
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =======================
          POPUP EDIT CHUNK
      ======================= */}
      {chunkEditState.open && (
        <div className="absolute inset-0 z-[60]">
          <div
            className="absolute inset-0 bg-black/40"
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
                  <p className="text-xs text-gray-500">
                    Update chunk content (dummy save for now)
                  </p>
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
