import { requirePageRole, ROLE_GROUPS } from "@/lib/auth/guards";
import {
  AdminMockPage,
  ButtonLike,
  DataTable,
  LinkLike,
  MetricGrid,
  Panel,
  SoftNotice,
  StatusPill,
} from "../admin-prototype-ui";

const documents = [
  ["개인정보처리방침", <StatusPill key="draft" tone="amber">검토 대기</StatusPill>, "한국어", "v3.2", "법무 확인"],
  ["이용약관", <StatusPill key="live" tone="green">게시중</StatusPill>, "한국어/영어", "v2.8", "수정"],
  ["판매자 약관", <StatusPill key="live2" tone="green">게시중</StatusPill>, "한국어", "v2.5", "수정"],
  ["구매자 FAQ", <StatusPill key="translate" tone="amber">번역 필요</StatusPill>, "한국어", "v1.9", "번역"],
  ["출금 정책", <StatusPill key="draft2" tone="amber">검토 대기</StatusPill>, "한국어", "v1.1", "승인"],
];

const revisions = [
  ["v3.2", "AML/출금 정책 문구 추가", "김태현", "검토 대기"],
  ["v3.1", "개인정보 처리 목적 업데이트", "박민지", "게시중"],
  ["v3.0", "UAE 운영 기준 반영", "이준영", "이전"],
  ["v2.8", "게임 거래 금지 항목 정리", "김태현", "이전"],
];

export default async function AdminCmsPage() {
  await requirePageRole(ROLE_GROUPS.PLATFORM_ADMINS, {
    signInPath: "/admin/sign-in",
    forbiddenPath: "/admin",
  });
  return (
    <AdminMockPage
      icon="문서"
      title="콘텐츠 관리"
      subtitle="약관, 정책, FAQ, 공지 문서를 운영합니다."
      actions={
        <>
          <LinkLike href="/admin/audit?targetType=CMS">변경 이력</LinkLike>
          <ButtonLike>HTML 내보내기</ButtonLike>
          <ButtonLike tone="primary">새 문서</ButtonLike>
        </>
      }
    >
      <MetricGrid
        items={[
          { label: "전체 문서", value: "24", hint: "약관 8, 가이드 12, FAQ 4", tone: "blue" },
          { label: "검토 대기", value: "3", hint: "게시 전 승인 필요", tone: "amber" },
          { label: "번역 필요", value: "2", hint: "다국어 미반영", tone: "red" },
          { label: "게시중", value: "19", hint: "사용자 노출", tone: "green" },
          { label: "월간 조회", value: "47K", hint: "최근 30일", tone: "cyan" },
          { label: "긴급 수정", value: "1", hint: "출금 정책", tone: "amber" },
        ]}
      />

      <Panel title="게시 운영 흐름">
        <div className="grid gap-3 lg:grid-cols-4">
          <CmsFlowCard
            title="초안 작성"
            body="약관, FAQ, 공지의 대상 국가와 언어를 먼저 정합니다."
          />
          <CmsFlowCard
            title="검토 요청"
            body="출금, 개인정보, 분쟁 관련 문서는 게시 전 법무/운영 검토가 필요합니다."
          />
          <CmsFlowCard
            title="번역 확인"
            body="KR, CN, VN, PH, TH 노출 문구가 같은 의미로 표시되는지 확인합니다."
          />
          <CmsFlowCard
            title="게시 추적"
            body="게시 후 변경 사유와 버전 이력을 감사 로그에서 확인합니다."
          />
        </div>
      </Panel>

      <section className="grid gap-5 xl:grid-cols-[320px_1fr]">
        <Panel title="문서 묶음">
          <div className="space-y-2">
            {["약관/정책", "거래 가이드", "입출금 FAQ", "보안 공지", "VIP 안내"].map((item, index) => (
              <button
                key={item}
                className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left text-sm font-black ${
                  index === 0
                    ? "border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_14%,white)] text-slate-950"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                <span>{item}</span>
                <StatusPill tone={index === 0 ? "amber" : "green"}>
                  {index === 0 ? "검토" : "정상"}
                </StatusPill>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="게시 전 확인" action={<ButtonLike tone="primary">게시 요청</ButtonLike>}>
          <SoftNotice tone="amber">출금 정책은 게시 전 법무/운영 승인 후 사용자에게 노출됩니다.</SoftNotice>
          <div className="mt-5">
            <DataTable headers={["문서", "상태", "언어", "버전", "다음 작업"]} rows={documents} />
          </div>
        </Panel>
      </section>

      <Panel title="버전 이력" action={<ButtonLike>diff 보기</ButtonLike>}>
        <DataTable headers={["버전", "변경 내용", "작성자", "상태"]} rows={revisions} />
      </Panel>
    </AdminMockPage>
  );
}

function CmsFlowCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-black text-slate-950">{title}</p>
      <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{body}</p>
    </div>
  );
}
