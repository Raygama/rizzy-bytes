"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { jwtDecode } from "jwt-decode";
import Cookies from "js-cookie";
import Image from "next/image";
import logo from "../../public/logo_telkom.png";
import {
  MessageCircle,
  BarChart2,
  Users,
  Database,
  Menu,
  X,
} from "lucide-react";
import Swal from "sweetalert2";
import { authUrl } from "@/lib/apiConfig";

export default function Sidebar({ mode = "mobile" }) {
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  // ambil token dari localStorage (client-side)
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      setUser(jwtDecode(token));
    } catch {
      setUser(null);
    }
  }, []);

  // kalau pindah halaman, auto close (khusus mobile)
  useEffect(() => {
    if (mode === "mobile") setIsOpen(false);
  }, [pathname, mode]);

  // lock body scroll saat sidebar mobile terbuka
  useEffect(() => {
    if (mode !== "mobile") return;

    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, mode]);

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
      const res = await fetch(authUrl("/logout"), {
        method: "POST",
        headers: {
          authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!res.ok) throw new Error(`logout failed: ${res.status}`);

      localStorage.removeItem("token");
      Cookies.set("token", "");
      sessionStorage.setItem("isLogin", "false");
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
  const role = String(roleRaw).toLowerCase();

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
    ],
    []
  );

  const allowedKeysByRole = useMemo(
    () => ({
      student: ["chat"],
      guest: ["chat"],
      staff: ["chat", "kb"],
      admin: ["chat", "analytics", "user_mgmt", "kb"],
    }),
    []
  );

  const allowedKeys = allowedKeysByRole[role] || allowedKeysByRole.guest;
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

  const isDesktop = mode === "desktop";

  return (
    <>
      {/* MOBILE: Toggle Button */}
      {!isDesktop && (
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          aria-label="Toggle sidebar"
          aria-expanded={isOpen}
          className="fixed left-4 top-4 z-50 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white text-gray-700 shadow"
        >
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      )}

      {/* MOBILE: Overlay */}
      {!isDesktop && isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* SIDEBAR CONTAINER */}
      <aside
        className={[
          // base
          "bg-white border-gray-200 flex flex-col",
          // desktop: static full height
          isDesktop
            ? "h-screen w-64 border-r"
            : // mobile: fixed + slide
              `fixed inset-y-0 left-0 z-40 h-screen w-64 border-r transition-transform duration-200 ${
                isOpen ? "translate-x-0" : "-translate-x-full"
              }`,
        ].join(" ")}
      >
        {/* App title */}
        <div className="flex flex-col items-center gap-2 px-6 pt-6 pb-4 text-center">
          <Image src={logo} alt="Telkom University" width={64} height={64} />
          <h1 className="text-lg font-semibold tracking-tight">
            Informatics AI
          </h1>
        </div>

        {/* Nav (scrollable) */}
        <nav className="px-3 space-y-1 flex-1 overflow-y-auto">
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

        {/* Bottom section */}
        <div className="px-3 pb-4 pt-4 space-y-3 border-t border-gray-100">
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
    </>
  );
}
