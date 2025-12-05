import Link from "next/link";
export default function HomePage() {
  const footerItems = [
    { label: "About Project", href: "#" },
    { label: "Terms of Service", href: "#" },
    { label: "Privacy Policy", href: "#" },
  ];
  return (
    <div className="flex flex-col justify-between w-5/6 h-screen mx-auto p-4">
      <nav className="border-b-2 border-red-500 p-2 mb-4">
        <h3>Informatics AI</h3>
      </nav>

      <div className="align-center text-center">
        <h1 className="font-bold text-3xl mb-4">Hello, Informatics</h1>
        <p className="mb-2">Your Number One Informatics Helpdesk</p>
        <button className="bg-red-500 p-2 rounded-lg text-white text-sm">
          <Link href="/login">Start Asking</Link>
        </button>
      </div>

      <footer className="border-t-2 border-gray-400">
        <ul className="flex flex-wrap justify-between gap-3 w-full p-2 mt-2">
          {footerItems.map((item) => (
            <li
              key={item.label}
              className="text-center w-1/6 text-sm text-gray-400"
            >
              <a href={item.href}>{item.label}</a>
            </li>
          ))}
        </ul>
        <div className="mt-2 text-center text-sm text-gray-400">
          2025 Informatic AI
        </div>
      </footer>
    </div>
  );
}
