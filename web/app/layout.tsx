import type { Metadata, Viewport } from "next";
import { Saira_Extra_Condensed, Sofia_Sans } from "next/font/google";
import { AppNav } from "@/components/app-nav";
import { THEME_COLOURS, THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

const saira = Saira_Extra_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-saira",
});

const sofia = Sofia_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sofia",
});

export const metadata: Metadata = {
  title: "rugbyleague-tipper",
  description: "Tipping comp and NRL predictor for a few mates.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: THEME_COLOURS.dark },
    { media: "(prefers-color-scheme: light)", color: THEME_COLOURS.light },
  ],
  colorScheme: "light dark",
};

/** The trial site (pipeline/trial.py): a separate database replaying 2026's Rounds 1–3. */
const TRIAL = process.env.NEXT_PUBLIC_TRIAL === "1";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // The theme script sets color-scheme on <html> before React hydrates.
    <html lang="en-AU" className={`${saira.variable} ${sofia.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        <AppNav />
        {TRIAL && (
          <p className="mx-auto mt-3 w-full max-w-[34rem] px-4 text-[13px] leading-snug text-ink-3">
            <span className="font-semibold text-ink-2">Trial.</span> 2026&rsquo;s Rounds 1&ndash;3 played again over nine
            days, with the real predictions and results. Tips here don&rsquo;t carry over to the real comp.
          </p>
        )}
        <div className="mx-auto w-full max-w-[34rem] px-4 pb-28 md:pb-12">
          {children}
          <footer className="mt-12 border-t border-line-soft pt-5 text-sm leading-relaxed text-ink-3">
            Tipping comp and predictor for the boys. I&rsquo;m not responsible if you lose money.
          </footer>
        </div>
      </body>
    </html>
  );
}
