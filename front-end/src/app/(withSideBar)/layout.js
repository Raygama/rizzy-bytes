import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({ children }) {
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
