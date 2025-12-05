"use client";

import { useState, useRef, useEffect } from "react";
import { Menu, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";

export default function ChatbotPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false); // NEW

  const quickActions = [
    "Cara menginput TAK terbaru",
    "Daftar nomor admin Theta",
    "Tata cara tanda tangan Kaprodi",
  ];

  console.log("Token from cookie:", localStorage.getItem("token"));

  const messagesEndRef = useRef(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // ===================== AMBIL JAWABAN DARI BACKEND (JSON) =====================
  const getBotResponse = async (userMessage) => {
    try {
      const response = await fetch(
        "http://localhost:3006/api/v1/prediction/df8c77d6-4a6e-4483-8e83-2e6ff46fb17f",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            authorization: "Bearer TYZ8fobwREuqXvo70fL7wwgsu4aeWNmuVF80MhJJvrk",
          },
          body: JSON.stringify({ question: userMessage }),
        }
      );

      const data = await response.json();
      console.log("backend response:", data);

      // dari screenshot: field jawabannya ada di `text`
      return data.text || "";
    } catch (error) {
      console.error("Error fetching bot response:", error);
      return "Maaf, terjadi kesalahan saat mengambil jawaban dari server.";
    }
  };

  // ===================== STREAM LOKAL (TYPEWRITER EFFECT) =====================
  const streamTextToMessage = async (botId, fullText) => {
    // ubah ke array karakter (kalau mau per kata pakai fullText.split(" "))
    const chars = Array.from(fullText);
    for (let i = 0; i < chars.length; i++) {
      const chunk = chars[i];

      // update pesan bot dengan menambah karakter
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === botId ? { ...msg, text: msg.text + chunk } : msg
        )
      );

      // atur kecepatan efek streaming di sini (ms)
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  };

  // ===================== HANDLE SEND =====================
  const handleSend = async (e) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }

    const userMessageText = typeof e === "string" ? e : input;

    if (!userMessageText.trim() || isLoading) return;

    // 1. Tambah pesan user
    const userMessage = {
      id: Date.now(),
      text: userMessageText,
      sender: "user",
    };
    setMessages((prev) => [...prev, userMessage]);

    setInput("");
    setIsLoading(true);

    // 2. Tambah bubble bot kosong
    const botId = Date.now() + 1;
    const emptyBotMessage = {
      id: botId,
      text: "",
      sender: "bot",
    };
    setMessages((prev) => [...prev, emptyBotMessage]);

    // 3. Ambil full jawaban dari backend
    const fullText = await getBotResponse(userMessageText);

    // 4. Stream jawaban ke bubble bot
    await streamTextToMessage(botId, fullText);

    setIsLoading(false);
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  const handleLogout = () => {
    // Hapus token dari cookies
    Cookies.remove("token");
    // Redirect ke halaman login
    window.location.href = "/login";
  };

  const decode = jwtDecode(localStorage.getItem("token"));
  const username = decode?.usn || "User";
  const role = decode?.role || "Guest";
  return (
    <div className="flex h-screen bg-[#F5F5F7] text-gray-900">
      {/* ===== LEFT SIDEBAR ===== */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* App title */}
        <div className="px-6 pt-6 pb-4">
          <h1 className="text-lg font-semibold tracking-tight">
            Informatics AI
          </h1>
        </div>

        {/* Nav */}
        <nav className="px-3 space-y-1">
          {/* Chat (active) */}
          <button
            type="button"
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-red-100 text-red-600 text-sm font-medium"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-red-500 text-white">
              <Menu size={16} />
            </span>
            <span>Chat</span>
          </button>

          {/* Setting (dummy) */}
          <button
            type="button"
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-gray-600 hover:bg-gray-100 text-sm font-medium"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gray-200 text-gray-700">
              ⚙
            </span>
            <span>Setting</span>
          </button>
        </nav>

        {/* Logout */}
        <div className="mt-auto px-3 pb-4 pt-6 space-y-3">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-gray-600 hover:bg-gray-100 text-sm font-medium"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gray-200 text-gray-700">
              ⏻
            </span>
            <span>Logout</span>
          </button>

          {/* User card */}
          <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-gray-50 border border-gray-200">
            <div className="h-9 w-9 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-semibold">
              MR
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold">{username}</span>
              <span className="text-[11px] text-gray-500">{role}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ===== RIGHT MAIN AREA ===== */}
      <main className="flex-1 flex flex-col bg-[#FAFAFB]">
        {messages.length === 0 ? (
          /* ========= EMPTY STATE (WELCOME) ========= */
          <div className="flex-1 flex flex-col items-center justify-center px-4">
            <div className="w-full max-w-3xl text-center space-y-10">
              {/* Greeting */}
              <div className="space-y-3">
                <p className="text-sm text-gray-500">Informatics AI</p>
                <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
                  Hello Rifqy, How Can We Help You?
                </h2>
              </div>

              {/* Quick actions */}
              <div className="flex flex-wrap justify-center gap-3">
                {quickActions.map((action, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSend(action)}
                    className="px-5 py-3 rounded-2xl bg-white border border-gray-200 shadow-sm text-sm text-gray-800 hover:bg-gray-50 transition-colors"
                  >
                    {action}
                  </button>
                ))}
              </div>

              {/* Input area */}
              <div className="mt-8 flex flex-col items-center gap-3">
                <form
                  onSubmit={handleSend}
                  className="w-full max-w-xl bg-white rounded-3xl border border-gray-200 shadow-sm px-4 py-2 flex items-center gap-3"
                >
                  <input
                    type="text"
                    placeholder="Type your question here..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    className="flex-1 border-none outline-none bg-transparent text-sm text-gray-800 placeholder:text-gray-400"
                  />
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="h-9 w-9 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white disabled:bg-gray-400"
                  >
                    <Send size={16} />
                  </button>
                </form>
                <p className="text-[11px] text-gray-400">
                  Chatbot may produce inaccurate information about people,
                  places, or facts.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* ========= CHAT STATE ========= */
          <>
            {/* Chat messages */}
            <div className="flex-1 flex flex-col items-center px-4 pt-6 pb-3 overflow-y-auto">
              <div className="w-full max-w-3xl space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.sender === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`px-4 py-3 rounded-2xl shadow-sm max-w-[80%] text-sm ${
                        msg.sender === "user"
                          ? "bg-red-500 text-white rounded-br-none"
                          : "bg-white text-gray-800 border border-gray-200 rounded-bl-none"
                      }`}
                    >
                      {msg.sender === "bot" ? (
                        <ReactMarkdown className="prose prose-slate prose-sm max-w-none">
                          {msg.text}
                        </ReactMarkdown>
                      ) : (
                        msg.text
                      )}
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="px-4 py-2 rounded-2xl bg-white border border-gray-200 text-xs text-gray-400">
                      Bot is typing...
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Input bottom */}
            <div className="border-t border-gray-200 bg-[#FAFAFB] px-4 py-3">
              <div className="w-full max-w-3xl mx-auto space-y-2">
                <form
                  onSubmit={handleSend}
                  className="bg-white rounded-3xl border border-gray-200 shadow-sm px-4 py-2 flex items-center gap-3"
                >
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={isLoading}
                    placeholder="Type your question here..."
                    className="flex-1 border-none outline-none bg-transparent text-sm text-gray-800 placeholder:text-gray-400"
                  />
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="h-9 w-9 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white disabled:bg-gray-400"
                  >
                    <Send size={16} />
                  </button>
                </form>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-gray-400">
                    Chatbot may produce inaccurate information about people,
                    places, or facts.
                  </p>
                  <button
                    type="button"
                    onClick={handleClearChat}
                    className="text-[11px] text-red-500 hover:underline"
                  >
                    Clear chat
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
