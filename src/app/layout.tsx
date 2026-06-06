import type { Metadata, Viewport } from "next";
import { Inter, Orbitron, Pirata_One } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { deDE } from "@clerk/localizations";
import QueryProvider from "./QueryProvider";
import { LangProvider } from "./components/LangContext";

const inter = Inter({ subsets: ["latin"] });
const orbitron = Orbitron({ 
  subsets: ["latin"],
  variable: '--font-orbitron'
});
const pirataOne = Pirata_One({ 
  weight: "400",
  subsets: ["latin"],
  variable: '--font-pirata-one'
});

export const metadata: Metadata = {
  title: "Dawid Faith Wallet",
  description: "Dawid Faith Wallet – D.FAITH Token & Music Ecosystem",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider localization={deDE as any}>
      <html lang="de" className="bg-[#13120e]">
          <body className={`${inter.className} ${orbitron.variable} ${pirataOne.variable} bg-[#13120e]`}>
            <QueryProvider><LangProvider>{children}</LangProvider></QueryProvider>
          </body>
      </html>
    </ClerkProvider>
  );
}
