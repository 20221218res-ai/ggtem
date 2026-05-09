import Link from "next/link";
import type { ReactNode } from "react";
import { AdminOrderChatsRefresh } from "./refresh-control";
import { getAdminOrderChatsState } from "@/lib/admin/order-chats";
import { requirePageRole, ROLE_GROUPS } from "@/lib/auth/guards";

type AdminOrderChatsPageProps = {
  searchParams?: Promise<{
    q?: string;
    orderId?: string;
    refresh?: string;
    risk?: string;
  }>;
};

type AdminOrderChatsState = Awaited<ReturnType<typeof getAdminOrderChatsState>>;
type ChatRoomSummary = AdminOrderChatsState["rooms"][number];
type ChatDetail = NonNullable<AdminOrderChatsState["selectedRoom"]>;
type Tone = "slate" | "blue" | "emerald" | "amber" | "red";

export default async function AdminOrderChatsPage({
  searchParams,
}: AdminOrderChatsPageProps) {
  const currentUser = await requirePageRole(ROLE_GROUPS.ORDER_OPERATORS, {
    signInPath: "/admin/sign-in",
    forbiddenPath: "/admin",
  });
  const params = await searchParams;
  const state = await getAdminOrderChatsState({
    query: params?.q,
    orderId: params?.orderId,
    viewerAdminId: currentUser.userId,
    riskOnly: params?.risk === "1",
    auditView: params?.refresh !== "1",
  });

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-950">
      <section className="mx-auto flex max-w-[1500px] flex-col gap-5">
        <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black text-[var(--gg-accent)]">
                ORDER CHAT MONITOR
              </p>
              <h1 className="mt-1 text-2xl font-black">주문 채팅 열람</h1>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
                분쟁 중재, 외부거래 단속, 사기 방지를 위해 운영자가 주문 채팅을 확인하는
                화면입니다. 채팅 상세를 열람하면 감사 로그에 기록됩니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <AdminLink href="/admin/risk">리스크</AdminLink>
              <AdminLink href="/admin/disputes">분쟁</AdminLink>
              <AdminLink href="/admin/audit?action=ADMIN_ORDER_CHAT_VIEWED">
                열람 로그
              </AdminLink>
            </div>
          </div>

          <form className="mt-5 flex flex-col gap-2 md:flex-row">
            {state.filters.riskOnly ? <input type="hidden" name="risk" value="1" /> : null}
            {params?.refresh === "1" ? <input type="hidden" name="refresh" value="1" /> : null}
            <input
              name="q"
              defaultValue={state.filters.query}
              placeholder="주문번호, 제목, 이메일, 닉네임 검색"
              className="min-h-11 flex-1 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-[var(--gg-accent)]"
            />
            <button
              type="submit"
              className="rounded-md bg-[var(--gg-accent)] px-5 py-2 text-sm font-black text-white"
            >
              검색
            </button>
            <Link
              href="/admin/order-chats"
              className="rounded-md border border-slate-200 bg-white px-5 py-2 text-center text-sm font-black text-slate-700"
            >
              초기화
            </Link>
          </form>
          <AdminOrderChatsRefresh
            autoRefresh={params?.refresh === "1"}
            riskOnly={state.filters.riskOnly}
          />
        </header>

        <section className="grid gap-3 md:grid-cols-3">
          <Metric label="전체 채팅방" value={state.summary.totalRooms} tone="blue" />
          <Metric label="표시 중" value={state.summary.shownRooms} tone="slate" />
          <Metric label="위험 신호 포함" value={state.summary.riskyRooms} tone="red" />
        </section>

        <section className="grid gap-5 xl:grid-cols-[440px_1fr]">
          <ChatRoomList
            rooms={state.rooms}
            selectedOrderId={state.selectedRoom?.orderId ?? null}
          />
          <ChatDetailPanel detail={state.selectedRoom} />
        </section>
      </section>
    </main>
  );
}

function ChatRoomList({
  rooms,
  selectedOrderId,
}: {
  rooms: ChatRoomSummary[];
  selectedOrderId: string | null;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-4">
        <p className="text-sm font-black text-slate-500">채팅방 목록</p>
      </div>
      <div className="max-h-[760px] overflow-y-auto p-3">
        {rooms.map((room) => {
          const active = room.orderId === selectedOrderId;

          return (
            <Link
              key={room.roomId}
              href={`/admin/order-chats?orderId=${room.orderId}`}
              className={`mb-3 block rounded-lg border p-4 transition ${
                active
                  ? "border-[var(--gg-accent)] bg-cyan-50"
                  : room.riskSignalCount > 0
                    ? "border-red-200 bg-red-50 hover:border-red-300"
                    : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-slate-950">{room.orderNumber}</p>
                  <p className="mt-1 line-clamp-1 text-sm font-semibold text-slate-600">
                    {room.listingTitle}
                  </p>
                </div>
                <Badge tone={room.riskSignalCount > 0 ? "red" : "slate"}>
                  위험 {room.riskSignalCount}건
                </Badge>
              </div>
              <p className="mt-3 line-clamp-2 text-sm font-semibold text-slate-700">
                {room.lastMessagePreview}
              </p>
              <div className="mt-3 grid gap-1 text-xs font-semibold text-slate-500">
                <span>구매자 {room.buyerName} / {room.buyerEmail}</span>
                <span>판매자 {room.sellerName} / {room.sellerEmail}</span>
                <span>
                  {room.gameName} / {room.orderStatus} / 메시지 {room.messageCount}건
                </span>
                <span>{room.lastMessageAt ?? "메시지 없음"}</span>
              </div>
            </Link>
          );
        })}

        {rooms.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm font-semibold text-slate-500">
            조건에 맞는 주문 채팅방이 없습니다.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function ChatDetailPanel({ detail }: { detail: ChatDetail | null }) {
  if (!detail) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-500 shadow-sm">
        왼쪽에서 채팅방을 선택하면 전체 주문 채팅이 표시됩니다.
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="blue">{detail.orderStatus}</Badge>
              <Badge tone="slate">{detail.gameName}</Badge>
              <Badge tone="emerald">
                {detail.grossAmount} {detail.currency}
              </Badge>
            </div>
            <h2 className="mt-3 text-xl font-black text-slate-950">
              {detail.orderNumber}
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              {detail.listingTitle}
            </p>
            <p className="mt-2 text-xs font-semibold text-slate-500">
              구매자 {detail.buyerName} / {detail.buyerEmail} · 판매자{" "}
              {detail.sellerName} / {detail.sellerEmail}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <AdminLink href={`/admin/orders?orderId=${detail.orderId}`}>
              주문 보기
            </AdminLink>
            <AdminLink href={`/admin/risk?query=${encodeURIComponent(detail.orderId)}`}>
              신고 보기
            </AdminLink>
            <AdminLink href={`/admin/audit?query=${encodeURIComponent(detail.orderId)}`}>
              감사 로그
            </AdminLink>
          </div>
        </div>
      </div>

      <div className="max-h-[720px] space-y-3 overflow-y-auto bg-slate-50 p-5">
        {detail.messages.map((message) => {
          const risky = message.riskLabels.length > 0;

          return (
            <article
              key={message.messageId}
              className={`rounded-lg border p-4 ${
                risky ? "border-red-300 bg-red-50" : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={message.senderRole === "BUYER" ? "blue" : "emerald"}>
                    {senderRoleLabel(message.senderRole)}
                  </Badge>
                  <span className="text-sm font-black text-slate-950">
                    {message.senderName}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    {message.senderEmail}
                  </span>
                </div>
                <span className="text-xs font-semibold text-slate-500">
                  {message.createdAt}
                </span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">
                {message.body}
              </p>
              {risky ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {message.riskLabels.map((label) => (
                    <Badge key={label} tone="red">
                      {label}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </article>
          );
        })}

        {detail.messages.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm font-semibold text-slate-500">
            아직 메시지가 없습니다.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  return (
    <div className={`rounded-lg border bg-white p-4 shadow-sm ${toneClass(tone)}`}>
      <p className="text-sm font-black text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black">{value.toLocaleString("ko-KR")}</p>
    </div>
  );
}

function AdminLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 shadow-sm hover:border-[var(--gg-accent)] hover:text-slate-950"
    >
      {children}
    </Link>
  );
}

function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${badgeClass(tone)}`}>
      {children}
    </span>
  );
}

function senderRoleLabel(role: string) {
  if (role === "BUYER") return "구매자";
  if (role === "SELLER") return "판매자";
  return "기타";
}

function badgeClass(tone: Tone) {
  const classes: Record<Tone, string> = {
    slate: "bg-slate-100 text-slate-600",
    blue: "bg-blue-100 text-blue-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
  };
  return classes[tone];
}

function toneClass(tone: Tone) {
  const classes: Record<Tone, string> = {
    slate: "border-slate-200 text-slate-950",
    blue: "border-blue-200 text-blue-700",
    emerald: "border-emerald-200 text-emerald-700",
    amber: "border-amber-200 text-amber-700",
    red: "border-red-200 text-red-700",
  };
  return classes[tone];
}
