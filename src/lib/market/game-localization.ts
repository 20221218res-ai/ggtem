export type LocalizedGameNames = {
  KR: string | null;
  CN: string | null;
  VN: string | null;
  PH: string | null;
  TH: string | null;
};

export type GameLocalizationSource = {
  nameKo?: string | null;
  nameCn?: string | null;
  nameVn?: string | null;
  namePh?: string | null;
  nameTh?: string | null;
};

export type GameCatalogOption = {
  name: string;
  code: string;
  region: string;
  imageUrl: string | null;
  localizedNames: LocalizedGameNames;
};

export function mapGameLocalizedNames(game: GameLocalizationSource): LocalizedGameNames {
  return {
    KR: game.nameKo ?? null,
    CN: game.nameCn ?? null,
    VN: game.nameVn ?? null,
    PH: game.namePh ?? null,
    TH: game.nameTh ?? null,
  };
}

export function getLocalizedGameNameInput(formData: FormData) {
  return {
    nameKo: normalizeOptionalGameName(formData.get("nameKo")),
    nameCn: normalizeOptionalGameName(formData.get("nameCn")),
    nameVn: normalizeOptionalGameName(formData.get("nameVn")),
    namePh: normalizeOptionalGameName(formData.get("namePh")),
    nameTh: normalizeOptionalGameName(formData.get("nameTh")),
  };
}

function normalizeOptionalGameName(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}
