import Link from "next/link";
import type { ReactNode } from "react";
import { getAdminGameSettingsState } from "@/lib/admin/game-settings";
import { ROLE_GROUPS, requirePageRole } from "@/lib/auth/guards";
import { FormSubmitButton } from "../form-submit-button";
import {
  createAdminGameNoteAction,
  createGameAction,
  createGameServerAction,
  createGameServersBulkAction,
  toggleGameActiveAction,
  toggleGameServerActiveAction,
  updateGameAction,
  updateGameServerAction,
} from "./actions";

type AdminGameSettingsPageProps = {
  searchParams?: Promise<{
    notice?: string;
    error?: string;
    q?: string;
    status?: string;
    game?: string;
    count?: string;
    servers?: string;
  }>;
};

type GameSettingsState = Awaited<ReturnType<typeof getAdminGameSettingsState>>;
type GameRow = GameSettingsState["games"][number];
type ServerRow = GameRow["servers"][number];

const noticeMessages: Record<string, string> = {
  "created-game": "게임을 추가했습니다.",
  "created-note": "운영 메모를 저장했습니다.",
  "created-server": "서버를 추가했습니다.",
  "created-servers": "서버 목록을 일괄 추가했습니다.",
  updated: "상태를 변경했습니다.",
  "updated-game": "게임 정보를 수정했습니다.",
  "updated-server": "서버 정보를 수정했습니다.",
};

export default async function AdminGameSettingsPage({ searchParams }: AdminGameSettingsPageProps) {
  await requirePageRole(ROLE_GROUPS.PLATFORM_ADMINS, {
    signInPath: "/admin/sign-in",
    forbiddenPath: "/admin/sign-in",
  });

  const params = searchParams ? await searchParams : {};
  const state = await getAdminGameSettingsState();
  const query = params.q?.trim().toLowerCase() ?? "";
  const status = params.status || "ALL";
  const gamesWithoutServers = state.games.filter((game) => game.servers.length === 0);
  const inactiveServers = state.games.flatMap((game) =>
    game.servers.filter((server) => !server.isActive),
  );
  const gamesWithoutImages = state.games.filter((game) => !game.imageUrl);
  const filteredGames = state.games.filter((game) => {
    const haystack = [
      game.name,
      game.code,
      game.moneyUnitName,
      ...game.servers.flatMap((server) => [server.name, server.code]),
    ]
      .join(" ")
      .toLowerCase();

    if (query && !haystack.includes(query)) return false;
    if (status === "ACTIVE") return game.isActive;
    if (status === "INACTIVE") return !game.isActive;
    if (status === "NO_SERVER") return game.servers.length === 0;
    if (status === "HAS_INACTIVE_SERVER") return game.servers.some((server) => !server.isActive);
    if (status === "NO_IMAGE") return !game.imageUrl;
    return true;
  });

  return (
    <main className="min-h-screen bg-[#f3f6fa] px-5 py-7 text-slate-950">
      <section className="mx-auto max-w-[1720px] space-y-5">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-[var(--color-primary)]">
              GAME CATALOG
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">게임 / 서버 설정</h1>
            <p className="mt-2 text-sm font-semibold text-slate-600">
              게임, 서버, 게임 이미지를 관리합니다. 이미지는 유저 페이지의 게임 카드와 탐색 화면에 사용됩니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <TopLink href="/admin/audit?targetType=GAME">감사 로그</TopLink>
            <TopLink href="/listings">유저 화면 확인</TopLink>
            <TopLink href="#create-game">게임 추가</TopLink>
          </div>
        </header>

        {params.notice ? (
          <Banner tone="success">
            {getNoticeMessage(params.notice, {
              game: params.game,
              count: params.count,
              servers: params.servers,
            })}
          </Banner>
        ) : null}
        {params.error ? <Banner tone="error">{params.error}</Banner> : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <Metric label="전체 게임" value={state.summary.totalGames} />
          <Metric label="활성 게임" value={state.summary.activeGames} tone="green" />
          <Metric label="전체 서버" value={state.summary.totalServers} />
          <Metric label="활성 서버" value={state.summary.activeServers} tone="green" />
          <Metric label="판매글" value={state.summary.totalListings} />
          <Metric label="구매요청" value={state.summary.totalBuyRequests} tone="cyan" />
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <ActionCard
            title={gamesWithoutServers.length > 0 ? "서버 없는 게임" : "게임 선택지 정상"}
            value={`${gamesWithoutServers.length}개`}
            tone={gamesWithoutServers.length > 0 ? "amber" : "green"}
            href="#create-server"
            action="서버 추가"
          />
          <ActionCard
            title="비활성 서버"
            value={`${inactiveServers.length}개`}
            tone={inactiveServers.length > 0 ? "amber" : "green"}
            href="?status=HAS_INACTIVE_SERVER"
            action="목록 보기"
          />
          <ActionCard
            title="이미지 없는 게임"
            value={`${gamesWithoutImages.length}개`}
            tone={gamesWithoutImages.length > 0 ? "amber" : "cyan"}
            href="?status=NO_IMAGE"
            action="이미지 등록"
          />
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <Panel title="게임 추가" id="create-game">
            <form action={createGameAction} className="grid gap-3 sm:grid-cols-4" encType="multipart/form-data">
              <Field name="name" label="게임명" placeholder="Lineage W" />
              <Field name="code" label="게임 코드" placeholder="lineage-w" />
              <Field name="moneyUnitName" label="게임머니 단위" placeholder="아데나" />
              <Field name="sortOrder" label="노출 순서" placeholder="1" />
              <Field name="nameKo" label="한국어 게임명" placeholder="리니지W" />
              <Field name="nameCn" label="중국어 게임명" placeholder="天堂W" />
              <Field name="nameVn" label="베트남어 게임명" placeholder="Lineage W" />
              <Field name="namePh" label="필리핀/영어 게임명" placeholder="Lineage W" />
              <Field name="nameTh" label="태국어 게임명" placeholder="ไลน์เอจ W" />
              <Field name="imageAlt" label="이미지 설명" placeholder="Lineage W 대표 이미지" />
              <FileField name="image" label="게임 이미지" />
              <FormSubmitButton className="self-end rounded-lg bg-[var(--color-primary)] px-4 py-3 text-sm font-black text-black">
                게임 추가
              </FormSubmitButton>
            </form>
          </Panel>

          <Panel title="서버 추가" id="create-server">
            <form action={createGameServerAction} className="grid gap-3 sm:grid-cols-5">
              <SelectGame games={state.games} name="gameId" label="게임" />
              <Field name="name" label="서버명" placeholder="Aphrodite" />
              <Field name="code" label="서버 코드" placeholder="aphrodite" />
              <FormSubmitButton className="self-end rounded-lg bg-[var(--color-primary)] px-4 py-3 text-sm font-black text-black sm:col-span-2">
                서버 추가
              </FormSubmitButton>
            </form>
          </Panel>
        </section>

        <Panel title="서버 일괄 추가" id="bulk-create-server">
          <form action={createGameServersBulkAction} className="grid gap-3 lg:grid-cols-[260px_1fr_160px]">
            <SelectGame games={state.games} name="bulkGameId" label="게임" />
            <label className="text-sm font-black text-slate-700">
              서버 목록
              <textarea
                name="servers"
                className="mt-2 min-h-28 w-full rounded-lg border border-slate-200 px-3 py-2 font-semibold"
                placeholder={"Aphrodite, aphrodite\nKerenis, kerenis\nJillian, jillian"}
              />
            </label>
            <FormSubmitButton className="self-end rounded-lg bg-[var(--color-primary)] px-4 py-3 text-sm font-black text-black">
              일괄 추가
            </FormSubmitButton>
          </form>
        </Panel>

        <Panel title="게임 검색">
          <form className="grid gap-3 lg:grid-cols-[1fr_220px_120px]">
            <input
              name="q"
              defaultValue={params.q}
              className={inputClass}
              placeholder="게임명, 서버명, 코드 검색"
            />
            <select name="status" defaultValue={status} className={inputClass}>
              <option value="ALL">전체</option>
              <option value="ACTIVE">활성 게임</option>
              <option value="INACTIVE">비활성 게임</option>
              <option value="NO_SERVER">서버 없음</option>
              <option value="HAS_INACTIVE_SERVER">비활성 서버 포함</option>
              <option value="NO_IMAGE">이미지 없음</option>
            </select>
            <button className="rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white">검색</button>
          </form>
        </Panel>

        <section id="game-list" className="space-y-4">
          {filteredGames.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
          {filteredGames.length === 0 ? (
            <Panel title="검색 결과 없음">
              <p className="text-sm font-semibold text-slate-600">조건에 맞는 게임이 없습니다.</p>
            </Panel>
          ) : null}
        </section>

        <Panel title="최근 변경 이력">
          <div className="divide-y divide-slate-100">
            {state.recentChanges.map((change) => (
              <div
                key={change.id}
                className="grid gap-2 py-3 text-sm font-semibold text-slate-700 sm:grid-cols-[180px_1fr_160px]"
              >
                <span className="font-black text-slate-950">{formatActionLabel(change.action)}</span>
                <span>{change.reason || change.targetType}</span>
                <span className="text-slate-500">
                  {change.adminName} / {change.createdAt}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </main>
  );
}

function GameCard({ game }: { game: GameRow }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-4 border-b border-slate-200 p-5 xl:grid-cols-[1fr_360px]">
        <div className="flex min-w-0 gap-4">
          {game.imageUrl ? (
            <img
              src={game.imageUrl}
              alt={game.imageAlt || game.name}
              className="h-20 w-20 shrink-0 rounded-xl border border-slate-200 object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-xl font-black text-slate-400">
              {getGameInitial(game.name)}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-2xl font-black">{game.name}</h2>
              <Pill tone={game.isActive ? "green" : "slate"}>{game.isActive ? "활성" : "숨김"}</Pill>
              <Pill tone="cyan">{game.code}</Pill>
              <Pill tone="slate">순서 {game.sortOrder}</Pill>
            </div>
            <p className="mt-2 text-sm font-bold text-slate-500">
              서버 {game.servers.length}개 / 판매글 {game.listingCount}개 / 구매요청 {game.buyRequestCount}개
            </p>
            <p className="mt-1 text-xs font-bold text-slate-400">
              {game.imageUrl ? "게임 이미지 등록됨" : "이미지 없음"}
            </p>
          </div>
        </div>
        <form action={toggleGameActiveAction} className="flex items-end gap-2 xl:justify-end">
          <input type="hidden" name="gameId" value={game.id} />
          <input type="hidden" name="nextActive" value={String(!game.isActive)} />
          <FormSubmitButton
            className={`rounded-lg px-4 py-3 text-sm font-black ${
              game.isActive ? "bg-slate-100 text-slate-700" : "bg-[var(--color-primary)] text-black"
            }`}
          >
            {game.isActive ? "게임 숨김" : "게임 활성화"}
          </FormSubmitButton>
        </form>
      </div>

      <div className="grid gap-5 p-5 xl:grid-cols-[420px_1fr]">
        <div className="space-y-5">
          <form action={updateGameAction} className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4" encType="multipart/form-data">
            <input type="hidden" name="gameId" value={game.id} />
            <Field name="name" label="게임명" defaultValue={game.name} />
            <Field name="code" label="게임 코드" defaultValue={game.code} />
            <Field name="moneyUnitName" label="게임머니 단위" defaultValue={game.moneyUnitName} />
            <Field name="sortOrder" label="노출 순서" defaultValue={String(game.sortOrder)} />
            <Field name="nameKo" label="한국어 게임명" defaultValue={game.nameKo || ""} />
            <Field name="nameCn" label="중국어 게임명" defaultValue={game.nameCn || ""} />
            <Field name="nameVn" label="베트남어 게임명" defaultValue={game.nameVn || ""} />
            <Field name="namePh" label="필리핀/영어 게임명" defaultValue={game.namePh || ""} />
            <Field name="nameTh" label="태국어 게임명" defaultValue={game.nameTh || ""} />
            <Field name="imageAlt" label="이미지 설명" defaultValue={game.imageAlt || game.name} />
            <FileField name="image" label="이미지 교체" />
            <FormSubmitButton className="w-full rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white">
              게임 정보 저장
            </FormSubmitButton>
          </form>

          <form action={createAdminGameNoteAction} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
            <input type="hidden" name="gameId" value={game.id} />
            <label className="text-sm font-black text-slate-700">
              운영 메모
              <textarea
                name="body"
                className="mt-2 min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 font-semibold"
                placeholder="운영 중 확인한 내용을 남깁니다."
              />
            </label>
            <FormSubmitButton className="w-full rounded-lg border border-[var(--color-primary)] px-4 py-3 text-sm font-black text-[var(--color-primary)]">
              메모 저장
            </FormSubmitButton>
          </form>

          {game.adminNotes.length > 0 ? (
            <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-sm font-black text-slate-700">최근 메모</p>
              {game.adminNotes.map((note) => (
                <div key={note.id} className="rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                  <p>{note.body}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {note.adminName} / {note.updatedAt}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-3">
          <h3 className="text-lg font-black">서버 목록</h3>
          {game.servers.map((server) => (
            <ServerItem key={server.id} server={server} />
          ))}
          {game.servers.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-black text-amber-800">
              서버가 없습니다. 위의 서버 추가 또는 일괄 추가로 등록하세요.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ServerItem({ server }: { server: ServerRow }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-lg font-black">{server.name}</p>
          <p className="text-xs font-bold text-slate-500">
            {server.code} / 판매글 {server.listingCount}개 / 구매요청 {server.buyRequestCount}개
          </p>
        </div>
        <Pill tone={server.isActive ? "green" : "slate"}>{server.isActive ? "활성" : "숨김"}</Pill>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr_120px_120px]">
        <form action={updateGameServerAction} className="contents">
          <input type="hidden" name="serverId" value={server.id} />
          <input name="name" defaultValue={server.name} className={inputClass} />
          <input name="code" defaultValue={server.code} className={inputClass} />
          <FormSubmitButton className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-black text-white">저장</FormSubmitButton>
        </form>
        <form action={toggleGameServerActiveAction}>
          <input type="hidden" name="serverId" value={server.id} />
          <input type="hidden" name="nextActive" value={String(!server.isActive)} />
          <FormSubmitButton className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-black text-slate-700">
            {server.isActive ? "숨김" : "활성"}
          </FormSubmitButton>
        </form>
      </div>
    </div>
  );
}

function SelectGame({ games, name, label }: { games: GameRow[]; name: string; label: string }) {
  return (
    <label className="text-sm font-black text-slate-700">
      {label}
      <select name={name} className={`${inputClass} mt-2`}>
        {games.map((game) => (
          <option key={game.id} value={game.id}>
            {game.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function Field({
  name,
  label,
  placeholder,
  defaultValue,
}: {
  name: string;
  label: string;
  placeholder?: string;
  defaultValue?: string | null;
}) {
  return (
    <label className="text-sm font-black text-slate-700">
      {label}
      <input
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue ?? ""}
        className={`${inputClass} mt-2`}
      />
    </label>
  );
}

function FileField({ name, label }: { name: string; label: string }) {
  return (
    <label className="text-sm font-black text-slate-700">
      {label}
      <input
        name={name}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className={`${inputClass} mt-2 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-black file:text-slate-700`}
      />
      <span className="mt-1 block text-xs font-bold text-slate-500">
        PNG, JPG, WEBP / 최대 5MB
      </span>
    </label>
  );
}

function Panel({ title, id, children }: { title: string; id?: string; children: ReactNode }) {
  return (
    <section id={id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-black">{title}</h2>
      {children}
    </section>
  );
}

function Metric({
  label,
  value,
  tone = "blue",
}: {
  label: string;
  value: number;
  tone?: "blue" | "green" | "cyan";
}) {
  const color =
    tone === "green" ? "text-emerald-600" : tone === "cyan" ? "text-[var(--color-primary)]" : "text-blue-700";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-black text-slate-600">{label}</p>
      <p className={`mt-2 text-3xl font-black ${color}`}>{value.toLocaleString("ko-KR")}</p>
    </div>
  );
}

function ActionCard({
  title,
  value,
  tone,
  href,
  action,
}: {
  title: string;
  value: string;
  tone: "green" | "amber" | "cyan";
  href: string;
  action: string;
}) {
  const classes = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    cyan: "border-sky-200 bg-sky-50 text-[var(--color-primary)]",
  };
  return (
    <div className={`rounded-xl border p-5 shadow-sm ${classes[tone]}`}>
      <p className="text-sm font-black">{title}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
      <Link href={href} className="mt-4 inline-flex rounded-lg bg-white px-3 py-2 text-sm font-black text-slate-950 shadow-sm">
        {action}
      </Link>
    </div>
  );
}

function TopLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-900 shadow-sm">
      {children}
    </Link>
  );
}

function Banner({ tone, children }: { tone: "success" | "error"; children: ReactNode }) {
  return (
    <div
      className={`rounded-lg border-l-4 px-4 py-3 text-sm font-black ${
        tone === "success"
          ? "border-emerald-500 bg-emerald-50 text-emerald-800"
          : "border-red-500 bg-red-50 text-red-800"
      }`}
    >
      {children}
    </div>
  );
}

function Pill({ tone, children }: { tone: "green" | "slate" | "cyan"; children: ReactNode }) {
  const classes = {
    green: "bg-emerald-100 text-emerald-700",
    slate: "bg-slate-100 text-slate-600",
    cyan: "bg-sky-100 text-[var(--color-primary)]",
  };
  return <span className={`rounded px-2 py-1 text-xs font-black ${classes[tone]}`}>{children}</span>;
}

function getNoticeMessage(kind: string, details: { game?: string; count?: string; servers?: string }) {
  const base = noticeMessages[kind] ?? "작업을 완료했습니다.";
  if (kind !== "created-servers") return base;
  const suffix = [details.game, details.count ? `${details.count}개` : null, details.servers]
    .filter(Boolean)
    .join(" / ");
  return suffix ? `${base} ${suffix}` : base;
}

function formatActionLabel(action: string) {
  const labels: Record<string, string> = {
    GAME_CREATED: "게임 추가",
    GAME_UPDATED: "게임 수정",
    GAME_ACTIVATED: "게임 활성화",
    GAME_DEACTIVATED: "게임 숨김",
    GAME_SERVER_CREATED: "서버 추가",
    GAME_SERVER_UPDATED: "서버 수정",
    GAME_SERVER_ACTIVATED: "서버 활성화",
    GAME_SERVER_DEACTIVATED: "서버 숨김",
    GAME_SERVERS_BULK_CREATED: "서버 일괄 추가",
    GAME_NOTE_CREATED: "메모 저장",
  };
  return labels[action] ?? action;
}

function getGameInitial(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "GG";
}

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-950 outline-none focus:border-[var(--color-primary)]";
