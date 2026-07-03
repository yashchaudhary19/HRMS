"use client";

import Link from "next/link";

export default function PrivacyPolicyPage() {
  const lastUpdated = "July 3, 2026";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Decorative Background Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-200/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-cyan-200/20 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/70 border-b border-indigo-100/50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center shadow-md shadow-indigo-200">
              <span className="text-white font-bold text-lg">HR</span>
            </div>
            <div>
              <span className="font-bold text-lg bg-gradient-to-r from-indigo-950 to-slate-800 bg-clip-text text-transparent">
                HR Connect
              </span>
              <span className="ml-1.5 text-xs font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-100">
                NodeHR
              </span>
            </div>
          </div>
          <Link
            href="/"
            className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors duration-200 flex items-center space-x-1"
          >
            <span>&larr;</span> <span>Back to Home</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-12 relative">
        <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-indigo-50 shadow-xl shadow-slate-100 p-8 md:p-12">
          {/* Page Title */}
          <div className="border-b border-slate-100 pb-8 mb-8">
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
              Privacy Policy
            </h1>
            <p className="text-sm text-slate-500 font-medium">
              Last Updated: <span className="text-slate-800">{lastUpdated}</span>
            </p>
          </div>

          <div className="space-y-8 text-slate-650 leading-relaxed text-base">
            <p>
              Welcome to <strong>HR Connect (NodeHR)</strong>. We value your privacy and are committed to protecting your personal data. This Privacy Policy explains how our mobile application and web portal collect, use, store, and share your information when you use our services.
            </p>

            <div className="bg-indigo-50/50 border border-indigo-100/50 rounded-2xl p-6 space-y-3">
              <h2 className="text-lg font-bold text-indigo-950 flex items-center space-x-2">
                <span className="flex h-2 w-2 rounded-full bg-indigo-600" />
                <span>Google Play Developer Policy Compliance Notice</span>
              </h2>
              <p className="text-sm text-slate-600 leading-normal">
                Because this application provides workplace geofencing, remote shift tracking, and device authorization, we require access to sensitive information including <strong>Precise Location (foreground and background)</strong>, <strong>Wi-Fi Network connections (SSID)</strong>, and <strong>unique Device Identifiers</strong>. This policy details our transparent handling of this data in accordance with Google Play Store guidelines.
              </p>
            </div>

            {/* Section 1 */}
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 font-bold text-sm">
                  1
                </span>
                <span>Information We Collect</span>
              </h2>
              <p>
                To provide automatic attendance tracking, shift verification, and security verification, the app collects the following categories of information:
              </p>

              <div className="space-y-4 mt-4">
                {/* Location */}
                <div className="border border-slate-100 rounded-xl p-5 hover:bg-slate-50/50 transition-colors duration-200">
                  <h3 className="font-bold text-slate-900 flex items-center space-x-2">
                    <span className="text-indigo-500">📍</span>
                    <span>Precise Location Data (Foreground &amp; Background)</span>
                  </h3>
                  <p className="text-sm text-slate-600 mt-2">
                    Our app collects precise coordinates (latitude and longitude) to verify whether check-in/check-out events occur within authorized workspaces (geofences) or during remote/WFH shifts. 
                  </p>
                  <p className="text-xs text-indigo-600/90 font-semibold mt-2.5 bg-indigo-50/30 px-3 py-1.5 rounded-lg border border-indigo-100/20">
                    *Background Location Access:* Background location is used during active "Work From Home" sessions to periodically verify your working parameters and location updates. This data is only collected when you are explicitly checked in and working.
                  </p>
                </div>

                {/* Wi-Fi & Network */}
                <div className="border border-slate-100 rounded-xl p-5 hover:bg-slate-50/50 transition-colors duration-200">
                  <h3 className="font-bold text-slate-900 flex items-center space-x-2">
                    <span className="text-indigo-500">📶</span>
                    <span>Wi-Fi Network Parameters (SSID, IP Address)</span>
                  </h3>
                  <p className="text-sm text-slate-600 mt-2">
                    We collect the Wi-Fi network SSID (name) and IP address of your device during office check-in requests. This verifies that you are connected to the official corporate network.
                  </p>
                </div>

                {/* Device IDs */}
                <div className="border border-slate-100 rounded-xl p-5 hover:bg-slate-50/50 transition-colors duration-200">
                  <h3 className="font-bold text-slate-900 flex items-center space-x-2">
                    <span className="text-indigo-500">📱</span>
                    <span>Device Identifiers (Hardware ID / Vendor ID)</span>
                  </h3>
                  <p className="text-sm text-slate-600 mt-2">
                    We collect a unique identifier from your device (Android ID or iOS Identifier for Vendor) to bind your user account to a single authorized device. This prevents buddy punching and unauthorized access to your employee profile.
                  </p>
                </div>

                {/* Camera / Selfie */}
                <div className="border border-slate-100 rounded-xl p-5 hover:bg-slate-50/50 transition-colors duration-200">
                  <h3 className="font-bold text-slate-900 flex items-center space-x-2">
                    <span className="text-indigo-500">📷</span>
                    <span>Camera Access &amp; Photo Verification</span>
                  </h3>
                  <p className="text-sm text-slate-600 mt-2">
                    If configured by your company, the app asks for camera permissions to capture a selfie photo during check-in for facial identity verification. This image is only used for attendance verification.
                  </p>
                </div>

                {/* Account details */}
                <div className="border border-slate-100 rounded-xl p-5 hover:bg-slate-50/50 transition-colors duration-200">
                  <h3 className="font-bold text-slate-900 flex items-center space-x-2">
                    <span className="text-indigo-500">👤</span>
                    <span>User Account &amp; Profile Details</span>
                  </h3>
                  <p className="text-sm text-slate-600 mt-2">
                    Basic details such as name, email, employee ID, department, shift details, and check-in history are stored on our servers to manage your profile and generate attendance timesheets.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 2 */}
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 font-bold text-sm">
                  2
                </span>
                <span>How We Use Your Information</span>
              </h2>
              <p>
                The information collected is used solely for core operational functions:
              </p>
              <ul className="list-disc list-inside space-y-2 pl-2 text-slate-700 text-sm">
                <li>Verifying check-in coordinates against corporate geofences.</li>
                <li>Validating office attendance using approved Wi-Fi SSIDs.</li>
                <li>Preventing login spoofing, clock tampering, and fraudulent device behavior.</li>
                <li>Providing real-time shift status logs and tracking remote work timers.</li>
                <li>Allowing company managers and HR personnel to view, generate, and process attendance reports.</li>
              </ul>
            </section>

            {/* Section 3 */}
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 font-bold text-sm">
                  3
                </span>
                <span>Data Sharing and Disclosure</span>
              </h2>
              <p>
                We do not sell, rent, or distribute your personal details or location history to third-party advertising platforms or marketing networks.
              </p>
              <p>
                Your location, device information, and check-in metrics are only visible to the <strong>designated HR administrators, managers, and system administrators</strong> of your respective employing company.
              </p>
            </section>

            {/* Section 4 */}
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 font-bold text-sm">
                  4
                </span>
                <span>Data Security and Retention</span>
              </h2>
              <p>
                Security is our top priority:
              </p>
              <ul className="list-disc list-inside space-y-2 pl-2 text-slate-700 text-sm">
                <li><strong>Encryption:</strong> All communication between the mobile app, backend APIs, and database instances is fully encrypted using HTTPS/TLS.</li>
                <li><strong>Access Control:</strong> Backend databases are stored on secure private cloud networks with access limited strictly to authorized operations.</li>
                <li><strong>Retention:</strong> Location points are only retained for the duration required by your company’s HR audit policies. You can coordinate with your HR department to request deletion of your history.</li>
              </ul>
            </section>

            {/* Section 5 */}
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 font-bold text-sm">
                  5
                </span>
                <span>Permissions &amp; Your Choices</span>
              </h2>
              <p>
                You retain complete control over your mobile device permissions. You can modify these permissions at any time through your device settings:
              </p>
              <ul className="list-disc list-inside space-y-2 pl-2 text-slate-700 text-sm">
                <li><strong>Location Services:</strong> You can disable location tracking. Please note that doing so will prevent you from utilizing geofenced check-in tools.</li>
                <li><strong>Background Updates:</strong> You can turn off background execution; however, this will impact active Remote WFH shift tracking.</li>
                <li><strong>Camera access:</strong> Disabling camera access will prevent identity-verified check-in options if required by your company.</li>
              </ul>
            </section>

            {/* Section 6 */}
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 font-bold text-sm">
                  6
                </span>
                <span>Contact Us</span>
              </h2>
              <p>
                If you have any questions about this Privacy Policy, your data, or if you would like to request removal of your account, please contact us at:
              </p>
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 space-y-2 text-sm mt-3">
                <p><strong>Email Support:</strong> <a href="mailto:support@nodehr.app" className="text-indigo-600 hover:text-indigo-800 transition-colors font-medium">support@nodehr.app</a></p>
                <p><strong>HR Administration:</strong> Contact your company's designated HR department for local workspace rules and data access requests.</p>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200/60 bg-slate-100 py-8 text-center text-xs text-slate-500">
        <div className="max-w-4xl mx-auto px-6 space-y-2">
          <p>&copy; {new Date().getFullYear()} HR Connect (NodeHR). All rights reserved.</p>
          <p>This privacy policy is designed to comply with Google Play Developer policies regarding prominent disclosures and consent.</p>
        </div>
      </footer>
    </div>
  );
}
