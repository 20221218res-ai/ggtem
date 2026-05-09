import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[var(--gg-page-bg)] px-5 py-10 text-[var(--gg-text)] lg:px-8">
      <section className="mx-auto flex min-h-[70vh] max-w-3xl flex-col justify-center">
        <div className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-8 shadow-lg shadow-[var(--gg-shadow)]">
          <p className="text-sm font-black text-[var(--gg-accent)]">페이지를 찾을 수 없습니다</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight lg:text-4xl">
            요청한 화면이 없거나 접근할 수 없습니다
          </h1>
          <p className="mt-4 text-sm leading-6 text-[var(--gg-muted)]">
            링크가 만료됐거나, 삭제된 거래/요청일 수 있습니다. 진행 중인 거래는
            마이페이지에서 다시 확인해 주세요.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-xl bg-[var(--gg-accent)] px-4 py-3 text-sm font-black text-white hover:bg-[var(--gg-accent-hover)]"
            >
              홈으로
            </Link>
            <Link
              href="/listings"
              className="rounded-xl border border-[var(--gg-border)] px-4 py-3 text-sm font-black text-[var(--gg-text)] hover:bg-[var(--gg-control-bg)]"
            >
              매물 둘러보기
            </Link>
            <Link
              href="/my"
              className="rounded-xl border border-[var(--gg-border)] px-4 py-3 text-sm font-black text-[var(--gg-text)] hover:bg-[var(--gg-control-bg)]"
            >
              마이페이지
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
