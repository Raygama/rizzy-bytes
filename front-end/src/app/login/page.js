"use client";

// BARU: Impor useRouter untuk redirect setelah login
import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation"; // << BARU
import Link from "next/link";

export default function Login() {
  const [activeIndex, setActiveIndex] = useState(0);
  const AUTH_API_URL =
    process.env.NEXT_PUBLIC_AUTH_API_URL || "http://localhost:3001";
  // --- LOGIKA LOGIN (BARU) ---
  const router = useRouter(); // BARU: Hook untuk redirect

  // BARU: State untuk menyimpan input form
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // BARU: State untuk menangani error dan loading
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // BARU: Fungsi yang dipanggil saat form disubmit
  const handleSubmit = async (e) => {
    e.preventDefault(); // Mencegah form me-refresh halaman
    setIsLoading(true); // Mulai loading
    setError(""); // Bersihkan error lama

    // Tentukan data yang akan dikirim berdasarkan tab yang aktif
    const credentials = {
      identifier: activeIndex === 0 ? email : username,
      password: password,
    };

    // Simulasi pemanggilan API
    try {
      // POST to the authentication-service (use env var or fallback)
      const response = await fetch(`http://localhost:3001/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        // Jika server merespon dengan error (misal: 401 Unauthorized)
        const data = await response.json();
        throw new Error(data.message || "Email atau password salah");
      }

      // Jika login berhasil (server merespon OK)
      // const data = await response.json(); // Mungkin Anda dapat token di sini

      // Arahkan (redirect) pengguna ke halaman chat
      if (activeIndex === 0) {
        sessionStorage.setItem("email", email); // simpan email di sessionStorage buat otp
        router.push("/otp");
      } else {
        router.push("/chat");
      }
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

        {/* MODIFIKASI: 
          Bungkus form dengan tag <form> dan tambahkan onSubmit={handleSubmit} 
        */}
        <form
          onSubmit={handleSubmit}
          className="w-1/3 grid grid-cols-2 gap-4 p-4 rounded-xl shadow-2xl"
        >
          <p className="col-span-2 text-center">
            Silahkan Pilih Tipe Pengguna Anda
          </p>
          <button
            type="button" // MODIFIKASI: ubah ke type="button" agar tidak mensubmit form
            className={`p-1 text-lg rounded-md ${
              activeIndex === 0
                ? "bg-[#BF0101] text-white"
                : "bg-white text-black border border-gray-300"
            }`}
            onClick={() => {
              setActiveIndex(0);
              setError(""); // BARU: bersihkan error saat ganti tab
            }}
          >
            Civitas Telkom
          </button>

          <button
            type="button" // MODIFIKASI: ubah ke type="button"
            className={`p-1 text-lg rounded-md ${
              activeIndex === 1
                ? "bg-[#BF0101] text-white"
                : "bg-white text-black border border-gray-300"
            }`}
            onClick={() => {
              setActiveIndex(1);
              setError(""); // BARU: bersihkan error saat ganti tab
            }}
          >
            Tamu
          </button>

          <div className="col-span-2 ">
            {activeIndex === 0 ? (
              <div>
                <label className="block text-lg">Email</label>
                <input
                  type="email"
                  placeholder="Enter your SSO email"
                  className="border-1 border-gray-300 w-full p-2 rounded-md"
                  value={email} // MODIFIKASI: hubungkan ke state
                  onChange={(e) => setEmail(e.target.value)} // MODIFIKASI: hubungkan ke state
                  required // BARU: tambahkan validasi dasar
                />
              </div>
            ) : (
              <div>
                <label className="block text-lg">Username</label>
                <input
                  type="text" // MODIFIKASI: ganti type jadi 'text'
                  placeholder="Enter your Username"
                  className="border-1 border-gray-300 w-full p-2 rounded-md"
                  value={username} // MODIFIKASI: hubungkan ke state
                  onChange={(e) => setUsername(e.target.value)} // MODIFIKASI: hubungkan ke state
                  required // BARU: tambahkan validasi dasar
                />
              </div>
            )}
          </div>
          <div className="col-span-2 ">
            <label className="block text-lg">Password</label>
            <input
              type="password"
              placeholder="Enter your password"
              className="border-1 border-gray-300 w-full p-2 rounded-md"
              value={password} // MODIFIKASI: hubungkan ke state
              onChange={(e) => setPassword(e.target.value)} // MODIFIKASI: hubungkan ke state
              required // BARU: tambahkan validasi dasar
            />
          </div>
          <div className="flex items-center">
            <input type="checkbox" className="mr-2" />
            <label>Remember Me</label>
          </div>

          <Link href="/register" className="text-right align-top">
            Create Account
          </Link>

          {/* BARU: Tampilkan pesan error jika ada */}
          {error && (
            <div className="col-span-2 text-center text-red-600">{error}</div>
          )}

          {/* MODIFIKASI: Ganti <Link> dengan button type="submit" */}
          <button
            type="submit" // MODIFIKASI: ganti jadi type="submit"
            className="bg-[#BF0101] p-1 col-span-2 text-white text-lg rounded-md disabled:bg-gray-400" // BARU: style untuk disabled
            disabled={isLoading} // BARU: nonaktifkan tombol saat loading
          >
            {/* BARU: ubah teks saat loading */}
            {isLoading ? "Loading..." : "Login"}
          </button>
        </form>
      </div>
    </>
  );
}
