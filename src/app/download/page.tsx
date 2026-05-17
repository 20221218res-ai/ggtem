import type { Metadata } from "next";
import BrandLogo from "@/components/brand-logo";
import DownloadInstallPanel from "./download-install-panel";

export const metadata: Metadata = {
  title: "GGtem App",
  description: "Install GGtem on your phone home screen.",
};

export default function DownloadPage() {
  return (
    <main className="min-h-screen bg-[var(--gg-page-bg)] px-4 py-6 text-[var(--gg-text)] lg:px-8">
      <section className="mx-auto flex max-w-[1080px] flex-col gap-5">
        <header className="rounded-2xl border border-[var(--gg-border)] bg-white p-5 shadow-sm shadow-[var(--gg-shadow)]">
          <BrandLogo size="lg" />
        </header>
        <DownloadInstallPanel />
      </section>
    </main>
  );
}
