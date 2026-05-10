"use client";

import { useEffect, useState } from "react";
import type { LocalizedGameNames } from "@/lib/market/game-localization";
import { COUNTRY_CHANGE_EVENT, getCurrentCountryCode } from "./country-text";

type CountryCode = keyof LocalizedGameNames;

const STATIC_GAME_NAMES: Record<string, LocalizedGameNames> = {
  "Lineage W": {
    KR: "리니지W",
    CN: "天堂W",
    VN: "Lineage W",
    PH: "Lineage W",
    TH: "ไลน์เอจ W",
  },
  "Lineage Classic": {
    KR: "리니지 클래식",
    CN: "天堂经典",
    VN: "Lineage Classic",
    PH: "Lineage Classic",
    TH: "ไลน์เอจ คลาสสิก",
  },
  "Aion 2": {
    KR: "아이온2",
    CN: "永恒之塔2",
    VN: "Aion 2",
    PH: "Aion 2",
    TH: "ไอออน 2",
  },
  "Lineage M": {
    KR: "리니지M",
    CN: "天堂M",
    VN: "Lineage M",
    PH: "Lineage M",
    TH: "ไลน์เอจ M",
  },
  "MapleStory Worlds": {
    KR: "메이플스토리월드",
    CN: "冒险岛世界",
    VN: "MapleStory Worlds",
    PH: "MapleStory Worlds",
    TH: "เมเปิลสตอรี่เวิลด์",
  },
  "Lord Nine": {
    KR: "로드나인",
    CN: "洛德九",
    VN: "Lord Nine",
    PH: "Lord Nine",
    TH: "ลอร์ดไนน์",
  },
  "Chosun Hyeopgaekjeon Classic": {
    KR: "조선협객전 클래식",
    CN: "朝鲜侠客传经典",
    VN: "Chosun Hyeopgaekjeon Classic",
    PH: "Chosun Hyeopgaekjeon Classic",
    TH: "โชซอนฮยอบแกกจอน คลาสสิก",
  },
  Vampir: {
    KR: "뱀피르",
    CN: "吸血鬼",
    VN: "Vampir",
    PH: "Vampir",
    TH: "แวมไพร์",
  },
  "Night Crows": {
    KR: "나이트 크로우",
    CN: "夜鸦",
    VN: "Night Crows",
    PH: "Night Crows",
    TH: "ไนท์โครว์",
  },
  Lineage2M: {
    KR: "리니지2M",
    CN: "天堂2M",
    VN: "Lineage2M",
    PH: "Lineage2M",
    TH: "ไลน์เอจ 2M",
  },
  "Archetic Land": {
    KR: "아키텍트 랜드 오브 엑자일",
    CN: "Architect: Land of Exiles",
    VN: "Archetic Land",
    PH: "Archetic Land",
    TH: "อาร์คีเทคติก แลนด์",
  },
  "RF Online Next": {
    KR: "RF온라인 넥스트",
    CN: "RF Online Next",
    VN: "RF Online Next",
    PH: "RF Online Next",
    TH: "RF Online Next",
  },
  "Ragnarok Online": {
    KR: "라그나로크 온라인",
    CN: "仙境传说",
    VN: "Ragnarok Online",
    PH: "Ragnarok Online",
    TH: "แร็กนาร็อกออนไลน์",
  },
  "Dungeon & Fighter": {
    KR: "던전앤파이터",
    CN: "地下城与勇士",
    VN: "Dungeon & Fighter",
    PH: "Dungeon & Fighter",
    TH: "ดันเจี้ยนไฟเตอร์",
  },
  "Odin: Valhalla Rising": {
    KR: "오딘: 발할라 라이징",
    CN: "奥丁：英灵殿崛起",
    VN: "Odin: Valhalla Rising",
    PH: "Odin: Valhalla Rising",
    TH: "โอดิน: วัลฮัลลาไรซิง",
  },
  "Odin: Valhalla": {
    KR: "오딘: 발할라",
    CN: "奥丁：英灵殿",
    VN: "Odin: Valhalla",
    PH: "Odin: Valhalla",
    TH: "โอดิน: วัลฮัลลา",
  },
  "Genshin Impact": {
    KR: "원신",
    CN: "原神",
    VN: "Genshin Impact",
    PH: "Genshin Impact",
    TH: "เกนชินอิมแพกต์",
  },
};

export function getLocalizedGameName(
  name: string,
  localizedNames?: Partial<LocalizedGameNames> | null,
  countryCode: string = getCurrentCountryCode(),
) {
  const country = normalizeCountryCode(countryCode);
  const explicit = localizedNames?.[country];
  const fallback = STATIC_GAME_NAMES[name]?.[country];

  return explicit || fallback || name;
}

export function useLocalizedGameName(
  name: string,
  localizedNames?: Partial<LocalizedGameNames> | null,
) {
  const [countryCode, setCountryCode] = useState(() => getCurrentCountryCode());

  useEffect(() => {
    const handleCountryChange = () => setCountryCode(getCurrentCountryCode());
    window.addEventListener(COUNTRY_CHANGE_EVENT, handleCountryChange);
    window.addEventListener("storage", handleCountryChange);

    return () => {
      window.removeEventListener(COUNTRY_CHANGE_EVENT, handleCountryChange);
      window.removeEventListener("storage", handleCountryChange);
    };
  }, []);

  return getLocalizedGameName(name, localizedNames, countryCode);
}

export default function GameNameText({
  name,
  localizedNames,
}: {
  name: string;
  localizedNames?: Partial<LocalizedGameNames> | null;
}) {
  return <>{useLocalizedGameName(name, localizedNames)}</>;
}

function normalizeCountryCode(countryCode: string): CountryCode {
  if (
    countryCode === "KR" ||
    countryCode === "CN" ||
    countryCode === "VN" ||
    countryCode === "PH" ||
    countryCode === "TH"
  ) {
    return countryCode;
  }

  return "KR";
}
