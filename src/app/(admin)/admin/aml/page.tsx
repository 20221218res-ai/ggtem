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

const alertRows = [
  [<StatusPill key="critical" tone="red">긴급</StatusPill>, "블랙리스트 지갑 거래 시도", "suspicious_073", "$4,800", "98", "15분 전", "즉시 차단"],
  [<StatusPill key="structuring" tone="red">긴급</StatusPill>, "스머핑 의심", "newbie_fresh", "$69,300", "91", "32분 전", "자금 동결"],
  [<StatusPill key="mixer" tone="red">긴급</StatusPill>, "믹서 서비스 연결", "anon_trader_x", "$12,400", "95", "1시간 전", "STR 준비"],
  [<StatusPill key="volume" tone="amber">주의</StatusPill>, "거래량 급증", "sleeping_account_42", "$28,400", "68", "2시간 전", "조사"],
  [<StatusPill key="pep" tone="blue">확인</StatusPill>, "PEP 일치 의심", "ahmed_al_rashid", "$8,400", "54", "6시간 전", "EDD 개시"],
];

const ruleRows = [
  ["고액 거래 알림", "단일 거래 $10,000 이상 자동 알림"],
  ["스머핑 감지", "$9,000-$9,999 구간 반복 거래 감지"],
  ["블랙리스트 지갑 대조", "OFAC SDN 리스트 실시간 대조"],
  ["거래량 급증", "평균 대비 10배 이상 이상 거래 감지"],
  ["PEP/제재 인물 체크", "외부 데이터 연동 예정"],
  ["순환 거래 패턴", "같은 그룹 내 반복 거래 감지"],
];

const walletRows = [
  ["TN9k...x2M1", "TRC20", "제재 대상", "OFAC SDN List / 북한 관련", "OFAC", "3건 시도", "2025-11-14"],
  ["0x8Fa...c4E2", "ERC20", "믹서", "Tornado Cash 출금 주소", "Chainalysis", "12건", "2025-09-22"],
  ["TKx2...m8H9", "TRC20", "의심", "과거 피싱 공격 연관", "내부 조사", "1건", "2026-02-08"],
];

export default async function AmlPage() {
  await requirePageRole(ROLE_GROUPS.ADMIN_OPERATORS, {
    signInPath: "/admin/sign-in",
    forbiddenPath: "/admin",
  });
  return (
    <AdminMockPage
      icon="AML"
      title="AML 모니터링"
      subtitle="의심 거래, 블랙리스트 지갑, STR 제출 준비 상태를 확인합니다."
      actions={
        <>
          <LinkLike href="/admin/risk">리스크 콘솔</LinkLike>
          <LinkLike href="/admin/users">유저 콘솔</LinkLike>
          <LinkLike href="/admin/finance/ledger">지갑 원장</LinkLike>
          <LinkLike href="/admin/audit?query=AML">감사 로그</LinkLike>
          <ButtonLike tone="primary" disabled title="보고서 생성 기능 연결 예정">
            FIU 보고서 준비중
          </ButtonLike>
        </>
      }
    >
      <SoftNotice tone="blue">
        실제 자금 동결, 영구 제한, STR 제출은 관리자 승인과 감사 로그를 남긴 뒤 처리합니다.
      </SoftNotice>

      <MetricGrid
        items={[
          { label: "긴급 알림", value: "3", hint: "즉시 검토 필요", tone: "red" },
          { label: "미처리", value: "12", hint: "조사 대기", tone: "amber" },
          { label: "오늘 감지", value: "28", hint: "규칙 12개 실행", tone: "blue" },
          { label: "블랙리스트", value: "47", hint: "지갑 차단 중", tone: "cyan" },
          { label: "STR 제출", value: "3", hint: "이번 분기", tone: "cyan" },
          { label: "회수 자금", value: "$4,820", hint: "피해 방지", tone: "green" },
        ]}
      />

      <Panel title="즉시 작업">
        <div className="grid gap-3 lg:grid-cols-4">
          <AmlActionCard
            title="고위험 유저 확인"
            body="신고, 낮은 리뷰, 계정 제한 후보를 함께 확인합니다."
            href="/admin/risk?severity=CRITICAL"
          />
          <AmlActionCard
            title="지갑 원장 대조"
            body="입출금, 에스크로, 관리자 조치 내역을 원장에서 확인합니다."
            href="/admin/finance/ledger"
          />
          <AmlActionCard
            title="출금 보류 확인"
            body="출금 요청의 네트워크, 주소, 처리 상태를 확인합니다."
            href="/admin/withdrawals"
          />
          <AmlActionCard
            title="감사 로그 추적"
            body="자금 동결, 제한, 보고서 생성 이력을 확인합니다."
            href="/admin/audit?query=AML"
          />
        </div>
      </Panel>

      <Panel title="긴급 AML 알림">
        <DataTable
          headers={["심각도", "알림 유형", "대상", "금액", "위험도", "발생", "조치"]}
          rows={alertRows}
        />
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="의심 자금 흐름">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-5">
            <div className="grid gap-3 text-sm font-black md:grid-cols-3">
              <FlowNode label="account_A" amount="$9,900" tone="blue" />
              <FlowNode label="중개 지갑" amount="$19,700" tone="amber" />
              <FlowNode label="Tornado Cash" amount="$19,700" tone="red" />
            </div>
            <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
              패턴 감지: 두 계정이 동일 지갑으로 반복 이동했습니다.
            </p>
          </div>
        </Panel>

        <Panel
          title="AML 감시 규칙"
          action={
            <ButtonLike tone="primary" disabled title="규칙 편집 기능 연결 예정">
              새 규칙 준비중
            </ButtonLike>
          }
        >
          <div className="divide-y divide-slate-100">
            {ruleRows.map(([title, desc]) => (
              <div key={title} className="flex items-center justify-between gap-4 py-4">
                <div>
                  <p className="font-black">{title}</p>
                  <p className="mt-1 text-sm text-slate-500">{desc}</p>
                </div>
                <Toggle />
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel
        title="블랙리스트 지갑"
        action={
          <>
            <ButtonLike disabled title="외부 제재 목록 동기화 기능 연결 예정">
              OFAC 동기화 준비중
            </ButtonLike>
            <ButtonLike tone="primary" disabled title="블랙리스트 지갑 수동 추가 기능 연결 예정">
              수동 추가 준비중
            </ButtonLike>
          </>
        }
      >
        <DataTable
          headers={["지갑 주소", "네트워크", "유형", "사유", "소스", "차단 건수", "등록일"]}
          rows={walletRows}
        />
      </Panel>
    </AdminMockPage>
  );
}

function AmlActionCard({
  title,
  body,
  href,
}: {
  title: string;
  body: string;
  href: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-black text-slate-950">{title}</p>
      <p className="mt-2 min-h-10 text-xs font-semibold leading-5 text-slate-500">{body}</p>
      <div className="mt-4">
        <LinkLike href={href} tone="primary">
          열기
        </LinkLike>
      </div>
    </div>
  );
}

function FlowNode({
  label,
  amount,
  tone,
}: {
  label: string;
  amount: string;
  tone: "blue" | "amber" | "red";
}) {
  const classes = {
    blue: "border-blue-300 bg-blue-50 text-blue-900",
    amber: "border-amber-300 bg-amber-50 text-amber-900",
    red: "border-red-300 bg-red-50 text-red-900",
  };

  return (
    <div className={`rounded-lg border px-4 py-5 text-center ${classes[tone]}`}>
      <p>{label}</p>
      <p className="mt-2">{amount}</p>
    </div>
  );
}
