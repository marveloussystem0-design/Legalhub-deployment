import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LegalHub - Comprehensive Legal Services Platform",
  description: "Modern legal services platform for advocates, clients, and legal professionals. Case management, document drafting, legal research, and more.",
  keywords: ["legal services", "case management", "advocates", "lawyers", "legal documents", "India"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {/* Failsafe: Redirect auth codes/tokens before React even hydrates */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var search = window.location.search;
              var hash = window.location.hash;
              var path = window.location.pathname;
              var appUrl = "${process.env.NEXT_PUBLIC_APP_URL || ''}";
              
              if (
                search.indexOf('code=') !== -1 &&
                path.indexOf('/auth/callback') === -1 &&
                path.indexOf('/reset-password') === -1
              ) {
                var params = new URLSearchParams(search);
                if (params.get('code')) {
                   if (appUrl && window.location.href.indexOf(appUrl) === -1) {
                     window.location.href = appUrl + '/auth/callback' + search;
                   } else {
                     window.location.href = '/auth/callback' + search;
                   }
                }
              } else if ((hash.indexOf('access_token=') !== -1 || hash.indexOf('type=recovery') !== -1) && path.indexOf('/reset-password') === -1) {
                if (appUrl && window.location.href.indexOf(appUrl) === -1) {
                  window.location.href = appUrl + '/reset-password' + hash;
                } else {
                  window.location.href = '/reset-password' + hash;
                }
              }
            } catch (e) {}
          })();
        ` }} />
        <div className="md:hidden min-h-screen flex items-center justify-center bg-gray-950 text-white p-6">
          <div className="max-w-sm text-center space-y-3">
            <h1 className="text-xl font-semibold">Desktop View Required</h1>
            <p className="text-sm text-gray-300">
              LegalHub web app is available only on desktop.
              Please open this site on a desktop/laptop or use your browser&apos;s desktop mode.
            </p>
          </div>
        </div>
        <div className="hidden md:block">
          {children}
        </div>
      </body>
    </html>
  );
}
