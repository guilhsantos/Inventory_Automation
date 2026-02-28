import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "SGA | Reauto Car",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-br">
      <body className="bg-white antialiased flex min-h-screen">
        <AuthProvider>
          <Sidebar />
          <main className="flex-1 bg-gray-50/30 overflow-y-auto">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}