import { requirePageRole, ROLE_GROUPS } from "@/lib/auth/guards";
import {
  AdminMockPage,
  DataTable,
  LinkLike,
  MetricGrid,
  Panel,
  SoftNotice,
  StatusPill,
} from "../admin-prototype-ui";

const checklistRows = [
  [
    "거래/에스크로",
    "충전 -> 구매 -> 에스크로 잠금 -> 채팅 -> 인수확정 -> 정산",
    <StatusPill key="trade" tone="green">통과</StatusPill>,
    "중복 완료, 중복 환불, 음수 잔액 차단",
  ],
  [
    "구매요청",
    "구매글 등록 -> 판매자 즉시판매 -> 주문 생성 -> 정산/환불",
    <StatusPill key="buy-request" tone="green">통과</StatusPill>,
    "구매자 잠금금, 판매자 정산, 분쟁 판정",
  ],
  [
    "입금",
    "USDT 입금 요청 -> 관리자 승인/반려 -> 잔액 반영",
    <StatusPill key="deposit" tone="green">통과</StatusPill>,
    "중복 승인/반려 방어, 감사 로그",
  ],
  [
    "출금",
    "최소 20 USDT, 일 2회, 4시간 쿨타임, TRC20/BEP20",
    <StatusPill key="withdrawal" tone="amber">재검증</StatusPill>,
    "큐 처리, TXID 완료, 실패 롤백",
  ],
  [
    "분쟁/신고",
    "분쟁 접수 -> 에스크로 유지 -> 구매자/판매자 승소 판정",
    <StatusPill key="dispute" tone="green">통과</StatusPill>,
    "중복 판정 방어, 관리자 처리 로그",
  ],
  [
    "관리자 권한",
    "최고관리자, 재무, CS, 운영 역할별 접근 제한",
    <StatusPill key="permission" tone="green">통과</StatusPill>,
    "권한 변경, 초대, 감사 로그",
  ],
  [
    "리포트",
    "날짜별 주문/입출금/분쟁/신고/수익/관리자 이력 조회",
    <StatusPill key="report" tone="green">통과</StatusPill>,
    "CSV/XLSX 다운로드와 감사 로그",
  ],
  [
    "국가/언어",
    "KR/CN/VN/PH/TH 선택, 게임/서버/통화 표시",
    <StatusPill key="locale" tone="amber">화면 QA</StatusPill>,
    "고정 한글 문구, 사용자 작성글 번역 정책",
  ],
  [
    "출시 환경",
    "환경변수, DB 마이그레이션, 빌드, 운영 서버",
    <StatusPill key="deploy" tone="amber">외부 설정</StatusPill>,
    "실제 지갑 주소, 백업, 모니터링, 법무 검토",
  ],
];

const scenarioRows = [
  ["정상 거래", "충전 -> 구매 -> 정산", "잔액/잠금/수수료 검증"],
  ["거래 취소", "에스크로 잠금 -> 취소", "환불 및 중복 환불 방어"],
  ["잔액 부족", "보유 금액보다 큰 구매", "주문 생성 차단"],
  ["출금 정책", "금액/횟수/쿨타임/체인", "수수료 및 제한 검증"],
  ["분쟁 처리", "구매자/판매자 승소", "잠금 유지 및 중복 판정 방어"],
  ["감사 로그", "관리자 액션 전체", "입금/출금/분쟁/권한 변경 기록"],
];

export default async function LaunchChecklistPage() {
  await requirePageRole(ROLE_GROUPS.ADMIN_OPERATORS, {
    signInPath: "/admin/sign-in",
    forbiddenPath: "/admin",
  });
  return (
    <AdminMockPage
      icon="LAUNCH"
      title="출시 준비 체크리스트"
      subtitle="실서비스 전 잔액, 에스크로, 출금, 권한, 리포트를 마지막으로 확인합니다."
      actions={
        <>
          <LinkLike href="/admin/reports">리포트</LinkLike>
          <LinkLike href="/admin/audit">감사 로그</LinkLike>
          <LinkLike href="/admin/finance/reconciliation" tone="primary">정산 대조</LinkLike>
        </>
      }
    >
      <MetricGrid
        items={[
          { label: "전체 항목", value: "9", hint: "출시 전 확인할 큰 항목", tone: "blue" },
          { label: "통과", value: "5", hint: "현재 기능 검증 완료", tone: "green" },
          { label: "재검증", value: "3", hint: "운영 전 반복 확인 필요", tone: "amber" },
          { label: "외부 설정", value: "1", hint: "실제 운영 인프라와 법무 설정", tone: "red" },
        ]}
      />

      <SoftNotice tone="amber">
        실제 서비스 전에는 `npm run test:service-simulation`으로 반복 시뮬레이션을 실행하고,
        실패 로그가 0건인지 확인해야 합니다.
      </SoftNotice>

      <Panel title="운영 체크리스트">
        <DataTable headers={["묶음", "완료 기준", "상태", "확인 포인트"]} rows={checklistRows} />
      </Panel>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Panel title="핵심 테스트 시나리오">
          <DataTable headers={["시나리오", "흐름", "검증"]} rows={scenarioRows} />
        </Panel>

        <Panel title="테스트 실행 방법">
          <div className="grid gap-3 text-sm font-bold text-slate-800">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black text-slate-500">전체 반복 시뮬레이션</p>
              <code className="mt-2 block rounded bg-slate-950 px-3 py-2 text-white">
                npm run test:service-simulation
              </code>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black text-slate-500">1회만 빠르게 확인</p>
              <code className="mt-2 block rounded bg-slate-950 px-3 py-2 text-white">
                $env:GGITEM_OVERNIGHT_CYCLES=1; npm run test:service-simulation
              </code>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black text-slate-500">결과 위치</p>
              <code className="mt-2 block rounded bg-slate-950 px-3 py-2 text-white">
                test-results/overnight-service-simulation-*/summary.md
              </code>
            </div>
          </div>
        </Panel>
      </section>
    </AdminMockPage>
  );
}
