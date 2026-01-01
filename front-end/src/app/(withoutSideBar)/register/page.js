"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Eye, EyeOff } from "lucide-react"
import { authUrl } from "@/lib/apiConfig"

export default function RegisterPage() {
  const router = useRouter()

  const [email, setEmail] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [passwordConfirm, setPasswordConfirm] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")

    if (password !== passwordConfirm) {
      setError("Password tidak sama. Silakan periksa kembali.")
      return
    }

    setIsLoading(true)

    const credentials = {
      email: email,
      usn: username,
      password: password,
      role: "student",
    }

    try {
      const response = await fetch(authUrl("/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || "Registrasi gagal")
      }

      router.push("/login")
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center p-4">
      <div className="w-full max-w-[440px] bg-white rounded-xl shadow-md p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Informatics AI</h1>
          <p className="text-sm text-gray-500 mt-1">Telkom University</p>
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold text-gray-900">
            Create Account
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-[#4E4E4E]/5 focus:outline-none focus:ring-2 focus:ring-[#E53935]"
              required
            />
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-[#4E4E4E]/5 focus:outline-none focus:ring-2 focus:ring-[#E53935]"
              required
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-[#4E4E4E]/5 focus:outline-none focus:ring-2 focus:ring-[#E53935]"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500"
              >
                {showPassword ? <Eye /> : <EyeOff />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Retype Password
            </label>
            <div className="relative">
              <input
                type={showPasswordConfirm ? "text" : "password"}
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                placeholder="Retype your password"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 bg-[#4E4E4E]/5 focus:outline-none focus:ring-2 focus:ring-[#E53935]"
                required
              />
              <button
                type="button"
                onClick={() =>
                  setShowPasswordConfirm(!showPasswordConfirm)
                }
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500"
              >
                {showPasswordConfirm ? <Eye /> : <EyeOff />}
              </button>
            </div>
          </div>

          {/* Terms
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
            />
            Accept <span className="text-[#E53935]">Terms and Condition</span>
          </label> */}

          {error && (
            <p className="text-center text-red-600 text-sm">{error}</p>
          )}

          <button
            type="submit"
            className={"w-full py-3 rounded-full text-white bg-[#E53935] hover:bg-[#D32F2F] font-semibold"}
          >
            {isLoading ? "Loading..." : "Register"}
          </button>

          {/* Back to Login */}
          <div className="text-center">
            <Link href="/login" className="text-sm text-[#E53935] hover:underline">
              Already have an account? Login
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
