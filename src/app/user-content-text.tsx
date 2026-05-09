"use client";

import { useEffect, useMemo, useState } from "react";
import { COUNTRY_CHANGE_EVENT, getCurrentCountryCode } from "./country-text";
import { getCountry, translate, type CountryCode } from "./i18n";

type UserContentTextProps = {
  text: string;
  className?: string;
  multiline?: boolean;
  showSourceFlag?: boolean;
};

const sourceTitleKeys: Record<CountryCode, Parameters<typeof translate>[0]> = {
  KR: "chat.sourceKorean",
  CN: "chat.sourceChinese",
  VN: "chat.sourceVietnamese",
  PH: "chat.sourceEnglish",
  TH: "chat.sourceThai",
};

const phraseMap: Record<Exclude<CountryCode, "KR">, Array<[string, string]>> = {
  CN: [
    ["안녕하세요", "你好"],
    ["확인했습니다", "已确认"],
    ["수령했습니다", "已收到"],
    ["전달 가능합니다", "可以交付"],
    ["전달 완료했습니다", "已完成交付"],
    ["게임머니", "游戏币"],
    ["아이템", "道具"],
    ["계정", "账号"],
    ["판매자", "卖家"],
    ["구매자", "买家"],
    ["서버", "服务器"],
    ["수량", "数量"],
    ["단가", "单价"],
    ["거래", "交易"],
    ["분쟁", "争议"],
  ],
  VN: [
    ["안녕하세요", "Xin chào"],
    ["확인했습니다", "Đã xác nhận"],
    ["수령했습니다", "Đã nhận"],
    ["전달 가능합니다", "Có thể giao"],
    ["전달 완료했습니다", "Đã giao xong"],
    ["게임머니", "tiền game"],
    ["아이템", "vật phẩm"],
    ["계정", "tài khoản"],
    ["판매자", "người bán"],
    ["구매자", "người mua"],
    ["서버", "máy chủ"],
    ["수량", "số lượng"],
    ["단가", "đơn giá"],
    ["거래", "giao dịch"],
    ["분쟁", "tranh chấp"],
  ],
  PH: [
    ["안녕하세요", "Hello"],
    ["확인했습니다", "Confirmed"],
    ["수령했습니다", "I received it"],
    ["전달 가능합니다", "I can deliver"],
    ["전달 완료했습니다", "Delivery completed"],
    ["게임머니", "game money"],
    ["아이템", "item"],
    ["계정", "account"],
    ["판매자", "seller"],
    ["구매자", "buyer"],
    ["서버", "server"],
    ["수량", "quantity"],
    ["단가", "unit price"],
    ["거래", "trade"],
    ["분쟁", "dispute"],
  ],
  TH: [
    ["안녕하세요", "สวัสดี"],
    ["확인했습니다", "ยืนยันแล้ว"],
    ["수령했습니다", "ได้รับแล้ว"],
    ["전달 가능합니다", "สามารถส่งมอบได้"],
    ["전달 완료했습니다", "ส่งมอบเรียบร้อยแล้ว"],
    ["게임머니", "เงินในเกม"],
    ["아이템", "ไอเทม"],
    ["계정", "บัญชี"],
    ["판매자", "ผู้ขาย"],
    ["구매자", "ผู้ซื้อ"],
    ["서버", "เซิร์ฟเวอร์"],
    ["수량", "จำนวน"],
    ["단가", "ราคาต่อหน่วย"],
    ["거래", "การซื้อขาย"],
    ["분쟁", "ข้อพิพาท"],
  ],
};

export default function UserContentText({
  text,
  className,
  multiline = false,
  showSourceFlag = true,
}: UserContentTextProps) {
  const [countryCode, setCountryCode] = useState<CountryCode>("KR");
  const [showOriginal, setShowOriginal] = useState(false);
  const sourceCountry = useMemo(() => detectSourceCountry(text), [text]);
  const translatedText = useMemo(
    () => translateUserContent(text, countryCode, sourceCountry),
    [countryCode, sourceCountry, text],
  );
  const hasTranslation = translatedText !== text;
  const visibleText = hasTranslation && !showOriginal ? translatedText : text;
  const sourceFlag = getCountry(sourceCountry).flag;
  const Wrapper = multiline ? "div" : "span";
  const sourceTitle = translate(sourceTitleKeys[sourceCountry], countryCode);

  useEffect(() => {
    function syncCountry() {
      setCountryCode(getCurrentCountryCode());
    }

    syncCountry();
    window.addEventListener(COUNTRY_CHANGE_EVENT, syncCountry);
    window.addEventListener("storage", syncCountry);

    return () => {
      window.removeEventListener(COUNTRY_CHANGE_EVENT, syncCountry);
      window.removeEventListener("storage", syncCountry);
    };
  }, []);

  return (
    <Wrapper className={className}>
      {showSourceFlag ? (
        <span className="mr-2 inline-flex align-baseline" title={sourceTitle} aria-label={sourceTitle}>
          {sourceFlag}
        </span>
      ) : null}
      {visibleText}
      {hasTranslation ? (
        <button
          type="button"
          onClick={() => setShowOriginal((current) => !current)}
          className="ml-2 inline-flex rounded-full border border-[var(--gg-border)] px-2 py-0.5 text-[11px] font-black text-[var(--gg-accent)] hover:bg-[var(--gg-control-bg)]"
        >
          {showOriginal ? translate("chat.translation", countryCode) : translate("chat.original", countryCode)}
        </button>
      ) : null}
    </Wrapper>
  );
}

export function SourceCountryFlag({ text }: { text: string }) {
  const sourceCountry = detectSourceCountry(text);
  const sourceFlag = getCountry(sourceCountry).flag;
  const sourceTitle = translate(sourceTitleKeys[sourceCountry], sourceCountry);

  return (
    <span className="mr-1 inline-flex align-baseline" title={sourceTitle} aria-label={sourceTitle}>
      {sourceFlag}
    </span>
  );
}

function translateUserContent(text: string, targetCountry: CountryCode, sourceCountry: CountryCode) {
  if (targetCountry === sourceCountry || targetCountry === "KR") {
    return text;
  }

  if (sourceCountry !== "KR") {
    return text;
  }

  return phraseMap[targetCountry].reduce(
    (result, [source, target]) => result.replaceAll(source, target),
    text,
  );
}

function detectSourceCountry(text: string): CountryCode {
  if (/[\u0e00-\u0e7f]/.test(text)) {
    return "TH";
  }

  if (/[\u4e00-\u9fff]/.test(text)) {
    return "CN";
  }

  if (/[\uac00-\ud7a3]/.test(text)) {
    return "KR";
  }

  if (/[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i.test(text)) {
    return "VN";
  }

  return "PH";
}
