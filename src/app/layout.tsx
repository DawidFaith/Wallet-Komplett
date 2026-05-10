import type { Metadata, Viewport } from "next";
import { Inter, Orbitron, Pirata_One } from "next/font/google";
import "./globals.css";
import { ThirdwebProvider } from "thirdweb/react";
import QueryProvider from "./QueryProvider";
import ParticleAuthProvider from "./components/ParticleAuthProvider";

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
    <html lang="de" className="bg-zinc-950">
      <body className={`${inter.className} ${orbitron.variable} ${pirataOne.variable} bg-zinc-950`}>
        <ThirdwebProvider>
          <ParticleAuthProvider>
            <QueryProvider>{children}</QueryProvider>
          </ParticleAuthProvider>
        </ThirdwebProvider>
      </body>
    </html>
  );
}
