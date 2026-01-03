"use client";

import { useState, useRef, useEffect } from "react";
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";
import { authUrl } from "@/lib/apiConfig";

export default function VerifyPage() {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);

  const inputsRef = useRef([]);

  const router = useRouter();
  const [email, setEmail] = useState("");

  useEffect(() => {
    const storedEmail = sessionStorage.getItem("email");
    if (storedEmail) {
      setEmail(storedEmail);
    }
  }, []);

  const handleChange = (value, index) => {
    if (!/^[0-9]?$/.test(value)) return; // hanya angka

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // auto focus next
    if (value && index < 5) {
      inputsRef.current[index + 1].focus();
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputsRef.current[index - 1].focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const finalOtp = otp.join(""); // gabungkan 6 angka menjadi 1 string
    console.log("Final OTP:", finalOtp);
    console.log("Email:", email);

    try {
      console.log("Submitting OTP:", finalOtp);
      console.log("For email:", email);
      const res = await fetch(authUrl("/login/verify"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email,
          otp: finalOtp,
        }),
      });

      if (res.status !== 200) {
        throw new Error("Invalid OTP");
      } else {
        const data = await res.json();
        console.log("Response:", data);
        const token = data.token;

        if (token) {
          Cookies.set("token", token);
          localStorage.setItem("token", token);
        }

        router.push("/chat");
      }
    } catch (error) {
      console.log("VERIFY URL =", authUrl("/login/verify"));
      console.trace("TRACE verify call");

      console.error(error);
      alert("Invalid OTP, please try again.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8f7f7]">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-semibold mb-2">
          Masukkan Kode Autentikasi
        </h1>

        <p className="text-sm text-gray-600 mb-6">
          Kami telah mengirimkan kode autentikasi ke Email :
          <br />
          <span className="font-medium">{email}</span>
        </p>

        <form onSubmit={handleSubmit}>
          <div className="flex justify-center space-x-3 mb-6">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => (inputsRef.current[index] = el)}
                type="text"
                maxLength="1"
                value={digit}
                onChange={(e) => handleChange(e.target.value, index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
                className="w-12 h-12 rounded-md border border-gray-300 text-center text-xl outline-none focus:border-red-600"
              />
            ))}
          </div>

          <button
            type="submit"
            className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded-md"
          >
            Verifikasi Akun
          </button>
        </form>

        <p className="text-sm text-gray-600 mt-4">
          Tidak menerima kode?{" "}
          <span className="text-red-600 font-medium cursor-pointer">
            Kirim Ulang
          </span>{" "}
          (0:50)
        </p>
      </div>
    </div>
  );
}
