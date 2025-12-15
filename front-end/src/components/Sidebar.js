"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { jwtDecode } from "jwt-decode";
import { Icon, Menu, Send } from "lucide-react";
import {
  MessageCircle,
  BarChart2,
  Users,
  Database,
  Settings,
  LogOut,
} from "lucide-react";

const handleLogout = () => {
  // Hapus token dari cookies

  Cookies.remove("token");
  // Redirect ke halaman login
  window.location.href = "/login";
};

export default function Sidebar() {
  const pathname = usePathname();
  const [user, setUser] = useState(null);

  const menu = [
    {
      name: "Chat",
      path: "/chat",
      icon: MessageCircle,
    },
    {
      name: "Analytics",
      path: "/analytics",
      icon: BarChart2,
    },
    {
      name: "User Management",
      path: "/user-management",
      icon: Users,
    },
    {
      name: "Knowledge Base",
      path: "/knowledge-base",
      icon: Database,
      activeColor: "bg-red-100 text-red-600 border-red-300",
    },
    {
      name: "Setting",
      path: "/setting",
      icon: Settings,
    },
  ];

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      setUser(jwtDecode(token));
    } catch {}
  }, []);

  const handleLogout = () => {
    // Hapus token dari cookies
    localStorage.removeItem("token");
    // Redirect ke halaman login
    window.location.href = "/login";
  };

  const username = user?.usn || "User";
  const role = user?.role || "Guest";
  console.log("Decoded username:", username);
  console.log("Decoded role:", role);

  return (
    <aside className="w-64 bg-white border-r h-screen border-gray-200 flex flex-col">
      {/* App title */}
      <div className="px-6 pt-6 pb-4">
        <h1 className="text-lg font-semibold tracking-tight">Informatics AI</h1>
      </div>

      {/* Nav */}
      <nav className="px-3 space-y-1">
        {/* Chat (active) */}

        {/* Setting (dummy) */}

        {/* Menu */}
        {menu.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={index}
              type="button"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-gray-600 hover:bg-gray-100 text-sm font-medium"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gray-200 text-gray-700">
                <Icon size={18} />
              </span>
              <Link href={item.path}>{item.name}</Link>
            </button>
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
            MR
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold">{username}</span>
            <span className="text-[11px] text-gray-500">{role}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
