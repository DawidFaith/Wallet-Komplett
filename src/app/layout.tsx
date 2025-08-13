import type { Metadata } from "next";
import { Inter, Orbitron } from "next/font/google";
import "./globals.css";
import { ThirdwebProvider } from "thirdweb/react";
import QueryProvider from "./QueryProvider";

const inter = Inter({ subsets: ["latin"] });
const orbitron = Orbitron({ 
  subsets: ["latin"],
  variable: '--font-orbitron'
});

export const metadata: Metadata = {
  title: "thirdweb SDK + Next starter",
  description:
    "Starter template for using thirdweb SDK with Next.js App router",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${orbitron.variable}`}>
        <ThirdwebProvider>
          <QueryProvider>{children}</QueryProvider>
        </ThirdwebProvider>
      </body>
    </html>
  );
}
