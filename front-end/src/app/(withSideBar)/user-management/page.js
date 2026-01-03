"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Search,
  X,
} from "lucide-react";
import Swal from "sweetalert2";
import { authUrl } from "@/lib/apiConfig";

import { redirect } from "next/navigation";
import { jwtDecode } from "jwt-decode";

export default function UserManagementPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    fullname: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "student",
  });

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState("");

  // =========================
  // GET ALL USERS
  // =========================
  useEffect(() => {
    const fetchUsers = async () => {
      setLoadingUsers(true);
      setUsersError("");

      try {
        const token = localStorage.getItem("token");

        const res = await fetch(authUrl("/users"), {
          method: "GET",
          headers: {
            // kalau ga butuh auth, hapus 2 baris ini
            Authorization: token ? `Bearer ${token}` : "",
          },
        });

        // biar enak debug kalau backend balikin non-JSON
        const raw = await res.text();
        if (!res.ok) throw new Error(`GET /user failed: ${res.status} ${raw}`);

        const json = raw ? JSON.parse(raw) : null;

        // fleksibel: kalau response kamu array langsung atau dibungkus field tertentu
        const arr = Array.isArray(json)
          ? json
          : Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json?.users)
          ? json.users
          : [];

        // map ke shape UI kamu
        const mapped = arr.map((u, idx) => {
          const name = u.fullname || u.name || u.usn || "Unknown";
          const email = u.email || "-";
          const role = u.role || "User";
          const status =
            u.status || (u.isActive === false ? "OFFLINE" : "ONLINE");

          // initials
          const initials = name
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((w) => w[0].toUpperCase())
            .join("");

          return {
            id: u.id ?? u._id ?? u.userId ?? idx + 1,
            initials: initials || "U",
            name,
            email,
            role: typeof role === "string" ? role : String(role),
            status: typeof status === "string" ? status : String(status),
            // simpan raw kalau kamu butuh field lain nanti
            _raw: u,
          };
        });

        setUsers(mapped);
      } catch (err) {
        console.error(err);
        setUsersError("Failed to load users.");
        setUsers([]);
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsers();
  }, []);

  // =========================
  // UI HELPERS (FILTER)
  // =========================
  const filteredUsers = users.filter((u) => {
    const q = searchQuery.trim().toLowerCase();
    const matchQuery =
      !q ||
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q);

    const status = (u.status || "").toLowerCase();
    const matchTab =
      activeTab === "all"
        ? true
        : activeTab === "ONLINE"
        ? status === "online"
        : status === "offline";

    return matchQuery && matchTab;
  });

  const handleAddNewEntry = () => {
    router.push("/user-management/add");
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setFormData({
      fullname: "",
      email: "",
      password: "",
      confirmPassword: "",
      role: "mahasiswa",
    });
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const handleCreate = () => {
    console.log("Creating user:", formData);
    // TODO: Implement create user logic
    handleCloseModal();
  };

  const handleRoleSelect = (role) => setFormData({ ...formData, role });

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
        const deleteUser = async () => {
          const targetId = userId ?? null;
          if (!targetId) {
            Swal.fire("Error", "User id not found.", "error");
            return;
          }
          try {
            const response = await fetch(authUrl(`/users/${targetId}`), {
              method: "DELETE",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${localStorage.getItem("token")}`,
              },
            });
          } catch (error) {
            console.error("Error deleting user:", error);
            Swal.fire("Error", "Failed to delete user.", "error");
            return;
          }
          setUsers(users.filter((u) => u.id !== targetId));
          Swal.fire("Deleted!", "User has been deleted.", "success");
        };
        deleteUser();
      }
    });
  };

  const token = localStorage.getItem("token");
  if (jwtDecode(token)?.role.toLowerCase() !== "admin") redirect("/chat");

  return (
    <>
      <div className="min-h-screen bg-[#F5F5F7] p-6 md:p-8 lg:p-12">
        <div className="mx-auto max-w-7xl">
          {/* Header Section */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 lg:text-4xl">
              User Management
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              monitor registered users on your system
            </p>
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
              Add New User
            </button>
          </div>

          {/* Tab Filters */}
          <div className="mb-6 flex items-center gap-3">
            <button
              onClick={() => setActiveTab("all")}
              className={`rounded-full px-6 py-2 text-sm font-medium transition-colors ${
                activeTab === "all"
                  ? "bg-red-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              All Users
            </button>
            <button
              onClick={() => setActiveTab("ONLINE")}
              className={`rounded-full px-6 py-2 text-sm font-medium transition-colors ${
                activeTab === "ONLINE"
                  ? "bg-red-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              ONLINE
            </button>
            <button
              onClick={() => setActiveTab("OFFLINE")}
              className={`rounded-full px-6 py-2 text-sm font-medium transition-colors ${
                activeTab === "OFFLINE"
                  ? "bg-red-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              OFFLINE
            </button>
          </div>

          {/* User List */}
          <div className="space-y-3">
            {loadingUsers ? (
              <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-sm">
                Loading users...
              </div>
            ) : usersError ? (
              <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-red-500 shadow-sm">
                {usersError}
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-sm">
                No users found.
              </div>
            ) : (
              filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-700">
                      {user.initials}
                    </div>

                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-gray-900">
                        {user.name}
                      </h3>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>

                    <div className="hidden md:block text-sm text-gray-600 w-32">
                      {user.role}
                    </div>

                    <div className="hidden md:flex items-center gap-2 w-24">
                      <div
                        className={`h-2 w-2 rounded-full ${
                          String(user.status).toLowerCase() === "online"
                            ? "bg-green-500"
                            : "bg-gray-400"
                        }`}
                      />
                      <span className="text-sm text-gray-700">
                        {user.status}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      handleDeleteUser(user.id ?? user._raw?._id, user.name)
                    }
                    className="ml-4 rounded-lg p-2 text-red-500 hover:bg-red-50 transition-colors focus:outline-none"
                    aria-label="Delete user"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer / Pagination (dummy) */}
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Showing {filteredUsers.length} users
            </div>
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

      {/* Modal tetap sama (tidak aku ubah) */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4"
          onClick={handleCloseModal}
        >
          <div
            className="relative w-full max-w-2xl rounded-3xl bg-white p-8 md:p-10 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleCloseModal}
              className="absolute right-6 top-6 text-red-500 hover:text-red-600 transition-colors"
              aria-label="Close modal"
            >
              <X size={24} strokeWidth={2.5} />
            </button>

            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900">Add New User</h2>
              <p className="mt-2 text-sm text-gray-600">
                Fill details to create new user
              </p>
            </div>

            {/* ... form kamu tetap ... */}
            {/* (aku sengaja tidak ubah isi modal biar fokus ke GET user) */}
          </div>
        </div>
      )}
    </>
  );
}
