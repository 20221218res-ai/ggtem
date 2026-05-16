"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  COUNTRY_CHANGE_EVENT,
  getCurrentCountryCode,
} from "./country-text";
import type { CountryCode } from "./i18n";

type PhraseMap = Partial<Record<CountryCode, string>>;

const phraseMap: Record<string, PhraseMap> = {
  "검색": { CN: "搜索", VN: "Tim kiem", PH: "Search", TH: "ค้นหา" },
  "보기": { CN: "查看", VN: "Xem", PH: "View", TH: "ดู" },
  "전체 내역": { CN: "全部记录", VN: "Tat ca lich su", PH: "All history", TH: "ประวัติทั้งหมด" },
  "전체 보기": { CN: "查看全部", VN: "Xem tat ca", PH: "View all", TH: "ดูทั้งหมด" },
  "새로고침": { CN: "刷新", VN: "Tai lai", PH: "Refresh", TH: "รีเฟรช" },
  "홈으로": { CN: "回到首页", VN: "Ve trang chu", PH: "Home", TH: "หน้าแรก" },
  "취소": { CN: "取消", VN: "Huy", PH: "Cancel", TH: "ยกเลิก" },
  "확인": { CN: "确认", VN: "Xac nhan", PH: "Confirm", TH: "ยืนยัน" },
  "처리 중...": { CN: "处理中...", VN: "Dang xu ly...", PH: "Processing...", TH: "กำลังดำเนินการ..." },

  "판매 등록": { CN: "发布出售", VN: "Dang ban", PH: "Sell post", TH: "ลงขาย" },
  "구매 등록": { CN: "发布求购", VN: "Dang mua", PH: "Buy post", TH: "ลงซื้อ" },
  "게임머니": { CN: "游戏币", VN: "Tien game", PH: "Game money", TH: "เงินเกม" },
  "아이템": { CN: "道具", VN: "Vat pham", PH: "Item", TH: "ไอเทม" },
  "계정": { CN: "账号", VN: "Tai khoan", PH: "Account", TH: "บัญชี" },
  "거래": { CN: "交易", VN: "Giao dich", PH: "Trade", TH: "ซื้อขาย" },
  "지갑": { CN: "钱包", VN: "Vi", PH: "Wallet", TH: "กระเป๋า" },
  "채팅": { CN: "聊天", VN: "Chat", PH: "Chat", TH: "แชท" },
  "알림": { CN: "通知", VN: "Thong bao", PH: "Notifications", TH: "แจ้งเตือน" },
  "로그인": { CN: "登录", VN: "Dang nhap", PH: "Sign in", TH: "เข้าสู่ระบบ" },
  "회원가입": { CN: "注册", VN: "Dang ky", PH: "Sign up", TH: "Sign up" },
  "로그아웃": { CN: "退出", VN: "Dang xuat", PH: "Sign out", TH: "ออกจากระบบ" },

  "판매중인 품목": { CN: "出售中的商品", VN: "Dang ban", PH: "Active sell posts", TH: "รายการขาย" },
  "구매중인 품목": { CN: "求购中的商品", VN: "Dang mua", PH: "Active buy posts", TH: "Buy requests" },
  "게임 카테고리": { CN: "游戏分类", VN: "Danh muc game", PH: "Game category", TH: "หมวดเกม" },
  "게임 제목 검색": { CN: "搜索游戏名称", VN: "Tim ten game", PH: "Search game title", TH: "ค้นหาชื่อเกม" },
  "전체 게임": { CN: "全部游戏", VN: "Tat ca game", PH: "All games", TH: "เกมทั้งหมด" },
  "전체 서버": { CN: "全部服务器", VN: "Tat ca may chu", PH: "All servers", TH: "เซิร์ฟเวอร์ทั้งหมด" },
  "전체 계정": { CN: "全部账号", VN: "Tat ca tai khoan", PH: "All accounts", TH: "บัญชีทั้งหมด" },
  "전체": { CN: "全部", VN: "Tat ca", PH: "All", TH: "ทั้งหมด" },
  "서버": { CN: "服务器", VN: "May chu", PH: "Server", TH: "เซิร์ฟเวอร์" },
  "가격": { CN: "价格", VN: "Gia", PH: "Price", TH: "ราคา" },
  "물품 검색": { CN: "搜索商品", VN: "Tim vat pham", PH: "Search item", TH: "ค้นหารายการ" },
  "검색저장": { CN: "保存搜索", VN: "Luu tim kiem", PH: "Save search", TH: "บันทึกการค้นหา" },
  "초기화": { CN: "重置", VN: "Dat lai", PH: "Reset", TH: "รีเซ็ต" },
  "게임 다시선택": { CN: "重新选择游戏", VN: "Chon lai game", PH: "Choose game again", TH: "เลือกเกมใหม่" },
  "바로 보기": { CN: "立即查看", VN: "Xem ngay", PH: "Open", TH: "ดูเลย" },

  "즉시 구매": { CN: "立即购买", VN: "Mua ngay", PH: "Buy now", TH: "ซื้อทันที" },
  "즉시 판매": { CN: "立即出售", VN: "Ban ngay", PH: "Sell now", TH: "ขายทันที" },
  "주문 상세": { CN: "订单详情", VN: "Chi tiet don", PH: "Order detail", TH: "รายละเอียดคำสั่ง" },
  "채팅 열기": { CN: "打开聊天", VN: "Mo chat", PH: "Open chat", TH: "เปิดแชท" },
  "거래 대기": { CN: "等待交易", VN: "Cho giao dich", PH: "Waiting", TH: "รอทำรายการ" },
  "결제 완료": { CN: "付款完成", VN: "Da thanh toan", PH: "Paid", TH: "ชำระแล้ว" },
  "거래 진행": { CN: "交易进行中", VN: "Dang giao dich", PH: "In progress", TH: "กำลังซื้อขาย" },
  "거래 완료": { CN: "交易完成", VN: "Hoan tat", PH: "Completed", TH: "เสร็จสิ้น" },
  "분쟁": { CN: "纠纷", VN: "Tranh chap", PH: "Dispute", TH: "ข้อพิพาท" },
  "취소됨": { CN: "已取消", VN: "Da huy", PH: "Canceled", TH: "ยกเลิกแล้ว" },
  "환불 완료": { CN: "已退款", VN: "Da hoan tien", PH: "Refunded", TH: "คืนเงินแล้ว" },
  "인수확정": { CN: "确认收货", VN: "Xac nhan nhan", PH: "Confirm receipt", TH: "ยืนยันรับ" },
  "인수확정 요청": { CN: "请求确认收货", VN: "Yeu cau xac nhan", PH: "Request confirmation", TH: "ขอยืนยันรับ" },

  "USDT 충전": { CN: "USDT 充值", VN: "Nap USDT", PH: "USDT deposit", TH: "ฝาก USDT" },
  "USDT 출금": { CN: "USDT 提现", VN: "Rut USDT", PH: "USDT withdrawal", TH: "ถอน USDT" },
  "충전하기": { CN: "充值", VN: "Nap tien", PH: "Deposit", TH: "ฝากเงิน" },
  "출금하기": { CN: "提现", VN: "Rut tien", PH: "Withdraw", TH: "ถอนเงิน" },
  "충전 방식 선택": { CN: "选择充值方式", VN: "Chon cach nap", PH: "Choose deposit method", TH: "เลือกวิธีฝาก" },
  "출금 방식 선택": { CN: "选择提现方式", VN: "Chon cach rut", PH: "Choose withdrawal method", TH: "เลือกวิธีถอน" },
  "충전 금액": { CN: "充值金额", VN: "So tien nap", PH: "Deposit amount", TH: "จำนวนฝาก" },
  "출금 금액": { CN: "提现金额", VN: "So tien rut", PH: "Withdrawal amount", TH: "จำนวนถอน" },
  "충전신청": { CN: "提交充值", VN: "Gui yeu cau nap", PH: "Request deposit", TH: "ขอฝากเงิน" },
  "출금 요청": { CN: "提交提现", VN: "Gui yeu cau rut", PH: "Request withdrawal", TH: "ขอถอนเงิน" },
  "충전 요청": { CN: "充值请求", VN: "Yeu cau nap", PH: "Deposit request", TH: "คำขอฝาก" },
  "충전 안내": { CN: "充值说明", VN: "Huong dan nap", PH: "Deposit guide", TH: "คู่มือฝาก" },
  "출금 규정": { CN: "提现规则", VN: "Quy dinh rut", PH: "Withdrawal rules", TH: "กฎการถอน" },
  "총 잔액": { CN: "总余额", VN: "Tong so du", PH: "Total balance", TH: "ยอดรวม" },
  "출금 가능": { CN: "可提现", VN: "Co the rut", PH: "Withdrawable", TH: "ถอนได้" },
  "거래 중": { CN: "交易中", VN: "Dang giao dich", PH: "In trade", TH: "ระหว่างซื้อขาย" },
  "최근 내역": { CN: "最近记录", VN: "Lich su gan day", PH: "Recent history", TH: "ประวัติล่าสุด" },
  "최근 충전 요청": { CN: "最近充值请求", VN: "Yeu cau nap gan day", PH: "Recent deposits", TH: "คำขอฝากล่าสุด" },
  "최근 출금 요청": { CN: "最近提现请求", VN: "Yeu cau rut gan day", PH: "Recent withdrawals", TH: "คำขอถอนล่าสุด" },
  "수수료": { CN: "手续费", VN: "Phi", PH: "Fee", TH: "ค่าธรรมเนียม" },
  "입금 주소": { CN: "入金地址", VN: "Dia chi nap", PH: "Deposit address", TH: "ที่อยู่ฝาก" },
  "받을 주소": { CN: "收款地址", VN: "Dia chi nhan", PH: "Receiving address", TH: "ที่อยู่รับ" },
  "최종 확인": { CN: "最终确认", VN: "Xac nhan cuoi", PH: "Final confirmation", TH: "ยืนยันสุดท้าย" },
  "관리자 승인": { CN: "管理员确认", VN: "Quan tri duyet", PH: "Admin approval", TH: "อนุมัติโดยผู้ดูแล" },
  "처리 중": { CN: "处理中", VN: "Dang xu ly", PH: "Processing", TH: "กำลังดำเนินการ" },
  "완료": { CN: "完成", VN: "Hoan tat", PH: "Completed", TH: "สำเร็จ" },
  "반려": { CN: "驳回", VN: "Tu choi", PH: "Rejected", TH: "ปฏิเสธ" },
  "실패": { CN: "失败", VN: "That bai", PH: "Failed", TH: "ล้มเหลว" },

  "마이페이지": { CN: "我的页面", VN: "Trang cua toi", PH: "My page", TH: "หน้าของฉัน" },
  "내 구매글": { CN: "我的求购", VN: "Bai mua cua toi", PH: "My buy posts", TH: "โพสต์ซื้อของฉัน" },
  "내 판매글": { CN: "我的出售", VN: "Bai ban cua toi", PH: "My sell posts", TH: "โพสต์ขายของฉัน" },
  "판매 등록하기": { CN: "发布出售", VN: "Dang ban", PH: "Create sell post", TH: "สร้างโพสต์ขาย" },
  "구매 등록하기": { CN: "发布求购", VN: "Dang mua", PH: "Create buy post", TH: "สร้างโพสต์ซื้อ" },
  "등록한 글 보기": { CN: "查看已发布", VN: "Xem bai da dang", PH: "View post", TH: "ดูโพสต์" },
  "판매글 수정": { CN: "编辑出售", VN: "Sua bai ban", PH: "Edit sell post", TH: "แก้ไขโพสต์ขาย" },
  "변경사항 저장": { CN: "保存修改", VN: "Luu thay doi", PH: "Save changes", TH: "บันทึก" },
  "본문 이미지": { CN: "正文图片", VN: "Anh noi dung", PH: "Content images", TH: "รูปภาพเนื้อหา" },
  "이미지 저장": { CN: "保存图片", VN: "Luu anh", PH: "Save image", TH: "บันทึกรูป" },
  "이미지 삭제": { CN: "删除图片", VN: "Xoa anh", PH: "Delete image", TH: "ลบรูป" },
  "제목": { CN: "标题", VN: "Tieu de", PH: "Title", TH: "ชื่อเรื่อง" },
  "내용": { CN: "内容", VN: "Noi dung", PH: "Content", TH: "เนื้อหา" },
  "거래 내용": { CN: "交易内容", VN: "Noi dung giao dich", PH: "Trade content", TH: "รายละเอียด" },
  "계정 유형": { CN: "账号类型", VN: "Loai tai khoan", PH: "Account type", TH: "ประเภทบัญชี" },
  "구글 계정": { CN: "Google账号", VN: "Tai khoan Google", PH: "Google account", TH: "บัญชี Google" },
  "게임사 계정": { CN: "游戏公司账号", VN: "Tai khoan nha phat hanh", PH: "Game company account", TH: "บัญชีค่ายเกม" },
  "전달 방식": { CN: "交付方式", VN: "Cach giao", PH: "Delivery method", TH: "วิธีส่งมอบ" },
  "수량": { CN: "数量", VN: "So luong", PH: "Quantity", TH: "จำนวน" },
  "단가": { CN: "单价", VN: "Don gia", PH: "Unit price", TH: "ราคาต่อหน่วย" },
  "최소 수량": { CN: "最小数量", VN: "So luong toi thieu", PH: "Minimum quantity", TH: "จำนวนขั้นต่ำ" },
  "판매 수량": { CN: "出售数量", VN: "So luong ban", PH: "Sell quantity", TH: "จำนวนขาย" },
  "구매 수량": { CN: "购买数量", VN: "So luong mua", PH: "Buy quantity", TH: "จำนวนซื้อ" },
  "주문 금액": { CN: "订单金额", VN: "So tien don", PH: "Order amount", TH: "ยอดคำสั่ง" },
  "결제 금액": { CN: "付款金额", VN: "So tien thanh toan", PH: "Payment amount", TH: "ยอดชำระ" },
  "정산 예정": { CN: "预计结算", VN: "Du kien nhan", PH: "Expected payout", TH: "คาดว่าจะได้รับ" },
  "판매자 정산": { CN: "卖家结算", VN: "Thanh toan nguoi ban", PH: "Seller payout", TH: "ยอดผู้ขาย" },

  "채팅 목록": { CN: "聊天列表", VN: "Danh sach chat", PH: "Chat list", TH: "รายการแชท" },
  "거래 정보": { CN: "交易信息", VN: "Thong tin giao dich", PH: "Trade info", TH: "ข้อมูลซื้อขาย" },
  "주문 보기": { CN: "查看订单", VN: "Xem don", PH: "View order", TH: "ดูคำสั่ง" },
  "매물 보기": { CN: "查看商品", VN: "Xem hang", PH: "View listing", TH: "ดูรายการ" },
  "메시지 없음": { CN: "没有消息", VN: "Khong co tin nhan", PH: "No messages", TH: "ไม่มีข้อความ" },
  "진행 중인 채팅이 없습니다.": { CN: "暂无进行中的聊天。", VN: "Khong co chat dang mo.", PH: "No active chats.", TH: "ไม่มีแชทที่ใช้งานอยู่" },

  "알림이 없습니다.": { CN: "暂无通知。", VN: "Khong co thong bao.", PH: "No notifications.", TH: "ไม่มีแจ้งเตือน" },
  "읽음 처리": { CN: "标为已读", VN: "Danh dau da doc", PH: "Mark as read", TH: "ทำเครื่องหมายอ่านแล้ว" },
};

const attributeNames = ["placeholder", "title", "aria-label"];
const textOriginals = new WeakMap<Text, string>();
const attrOriginalName = "data-gg-original-text";

export default function UserLocaleDomTranslator() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname?.startsWith("/admin")) {
      return;
    }

    let rafId = 0;
    let observer: MutationObserver | null = null;

    const stopObserver = () => {
      observer?.disconnect();
      observer = null;
    };

    const startObserver = () => {
      if (observer) {
        return;
      }

      observer = new MutationObserver(translateNow);
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: attributeNames,
      });
    };

    const translateNow = () => {
      window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        const countryCode = getCurrentCountryCode();
        translateDocument(countryCode);

        if (countryCode === "KR") {
          stopObserver();
        } else {
          startObserver();
        }
      });
    };

    translateNow();
    window.addEventListener(COUNTRY_CHANGE_EVENT, translateNow);
    window.addEventListener("storage", translateNow);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener(COUNTRY_CHANGE_EVENT, translateNow);
      window.removeEventListener("storage", translateNow);
      stopObserver();
    };
  }, [pathname]);

  return null;
}

function translateDocument(countryCode: CountryCode) {
  translateTextNodes(document.body, countryCode);
  translateAttributes(document.body, countryCode);
}

function translateTextNodes(root: HTMLElement, countryCode: CountryCode) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || shouldSkip(parent)) {
        return NodeFilter.FILTER_REJECT;
      }

      return node.nodeValue?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });

  const nodes: Text[] = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode as Text);
  }

  for (const node of nodes) {
    const current = node.nodeValue ?? "";
    const original = getOriginalText(node, current);
    const translated = translatePhrase(original, countryCode);
    if (!translated) {
      continue;
    }

    node.nodeValue = preserveSpacing(current, translated);
  }
}

function translateAttributes(root: HTMLElement, countryCode: CountryCode) {
  for (const attrName of attributeNames) {
    const elements = root.querySelectorAll<HTMLElement>(`[${attrName}]`);
    elements.forEach((element) => {
      if (shouldSkip(element)) {
        return;
      }

      const current = element.getAttribute(attrName);
      if (!current) {
        return;
      }

      const dataKey = `${attrOriginalName}-${attrName}`;
      const original = element.getAttribute(dataKey) ?? current;
      if (!element.hasAttribute(dataKey)) {
        element.setAttribute(dataKey, original);
      }

      const translated = translatePhrase(original, countryCode);
      if (translated) {
        element.setAttribute(attrName, translated);
      }
    });
  }
}

function getOriginalText(node: Text, current: string) {
  const trimmed = current.trim();
  const saved = textOriginals.get(node);
  if (!saved) {
    textOriginals.set(node, trimmed);
    return trimmed;
  }

  const knownTranslations = new Set(
    Object.values(phraseMap[saved] ?? {}).filter(Boolean),
  );
  if (trimmed === saved || knownTranslations.has(trimmed)) {
    return saved;
  }

  textOriginals.set(node, trimmed);
  return trimmed;
}

function translatePhrase(text: string, countryCode: CountryCode) {
  if (countryCode === "KR") {
    return text;
  }

  return phraseMap[text]?.[countryCode] ?? null;
}

function preserveSpacing(source: string, translated: string) {
  const prefix = source.match(/^\s*/)?.[0] ?? "";
  const suffix = source.match(/\s*$/)?.[0] ?? "";
  return `${prefix}${translated}${suffix}`;
}

function shouldSkip(element: Element) {
  const tagName = element.tagName.toLowerCase();
  return (
    tagName === "script" ||
    tagName === "style" ||
    tagName === "code" ||
    tagName === "pre" ||
    tagName === "textarea" ||
    element.closest("[data-no-auto-translate]") !== null ||
    element.closest("[contenteditable='true']") !== null
  );
}
