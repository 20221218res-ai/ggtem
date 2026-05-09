import { getCurrentSessionUser, getDemoAccountOptions } from "@/lib/auth/session";
import { ROLE_GROUPS, roleHasAccess } from "@/lib/auth/guards";
import BrandLogo from "@/components/brand-logo";
import SignOutButton from "@/app/sign-out-button";
import AdminSignInForm from "./admin-sign-in-form";

export default async function AdminSignInPage() {
  const currentUser = await getCurrentSessionUser();
  const isAdminUser = currentUser
    ? roleHasAccess(currentUser.role, ROLE_GROUPS.ADMIN_OPERATORS)
    : false;
  const adminAccounts = getDemoAccountOptions().filter((account) =>
    roleHasAccess(account.role, ROLE_GROUPS.ADMIN_OPERATORS),
  );

  return (
    <main className="min-h-screen bg-[#f3f4f6] text-slate-950">
      <section className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <a href="/admin/sign-in" className="flex items-center gap-3">
            <div>
              <BrandLogo size="sm" admin />
              <p className="text-xs font-bold text-slate-500">운영자 전용 콘솔</p>
            </div>
          </a>
          <div className="flex flex-wrap gap-2">
            <a
              href="/"
              className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
            >
              유저 홈
            </a>
            <a
              href="/sign-in"
              className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50"
            >
              일반 로그인
            </a>
          </div>
        </header>

        <div className="grid flex-1 items-center gap-8 py-12 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <p className="w-fit rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-black text-sky-700">
              SEPARATED ADMIN CONSOLE
            </p>
            <h1 className="mt-6 text-4xl font-black tracking-tight text-slate-950 lg:text-5xl">
              관리자 콘솔 로그인
            </h1>
            <p className="mt-5 max-w-xl text-sm font-semibold leading-7 text-slate-700">
              이 화면은 일반 유저 서비스와 분리된 운영자 전용 진입점입니다.
              주문, 지갑, 분쟁, 신고, 감사 로그 같은 민감 기능은 승인된 운영 계정으로만 접근할 수 있습니다.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <AdminGuardCard title="권한 분리" body="일반 유저 계정 차단" />
              <AdminGuardCard title="감사 로그" body="민감 조치 기록" />
              <AdminGuardCard title="수동 운영" body="충전/출금 검증" />
            </div>

            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
              <p className="font-black text-amber-800">운영자 확인</p>
              <p className="mt-2">
                공용 PC에서는 로그아웃을 꼭 확인하세요. 관리자 권한 변경, 환불, 출금,
                유저 제한은 모두 감사 로그에 기록됩니다.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-2 text-slate-950 shadow-lg shadow-slate-200/80">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-black text-sky-700">ADMIN ACCESS</p>
                  <h2 className="mt-2 text-2xl font-black text-slate-950">
                    운영자 계정으로 접속
                  </h2>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                    관리자 계정만 로그인할 수 있습니다.
                  </p>
                </div>
                <span className="rounded-md bg-slate-950 px-2 py-1 text-[10px] font-black text-white">
                  SECURE
                </span>
              </div>

              {currentUser ? (
                <div
                  className={
                    isAdminUser
                      ? "mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800"
                      : "mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900"
                  }
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      현재 {currentUser.displayName} 계정으로 로그인되어 있습니다.
                      {isAdminUser
                        ? " 관리자 메인으로 바로 이동할 수 있습니다."
                        : " 관리자 계정을 선택해 다시 로그인하면 관리자 세션으로 전환됩니다."}
                    </span>
                    <div className="flex shrink-0 gap-2">
                      {isAdminUser ? (
                        <a
                          href="/admin"
                          className="rounded-md border border-emerald-200 bg-white px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-50"
                        >
                          관리자 메인
                        </a>
                      ) : null}
                      <SignOutButton
                        redirectTo="/admin/sign-in"
                        className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              <AdminSignInForm accounts={adminAccounts} />
            </div>
          </div>
        </div>

        <footer className="border-t border-slate-200 py-5 text-xs font-semibold text-slate-500">
          관리자 콘솔은 일반 유저 서비스와 분리해서 운영합니다. 접근 권한은 최소 인원에게만 부여하세요.
        </footer>
      </section>
    </main>
  );
}

function AdminGuardCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-black text-slate-950">{title}</p>
      <p className="mt-2 text-xs font-semibold text-slate-500">{body}</p>
    </div>
  );
}
