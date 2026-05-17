const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const sharp = require("sharp");

const pptxForShapes = new pptxgen();
const SHAPE = pptxForShapes.ShapeType;

const docsDir = __dirname;
const uiDir = path.join(docsDir, "assets", "business-plan-ui");
const previewDir = path.join(docsDir, "assets", "business-plan-ppt-preview");
const outFile = path.join(docsDir, "GGtem-business-plan-ui-money-flow.pptx");

const C = {
  ink: "111827",
  muted: "64748B",
  soft: "F8FAFC",
  line: "CBD5E1",
  white: "FFFFFF",
  dark: "0F172A",
  green: "00A885",
  blue: "2563EB",
  amber: "F59E0B",
  red: "EF4444",
  mint: "DCFCE7",
  sky: "DBEAFE",
  rose: "FFE4E6",
  yellow: "FEF3C7",
};

const font = "Malgun Gothic";

function ui(name) {
  return path.join(uiDir, name);
}

function bg(slide, color = C.soft) {
  slide.background = { color };
}

function title(slide, text, sub) {
  slide.addText(text, {
    x: 0.58,
    y: 0.42,
    w: 10.2,
    h: 0.46,
    margin: 0,
    fontFace: font,
    fontSize: 24,
    bold: true,
    color: C.ink,
    fit: "shrink",
  });
  if (sub) {
    slide.addText(sub, {
      x: 0.6,
      y: 0.98,
      w: 10.8,
      h: 0.26,
      margin: 0,
      fontFace: font,
      fontSize: 10.5,
      color: C.muted,
      fit: "shrink",
    });
  }
  slide.addShape(SHAPE.line, {
    x: 0.58,
    y: 1.34,
    w: 12.2,
    h: 0,
    line: { color: C.line, width: 0.8 },
  });
}

function footer(slide, n) {
  slide.addText(`GGtem 사업계획서 | ${String(n).padStart(2, "0")}`, {
    x: 10.7,
    y: 7.1,
    w: 2.0,
    h: 0.2,
    margin: 0,
    fontFace: font,
    fontSize: 7,
    color: "94A3B8",
    align: "right",
  });
}

function shot(slide, file, x, y, w, h, label) {
  slide.addShape(SHAPE.roundRect, {
    x: x - 0.04,
    y: y - 0.04,
    w: w + 0.08,
    h: h + 0.08,
    rectRadius: 0.08,
    fill: { color: C.white },
    line: { color: "E2E8F0", width: 1 },
    shadow: { type: "outer", color: "CBD5E1", opacity: 0.18, blur: 2, angle: 45, distance: 1 },
  });
  slide.addImage({ path: ui(file), x, y, w, h, sizingCrop: true });
  if (label) {
    slide.addText(label, {
      x,
      y: y + h + 0.08,
      w,
      h: 0.18,
      margin: 0,
      fontFace: font,
      fontSize: 7.5,
      color: C.muted,
      align: "center",
      fit: "shrink",
    });
  }
}

function text(slide, value, x, y, w, h, size = 13, color = C.ink, bold = false) {
  slide.addText(value, {
    x,
    y,
    w,
    h,
    margin: 0,
    fontFace: font,
    fontSize: size,
    color,
    bold,
    fit: "shrink",
    breakLine: false,
    paraSpaceAfterPt: 0,
  });
}

function chip(slide, value, x, y, w, fill, color = C.ink) {
  slide.addShape(SHAPE.roundRect, {
    x,
    y,
    w,
    h: 0.34,
    rectRadius: 0.09,
    fill: { color: fill },
    line: { color: fill },
  });
  text(slide, value, x + 0.08, y + 0.08, w - 0.16, 0.14, 7.5, color, true);
}

function node(slide, value, x, y, w, fill, color = C.ink) {
  slide.addShape(SHAPE.roundRect, {
    x,
    y,
    w,
    h: 0.58,
    rectRadius: 0.1,
    fill: { color: fill },
    line: { color: fill },
  });
  slide.addText(value, {
    x: x + 0.08,
    y: y + 0.17,
    w: w - 0.16,
    h: 0.2,
    margin: 0,
    fontFace: font,
    fontSize: 8.8,
    color,
    bold: true,
    align: "center",
    fit: "shrink",
  });
}

function arrow(slide, x, y, w, color = "94A3B8") {
  slide.addShape(SHAPE.line, {
    x,
    y,
    w,
    h: 0,
    line: { color, width: 1.3, endArrowType: "triangle" },
  });
}

function cover(pptx) {
  const s = pptx.addSlide();
  bg(s, C.dark);
  s.addImage({ path: ui("home.png"), x: 6.1, y: 0.55, w: 6.55, h: 5.85, sizingCrop: true, transparency: 4 });
  s.addShape(SHAPE.rect, { x: 5.55, y: 0, w: 1.4, h: 7.5, fill: { color: C.dark, transparency: 7 }, line: { color: C.dark } });
  text(s, "GGTEM", 0.72, 0.68, 1.8, 0.3, 15, C.green, true);
  text(s, "실제 UI로 보는\n게임 아이템 거래 플랫폼", 0.72, 1.55, 5.0, 1.3, 35, C.white, true);
  text(s, "사업계획서 · 돈의 흐름 · 운영 콘솔 · 에스크로 신뢰 구조", 0.74, 3.5, 4.7, 0.42, 13.5, "CBD5E1");
  chip(s, "2026.05.16", 0.74, 6.42, 1.2, "1E293B", "CBD5E1");
  chip(s, "실제 화면 캡처 기반", 2.1, 6.42, 1.55, "0F766E", C.white);
}

function slide2(pptx) {
  const s = pptx.addSlide();
  bg(s);
  title(s, "문제는 거래가 아니라 신뢰와 정산입니다", "게임머니/아이템 거래는 주문, 채팅, 돈의 상태가 분리될수록 운영 리스크가 커집니다.");
  shot(s, "listings.png", 0.68, 1.72, 6.25, 4.55, "공개 거래 목록");
  text(s, "구매자는 돈을 맡길 곳이 필요하고,\n판매자는 정산 받을 근거가 필요합니다.", 7.45, 1.75, 4.7, 1.25, 25, C.ink, true);
  text(s, "GGtem은 거래 등록, 에스크로, 주문 채팅, 지갑 원장, 관리자 분쟁 처리를 하나의 흐름으로 묶습니다.", 7.48, 3.65, 4.35, 0.85, 14, C.muted);
  chip(s, "목록 → 주문", 7.5, 5.12, 1.3, C.sky, "1E40AF");
  chip(s, "에스크로", 9.05, 5.12, 1.15, C.mint, "166534");
  chip(s, "원장/감사", 10.45, 5.12, 1.28, C.yellow, "92400E");
  footer(s, 2);
}

function slide3(pptx) {
  const s = pptx.addSlide();
  bg(s, C.white);
  title(s, "유저 UI와 어드민 UI가 한 운영 시스템으로 연결됩니다", "판매/구매 화면의 모든 상태 변화는 지갑 원장과 어드민 처리 화면으로 이어집니다.");
  const xs = [0.9, 3.75, 6.6, 9.45];
  ["판매등록", "구매등록", "주문/채팅", "지갑/정산"].forEach((v, i) => {
    node(s, v, xs[i], 2.0, 1.55, i === 3 ? C.mint : C.sky, i === 3 ? "166534" : "1E40AF");
    if (i < 3) arrow(s, xs[i] + 1.7, 2.29, 0.9);
  });
  node(s, "어드민 운영 콘솔", 4.85, 4.55, 3.25, C.dark, C.white);
  text(s, "충전 승인 · 출금 처리 · 분쟁 · QNA · 게임/서버/입금주소 설정", 3.05, 5.35, 6.95, 0.32, 13.5, C.ink, true);
  shot(s, "admin-deposits.png", 0.9, 4.05, 2.5, 1.6, "충전 승인");
  shot(s, "support.png", 10.0, 4.05, 2.45, 1.6, "고객센터");
  footer(s, 3);
}

function slide4(pptx) {
  const s = pptx.addSlide();
  bg(s);
  title(s, "유저 플로우는 가입부터 지갑까지 끊기지 않습니다", "온보딩, 인증, 탐색, 고객센터까지 실제 UI 흐름으로 설명합니다.");
  shot(s, "sign-up.png", 0.75, 1.7, 3.1, 2.55, "회원가입");
  shot(s, "sign-in.png", 4.08, 1.7, 3.1, 2.55, "로그인");
  shot(s, "support.png", 7.4, 1.7, 4.95, 2.55, "고객센터/신규 게임 신청");
  ["가입", "인증", "거래", "지갑", "CS"].forEach((v, i) => {
    const x = 1.05 + i * 2.5;
    node(s, v, x, 5.35, 1.16, i < 2 ? C.sky : i === 2 ? C.mint : i === 3 ? C.yellow : C.rose);
    if (i < 4) arrow(s, x + 1.28, 5.64, 0.95);
  });
  footer(s, 4);
}

function slide5(pptx) {
  const s = pptx.addSlide();
  bg(s, C.white);
  title(s, "마켓은 판매 매물과 구매 수요를 동시에 모읍니다", "공개 목록에서 게임/서버/카테고리 기준으로 거래 진입을 만듭니다.");
  shot(s, "listings.png", 0.7, 1.68, 7.2, 4.92, "실제 /listings 화면");
  text(s, "두 방향의 유동성", 8.45, 1.8, 3.2, 0.35, 24, C.ink, true);
  text(s, "판매자는 매물을 올리고, 구매자는 원하는 조건의 구매요청을 등록합니다. 플랫폼은 양쪽 수요를 같은 게임/서버 구조로 정렬합니다.", 8.48, 2.48, 3.65, 1.1, 13.5, C.muted);
  chip(s, "판매등록", 8.48, 4.15, 1.1, C.sky, "1E40AF");
  chip(s, "구매등록", 9.75, 4.15, 1.1, C.mint, "166534");
  chip(s, "즉시구매", 11.02, 4.15, 1.1, C.yellow, "92400E");
  text(s, "핵심은 거래 유형이 달라도 돈의 흐름은 하나의 원장으로 모인다는 점입니다.", 8.48, 5.18, 3.62, 0.55, 13.2, C.ink, true);
  footer(s, 5);
}

function slide6(pptx) {
  const s = pptx.addSlide();
  bg(s, C.dark);
  text(s, "돈의 흐름은 6개 버킷과 원장으로 설명됩니다", 0.7, 0.58, 9.4, 0.44, 25, C.white, true);
  text(s, "입금, 에스크로, 정산, 출금은 모두 버킷 이동과 WalletLedgerEntry로 추적됩니다.", 0.72, 1.13, 8.3, 0.24, 10.5, "CBD5E1");
  const nodes = [
    ["AVAILABLE", "사용 가능", 0.9, 2.05, C.sky, "1E40AF"],
    ["WITHDRAWABLE", "출금 가능", 3.05, 2.05, C.mint, "166534"],
    ["ESCROW_LOCKED", "주문 잠금", 5.2, 2.05, C.yellow, "92400E"],
    ["BUY_REQUEST_LOCKED", "구매요청 잠금", 7.35, 2.05, "EDE9FE", "6D28D9"],
    ["WITHDRAWAL_LOCKED", "출금 처리중", 9.5, 2.05, C.rose, "9F1239"],
    ["PLATFORM_REVENUE", "플랫폼 수익", 4.5, 4.8, "CCFBF1", "115E59"],
  ];
  nodes.forEach(([a, b, x, y, fill, color]) => {
    node(s, a, x, y, 1.6, fill, color);
    text(s, b, x + 0.12, y + 0.72, 1.35, 0.18, 7.3, color, true);
  });
  arrow(s, 2.6, 2.34, 0.35);
  arrow(s, 4.75, 2.34, 0.35);
  arrow(s, 6.9, 2.34, 0.35);
  arrow(s, 9.05, 2.34, 0.35);
  text(s, "주문 생성은 매출이 아니라 에스크로 잠금입니다. 매출은 완료 또는 분쟁 판매자 지급 때 확정됩니다.", 1.0, 6.15, 10.8, 0.44, 15, "E2E8F0", true);
  footer(s, 6);
}

function slide7(pptx) {
  const s = pptx.addSlide();
  bg(s);
  title(s, "충전 승인 후에만 플랫폼 내부 잔액이 됩니다", "입금 요청은 운영자가 TXID와 금액을 확인해 승인해야 AVAILABLE/WITHDRAWABLE에 반영됩니다.");
  shot(s, "admin-deposits.png", 0.75, 1.72, 5.55, 3.7, "어드민 충전 승인 화면");
  node(s, "입금 요청", 7.02, 1.95, 1.45, C.sky, "1E40AF");
  arrow(s, 8.62, 2.24, 0.65);
  node(s, "관리자 승인", 9.4, 1.95, 1.55, C.yellow, "92400E");
  arrow(s, 11.1, 2.24, 0.52);
  node(s, "잔액 반영", 11.75, 1.95, 1.05, C.mint, "166534");
  text(s, "승인 시 원장 2건", 7.1, 3.25, 2.2, 0.28, 14, C.ink, true);
  text(s, "1. ADMIN_DEPOSIT_APPROVED / CREDIT / AVAILABLE\n2. ADMIN_DEPOSIT_APPROVED / CREDIT / WITHDRAWABLE", 7.1, 3.68, 5.15, 0.74, 12.5, C.muted);
  text(s, "반려 시에는 잔액 변화 없이 요청 상태와 감사 로그만 남습니다.", 7.1, 4.85, 4.85, 0.34, 12.8, C.red, true);
  footer(s, 7);
}

function slide8(pptx) {
  const s = pptx.addSlide();
  bg(s, C.white);
  title(s, "즉시구매는 구매자 잔액을 에스크로로 옮기는 행동입니다", "판매자 정산은 구매확정 또는 분쟁 판매자 지급 이후에만 발생합니다.");
  node(s, "구매자 잔액", 0.9, 2.05, 1.45, C.sky, "1E40AF");
  arrow(s, 2.5, 2.34, 0.8);
  node(s, "에스크로", 3.45, 2.05, 1.35, C.yellow, "92400E");
  arrow(s, 4.95, 2.34, 0.8);
  node(s, "주문/채팅", 5.9, 2.05, 1.35, "EDE9FE", "6D28D9");
  arrow(s, 7.4, 2.34, 0.8);
  node(s, "판매자 정산", 8.35, 2.05, 1.55, C.mint, "166534");
  arrow(s, 10.05, 2.34, 0.7);
  node(s, "수수료 매출", 10.9, 2.05, 1.55, "CCFBF1", "115E59");
  shot(s, "wallet.png", 0.9, 3.55, 3.55, 2.05, "지갑 진입/보호 화면");
  text(s, "100 USDT 거래 예시", 5.0, 3.7, 3.0, 0.32, 17, C.ink, true);
  text(s, "구매자 에스크로 감소: -100\n판매자 정산액: +95\n플랫폼 수수료: +5", 5.04, 4.18, 3.1, 0.92, 15.5, C.muted);
  shot(s, "listings.png", 8.65, 3.55, 3.62, 2.05, "거래 진입 화면");
  footer(s, 8);
}

function slide9(pptx) {
  const s = pptx.addSlide();
  bg(s);
  title(s, "출금과 분쟁은 운영자가 돈을 최종 확정하는 구간입니다", "시연에서는 설명만 하고 실제 버튼은 데모 데이터가 아니면 클릭하지 않습니다.");
  ["출금 신청", "WITHDRAWAL_LOCKED", "관리자 완료", "외부 송금", "수수료 수익"].forEach((v, i) => {
    const x = 0.9 + i * 2.35;
    node(s, v, x, 2.0, i === 1 ? 1.75 : 1.35, i === 1 ? C.rose : i === 4 ? "CCFBF1" : C.sky, i === 1 ? "9F1239" : i === 4 ? "115E59" : "1E40AF");
    if (i < 4) arrow(s, x + (i === 1 ? 1.9 : 1.5), 2.29, 0.62);
  });
  shot(s, "admin-withdrawals.png", 0.9, 3.55, 2.8, 1.78, "출금 화면");
  shot(s, "admin-disputes.png", 4.05, 3.55, 2.8, 1.78, "분쟁 화면");
  shot(s, "admin-finance.png", 7.2, 3.55, 2.8, 1.78, "재무 화면");
  text(s, "관리자 로그인 세션으로 재캡처하면 실제 처리 화면을 더 설득력 있게 보여줄 수 있습니다.", 10.32, 3.65, 2.1, 1.25, 11.2, C.muted);
  footer(s, 9);
}

function slide10(pptx) {
  const s = pptx.addSlide();
  bg(s, C.white);
  title(s, "어드민 콘솔은 운영자가 다음 액션을 바로 이해하게 만듭니다", "충전, 출금, 분쟁, 주문, 고객센터, 설정이 하나의 운영 흐름으로 이어집니다.");
  shot(s, "admin.png", 0.72, 1.68, 3.15, 2.05, "어드민 진입");
  shot(s, "admin-deposits.png", 4.05, 1.68, 3.15, 2.05, "충전 처리");
  shot(s, "support.png", 7.38, 1.68, 4.15, 2.05, "고객센터");
  const rows = [
    ["충전 승인", "TXID/금액 확인 후 잔액 반영"],
    ["출금 처리", "주소/체인/위험 플래그 확인"],
    ["분쟁 처리", "채팅 증빙 기반 환불/지급"],
    ["QNA/CMS", "반복 문의를 FAQ/공지로 전환"],
  ];
  rows.forEach(([a, b], i) => {
    const x = 0.95 + i * 3.0;
    chip(s, a, x, 4.65, 1.25, [C.sky, C.rose, C.yellow, C.mint][i], C.ink);
    text(s, b, x, 5.15, 2.2, 0.42, 10.5, C.muted);
  });
  footer(s, 10);
}

function slide11(pptx) {
  const s = pptx.addSlide();
  bg(s, C.dark);
  text(s, "수익 모델은 거래 수수료, 출금 수수료, 프리미엄 노출입니다", 0.68, 0.62, 10.6, 0.48, 24, C.white, true);
  const items = [
    ["1", "거래 수수료", "주문 완료 또는 분쟁 판매자 지급 시 플랫폼 수익 원장 확정"],
    ["2", "출금 수수료", "출금 완료 시 수수료가 PLATFORM_REVENUE로 확정"],
    ["3", "프리미엄 노출", "판매/구매 등록 상단 노출로 추가 매출 후보 확보"],
  ];
  items.forEach(([n, a, b], i) => {
    const x = 1.0 + i * 3.75;
    text(s, n, x, 2.0, 0.5, 0.45, 30, C.green, true);
    text(s, a, x, 2.72, 2.7, 0.32, 18, C.white, true);
    text(s, b, x, 3.28, 2.65, 0.82, 12.5, "CBD5E1");
  });
  text(s, "투자자에게 강조할 메시지: GGtem의 매출은 원장으로 검증 가능한 완료 이벤트에서 발생합니다.", 1.1, 5.72, 10.8, 0.46, 16, "E2E8F0", true);
  footer(s, 11);
}

function slide12(pptx) {
  const s = pptx.addSlide();
  bg(s);
  title(s, "발표 데모는 '보여주기'와 '클릭 금지'를 분리합니다", "돈, 권한, DB, 입금주소와 연결되는 기능은 실제 데이터에서 누르지 않습니다.");
  const rows = [
    ["클릭 가능", "홈, 목록, 고객센터, 로그인/회원가입, 보호 화면, 읽기 전용 원장"],
    ["설명만", "입금 승인, 출금 완료/반려, 분쟁 환불/판매자 지급"],
    ["데모 데이터 필요", "주문 상세, 채팅, 지갑 원장, 관리자 처리 완료 화면"],
    ["다음 자료", "수수료율, 월 GMV 가정, 데모 계정 2개, 데모 주문/분쟁 1건"],
  ];
  rows.forEach(([a, b], i) => {
    const y = 1.78 + i * 1.12;
    chip(s, a, 0.9, y, 1.75, [C.mint, C.rose, C.yellow, C.sky][i], C.ink);
    text(s, b, 3.05, y + 0.04, 8.9, 0.3, 14.5, i === 1 ? C.red : C.ink, i === 1);
    s.addShape(SHAPE.line, { x: 0.9, y: y + 0.75, w: 11.2, h: 0, line: { color: "E2E8F0", width: 0.8 } });
  });
  footer(s, 12);
}

function makePptx() {
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "GGtem";
  pptx.company = "GGtem";
  pptx.subject = "GGtem business plan with real UI";
  pptx.title = "GGtem 사업계획서";
  pptx.lang = "ko-KR";
  pptx.theme = { headFontFace: font, bodyFontFace: font, lang: "ko-KR" };
  cover(pptx);
  slide2(pptx);
  slide3(pptx);
  slide4(pptx);
  slide5(pptx);
  slide6(pptx);
  slide7(pptx);
  slide8(pptx);
  slide9(pptx);
  slide10(pptx);
  slide11(pptx);
  slide12(pptx);
  return pptx;
}

function escXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function previewSlide(n, titleText, subtitle, image, dark = false) {
  const bgColor = dark ? "#0F172A" : "#F8FAFC";
  const fg = dark ? "#FFFFFF" : "#111827";
  const sub = dark ? "#CBD5E1" : "#64748B";
  const parts = [
    `<rect width="1920" height="1080" fill="${bgColor}"/>`,
    `<text x="120" y="168" font-family="Arial, sans-serif" font-size="58" font-weight="700" fill="${fg}">${escXml(titleText)}</text>`,
    `<text x="120" y="228" font-family="Arial, sans-serif" font-size="28" fill="${sub}">${escXml(subtitle)}</text>`,
    `<rect x="120" y="930" width="340" height="10" rx="5" fill="#00A885"/>`,
    `<text x="1760" y="120" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="${sub}">${String(n).padStart(2, "0")}</text>`,
  ];
  if (image) {
    const img = fs.readFileSync(ui(image)).toString("base64");
    parts.push(`<image href="data:image/png;base64,${img}" x="960" y="360" width="760" height="470" preserveAspectRatio="xMidYMid slice"/>`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">${parts.join("")}</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(previewDir, `slide-${String(n).padStart(2, "0")}.png`));
}

async function makePreviews() {
  fs.mkdirSync(previewDir, { recursive: true });
  const slides = [
    ["GGTEM 사업계획서", "실제 UI로 보는 게임 아이템 거래 플랫폼", "home.png", true],
    ["문제는 거래가 아니라 신뢰와 정산입니다", "거래 등록, 에스크로, 채팅, 원장을 하나의 흐름으로 묶습니다.", "listings.png", false],
    ["유저 UI와 어드민 UI가 연결됩니다", "판매/구매 상태 변화는 지갑 원장과 어드민 처리 화면으로 이어집니다.", "admin-deposits.png", false],
    ["유저 플로우는 가입부터 지갑까지 이어집니다", "온보딩, 인증, 탐색, 고객센터까지 실제 UI 흐름으로 설명합니다.", "sign-up.png", false],
    ["마켓은 판매 매물과 구매 수요를 동시에 모읍니다", "판매등록, 구매등록, 즉시구매가 게임/서버 구조로 정렬됩니다.", "listings.png", false],
    ["돈의 흐름은 6개 버킷과 원장입니다", "AVAILABLE, ESCROW_LOCKED, WITHDRAWAL_LOCKED, PLATFORM_REVENUE", null, true],
    ["충전 승인 후에만 내부 잔액이 됩니다", "관리자 승인 시 AVAILABLE/WITHDRAWABLE 원장이 함께 증가합니다.", "admin-deposits.png", false],
    ["즉시구매는 에스크로 이동입니다", "판매자 정산은 완료 또는 분쟁 지급 이후 발생합니다.", "wallet.png", false],
    ["출금과 분쟁은 운영자가 최종 확정합니다", "실제 데이터에서는 클릭 금지, 데모 데이터로만 시연합니다.", "admin-withdrawals.png", false],
    ["어드민 콘솔은 다음 액션을 보여줍니다", "충전, 출금, 분쟁, 주문, 고객센터, 설정이 연결됩니다.", "admin.png", false],
    ["수익 모델은 완료 이벤트에서 확정됩니다", "거래 수수료, 출금 수수료, 프리미엄 노출", null, true],
    ["데모는 보여주기와 클릭 금지를 분리합니다", "돈, 권한, DB, 입금주소 연결 기능은 실제 데이터에서 누르지 않습니다.", null, false],
  ];
  for (let i = 0; i < slides.length; i += 1) {
    await previewSlide(i + 1, ...slides[i]);
  }
}

async function main() {
  const pptx = makePptx();
  await pptx.writeFile({ fileName: outFile });
  await makePreviews();
  console.log(JSON.stringify({ pptx: outFile, previewDir, slideCount: 12 }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
