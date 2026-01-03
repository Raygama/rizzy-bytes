import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default function withoutSideBarLayout({ children }) {
  const token = cookies().get("token")?.value;
  if (token) redirect("/chat");
  return (
    <div>
      {/* Main content scroll */}
      <main>{children}</main>
    </div>
  );
}
