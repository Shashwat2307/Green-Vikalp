import type { Metadata, Viewport } from "next";
import { Outfit, Inter } from "next/font/google";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Green Vikalp Mobile",
  description: "Mobile CRM application",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.webp",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Green Vikalp Mobile",
  },
  formatDetection: {
    telephone: false, // Don't auto-format numbers, we'll handle tel: links manually
  },
};

export const viewport: Viewport = {
  themeColor: "#171717", // neutral-900
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className={`${outfit.variable} ${inter.variable} font-sans min-h-full flex flex-col bg-background text-foreground`}>
        <AuthProvider>
          {children}
          <Toaster position="top-center" />
        </AuthProvider>
      </body>
    </html>
  );
}
