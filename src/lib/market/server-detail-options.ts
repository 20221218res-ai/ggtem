const SERVER_DETAIL_OPTIONS_BY_GAME_CODE: Record<string, string[]> = {
  "lineage-m": buildNumericOptions(10),
  lineage2m: buildNumericOptions(10),
  "lineage-w": buildNumericOptions(12),
};

export function getServerDetailOptionsForGameCode(gameCode?: string | null) {
  if (!gameCode) return [];
  return SERVER_DETAIL_OPTIONS_BY_GAME_CODE[gameCode] ?? [];
}

export function normalizeServerDetail(
  value: string | null | undefined,
  gameCode?: string | null,
) {
  const normalized = value?.trim() ?? "";
  if (!normalized) return null;

  const options = getServerDetailOptionsForGameCode(gameCode);
  if (options.length === 0) return null;
  return options.includes(normalized) ? normalized : null;
}

export function validateServerDetail(
  value: string | null | undefined,
  gameCode?: string | null,
) {
  const normalized = value?.trim() ?? "";
  if (!normalized) return null;

  const options = getServerDetailOptionsForGameCode(gameCode);
  if (options.length === 0 || !options.includes(normalized)) {
    throw new Error("선택한 서버 상세 번호가 해당 게임과 맞지 않습니다.");
  }

  return normalized;
}

function buildNumericOptions(max: number) {
  return Array.from({ length: max }, (_, index) => String(index + 1).padStart(2, "0"));
}
