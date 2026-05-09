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

const modules = [
  ["메인 사이트", "홈/리스트/매물 조회", <StatusPill key="ok1" tone="green">정상</StatusPill>, <Toggle key="t1" />],
  ["주문/에스크로", "거래 생성, 대금 잠금", <StatusPill key="ok2" tone="green">정상</StatusPill>, <Toggle key="t2" />],
  ["출금 시스템", "USDT 출금 요청", <StatusPill key="ok3" tone="green">정상</StatusPill>, <Toggle key="t3" />],
  ["회원가입", "신규 유저 등록", <StatusPill key="ok4" tone="green">정상</StatusPill>, <Toggle key="t4" />],
  ["채팅 서버", "거래 채팅/CS 메시지", <StatusPill key="delay" tone="amber">지연</StatusPill>, <Toggle key="t5" />],
  ["KYC 시스템", "본인 확인", <StatusPill key="ok5" tone="green">정상</StatusPill>, <Toggle key="t6" />],
  ["이메일 발송", "운영 알림", <StatusPill key="ok6" tone="green">정상</StatusPill>, <Toggle key="t7" />],
  ["푸시 알림", "모바일 알림", <StatusPill key="check" tone="amber">점검</StatusPill>, <Toggle key="t8" on={false} />],
];

const schedules = [
  ["월간 정기 점검", "2026-04-25 02:00 KST", "2시간", "전체 서비스 중단"],
  ["푸시 알림 서버 업그레이드", "2026-04-22 03:00 KST", "30분", "푸시 알림만 중단"],
];

export default async function AdminMaintenancePage() {
  await requirePageRole(ROLE_GROUPS.PLATFORM_ADMINS, {
    signInPath: "/admin/sign-in",
    forbiddenPath: "/admin",
  });
  return (
    <AdminMockPage
      icon="점검"
      title="점검 / 유지보수"
      subtitle="서비스 모듈 점검, 긴급 차단, 사용자 공지를 관리합니다."
      actions={
        <>
          <LinkLike href="/admin/audit?query=MAINTENANCE">점검 이력</LinkLike>
          <ButtonLike tone="primary">새 점검 예약</ButtonLike>
        </>
      }
    >
      <MetricGrid
        items={[
          { label: "서비스 상태", value: "정상", hint: "전체 운영중", tone: "green" },
          { label: "다음 점검", value: "4일 후", hint: "4/25 02:00", tone: "amber" },
          { label: "지연 모듈", value: "1", hint: "채팅 서버", tone: "amber" },
          { label: "차단 모듈", value: "0", hint: "전체 정상", tone: "green" },
          { label: "공지 예약", value: "2", hint: "사용자 알림", tone: "blue" },
          { label: "긴급 액션", value: "3", hint: "킬스위치 버튼", tone: "red" },
        ]}
      />

      <SoftNotice tone="red">
        긴급 중단은 관리자 2차 확인 후 적용됩니다. 신규가입, 출금, 전체 서비스 순서로 차단할 수 있습니다.
      </SoftNotice>

      <Panel title="모듈별 가용성">
        <DataTable headers={["모듈", "범위", "상태", "전환"]} rows={modules} />
      </Panel>

      <section className="grid gap-5 xl:grid-cols-2">
        <Panel title="예정된 점검" action={<ButtonLike>공지 작성</ButtonLike>}>
          <DataTable headers={["점검", "시작", "예상", "영향"]} rows={schedules} />
        </Panel>

        <Panel title="사용자 미리보기" action={<ButtonLike tone="primary">저장</ButtonLike>}>
          <div className="rounded-lg bg-slate-950 p-8 text-center text-white">
            <p className="text-4xl">점검</p>
            <h2 className="mt-4 text-2xl font-black">서비스 점검 중입니다</h2>
            <p className="mt-3 text-sm font-semibold text-slate-300">
              더 나은 거래 환경을 위해 정기 점검을 진행합니다.
            </p>
            <p className="mt-6 rounded-lg bg-slate-800 px-4 py-3 text-xl font-black text-amber-300">
              2026-04-25 04:00 KST
            </p>
          </div>
        </Panel>
      </section>
    </AdminMockPage>
  );
}
