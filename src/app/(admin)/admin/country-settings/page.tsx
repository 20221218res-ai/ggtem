import { requirePageRole, ROLE_GROUPS } from "@/lib/auth/guards";
import {
  AdminMockPage,
  ButtonLike,
  DataTable,
  LinkLike,
  MetricGrid,
  Panel,
  StatusPill,
} from "../admin-prototype-ui";

const countryRows = [
  ["KR", "한국어", "KRW / USDT", <StatusPill key="kr" tone="green">운영</StatusPill>],
  ["CN", "중국어", "CNY / USDT", <StatusPill key="cn" tone="amber">준비</StatusPill>],
  ["VN", "베트남어", "VND / USDT", <StatusPill key="vn" tone="amber">준비</StatusPill>],
  ["PH", "영어 / 필리핀", "PHP / USDT", <StatusPill key="ph" tone="amber">준비</StatusPill>],
  ["TH", "태국어", "THB / USDT", <StatusPill key="th" tone="amber">준비</StatusPill>],
];

export default async function AdminCountrySettingsPage() {
  await requirePageRole(ROLE_GROUPS.PLATFORM_ADMINS, {
    signInPath: "/admin/sign-in",
    forbiddenPath: "/admin",
  });

  return (
    <AdminMockPage
      icon="LANG"
      title="국가 설정"
      subtitle="국가별 언어와 통화 상태"
      actions={
        <>
          <LinkLike href="/admin/cms">문구 관리</LinkLike>
          <LinkLike href="/admin/game-settings">게임/서버</LinkLike>
          <ButtonLike tone="primary" disabled title="국가 추가 기능은 연결 전입니다.">
            국가 추가 준비중
          </ButtonLike>
        </>
      }
    >
      <MetricGrid
        items={[
          { label: "운영 국가", value: "1", hint: "", tone: "green" },
          { label: "준비 국가", value: "4", hint: "", tone: "amber" },
          { label: "기준 통화", value: "USDT", hint: "", tone: "cyan" },
          { label: "게임 노출", value: "어드민", hint: "", tone: "blue" },
        ]}
      />

      <Panel title="국가별 상태">
        <DataTable headers={["국가", "언어", "통화", "상태"]} rows={countryRows} />
      </Panel>
    </AdminMockPage>
  );
}
