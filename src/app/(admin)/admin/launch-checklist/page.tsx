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
    "계정/권한",
    "최고관리자 계정만 활성화하고, 운영자/재무/CS 계정은 최고관리자가 생성합니다.",
    <StatusPill key="account" tone="amber">확인 필요</StatusPill>,
    "데모 계정 미노출, 관리자 회원가입 없음, 권한 변경 감사 로그 확인",
  ],
  [
    "입금",
    "유저가 TRC20/BEP20 중 선택하고 TXID를 제출하면 관리자가 승인 또는 반려합니다.",
    <StatusPill key="deposit" tone="amber">실거래 테스트 필요</StatusPill>,
    "승인 시 잔액 반영, 반려 시 잔액 유지, 중복 TXID 차단 확인",
  ],
  [
    "출금",
    "최소 20 USDT, 하루 2회, 4시간 쿨타임, TRC20/BEP20만 허용합니다.",
    <StatusPill key="withdrawal" tone="amber">실거래 테스트 필요</StatusPill>,
    "수수료, 총 차감액, 출금 잠금, 실패 롤백, 완료 TXID 확인",
  ],
  [
    "판매글/즉시구매",
    "판매글 등록 후 구매자가 즉시구매하면 구매자 잔액이 에스크로로 잠깁니다.",
    <StatusPill key="listing" tone="amber">시뮬레이션 필요</StatusPill>,
    "재고 차감, 주문 생성, 판매자 정산, 플랫폼 수수료 확인",
  ],
  [
    "구매글/즉시판매",
    "구매글 등록 시 구매자 금액이 잠기고, 판매자가 즉시판매로 거래를 시작합니다.",
    <StatusPill key="buy-request" tone="amber">시뮬레이션 필요</StatusPill>,
    "구매글 잠금 금액, 판매자 정산, 취소 환불, 분쟁 처리 확인",
  ],
  [
    "분쟁/신고",
    "분쟁이 접수되면 관리자 판단 전까지 출금과 정산 흐름을 보수적으로 막습니다.",
    <StatusPill key="dispute" tone="amber">시뮬레이션 필요</StatusPill>,
    "구매자 환불, 판매자 정산, 중복 처리 방지, 감사 로그 확인",
  ],
  [
    "알림",
    "입금 승인/반려, 출금 승인/실패, 채팅, 분쟁, 인수확정 요청을 알립니다.",
    <StatusPill key="notification" tone="amber">누락 점검</StatusPill>,
    "유저 알림함, 실시간 API, 주문 채팅 알림 확인",
  ],
  [
    "다국어",
    "KR/CN/VN/PH/TH 화면에서 핵심 버튼과 상태 문구가 고정 한국어로 남지 않아야 합니다.",
    <StatusPill key="locale" tone="amber">화면 QA</StatusPill>,
    "마이페이지, 지갑, 매물 목록, 상세, 채팅, 등록 화면 확인",
  ],
  [
    "배포/모니터링",
    "Vercel, Supabase, 도메인, 백업, 로그, 비용 알림을 운영 기준으로 설정합니다.",
    <StatusPill key="deploy" tone="amber">운영 설정</StatusPill>,
    "환경변수, 빌드 로그, DB 백업, 장애 대응 연락 기준 확인",
  ],
];

const scenarioRows = [
  [
    "회원가입",
    "유저 A/B 생성, 이메일 인증 또는 테스트 로그인 확인",
    "유저 권한 CUSTOMER, 지갑 자동 생성, 관리자 계정과 분리",
  ],
  [
    "충전",
    "유저 A가 충전 신청 후 TXID 제출, 관리자가 승인",
    "available/withdrawable 증가, 입금 요청 상태 CONFIRMED",
  ],
  [
    "판매글 작성",
    "유저 B가 게임머니 판매글 작성",
    "카테고리 필수값, 서버, 수량, 단가, 전달 방식 검증",
  ],
  [
    "즉시구매",
    "유저 A가 유저 B 판매글 즉시구매",
    "구매자 available 감소, escrow 증가, 주문 생성",
  ],
  [
    "거래 완료",
    "인수확정 또는 관리자 완료 처리",
    "구매자 escrow 감소, 판매자 정산, 수수료 기록",
  ],
  [
    "취소/환불",
    "진행 중 주문 취소 또는 분쟁 환불",
    "구매자 잔액 복구, 재고 복구, 중복 환불 차단",
  ],
  [
    "출금",
    "성공 거래 조건 충족 후 출금 요청",
    "정책 검증, 출금 잠금, 완료/반려 시 잔액 일관성",
  ],
  [
    "감사 로그",
    "관리자 입금/출금/분쟁/권한 조작 기록 확인",
    "누가, 언제, 무엇을, 왜 처리했는지 추적 가능",
  ],
];

const runbookRows = [
  ["로컬 1회 빠른 점검", "$env:GGITEM_OVERNIGHT_CYCLES=1; npm.cmd run test:service-simulation"],
  ["반복 시뮬레이션", "npm.cmd run test:service-simulation"],
  ["타입 검사", "npm.cmd run typecheck"],
  ["프로덕션 빌드", "npm.cmd run build"],
  ["결과 파일", "test-results/overnight-service-simulation-*/summary.md"],
];

export default async function LaunchChecklistPage() {
  await requirePageRole(ROLE_GROUPS.ADMIN_OPERATORS, {
    signInPath: "/admin/sign-in",
    forbiddenPath: "/admin",
  });

  return (
    <AdminMockPage
      icon="LAUNCH"
      title="출시 준비 체크"
      subtitle="실운영 전에 돈, 거래, 권한, 알림, 배포 상태를 마지막으로 확인합니다."
      actions={
        <>
          <LinkLike href="/admin/finance/reconciliation" tone="primary">
            정산 대조
          </LinkLike>
          <LinkLike href="/admin/audit">감사 로그</LinkLike>
          <LinkLike href="/admin/reports">리포트</LinkLike>
        </>
      }
    >
      <MetricGrid
        items={[
          { label: "점검 항목", value: "9", hint: "출시 전 확인할 운영 묶음", tone: "blue" },
          { label: "실거래 테스트", value: "5", hint: "충전, 거래, 정산, 환불, 출금", tone: "amber" },
          { label: "운영 설정", value: "2", hint: "권한과 배포 모니터링", tone: "cyan" },
          { label: "자동 테스트", value: "26+", hint: "서비스 시뮬레이션 스모크 테스트", tone: "green" },
        ]}
      />

      <SoftNotice tone="amber">
        현재 운영 DB는 최고관리자 1명만 있는 깨끗한 상태입니다. 테스트 유저와 테스트 금액을 넣는 단계부터는
        실제 운영 데이터가 생기므로, 실행 전에 범위를 정하고 진행해야 합니다.
      </SoftNotice>

      <Panel title="운영 체크리스트">
        <DataTable
          headers={["묶음", "완료 기준", "상태", "확인 포인트"]}
          rows={checklistRows}
        />
      </Panel>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Panel title="수동 시뮬레이션 순서">
          <DataTable headers={["시나리오", "흐름", "검증 기준"]} rows={scenarioRows} />
        </Panel>

        <Panel title="자동 테스트 실행">
          <DataTable headers={["목적", "명령어 또는 위치"]} rows={runbookRows} />
        </Panel>
      </section>
    </AdminMockPage>
  );
}
