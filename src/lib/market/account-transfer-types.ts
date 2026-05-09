export const accountTransferTypeOptions = [
  { value: "GOOGLE", label: "구글 계정", shortLabel: "Google" },
  { value: "GAME_COMPANY", label: "게임사 계정", shortLabel: "게임사" },
] as const;

export type AccountTransferType =
  (typeof accountTransferTypeOptions)[number]["value"];

export function normalizeAccountTransferType(
  value?: string | null,
): AccountTransferType | null {
  const normalized = value?.trim().toUpperCase();

  if (normalized === "GOOGLE") {
    return "GOOGLE";
  }

  if (
    normalized === "GAME_COMPANY" ||
    normalized === "GAME" ||
    normalized === "PUBLISHER"
  ) {
    return "GAME_COMPANY";
  }

  return null;
}

export function getAccountTransferTypeLabel(value?: string | null) {
  const normalized = normalizeAccountTransferType(value);

  return (
    accountTransferTypeOptions.find((option) => option.value === normalized)
      ?.label ??
    value?.trim() ??
    null
  );
}
