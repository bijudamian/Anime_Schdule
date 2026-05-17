import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { Analytics } from "@vercel/analytics/next";
import Providers from "@/components/Providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Anime Schedule — Weekly Anime Release Calendar",
  description:
    "Track your weekly anime releases. View the airing schedule, filter by type, and build your personal watchlist.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased font-sans`} suppressHydrationWarning>
        <ClerkProvider
          appearance={{
            baseTheme: dark,
            variables: {
              colorPrimary: "#3A75C4",
              colorBackground: "#2b2b2b",
              colorInputBackground: "#373737",
              colorText: "#ededed",
            },
          }}
        >
          <Providers>{children}</Providers>
        </ClerkProvider>
        <Analytics />
      </body>
    </html>
  );
}
