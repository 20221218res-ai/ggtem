export type OffPlatformSignal = {
  code: string;
  label: string;
};

export type OffPlatformContactDetection = {
  blocked: boolean;
  signals: OffPlatformSignal[];
};

const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const externalUrlPattern =
  /(?:https?:\/\/|www\.|open\.kakao|openchat\.kakao|pf\.kakao|t\.me\/|telegram\.me|discord\.gg|discord\.com\/invite|line\.me|instagram\.com|facebook\.com|twitter\.com|x\.com|wa\.me|whatsapp\.com|zalo\.me|wechat\.com|weixin\.qq\.com)/i;
const domainLikePattern =
  /\b(?:kakao|telegram|discord|line|whatsapp|wechat|zalo|facebook|instagram|gmail|naver|daum|hotmail|outlook)\s*(?:id|아이디|계정|주소|링크|link|account)?\b/i;
const messengerKeywordPattern =
  /(카톡|카카오톡|오픈채팅|오픈\s*채팅|텔레그램|텔레\b|라인\b|디스코드|위챗|왓츠앱|잘로|zalo|wechat|kakao|telegram|discord|line\s*id|lineid|whatsapp|dm|디엠|문자|전화|핸드폰|휴대폰|연락처|폰번|전번|번호\s*교환|sns)/i;
const offPlatformTradePattern =
  /(직거래|외부\s*거래|밖에서\s*거래|수수료\s*(?:없이|빼고|아끼)|사이트\s*밖|따로\s*거래|개인\s*거래|계좌\s*이체|계좌이체|무통장|현금\s*거래|에스크로\s*(?:없이|빼고)|direct\s*trade|outside\s*(?:trade|deal)|off\s*platform|no\s*fee|without\s*escrow|bank\s*transfer)/i;
const cryptoAddressPattern =
  /\bT[1-9A-HJ-NP-Za-km-z]{33}\b|\b0x[a-fA-F0-9]{40}\b|\bnb1[0-9a-z]{38,58}\b/i;

export function detectOffPlatformContact(text: string): OffPlatformContactDetection {
  const normalizedText = normalizeContactText(text);
  const signals: OffPlatformSignal[] = [];

  addSignalIf(signals, emailPattern.test(normalizedText), "EMAIL", "이메일 주소");
  addSignalIf(
    signals,
    externalUrlPattern.test(normalizedText),
    "EXTERNAL_URL",
    "외부 링크",
  );
  addSignalIf(signals, containsPhoneNumber(normalizedText), "PHONE", "전화번호");
  addSignalIf(
    signals,
    messengerKeywordPattern.test(normalizedText) || domainLikePattern.test(normalizedText),
    "MESSENGER",
    "외부 메신저/연락처",
  );
  addSignalIf(
    signals,
    offPlatformTradePattern.test(normalizedText),
    "OFF_PLATFORM_TRADE",
    "외부거래 유도",
  );
  addSignalIf(
    signals,
    cryptoAddressPattern.test(normalizedText),
    "CRYPTO_ADDRESS",
    "개인 코인 지갑주소",
  );

  return {
    blocked: signals.length > 0,
    signals,
  };
}

function normalizeContactText(text: string) {
  return text
    .normalize("NFKC")
    .trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[ㆍ·。]/g, ".")
    .replace(/\s+/g, " ");
}

function addSignalIf(
  signals: OffPlatformSignal[],
  condition: boolean,
  code: string,
  label: string,
) {
  if (condition && !signals.some((signal) => signal.code === code)) {
    signals.push({ code, label });
  }
}

function containsPhoneNumber(text: string) {
  const compactText = text.replace(/[^\d+]/g, "");
  const candidates = [
    ...(text.match(/\+?\d[\d\s().-]{7,}\d/g) ?? []),
    compactText,
  ];

  return candidates.some((candidate) => {
    const digits = candidate.replace(/\D/g, "");

    if (digits.length < 8 || digits.length > 15) {
      return false;
    }

    return (
      digits.startsWith("010") ||
      digits.startsWith("011") ||
      digits.startsWith("016") ||
      digits.startsWith("017") ||
      digits.startsWith("018") ||
      digits.startsWith("019") ||
      digits.startsWith("82") ||
      digits.startsWith("84") ||
      digits.startsWith("66") ||
      digits.startsWith("86") ||
      digits.startsWith("63")
    );
  });
}
