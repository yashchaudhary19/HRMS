"use client";

import { useState } from "react";
import Link from "next/link";

export default function DeleteAccountPage() {
  const [email, setEmail] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !employeeId) return;

    setLoading(true);
    // Simulate API request to register deletion request
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-rose-100 selection:text-rose-950">
      {/* Decorative Background Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-rose-200/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-indigo-200/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/70 border-b border-slate-100">
        <div className="max-w-xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center shadow-md shadow-indigo-200">
              <span className="text-white font-bold text-lg">HR</span>
            </div>
            <div>
              <span className="font-bold text-lg bg-gradient-to-r from-indigo-950 to-slate-800 bg-clip-text text-transparent">
                HR Connect
              </span>
            </div>
          </div>
          <Link
            href="/privacy"
            className="text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
          >
            Privacy Policy
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-xl mx-auto px-6 py-12 relative">
        <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/80 p-8 md:p-10">
          
          {!submitted ? (
            <>
              {/* Introduction */}
              <div className="mb-8">
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-2">
                  Account Deletion Request
                </h1>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Request the permanent deletion of your HR Connect (NodeHR) account and all associated personal data.
                </p>
              </div>

              {/* Data Warning Box */}
              <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5 mb-6 text-sm text-rose-800 space-y-2">
                <h3 className="font-bold flex items-center space-x-2 text-rose-950">
                  <span>⚠️</span>
                  <span>Important: This action is permanent</span>
                </h3>
                <p className="text-xs leading-normal text-rose-700">
                  Deleting your account will permanently erase your profile, past check-in/check-out logs, geofencing coordinates, Wi-Fi parameters, and shift history from our systems. This action cannot be undone.
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Work Email Address
                  </label>
                  <input
                    type="email"
                    id="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 bg-white transition-all text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="employeeId" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Employee ID
                  </label>
                  <input
                    type="text"
                    id="employeeId"
                    required
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    placeholder="EMP12345"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 bg-white transition-all text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="reason" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Reason for Deletion (Optional)
                  </label>
                  <textarea
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g., Leaving the company, contract completed"
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 bg-white transition-all text-sm resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold py-3.5 px-4 rounded-xl shadow-lg shadow-rose-200 transition-all duration-200 flex items-center justify-center space-x-2 text-sm disabled:opacity-75 cursor-pointer"
                >
                  {loading ? (
                    <span>Processing...</span>
                  ) : (
                    <>
                      <span>Delete Account &amp; Data</span>
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            /* Success State */
            <div className="text-center py-6 space-y-6">
              <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto text-rose-600 text-3xl">
                ✓
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-slate-900">Request Submitted</h2>
                <p className="text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
                  Your deletion request has been registered. Our system will notify your company's HR Administrator to verify and approve the data deletion within 7 business days.
                </p>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 text-xs text-slate-500 max-w-sm mx-auto text-left space-y-1">
                <p><strong>Confirmation Email:</strong> A verification link has been sent to <strong>{email}</strong>. Please check your inbox to confirm your request.</p>
              </div>
              <button
                onClick={() => setSubmitted(false)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
              >
                Submit another request
              </button>
            </div>
          )}

          {/* HR Note */}
          <div className="border-t border-slate-100 mt-8 pt-6 text-center">
            <p className="text-xs text-slate-400">
              Need assistance? Email us at{" "}
              <a href="mailto:support@nodehr.app" className="text-indigo-500 hover:underline">
                support@nodehr.app
              </a>
            </p>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-100 bg-slate-50 py-6 text-center text-xs text-slate-400">
        <p>&copy; {new Date().getFullYear()} HR Connect (NodeHR). All rights reserved.</p>
      </footer>
    </div>
  );
}
