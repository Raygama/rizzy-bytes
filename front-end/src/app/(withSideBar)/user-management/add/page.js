"use client"

import { useState } from "react"
import { Eye, EyeOff, ChevronLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import Swal from "sweetalert2"

const roleDescriptions = {
  mahasiswa: "Limited access to course materials and personal profile.",
  staff: "Can manage course content and view student data.",
  administrator: "Full system access, user management, and settings.",
  guest: "View-only access to public resources.",
}

export default function AddNewUserPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [selectedRole, setSelectedRole] = useState("mahasiswa")

  const [formData, setFormData] = useState({
    fullname: "Muhammad Rifqy Khuzaini",
    email: "rifqykhuzaini@student.telkomuniversity.ac.id",
    password: "KetoprakGate3",
    confirmPassword: "KetoprakGate3",
    role: "mahasiswa",
  })

  const generateUsername = (fullname) => {
    const parts = fullname.toLowerCase().split(" ")
    if (parts.length === 1) return parts[0]
    return `${parts[0]}_${parts[parts.length - 1]}`
  }

  const getInitials = (fullname) => {
    const parts = fullname.split(" ")
    return parts
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const isNameProvided = formData.fullname.trim().length > 0
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)
  const isPasswordMatch = formData.password === formData.confirmPassword && formData.password.length > 0
  const isRoleSelected = !!selectedRole

  const allRequirementsMet = isNameProvided && isValidEmail && isPasswordMatch && isRoleSelected

  const handleDiscard = () => {
    setFormData({
      fullname: "Muhammad Rifqy Khuzaini",
      email: "rifqykhuzaini@student.telkomuniversity.ac.id",
      password: "KetoprakGate3",
      confirmPassword: "KetoprakGate3",
      role: "mahasiswa",
    })
    setSelectedRole("mahasiswa")
  }

  const handleCreateAccount = async () => {
    if (!allRequirementsMet) {
      Swal.fire("Error", "Please fill all required fields", "error")
      return
    }

    try {
      const token = localStorage.getItem("token")
      const response = await fetch("http://localhost:3001/auth/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          fullname: formData.fullname,
          email: formData.email,
          password: formData.password,
          role: formData.role,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || `Failed to create user: ${response.status}`)
      }

      Swal.fire("Success", "User created successfully", "success").then(() => {
        router.push("/user-management")
      })
    } catch (error) {
      console.error("Error creating user:", error)
      Swal.fire("Error", error.message || "Failed to create user", "error")
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] p-6 md:p-8 lg:p-12">
      <div className="mx-auto max-w-7xl">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="mb-6 inline-flex items-center gap-2 text-red-500 hover:text-red-600 transition-colors"
        >
          <ChevronLeft size={20} />
          <span className="text-sm font-medium">Back</span>
        </button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Add New User</h1>
          <p className="mt-2 text-sm text-gray-600">Fill details to create new user</p>
        </div>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Forms (60%) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Personal Information Card */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-5 text-lg font-semibold text-gray-900">Personal Information</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="fullname" className="mb-2 block text-sm font-medium text-gray-900">
                    Fullname
                  </label>
                  <input
                    type="text"
                    id="fullname"
                    value={formData.fullname}
                    onChange={(e) => setFormData({ ...formData, fullname: e.target.value })}
                    placeholder="Enter user's fullname"
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-medium text-gray-900">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Enter user's email"
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Security Card */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-5 text-lg font-semibold text-gray-900">Security</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="password" className="mb-2 block text-sm font-medium text-gray-900">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      id="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Enter user's password"
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-gray-900">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      id="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      placeholder="Re-enter user's password"
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Role Assignment Card */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-5 text-lg font-semibold text-gray-900">Role Assignment</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(roleDescriptions).map(([role, description]) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => {
                      setSelectedRole(role)
                      setFormData({ ...formData, role })
                    }}
                    className={`rounded-lg border-2 p-4 text-left transition-all ${
                      selectedRole === role
                        ? "border-red-500 bg-red-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <h3
                      className={`text-sm font-semibold capitalize ${selectedRole === role ? "text-red-600" : "text-gray-900"}`}
                    >
                      {role}
                    </h3>
                    <p className="mt-1 text-xs text-gray-600">{description}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Summary (40%) */}
          <div className="lg:col-span-1 space-y-6">
            {/* Account Summary Card */}
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sticky top-8">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Account Summary</h2>
                <div className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1">
                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  <span className="text-xs font-medium text-green-700">Live Preview</span>
                </div>
              </div>

              <div className="mb-6 text-center">
                <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full border-2 border-gray-300 bg-gray-100 text-lg font-bold text-gray-700">
                  {getInitials(formData.fullname) || "?"}
                </div>
                <h3 className="text-sm font-semibold capitalize text-red-600">{selectedRole}</h3>
              </div>

              <div className="mb-6 space-y-3 border-t border-gray-200 pt-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Fullname</span>
                  <span className="text-sm font-medium text-gray-900">{formData.fullname || "-"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Username</span>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                    {generateUsername(formData.fullname) || "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Email</span>
                  <span className="text-xs font-medium text-gray-700 text-right">{formData.email || "-"}</span>
                </div>
              </div>

              {/* Requirements */}
              <div className="space-y-3 border-t border-gray-200 pt-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-600">Requirements</h3>
                <div className="space-y-2">
                  <RequirementItem label="Name provided" met={isNameProvided} />
                  <RequirementItem label="Valid email format" met={isValidEmail} />
                  <RequirementItem label="Passwords match" met={isPasswordMatch} />
                  <RequirementItem label="Role selected" met={isRoleSelected} />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 space-y-3 border-t border-gray-200 pt-6">
                <button
                  onClick={handleCreateAccount}
                  disabled={!allRequirementsMet}
                  className={`w-full rounded-lg px-4 py-3 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
                    allRequirementsMet
                      ? "bg-red-500 text-white hover:bg-red-600"
                      : "bg-gray-200 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  <span>+</span> Create Account
                </button>
                <button
                  onClick={handleDiscard}
                  className="w-full rounded-lg bg-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-300"
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function RequirementItem({ label, met }) {
  return (
    <div className="flex items-center gap-2">
      <svg className={`h-4 w-4 ${met ? "text-green-500" : "text-gray-300"}`} fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      </svg>
      <span className={`text-xs ${met ? "text-green-600" : "text-gray-500"}`}>{label}</span>
    </div>
  )
}
