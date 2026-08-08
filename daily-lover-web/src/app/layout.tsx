import type { Metadata } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Daily Lover — El Club Social de Solteros y Citas a Ciegas",
  description:
    "Experiencias exclusivas, catas de vino, eventos sociales y citas a ciegas para solteros que buscan relaciones reales.",
  keywords: [
    "citas a ciegas",
    "club de solteros",
    "matchmaking",
    "eventos solteros bogota",
    "eventos solteros medellin",
    "singles club miami",
    "daily lover",
  ],
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: "Daily Lover — El Club Social de Solteros",
    description:
      "Conecta en persona en el club social de solteros más exclusivo.",
    url: "https://www.dailylover.org",
    siteName: "Daily Lover",
    locale: "es_CO",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${interTight.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-neutral-900 font-sans selection:bg-[#961500] selection:text-white">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
