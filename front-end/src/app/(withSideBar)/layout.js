import Sidebar from "@/components/Sidebar";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Cookies from "js-cookie";

export default function DashboardLayout({ children }) {
  const token = cookies().get("token")?.value;
  if (!token) redirect("/login");
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar fixed height */}
      <aside className="w-64 shrink-0">
        {/* Sidebar component kamu */}
        <Sidebar />
      </aside>

      {/* Main content scroll */}
      <main className="flex-1 overflow-y-auto bg-[#F5F5F7]">{children}</main>
    </div>
  );
}
