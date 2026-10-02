import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider, ToastViewport } from "@/components/ui/toast";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Control de Obra Pro",
  description:
    "Sistema ERP para la gestión integral de proyectos de construcción",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        {/* P2 (seccion 4.2): ToastProvider unico en la app; cualquier
            mutacion del data-store puede invocar toastBus.show().
            ToastViewport se renderiza al final del body para que los
            toasts se monten sobre el resto del UI. */}
        <ToastProvider>
          {children}
          <ToastViewport />
        </ToastProvider>
      </body>
    </html>
  );
}
