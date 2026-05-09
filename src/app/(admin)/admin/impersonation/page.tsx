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

const sessionRows = [
  [<StatusPill key="cs" tone="blue">CS</StatusPill>, "lee_aden", "읽기 전용", "지갑 금액 오류 확인", "14분째 진행 중", <StatusPill key="active" tone="green">진행</StatusPill>],
  [<StatusPill key="admin" tone="slate">ADMIN</StatusPill>, "kim_trader", "읽기 전용", "매물 등록 버튼 재현", "1시간 전 종료", <StatusPill key="closed" tone="green">종료</StatusPill>],
  [<StatusPill key="owner" tone="red">OWNER</StatusPill>, "yuki_trader", "읽기 전용", "VIP 화면 확인", "어제 종료", <StatusPill key="closed2" tone="green">종료</StatusPill>],
];

const chatRules = [
  ["외부 거래 유도", "구매자/판매자 경고와 리스크 로그", "즉시"],
  ["개인정보 노출", "메시지 숨김 검토와 양측 안내", "높음"],
  ["욕설/비방", "경고 발송과 반복 시 제한 검토", "높음"],
  ["고액 거래", "에스크로/지갑 상태 추가 확인", "주의"],
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
      subtitle="유저 화면 확인과 채팅 위험 신호를 관리합니다."
      actions={
        <>
          <LinkLike href="/admin/users">유저 관리</LinkLike>
          <LinkLike href="/admin/audit?targetType=IMPERSONATION_SESSION">감사 로그</LinkLike>
        </>
      }
    >
      <MetricGrid
        items={[
          { label: "활성 세션", value: "1", hint: "읽기 전용", tone: "blue" },
          { label: "AI 플래그", value: "24", hint: "즉시 확인 필요", tone: "red" },
          { label: "외부 유도 감지", value: "8", hint: "연락처 공유 의심", tone: "amber" },
          { label: "동의 정확도", value: "91%", hint: "관리자 동의율", tone: "green" },
        ]}
      />

      <SoftNotice tone="amber">
        임파서네이션은 민감 작업이므로 사유, 담당자, 시작/종료 시각을 감사 로그에 남깁니다.
      </SoftNotice>

      <Panel title="최근 세션">
        <DataTable headers={["권한", "대상 유저", "모드", "사유", "시간", "상태"]} rows={sessionRows} />
      </Panel>

      <Panel title="채팅 개입 규칙">
        <DataTable headers={["신호", "조치", "우선순위"]} rows={chatRules} />
      </Panel>
    </AdminMockPage>
  );
}
