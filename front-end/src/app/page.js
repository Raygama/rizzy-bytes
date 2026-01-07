import Link from "next/link"
import Image from "next/image"

export default function HomePage() {
  return (
    <div className="bg-white min-h-screen flex flex-col">
      {/* Navbar */}
      <nav className="bg-white border border-gray-200 shadow-sm rounded-2xl m-4 px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Image src="/logo_telkom.png" alt="Telkom Logo" width={64} height={64} className="h-8 w-auto" />
            <span className="font-bold text-lg text-black">Informatics AI</span>
          </div>
          <Link
            href="/login"
            className="bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-2 rounded-lg transition"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="px-4 py-16 md:py-24">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="flex flex-col gap-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-black leading-tight">
                Your <span className="text-red-500">Smart</span> <span className="text-red-500">Companion</span> for
                Informatics
              </h1>
            </div>
            <p className="text-gray-600 text-lg leading-relaxed">
              Instant answer for academics queries, LMS access, and Campus Information. Available 24/7
            </p>
            <div className="flex gap-4 flex-wrap">
              <Link
                href="/login"
                className="bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-3 rounded-lg transition"
              >
                Start Asking
              </Link>
              <Link
                href="/login"
                className="border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold px-6 py-3 rounded-lg transition"
              >
                Learn More
              </Link>
            </div>
          </div>

          {/* Right Image */}
          <div className="hidden md:flex justify-center">
            <div className="rounded-lg shadow-lg overflow-hidden border border-gray-200">
              <Image
                src="/tult.png"
                alt="Informatics AI Building"
                width={400}
                height={300}
                className="w-full h-auto object-cover"
              />
            </div>
          </div>
        </div>

        {/* Mobile Hero Image */}
        <div className="md:hidden mt-8 flex justify-center">
          <div className="rounded-lg shadow-lg overflow-hidden border border-gray-200 w-full max-w-sm">
            <Image
              src="/tult.png"
              alt="Informatics AI Building"
              width={400}
              height={300}
              className="w-full h-auto object-cover"
            />
          </div>
        </div>
      </section>

      {/* Why Use Informatics AI Section */}
      <section className="bg-gray-50 px-4 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-black mb-2">
              Why Use <span className="text-red-500">Informatics AI</span>?
            </h2>
            <p className="text-gray-600 text-lg">
              Designed specifically for the academic ecosystem, providing accurate, and instant support
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 hover:shadow-md transition">
              <div className="mb-4">
                <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
                  <path strokeWidth="1.5" d="M8 12l2 2 4-4" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-black mb-2">Academic Accuracy</h3>
              <p className="text-gray-600 text-sm">
                Trained on verified university curriculum and data sources to ensure every answer is academically sound
                and relevant
              </p>
            </div>

            {/* Card 2 */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 hover:shadow-md transition">
              <div className="mb-4">
                <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
                  <path strokeWidth="1.5" d="M12 8v8m-3-3h6" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-black mb-2">Secure & Private</h3>
              <p className="text-gray-600 text-sm">
                Your academic data is protected with enterprise-grade security and privacy controls
              </p>
            </div>

            {/* Card 3 */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 hover:shadow-md transition">
              <div className="mb-4">
                <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
                  <path strokeWidth="1.5" d="M8 12l2 2 4-4" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-black mb-2">Fast Responses</h3>
              <p className="text-gray-600 text-sm">
                Get instant answers to your academic queries, available 24/7 to support your learning journey
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="px-4 py-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-black">How It Works?</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="flex flex-col items-center text-center">
              <div className="mb-6 flex items-center justify-center">
                <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeWidth="1.5"
                    d="M15 7h4a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V9a2 2 0 012-2h4m0 0V5a2 2 0 012-2h2a2 2 0 012 2v2m0 0h4"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-black mb-2">1. Login with Email</h3>
              <p className="text-gray-600 text-sm">Use your email to access the platform</p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center text-center">
              <div className="mb-6 flex items-center justify-center">
                <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-black mb-2">2. Ask Anything</h3>
              <p className="text-gray-600 text-sm">Type questions about courses, campus info, or administration</p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center text-center">
              <div className="mb-6 flex items-center justify-center">
                <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-black mb-2">3. Get Verified Answer</h3>
              <p className="text-gray-600 text-sm">Receive accurate, verified answers instantly</p>
            </div>
          </div>

          {/* Dashed line for desktop (visual connector) */}
          <div className="hidden md:block mt-12 relative">
            <svg className="w-full h-12" viewBox="0 0 1000 50" preserveAspectRatio="none">
              <line x1="0" y1="25" x2="1000" y2="25" stroke="#e5e7eb" strokeWidth="2" strokeDasharray="5,5" />
            </svg>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="bg-gray-50 px-4 py-20">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-black mb-4">
            Ready to simplify your <span className="text-red-500">academic life?</span>
          </h2>
          <p className="text-gray-600 text-lg mb-8">
            Join thousands of students and faculty members who already using Informatics AI to stay ahead.
          </p>
          <Link
            href="/login"
            className="inline-block bg-red-500 hover:bg-red-600 text-white font-semibold px-8 py-3 rounded-lg transition"
          >
            Launch Chatbot
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-center items-center gap-6 mb-8">
            <a href="#" className="text-gray-600 hover:text-gray-900 text-sm">
              About Project
            </a>
            <a href="#" className="text-gray-600 hover:text-gray-900 text-sm">
              Terms of Service
            </a>
            <a href="#" className="text-gray-600 hover:text-gray-900 text-sm">
              Privacy Policy
            </a>
          </div>
          <div className="text-center text-gray-400 text-sm">2025 Informatics AI</div>
        </div>
      </footer>
    </div>
  )
}
