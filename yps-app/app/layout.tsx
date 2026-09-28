import type { Metadata } from "next";
import { Cinzel, Bebas_Neue, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["600", "700", "900"],
});

const bebas = Bebas_Neue({
  variable: "--font-bebas",
  subsets: ["latin"],
  weight: ["400"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "YPS 2026 — A New Covenant | Young People Summit",
  description: "Youth Programme Summit 2026 — Great Impact Baptist Church Bariga, Lagos. 7th Nov 2026, 9:00AM.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${cinzel.variable} ${bebas.variable} ${jakarta.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-[#0A0F24] text-[#F3F4F6] selection:bg-[#E5A93C] selection:text-[#0A0F24]">
        {children}
      </body>
    </html>
  );
}
