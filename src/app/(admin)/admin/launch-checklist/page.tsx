import { requirePageRole, ROLE_GROUPS } from "@/lib/auth/guards";
import {
  AdminMockPage,
  DataTable,
  LinkLike,
  MetricGrid,
  Panel,
  StatusPill,
} from "../admin-prototype-ui";

export default async function LaunchChecklistPage() {
  await requirePageRole(ROLE_GROUPS.ADMIN_OPERATORS, {
    signInPath: "/admin/sign-in",
    forbiddenPath: "/admin",
  });

  const runtimeChecks = getRuntimeChecks();
  const readyCount = runtimeChecks.filter((item) => item.status === "ready").length;
  const warningCount = runtimeChecks.filter((item) => item.status === "warning").length;
  const missingCount = runtimeChecks.filter((item) => item.status === "missing").length;
  const checkRows = runtimeChecks.map((item) => [
    item.label,
    <StatusPill key={item.key} tone={statusTone(item.status)}>
      {statusLabel(item.status)}
    </StatusPill>,
    item.detail,
  ]);

  return (
    <AdminMockPage
      icon="LAUNCH"
      title="출시 체크"
      subtitle=""
      actions={
        <>
          <LinkLike href="/admin/finance/reconciliation" tone="primary">정산 대조</LinkLike>
          <LinkLike href="/admin/audit">감사 로그</LinkLike>
          <LinkLike href="/admin/reports">리포트</LinkLike>
        </>
      }
    >
      <MetricGrid
        items={[
          { label: "필수", value: String(runtimeChecks.length), hint: "", tone: "blue" },
          { label: "완료", value: String(readyCount), hint: "", tone: "green" },
          { label: "확인 필요", value: String(warningCount), hint: "", tone: "amber" },
          { label: "누락", value: String(missingCount), hint: "", tone: missingCount > 0 ? "red" : "cyan" },
        ]}
      />

      <Panel title="필수 항목">
        <DataTable headers={["항목", "상태", "이동"]} rows={checkRows} />
      </Panel>

      <Panel title="바로가기">
        <div className="grid gap-3 md:grid-cols-5">
          <LinkLike href="/admin/admin-accounts">관리자</LinkLike>
          <LinkLike href="/admin/deposit-addresses">주소</LinkLike>
          <LinkLike href="/admin/deposits" tone="primary">충전</LinkLike>
          <LinkLike href="/admin/withdrawals">출금</LinkLike>
          <LinkLike href="/admin/disputes">분쟁</LinkLike>
        </div>
      </Panel>
    </AdminMockPage>
  );
}

type RuntimeCheckStatus = "ready" | "warning" | "missing";

type RuntimeCheck = {
  key: string;
  label: string;
  status: RuntimeCheckStatus;
  detail: string;
};

function getRuntimeChecks(): RuntimeCheck[] {
  const uploadStorage = process.env.GGITEM_UPLOAD_STORAGE?.trim();
  const supabaseUploadEnabled = uploadStorage === "supabase";

  return [
    envCheck("database", "운영 DB", "DATABASE_URL", "거래/회원 데이터 저장"),
    envCheck("order-storage", "주문 저장소", "GGITEM_ORDER_STORAGE", "prisma 권장"),
    envCheck("cron-secret", "Cron 인증", "CRON_SECRET", "10분 maintenance 보호"),
    envCheck("account-secret", "계정거래 암호화", "GGITEM_ACCOUNT_CREDENTIAL_SECRET", "계정 정보 보관 암호화"),
    envCheck("web-push-public", "웹푸시 공개키", "GGITEM_WEB_PUSH_PUBLIC_KEY", "PWA 알림 구독"),
    envCheck("web-push-private", "웹푸시 개인키", "GGITEM_WEB_PUSH_PRIVATE_KEY", "PWA 알림 발송"),
    envCheck("base-url", "서비스 URL", "GGITEM_BASE_URL", "이메일/사이트맵 기준 URL"),
    envCheck("admin-url", "관리자 URL", "ADMIN_BASE_URL", "관리자 도메인 분리"),
    {
      key: "upload-storage",
      label: "이미지 저장소 모드",
      status: supabaseUploadEnabled ? "ready" : "warning",
      detail: supabaseUploadEnabled ? "Supabase Storage 사용" : "로컬 업로드 사용 중",
    },
    envCheck("supabase-url", "Supabase URL", "SUPABASE_URL", "이미지 영구 저장"),
    envCheck(
      "supabase-service-role",
      "Supabase service role",
      "SUPABASE_SERVICE_ROLE_KEY",
      "이미지 업로드 쓰기 권한",
    ),
    envCheck("upload-bucket", "업로드 버킷", "GGITEM_UPLOAD_BUCKET", "ggtem-uploads"),
  ];
}

function envCheck(key: string, label: string, envName: string, detail: string): RuntimeCheck {
  return {
    key,
    label,
    status: process.env[envName]?.trim() ? "ready" : "missing",
    detail,
  };
}

function statusLabel(status: RuntimeCheckStatus) {
  if (status === "ready") return "설정";
  if (status === "warning") return "확인";
  return "누락";
}

function statusTone(status: RuntimeCheckStatus): "green" | "amber" | "red" {
  if (status === "ready") return "green";
  if (status === "warning") return "amber";
  return "red";
}
