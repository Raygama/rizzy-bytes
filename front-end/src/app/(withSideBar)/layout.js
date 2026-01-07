import Sidebar from "@/components/Sidebar";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default function DashboardLayout({ children }) {
  const token = cookies().get("token")?.value;
  if (!token) redirect("/login");

  return (
    <div className="h-screen bg-[#F5F5F7] md:flex md:overflow-hidden">
      {/* Desktop sidebar (static column) */}
      <aside className="hidden md:block md:w-64 md:shrink-0 md:border-r md:border-gray-200 bg-white">
        <Sidebar mode="desktop" />
      </aside>

      {/* Mobile sidebar (off-canvas overlay) */}
      <div className="md:hidden">
        <Sidebar mode="mobile" />
      </div>

      {/* Main content */}
      <main className="h-screen overflow-y-auto flex-1">{children}</main>
    </div>
  );
}
