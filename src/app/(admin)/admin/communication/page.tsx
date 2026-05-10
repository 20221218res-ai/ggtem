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

const campaignRows = [
  ["4월 이벤트 종료 안내", "이메일", "12,847명", <StatusPill key="scheduled" tone="amber">예약</StatusPill>, "오늘 19:00"],
  ["2주년 이벤트 안내", "이메일", "42,187명", <StatusPill key="done" tone="green">완료</StatusPill>, "4/1 10:00"],
  ["신규 가입 웰컴", "이메일+푸시", "247명", <StatusPill key="auto" tone="blue">자동화</StatusPill>, "상시"],
  ["서버 점검 사전 안내", "푸시", "28,421명", <StatusPill key="done2" tone="green">완료</StatusPill>, "4/18 18:00"],
  ["KYC 재인증 요청", "이메일", "47명", <StatusPill key="blocked" tone="red">차단</StatusPill>, "스팸 필터"],
];

const channels = [
  ["이메일", "SendGrid", "84K/월", <StatusPill key="active" tone="green">활성</StatusPill>],
  ["푸시 알림", "FCM", "58K/월", <StatusPill key="active2" tone="green">활성</StatusPill>],
  ["SMS", "Twilio", "긴급용", <StatusPill key="limited" tone="amber">제한</StatusPill>],
  ["인앱 알림", "웹 표시", "상시", <StatusPill key="active3" tone="green">활성</StatusPill>],
  ["카카오 알림톡", "연동 예정", "준비중", <StatusPill key="ready" tone="slate">대기</StatusPill>],
];

export default async function AdminCommunicationPage() {
  await requirePageRole(ROLE_GROUPS.ADMIN_OPERATORS, {
    signInPath: "/admin/sign-in",
    forbiddenPath: "/admin",
  });
  return (
    <AdminMockPage
      icon="알림"
      title="커뮤니케이션 센터"
      subtitle="대량 알림과 운영 공지를 발송합니다."
      actions={
        <>
          <LinkLike href="/admin/reports?kind=communication">발송 분석</LinkLike>
          <ButtonLike disabled title="템플릿 관리 기능 연결 예정">
            템플릿 준비중
          </ButtonLike>
          <ButtonLike tone="primary" disabled title="캠페인 생성 기능 연결 예정">
            새 캠페인 준비중
          </ButtonLike>
        </>
      }
    >
      <MetricGrid
        items={[
          { label: "이번 달 발송", value: "142K", hint: "이메일 84K, 푸시 58K", tone: "blue" },
          { label: "평균 오픈율", value: "34.2%", hint: "전월 대비 상승", tone: "green" },
          { label: "평균 클릭률", value: "8.7%", hint: "업계 평균 이상", tone: "cyan" },
          { label: "예약 발송", value: "4", hint: "다음 발송 대기", tone: "amber" },
          { label: "수신 거부율", value: "0.8%", hint: "정상 범위", tone: "slate" },
          { label: "이번 달 비용", value: "$847", hint: "SendGrid/FCM/Twilio", tone: "red" },
        ]}
      />

      <Panel title="발송 전 점검">
        <div className="grid gap-3 lg:grid-cols-4">
          <CommCheckCard
            title="대상 확인"
            body="유저 등급, 국가, 최근 거래 여부, 수신 동의 상태를 확인합니다."
          />
          <CommCheckCard
            title="비용 예측"
            body="채널별 발송량과 예상 비용을 먼저 확인하고 예약합니다."
          />
          <CommCheckCard
            title="테스트 발송"
            body="운영자 본인에게 이메일/푸시/인앱 메시지를 먼저 보냅니다."
          />
          <CommCheckCard
            title="예약 관리"
            body="예약 발송은 발송 10분 전까지 수정 가능 여부를 확인합니다."
          />
        </div>
      </Panel>

      <section className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <Panel title="채널 상태">
          <DataTable headers={["채널", "공급자", "사용량", "상태"]} rows={channels} />
        </Panel>

        <Panel
          title="캠페인 작성"
          action={
            <ButtonLike tone="primary" disabled title="테스트 발송 기능 연결 예정">
              테스트 발송 준비중
            </ButtonLike>
          }
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="text-sm font-black text-slate-700">
              캠페인 이름
              <input className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2" defaultValue="Diamond 감사 쿠폰" />
            </label>
            <label className="text-sm font-black text-slate-700">
              대상 그룹
              <input className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2" defaultValue="Diamond 등급 + 최근 30일 활성" />
            </label>
          </div>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-black text-slate-700">미리보기</p>
            <p className="mt-2 text-lg font-black text-slate-950">Diamond 전용 $50 감사 쿠폰</p>
            <p className="mt-1 text-sm font-semibold text-slate-600">발송 전 비용과 예상 오픈율을 확인합니다.</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <ButtonLike disabled title="초안 저장 기능 연결 예정">
              초안 저장 준비중
            </ButtonLike>
            <ButtonLike disabled title="테스트 발송 기능 연결 예정">
              나에게 테스트 준비중
            </ButtonLike>
            <ButtonLike tone="primary" disabled title="대량 발송 기능 연결 예정">
              발송 준비중
            </ButtonLike>
          </div>
        </Panel>
      </section>

      <Panel title="최근 발송 이력">
        <SoftNotice tone="cyan">예약 발송은 발송 10분 전까지 수정할 수 있습니다.</SoftNotice>
        <div className="mt-4">
          <DataTable headers={["캠페인", "채널", "대상", "상태", "시간"]} rows={campaignRows} />
        </div>
      </Panel>
    </AdminMockPage>
  );
}

function CommCheckCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-black text-slate-950">{title}</p>
      <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{body}</p>
    </div>
  );
}
