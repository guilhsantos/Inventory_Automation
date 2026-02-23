import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
// IMPORTANTE: Importando o provedor que criamos
import { AuthProvider } from "@/lib/auth-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SGA | Reauto Car",
  description: "Sistema de Gestão de Automação Industrial",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-br">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* O AuthProvider deve envolver o children para que todas as páginas 
            saibam quem é o usuário e qual o seu cargo (role) */}
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}