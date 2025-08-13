import type { Metadata } from "next";
import { Inter, Pirata_One } from "next/font/google";
import "./globals.css";
import { ThirdwebProvider } from "thirdweb/react";
import QueryProvider from "./QueryProvider";

const inter = Inter({ subsets: ["latin"] });
const pirataOne = Pirata_One({ 
  weight: '400',
  subsets: ["latin"],
  variable: '--font-pirata-one'
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
      <body className={`${inter.className} ${pirataOne.variable}`}>
        <ThirdwebProvider>
          <QueryProvider>{children}</QueryProvider>
        </ThirdwebProvider>
      </body>
    </html>
  );
}
