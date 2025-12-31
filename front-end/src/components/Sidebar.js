"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { jwtDecode } from "jwt-decode";
import {
  MessageCircle,
  BarChart2,
  Users,
  Database,
  Settings,
} from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      setUser(jwtDecode(token));
    } catch {
      setUser(null);
    }
  }, []);

  // const handleLogout = () => {
  //   localStorage.removeItem("token");
  //   window.location.href = "/login";
  // };

  const handleLogout = async () => {
    const confirm = await Swal.fire({
      title: "Are you sure want to logout?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#9ca3af",
      confirmButtonText: "Logout",
      cancelButtonText: "Cancel",
    });

    if (!confirm.isConfirmed) return;

    try {
      const res = await fetch(`http://localhost:3001/auth/logout`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!res.ok) {
        throw new Error(`logout failed: ${res.status}`);
      }

      localStorage.removeItem("token");
      window.location.href = "/login";
    } catch (error) {
      console.error("Error logout:", error);
      Swal.fire({
        title: "Error",
        text: "Failed to logout. Please try again.",
        icon: "error",
      });
    }
  };

  const username = user?.usn || "User";
  const roleRaw = user?.role || "guest";
  const role = String(roleRaw).toLowerCase(); // normalize

  // Define all menu items once
  const allMenu = useMemo(
    () => [
      { key: "chat", name: "Chat", path: "/chat", icon: MessageCircle },
      {
        key: "analytics",
        name: "Analytics",
        path: "/analytics",
        icon: BarChart2,
      },
      {
        key: "user_mgmt",
        name: "User Management",
        path: "/user-management",
        icon: Users,
      },
      {
        key: "kb",
        name: "Knowledge Base",
        path: "/knowledge-base",
        icon: Database,
      },
      { key: "setting", name: "Setting", path: "/setting", icon: Settings },
    ],
    []
  );

  // RBAC rules
  const allowedKeysByRole = useMemo(
    () => ({
      // student & guest: chat + setting only
      student: ["chat", "setting"],
      guest: ["chat", "setting"],

      // staff: chat + setting + knowledge base
      staff: ["chat", "kb", "setting"],

      // admin: all
      admin: ["chat", "analytics", "user_mgmt", "kb", "setting"],
    }),
    []
  );

  const allowedKeys = allowedKeysByRole[role] || allowedKeysByRole["guest"];
  const menu = allMenu.filter((m) => allowedKeys.includes(m.key));

  const getInitials = (text) => {
    const s = String(text || "").trim();
    if (!s) return "U";
    const parts = s.split(/\s+/).filter(Boolean);
    const initials = parts
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("");
    return initials || s.slice(0, 2).toUpperCase();
  };

  const displayRole =
    role === "mahasiswa" || role === "student"
      ? "Student"
      : role === "administrator"
      ? "Admin"
      : role.charAt(0).toUpperCase() + role.slice(1);

  return (
    <aside className="w-64 bg-white border-r h-screen border-gray-200 flex flex-col">
      {/* App title */}
      <div className="px-6 pt-6 pb-4">
        <h1 className="text-lg font-semibold tracking-tight">Informatics AI</h1>
      </div>

      {/* Nav */}
      <nav className="px-3 space-y-1">
        {menu.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.path || pathname?.startsWith(item.path + "/");

          return (
            <Link
              key={item.key}
              href={item.path}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? "bg-red-50 text-red-600"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <span
                className={`inline-flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                  isActive
                    ? "bg-red-100 text-red-600"
                    : "bg-gray-200 text-gray-700"
                }`}
              >
                <Icon size={18} />
              </span>
              <span>{item.name}</span>
            </Link>
          );
        })}
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
            {getInitials(username)}
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold">{username}</span>
            <span className="text-[11px] text-gray-500">{displayRole}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
