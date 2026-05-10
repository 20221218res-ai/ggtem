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
  Toggle,
} from "../admin-prototype-ui";

const countries = [
  ["대한민국", "KR", "한국어", "KRW / USDT", <StatusPill key="kr" tone="green">운영 중</StatusPill>],
  ["중국", "CN", "중국어", "CNY / USDT", <StatusPill key="cn" tone="amber">준비 중</StatusPill>],
  ["베트남", "VN", "베트남어", "VND / USDT", <StatusPill key="vn" tone="amber">준비 중</StatusPill>],
  ["필리핀", "PH", "영어 / 타갈로그어", "PHP / USDT", <StatusPill key="ph" tone="amber">준비 중</StatusPill>],
  ["태국", "TH", "태국어", "THB / USDT", <StatusPill key="th" tone="amber">준비 중</StatusPill>],
];

const complianceRows = [
  ["전자상거래 고지", "청약철회/환불 규정", <Toggle key="commerce" />],
  ["개인정보", "국가별 개인정보 안내", <Toggle key="privacy" />],
  ["가상자산", "고액 거래 KYC 강화", <Toggle key="virtual-asset" />],
  ["게임 거래", "국가별 허용 게임 관리", <Toggle key="game-trade" />],
];

const countryRules = [
  ["입출금 수단", "USDT TRC20 / BEP20"],
  ["기본 언어", "한국어"],
  ["가격 표시", "KRW / USDT 병기"],
  ["고객 지원", "평일 09:00-22:00"],
];

const gamePolicyRows = [
  ["Lineage W", "대한민국", <StatusPill key="lw" tone="green">노출</StatusPill>],
  ["Lineage M", "대한민국", <StatusPill key="lm" tone="green">노출</StatusPill>],
  ["Lost Ark", "대한민국", <StatusPill key="la" tone="green">노출</StatusPill>],
  ["Genshin Impact", "글로벌", <StatusPill key="gi" tone="blue">검토</StatusPill>],
];

const launchChecklist = [
  ["언어팩", "상단 네비게이션, 홈, 매물, 지갑 핵심 문구"],
  ["통화", "현지 통화와 USDT 병기 정책"],
  ["입출금 안내", "체인, 최소 금액, 수수료, 처리 시간"],
  ["게임 노출", "국가별 허용 게임과 서버"],
  ["고객센터", "국가별 운영 시간과 문의 문구"],
];

export default async function AdminCountrySettingsPage() {
  await requirePageRole(ROLE_GROUPS.PLATFORM_ADMINS, {
    signInPath: "/admin/sign-in",
    forbiddenPath: "/admin",
  });
  return (
    <AdminMockPage
      icon="국가"
      title="국가별 설정"
      subtitle="언어, 통화, 입출금 안내, 게임 노출 기준을 국가별로 관리합니다."
      actions={
        <>
          <LinkLike href="/admin/reports?kind=country">국가별 리포트</LinkLike>
          <ButtonLike tone="primary" disabled title="국가 추가 기능 연결 예정">
            새 국가 추가 준비중
          </ButtonLike>
        </>
      }
    >
      <MetricGrid
        items={[
          { label: "운영 국가", value: "1", hint: "KR 운영 중", tone: "green" },
          { label: "준비 국가", value: "4", hint: "CN/VN/PH/TH", tone: "amber" },
          { label: "지원 언어", value: "6", hint: "한국어 포함", tone: "blue" },
          { label: "통화 설정", value: "5", hint: "USDT 기준", tone: "cyan" },
          { label: "규정 점검", value: "2", hint: "검토 필요", tone: "red" },
          { label: "국가별 게임", value: "18", hint: "노출/제한", tone: "slate" },
        ]}
      />

      <Panel title="출시 준비 흐름">
        <div className="grid gap-3 lg:grid-cols-4">
          <GuideBox title="1. 언어/통화">
            국가 코드, 기본 언어, 현지 통화와 USDT 병기 방식을 먼저 확정합니다.
          </GuideBox>
          <GuideBox title="2. 입출금 안내">
            TRC20/BEP20, 최소 출금액, 수수료, 최대 30분 처리 안내를 현지 언어로 확인합니다.
          </GuideBox>
          <GuideBox title="3. 게임 노출">
            국가별 허용 게임, 서버, 계정 거래 정책을 운영 기준과 맞춥니다.
          </GuideBox>
          <GuideBox title="4. 번역 점검">
            유저 작성 콘텐츠는 원문/번역 보기 정책으로 노출되는지 확인합니다.
          </GuideBox>
        </div>
      </Panel>

      <Panel title="서비스 국가">
        <DataTable headers={["국가", "코드", "언어", "통화", "상태"]} rows={countries} />
      </Panel>

      <section className="grid gap-5 xl:grid-cols-2">
        <Panel
          title="현재 운영 기준"
          action={
            <ButtonLike tone="primary" disabled title="국가별 운영 기준 저장 기능 연결 예정">
              저장 준비중
            </ButtonLike>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {countryRules.map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black text-slate-500">{label}</p>
                <p className="mt-2 text-lg font-black text-slate-950">{value}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="출시 전 체크">
          <DataTable headers={["항목", "확인 기준"]} rows={launchChecklist} />
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Panel title="규정 체크">
          <DataTable headers={["항목", "기준", "적용"]} rows={complianceRows} />
        </Panel>

        <Panel title="국가별 안내 문구">
          <div className="space-y-3">
            <GuideBox title="입금 안내">
              현 단계에서는 USDT 입금 주소와 TXID 확인 후 관리자가 수동 승인합니다.
            </GuideBox>
            <GuideBox title="출금 안내">
              출금은 TRC20/BEP20만 허용하고, 최대 30분 소요될 수 있음을 표시합니다.
            </GuideBox>
            <GuideBox title="번역 정책">
              유저가 작성한 제목과 설명은 원문 국기와 함께 표시하고, 선택 언어 기준 번역본을 함께 노출합니다.
            </GuideBox>
          </div>
        </Panel>
      </section>

      <Panel title="국가별 게임 노출">
        <DataTable headers={["게임", "적용 국가", "상태"]} rows={gamePolicyRows} />
      </Panel>

      <SoftNotice tone="cyan">
        국가 설정은 유저 화면의 언어, 통화, 결제 안내, 노출 게임과 연결됩니다. 신규 국가를 열기 전에는
        입출금 문구, 고객지원 시간, 허용 게임, 번역 정책을 먼저 확인하세요.
      </SoftNotice>
    </AdminMockPage>
  );
}

function GuideBox({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-black text-slate-950">{title}</p>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{children}</p>
    </div>
  );
}
