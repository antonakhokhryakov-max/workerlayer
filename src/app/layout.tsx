import type { Metadata } from "next";
import { Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import Link from "next/link";
import {
  PRODUCT_ALPHA_LABEL,
  PRODUCT_ALPHA_SYNTHETIC,
  PRODUCT_MOTTO,
  PRODUCT_NAME,
  PRODUCT_SUCCESS,
  PRODUCT_TAGLINE,
} from "@aether/contracts";
import { PUBLIC_DESK_NOTE, PUBLIC_DESK_URL } from "@/lib/public-desk";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${PRODUCT_NAME} — ${PRODUCT_TAGLINE}`,
  description: `${PRODUCT_NAME}: ${PRODUCT_TAGLINE}. ${PRODUCT_MOTTO}. ${PRODUCT_ALPHA_LABEL}. You bring the model, agent logic, domain, and UX. WorkerLayer provides the WorkerEnvironment.`,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${sourceSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="bg-background">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/" className="flex items-baseline gap-3">
              <span className="font-heading text-xl tracking-tight">{PRODUCT_NAME}</span>
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {PRODUCT_MOTTO}
              </span>
            </Link>
            <p className="text-xs text-muted-foreground sm:text-right sm:text-sm">
              Build and run an agent
            </p>
          </div>
          <p className="mx-auto w-full max-w-6xl px-5 pb-5 text-xs leading-5 text-muted-foreground sm:text-sm">
            {PRODUCT_ALPHA_LABEL}. {PRODUCT_ALPHA_SYNTHETIC}. {PRODUCT_SUCCESS}. Not
            enterprise zero-trust.{" "}
            <a
              href={PUBLIC_DESK_URL}
              className="text-foreground underline underline-offset-4"
            >
              {PUBLIC_DESK_URL}
            </a>
            . {PUBLIC_DESK_NOTE}
          </p>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
