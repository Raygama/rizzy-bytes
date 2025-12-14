"use client"

import { useState } from "react"
import { Plus, ChevronLeft, ChevronRight, Trash2, Search, X } from "lucide-react"
import Swal from "sweetalert2"

export default function UserManagementPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("all")
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState({
    fullname: "",
    email: "",
    role: "mahasiswa",
  })

  const [users, setUsers] = useState([
    {
      id: 1,
      initials: "HA",
      name: "Harits Arkaan",
      email: "haritsarkaan@student.telkomuniversity.ac.id",
      role: "Administrator",
      status: "Active",
    },
    {
      id: 2,
      initials: "AA",
      name: "Abbiyu Abdurrafi",
      email: "abbiyuabdurrafi@student.telkomuniversity.ac.id",
      role: "Mahasiswa",
      status: "Active",
    },
    {
      id: 3,
      initials: "RP",
      name: "Rangga Aldora Permadi",
      email: "ranggaaldora@student.telkomuniversity.ac.id",
      role: "Mahasiswa",
      status: "Active",
    },
    {
      id: 4,
      initials: "MR",
      name: "Muhammad Rifqy Khuzaini",
      email: "rifqykhuzaini@student.telkomuniversity.ac.id",
      role: "Mahasiswa",
      status: "Active",
    },
    {
      id: 5,
      initials: "MD",
      name: "M Daffa Raygama",
      email: "daffaragama@student.telkomuniversity.ac.id",
      role: "Staff",
      status: "Active",
    },
  ])

  const handleAddNewEntry = () => {
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setFormData({ fullname: "", email: "", role: "mahasiswa" })
  }

  const handleCreate = () => {
    console.log("Creating user:", formData)
    // TODO: Implement create user logic
    handleCloseModal()
  }

  const handleRoleSelect = (role) => {
    setFormData({ ...formData, role })
  }

  const handleDeleteUser = (userId, userName) => {
    Swal.fire({
      title: "Are you sure?",
      text: `Do you want to delete ${userName}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#9ca3af",
      confirmButtonText: "Yes, delete it!",
      cancelButtonText: "Cancel",
    }).then((result) => {
      if (result.isConfirmed) {
        // Remove the user from the list
        setUsers(users.filter((user) => user.id !== userId))
        Swal.fire({
          title: "Deleted!",
          text: "User has been deleted.",
          icon: "success",
          confirmButtonColor: "#ef4444",
        })
      }
    })
  }

  return (
    <>
      <div className="min-h-screen bg-[#F5F5F7] p-6 md:p-8 lg:p-12">
        <div className="mx-auto max-w-7xl">
          {/* Header Section */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 lg:text-4xl">User Management</h1>
            <p className="mt-2 text-sm text-gray-500">Manage User Across The System</p>
          </div>

          {/* Search Bar and Add Button */}
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search user by username or Email"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-full border border-gray-300 bg-white py-2.5 pl-11 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors"
              />
            </div>
            <button
              onClick={handleAddNewEntry}
              className="inline-flex items-center gap-2 rounded-full bg-red-500 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-red-600 transition-colors"
            >
              <Plus size={18} />
              Add New Entry
            </button>
          </div>

          {/* Tab Filters */}
          <div className="mb-6 flex items-center gap-3">
            <button
              onClick={() => setActiveTab("all")}
              className={`rounded-full px-6 py-2 text-sm font-medium transition-colors ${
                activeTab === "all" ? "bg-red-500 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              All Users
            </button>
            <button
              onClick={() => setActiveTab("active")}
              className={`rounded-full px-6 py-2 text-sm font-medium transition-colors ${
                activeTab === "active" ? "bg-red-500 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setActiveTab("unactive")}
              className={`rounded-full px-6 py-2 text-sm font-medium transition-colors ${
                activeTab === "unactive" ? "bg-red-500 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              Unactive
            </button>
          </div>

          {/* User List */}
          <div className="space-y-3">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-4 flex-1">
                  {/* Avatar */}
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-700">
                    {user.initials}
                  </div>

                  {/* Name and Email */}
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-gray-900">{user.name}</h3>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>

                  {/* Role */}
                  <div className="hidden md:block text-sm text-gray-600 w-32">{user.role}</div>

                  {/* Status */}
                  <div className="hidden md:flex items-center gap-2 w-24">
                    <div className="h-2 w-2 rounded-full bg-green-500"></div>
                    <span className="text-sm text-gray-700">{user.status}</span>
                  </div>
                </div>

                {/* Delete Button */}
                <button
                  onClick={() => handleDeleteUser(user.id, user.name)}
                  className="ml-4 rounded-lg p-2 text-red-500 hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                  aria-label="Delete user"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>

          {/* Footer / Pagination */}
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-500">Show 1 to 5 of 110 users</div>
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

      {/* Add New User Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
          onClick={handleCloseModal}
        >
          <div
            className="relative w-full max-w-4xl rounded-3xl bg-white p-8 md:p-12 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={handleCloseModal}
              className="absolute right-6 top-6 text-red-500 hover:text-red-600 transition-colors"
              aria-label="Close modal"
            >
              <X size={24} strokeWidth={2} />
            </button>

            {/* Modal Header */}
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900">Add New User</h2>
              <p className="mt-2 text-sm text-gray-600">Fill details to create new user</p>
            </div>

            {/* Form */}
            <div className="space-y-6">
              {/* Fullname */}
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
                  className="w-full rounded-2xl border border-gray-300 bg-white px-5 py-4 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors"
                />
              </div>

              {/* Email Address */}
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
                  className="w-full rounded-2xl border border-gray-300 bg-white px-5 py-4 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors"
                />
              </div>

              {/* Role Selection */}
              <div>
                <label className="mb-3 block text-sm font-medium text-gray-900">Role</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    type="button"
                    onClick={() => handleRoleSelect("mahasiswa")}
                    className={`rounded-2xl px-6 py-4 text-base font-semibold transition-all ${
                      formData.role === "mahasiswa"
                        ? "bg-red-500 text-white shadow-md"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    Mahasiswa
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRoleSelect("staff")}
                    className={`rounded-2xl px-6 py-4 text-base font-semibold transition-all ${
                      formData.role === "staff"
                        ? "bg-red-500 text-white shadow-md"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    Staff
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRoleSelect("administrator")}
                    className={`rounded-2xl px-6 py-4 text-base font-semibold transition-all ${
                      formData.role === "administrator"
                        ? "bg-red-500 text-white shadow-md"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    Administrator
                  </button>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-8 flex items-center justify-end gap-4">
              <button
                onClick={handleCloseModal}
                className="rounded-full bg-gray-300 px-8 py-3 text-base font-semibold text-gray-800 hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="inline-flex items-center gap-2 rounded-full bg-red-500 px-8 py-3 text-base font-semibold text-white hover:bg-red-600 transition-colors"
              >
                <Plus size={20} />
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
