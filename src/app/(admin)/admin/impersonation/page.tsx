import { requirePageRole, ROLE_GROUPS } from "@/lib/auth/guards";
import {
  AdminMockPage,
  DataTable,
  LinkLike,
  MetricGrid,
  Panel,
  StatusPill,
} from "../admin-prototype-ui";

const sessionRows = [
  [<StatusPill key="cs" tone="blue">CS</StatusPill>, "lee_aden", "읽기 전용", "지갑 금액 오류 확인", "14분째 진행 중", <StatusPill key="active" tone="green">진행</StatusPill>],
  [<StatusPill key="admin" tone="slate">ADMIN</StatusPill>, "kim_trader", "읽기 전용", "매물 등록 버튼 재현", "1시간 전 종료", <StatusPill key="closed" tone="green">종료</StatusPill>],
  [<StatusPill key="owner" tone="red">OWNER</StatusPill>, "yuki_trader", "읽기 전용", "VIP 화면 확인", "어제 종료", <StatusPill key="closed2" tone="green">종료</StatusPill>],
];

const chatRules = [
  ["외부 거래 유도", "경고 / 로그", "즉시"],
  ["개인정보 노출", "숨김 검토", "높음"],
  ["욕설/비방", "경고 / 제한", "높음"],
  ["고액 거래", "에스크로 확인", "주의"],
];

export default async function ImpersonationPage() {
  await requirePageRole(ROLE_GROUPS.PLATFORM_ADMINS, {
    signInPath: "/admin/sign-in",
    forbiddenPath: "/admin",
  });
  return (
    <AdminMockPage
      icon="USER"
      title="임파서네이션 & 채팅 모니터링"
      subtitle=""
      actions={
        <>
          <LinkLike href="/admin/users">유저 관리</LinkLike>
          <LinkLike href="/admin/audit?targetType=IMPERSONATION_SESSION">감사 로그</LinkLike>
        </>
      }
    >
      <MetricGrid
        items={[
          { label: "활성 세션", value: "1", hint: "", tone: "blue" },
          { label: "AI 플래그", value: "24", hint: "", tone: "red" },
          { label: "외부 유도", value: "8", hint: "", tone: "amber" },
          { label: "동의율", value: "91%", hint: "", tone: "green" },
        ]}
      />

      <Panel
        title="최근 세션"
        action={
          <StatusPill tone="blue">
            진행 1건
          </StatusPill>
        }
      >
        <DataTable headers={["권한", "대상 유저", "모드", "사유", "시간", "상태"]} rows={sessionRows} />
      </Panel>

      <details className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <summary className="cursor-pointer text-lg font-black text-slate-950">
          채팅 개입 기준
        </summary>
        <div className="mt-4">
          <DataTable headers={["신호", "조치", "우선순위"]} rows={chatRules} />
        </div>
      </details>
    </AdminMockPage>
  );
}
