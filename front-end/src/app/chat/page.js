"use client";

// (BARU) Impor hook tambahan: useRef dan useEffect
import { useState, useRef, useEffect } from "react";
import { Menu, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";

// (BARU) Definisikan tipe pesan untuk kejelasan
// interface Message {
//   id: number;
//   text: string;
//   sender: 'user' | 'bot';
// }

export default function ChatbotPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // (MODIFIKASI) 'question' sekarang kita sebut 'input' agar konsisten
  const [input, setInput] = useState("");

  // (BARU) State untuk menyimpan semua pesan. Ini adalah KUNCI transformasinya.
  const [messages, setMessages] = useState([]);

  // (BARU) State untuk loading jawaban bot
  const [isLoading, setIsLoading] = useState(false);

  const quickActions = [
    "Cara menginput TAK terbaru",
    "Daftar nomor admin Theta",
    "Tata cara tanda tangan Kaprodi",
  ];

  // (BARU) Ref dan hook untuk auto-scroll ke pesan terbaru
  const messagesEndRef = useRef(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // (BARU) Fungsi placeholder untuk logika API backend Anda
  const getBotResponse = async (userMessage) => {
    // Simulasi penundaan API
    try {
      const response = await fetch(
        "http://localhost:3006/api/v1/prediction/2bdcfdde-326c-45bf-8996-434189d5c59e",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            authorization: "Bearer ikdPiO2FZzOMrrXJrCFHJColMQDeAnoZ0REgKq0KIbI",
          },
          body: JSON.stringify({ question: userMessage }),
        }
      );
      const data = await response.json();
      console.log(data);
      return data.text;
    } catch (error) {
      console.error("Error fetching bot response:", error);
    }

    // Nanti, ganti dengan logika fetch API Anda...
  };

  // (MODIFIKASI) Fungsi handleSend sekarang ASINKRON dan MENGELOLA PESAN
  const handleSend = async (e) => {
    // Jika 'e' adalah event (dari form), cegah reload.
    // Jika 'e' adalah string (dari quick action), e.preventDefault() tidak ada
    if (e && e.preventDefault) {
      e.preventDefault();
    }

    // Tentukan teks pesan: bisa dari argumen string atau dari state 'input'
    const userMessageText = typeof e === "string" ? e : input;

    // Jangan kirim jika kosong atau sedang loading
    if (!userMessageText.trim() || isLoading) return;

    // 1. Buat pesan pengguna
    const userMessage = {
      // Objek ini HARUS memiliki properti yang sama
      // dengan yang diharapkan oleh .map() Anda
      id: Date.now(), // <-- TAMBAHKAN ID UNIK
      text: userMessageText, // <-- GUNAKAN 'text' (bukan 'question')
      sender: "user", // <-- TAMBAHKAN SENDER
    };

    // 2. Tambahkan pesan pengguna ke state.
    //    INI AKAN MENTRIGGER "TRANSFORMASI" UI
    setMessages((prevMessages) => [...prevMessages, userMessage]);

    // 3. Kosongkan input dan set loading
    setInput("");
    setIsLoading(true);

    // 4. Dapatkan jawaban bot
    const botResponseText = await getBotResponse(userMessageText);
    const botMessage = {
      id: Date.now() + 1,
      text: botResponseText,
      sender: "bot",
    };

    // 5. Tambahkan jawaban bot dan matikan loading
    setMessages((prevMessages) => [...prevMessages, botMessage]);
    setIsLoading(false);
  };

  // (BARU) Fungsi untuk kembali ke layar selamat datang
  const handleClearChat = () => {
    setMessages([]);
  };

  return (
    // (MODIFIKASI) Pastikan layout flex-col mengisi seluruh tinggi layar
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar (Kode Anda, tidak berubah) */}
      <div
        className={`${
          sidebarOpen ? "w-64" : "w-16"
        } bg-gray-800 text-white transition-all duration-300 flex flex-col items-center py-6 fixed h-full left-0 top-0 z-40`}
      >
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors mb-8"
        >
          <Menu size={24} />
        </button>
        {sidebarOpen && (
          <nav className="flex-1 w-full px-4 space-y-4">
            {/* Navigation items can go here */}
          </nav>
        )}
        <div className="mt-auto text-sm font-bold">MK</div>
      </div>
      {/* (TAMBAHKAN KODE INI) Backdrop Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 transition-opacity duration-300"
        ></div>
      )}

      {/* Main Content */}
      {/* Main Content */}
      <div
        className={`ml-16 flex-1 transition-all duration-300 flex flex-col`} // <-- SELALU ml-16
      >
        {/* Header (Kode Anda, tidak berubah) */}
        <div className="bg-white border-b border-gray-200 px-8 py-6">
          <h1 className="text-2xl font-bold text-gray-900">Chatbot</h1>
        </div>

        {/* --- INI ADALAH LOGIKA TRANSFORMASI UTAMA --- */}

        {messages.length === 0 ? (
          // --- VIEW 1: LAYAR SELAMAT DATANG (Jika tidak ada pesan) ---
          <div className="flex-1 overflow-auto bg-white px-8 py-12 flex flex-col items-center justify-center">
            <div className="w-full max-w-2xl">
              {/* Welcome Message (Kode Anda) */}
              <div className="text-center mb-8">
                <p className="text-sm text-gray-500 mb-2">
                  Selamat datang Rifky Khuzaini!
                </p>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                  Apakah ada yang bisa saya bantu?
                </h2>
                <p className="text-sm text-gray-600">
                  Tuliskan pertanyaan anda dibawah
                </p>
              </div>

              {/* Quick Action Buttons (MODIFIKASI onClick) */}
              <div className="mb-8 flex flex-wrap gap-2 justify-center">
                {quickActions.map((action, index) => (
                  <button
                    key={index}
                    // (MODIFIKASI) Langsung panggil handleSend dengan teks aksi
                    onClick={() => handleSend(action)}
                    className="text-xs py-2 px-3 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 bg-white transition-colors"
                  >
                    {action}
                  </button>
                ))}
              </div>

              {/* Input Area (MODIFIKASI: bungkus dengan <form>) */}
              {/* (MODIFIKASI) onSubmit akan memanggil handleSend */}
              <form
                onSubmit={handleSend}
                className="border border-gray-300 rounded-lg p-4"
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Type your question here..."
                    value={input} // (MODIFIKASI) ganti 'question' jadi 'input'
                    onChange={(e) => setInput(e.target.value)} // (MODIFIKASI) ganti 'setQuestion' jadi 'setInput'
                    // (MODIFIKASI) Hapus onKeyPress, biarkan form yang menangani 'Enter'
                    className="flex-1 outline-none text-gray-700 placeholder-gray-400 bg-transparent"
                  />
                  <button
                    type="submit" // (MODIFIKASI) Tambahkan type="submit"
                    className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg transition-colors flex items-center justify-center"
                  >
                    <Send size={20} />
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : (
          // --- VIEW 2: TAMPILAN CHAT PENUH (Jika SUDAH ADA pesan) ---
          <>
            {/* Area Daftar Pesan */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-white">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.sender === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`p-3 rounded-lg shadow-md max-w-lg ${
                      msg.sender === "user"
                        ? "bg-red-500 text-white" // Bubble user
                        : "bg-gray-200 text-gray-800" // Bubble bot
                    }`}
                  >
                    {/* --- 2. INI PERUBAHAN UTAMANYA --- */}
                    {msg.sender === "bot" ? (
                      // Jika pesan dari BOT, gunakan ReactMarkdown
                      <ReactMarkdown className="chat-bubble prose prose-slate">
                        {msg.text}
                      </ReactMarkdown>
                    ) : (
                      // Jika pesan dari USER, tampilkan teks biasa
                      msg.text
                    )}
                  </div>
                </div>
              ))}

              {/* Indikator "Typing..." */}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="p-3 rounded-lg shadow-md bg-gray-200 text-gray-400">
                    Bot is typing...
                  </div>
                </div>
              )}
              {/* Ref untuk auto-scroll */}
              <div ref={messagesEndRef} />
            </div>

            {/* Area Input yang Terpisah (Pinned di Bawah) */}
            <div className="p-4 bg-white border-t border-gray-200">
              <form onSubmit={handleSend} className="flex items-center gap-3">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={isLoading}
                  placeholder="Type your question here..."
                  className="flex-grow p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="p-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-gray-400"
                >
                  <Send size={20} />
                </button>
              </form>
              <button
                onClick={handleClearChat}
                className="text-sm text-red-600 hover:underline mt-2 w-full text-center"
              >
                Clear Chat
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
