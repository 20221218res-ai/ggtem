import Link from "next/link";
import BrandLogo from "@/components/brand-logo";
import AdminInviteAcceptForm from "./admin-invite-accept-form";

type AdminInvitePageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function AdminInvitePage({ params }: AdminInvitePageProps) {
  const { token } = await params;

  return (
    <main className="min-h-screen bg-[#f3f4f6] px-6 py-8 text-slate-950">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/admin/sign-in" className="flex items-center gap-3">
            <div>
              <BrandLogo size="sm" admin />
              <p className="text-xs font-bold text-slate-500">운영자 초대 활성화</p>
            </div>
          </Link>
          <Link
            href="/admin/sign-in"
            className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50"
          >
            관리자 로그인
          </Link>
        </header>

        <div className="grid flex-1 items-center gap-8 py-12 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <p className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
              ONE-TIME INVITE
            </p>
            <h2 className="mt-6 text-4xl font-black tracking-tight text-slate-950">
              초대받은 운영자만 계정을 활성화할 수 있습니다.
            </h2>
            <p className="mt-5 max-w-xl text-sm font-semibold leading-7 text-slate-700">
              이 링크는 최고관리자가 발급한 1회용 초대 링크입니다. 활성화 후에는
              링크가 폐기되고, 이후에는 관리자 로그인 화면에서 접속합니다.
            </p>
            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">
              비밀번호는 운영자 본인만 알아야 합니다. 공유 PC에서는 저장하지 말고,
              설정 후 관리자 콘솔에서 필요한 업무만 처리하세요.
            </div>
          </div>

          <AdminInviteAcceptForm token={token} />
        </div>
      </section>
    </main>
  );
}
