import "./globals.css";
import { AuthProvider } from "@/lib/auth-context"; //
import AppShell from "@/components/AppShell";

export const metadata = {
  title: "SGA Industrial - Reauto Car",
  description: "Sistema de Gestão de Automação Reauto",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-br">
      <body className="antialiased">
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}