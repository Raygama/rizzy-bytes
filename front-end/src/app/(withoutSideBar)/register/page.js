"use client";

// BARU: Impor useRouter untuk redirect setelah login
import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation"; // << BARU
import { authEndpoint } from "@/lib/authApi";

// MODIFIKASI: Sebaiknya nama komponen diawali huruf kapital
export default function Register() {
  // HAPUS: State activeIndex tidak digunakan di halaman register ini
  // const [activeIndex, setActiveIndex] = useState(0);

  const router = useRouter(); // Hook untuk redirect

  // State untuk menyimpan input form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password_confirm, setPasswordConfirm] = useState(""); // State ini sudah benar
  const [username, setUsername] = useState("");

  // State untuk menangani error dan loading
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Fungsi yang dipanggil saat form disubmit
  const handleSubmit = async (e) => {
    e.preventDefault(); // Mencegah form me-refresh halaman
    setError(""); // Bersihkan error lama

    // --- 1. VALIDASI PASSWORD (BARU) ---
    // Cek apakah password dan konfirmasi password sama
    if (password !== password_confirm) {
      setError("Password tidak sama. Silakan periksa kembali.");
      return; // Hentikan eksekusi jika password tidak sama
    }
    // --- AKHIR VALIDASI ---

    setIsLoading(true); // Mulai loading

    // MODIFIKASI: Data yang dikirim disesuaikan untuk registrasi
    const credentials = {
      email: email,
      usn: username,
      password: password,
      role: "student",
    };

    // Simulasi pemanggilan API
    try {
      // MODIFIKASI: Menggunakan AUTH_API_URL dan endpoint /register
      const response = await fetch(authEndpoint("/register"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        // Jika server merespon dengan error
        const data = await response.json();
        throw new Error(data.message || "Registrasi gagal");
      }

      // MODIFIKASI: Arahkan (redirect) pengguna ke halaman login setelah berhasil
      router.push("/");
    } catch (err) {
      // Tangkap error (baik dari fetch atau dari throw di atas)
      setError(err.message);
    } finally {
      // Apapun yang terjadi (berhasil atau gagal), hentikan loading
      setIsLoading(false);
    }
  };
  // --- BATAS AKHIR LOGIKA LOGIN ---

  return (
    <>
      <div className="flex items-center justify-around w-full h-screen">
        {/* Logo and welcome word (Tidak berubah) */}
        <div className="w-1/3 flex flex-col items-center">
          <div className="w-5/6">
            <Image
              src="/logo-fakultas.png"
              alt="Logo Fakultas"
              width={317}
              height={83}
            />
            <h1 className="font-bold text-4xl ">
              Selamat Datang di Chatbot Helpdesk Informatik
            </h1>
          </div>
        </div>

        {/* dividing line (Tidak berubah) */}
        <div className="border-l-2 h-2/3 border-black "></div>

        {/* Form Registrasi */}
        <form
          onSubmit={handleSubmit}
          className="w-1/3 grid grid-cols-2 gap-4 p-4 rounded-xl shadow-2xl"
        >
          {/* --- 2. JUDUL FORM (BARU) --- */}
          <h2 className="col-span-2 text-center text-3xl font-bold text-gray-900 mb-4">
            Create Account
          </h2>

          <div className="col-span-2 ">
            <label className="block text-lg">Email</label>
            <input
              type="email"
              placeholder="Enter your SSO email"
              className="border-1 border-gray-300 w-full p-2 rounded-md"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="col-span-2 ">
            <label className="block text-lg">Username</label>
            <input
              type="text"
              placeholder="Enter your Username"
              className="border-1 border-gray-300 w-full p-2 rounded-md"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="col-span-2 ">
            <label className="block text-lg">Password</label>
            <input
              type="password"
              placeholder="Enter your password"
              className="border-1 border-gray-300 w-full p-2 rounded-md"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="col-span-2 ">
            <label className="block text-lg">Retype Your Password</label>
            <input
              type="password"
              placeholder="Retype Your Password"
              className="border-1 border-gray-300 w-full p-2 rounded-md"
              value={password_confirm}
              // --- 3. PERBAIKAN BUG (MODIFIKASI) ---
              onChange={(e) => setPasswordConfirm(e.target.value)} // Diperbaiki dari setPassword
              required
            />
          </div>

          {/* MODIFIKASI: Dibuat span 2 agar rapi dan 'required' */}
          <div className="flex items-center col-span-2">
            <input type="checkbox" className="mr-2" required />
            <label>Accept T&C</label>
          </div>

          {/* BARU: Tampilkan pesan error jika ada */}
          {error && (
            <div className="col-span-2 text-center text-red-600">{error}</div>
          )}

          {/* MODIFIKASI: Ganti <Link> dengan button type="submit" */}
          <button
            type="submit"
            className="bg-[#BF0101] p-1 col-span-2 text-white text-lg rounded-md disabled:bg-gray-400"
            disabled={isLoading}
          >
            {/* MODIFIKASI: Ubah teks tombol */}
            {isLoading ? "Loading..." : "Register"}
          </button>
        </form>
      </div>
    </>
  );
}
