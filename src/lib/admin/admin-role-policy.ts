export const ADMIN_ROLES = ["SUPER", "ADMIN", "FINANCE", "CS", "MODERATOR"] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];
export type AdminRoleTone = "red" | "cyan" | "blue" | "green" | "amber";

export const ADMIN_ROLE_POLICIES: Record<
  AdminRole,
  {
    title: string;
    description: string;
    scope: string;
    tone: AdminRoleTone;
    risk: string;
    menuScope: string[];
  }
> = {
  SUPER: {
    title: "최고관리자",
    description:
      "관리자 계정, 권한, 민감 작업 승인, 감사 로그, 서비스 설정 전체를 관리합니다.",
    scope: "전체 권한",
    tone: "red",
    risk: "권한 변경, 출금 최종 승인, 서비스 차단 같은 최고 위험 작업을 수행할 수 있습니다.",
    menuScope: ["관리자 계정", "감사 로그", "출금 최종 승인", "국가/점검 설정"],
  },
  ADMIN: {
    title: "운영관리자",
    description:
      "유저, 주문, 분쟁, 신고, CMS, 게임/서버 설정을 관리하는 일반 운영 책임자입니다.",
    scope: "운영/분쟁/CMS",
    tone: "cyan",
    risk: "서비스 운영 설정과 유저 제한을 변경할 수 있습니다.",
    menuScope: ["유저", "주문", "분쟁", "리스크", "CMS", "게임/서버"],
  },
  FINANCE: {
    title: "재무 담당자",
    description:
      "수동 충전, 출금 검토, 정산, 원장, 재무 리포트를 확인하고 처리합니다.",
    scope: "충전/출금/정산",
    tone: "blue",
    risk: "금액 데이터와 출금 검토 화면에 접근합니다.",
    menuScope: ["입출금", "충전 승인", "원장", "정산", "재무 리포트"],
  },
  CS: {
    title: "고객지원",
    description:
      "주문 문의, 채팅, 신고와 분쟁의 1차 확인을 담당합니다.",
    scope: "문의/채팅/1차 확인",
    tone: "green",
    risk: "유저 응대와 주문 확인에 필요한 최소 운영 화면에 접근합니다.",
    menuScope: ["주문", "분쟁", "SLA", "커뮤니케이션"],
  },
  MODERATOR: {
    title: "모더레이터",
    description:
      "리뷰, 신고, 위험 콘텐츠 검토와 반복 위반 계정의 1차 확인을 담당합니다.",
    scope: "리뷰/신고/리스크",
    tone: "amber",
    risk: "리뷰와 신고 판단 화면에 접근합니다.",
    menuScope: ["리뷰", "리스크", "주문 조회", "SLA"],
  },
};

export const ADMIN_PERMISSION_GROUPS = [
  {
    title: "유저/주문 운영",
    items: [
      {
        label: "유저 조회",
        description: "회원 상태, 거래 제한, 운영 메모를 확인합니다.",
        roles: ["SUPER", "ADMIN", "CS"] as AdminRole[],
        risk: "normal" as const,
      },
      {
        label: "주문 조회",
        description: "주문 상태와 채팅 흐름을 확인합니다.",
        roles: ["SUPER", "ADMIN", "CS", "MODERATOR"] as AdminRole[],
        risk: "normal" as const,
      },
      {
        label: "분쟁 처리",
        description: "분쟁 메모, 증거, 처리 방향을 확인합니다.",
        roles: ["SUPER", "ADMIN", "CS"] as AdminRole[],
        risk: "high" as const,
      },
      {
        label: "유저 제재 요청",
        description: "판매 제한, 출금 보류, 신고 검토를 처리합니다.",
        roles: ["SUPER", "ADMIN", "MODERATOR"] as AdminRole[],
        risk: "high" as const,
      },
    ],
  },
  {
    title: "재무/지갑",
    items: [
      {
        label: "충전 조회",
        description: "입금 요청과 지갑 반영 상태를 확인합니다.",
        roles: ["SUPER", "FINANCE"] as AdminRole[],
        risk: "money" as const,
      },
      {
        label: "충전 처리",
        description: "수동 충전 승인/반려를 처리합니다.",
        roles: ["SUPER", "FINANCE"] as AdminRole[],
        risk: "money" as const,
      },
      {
        label: "출금 조회",
        description: "출금 요청과 목적지 정보를 확인합니다.",
        roles: ["SUPER", "FINANCE"] as AdminRole[],
        risk: "money" as const,
      },
      {
        label: "출금 최종 승인",
        description: "실제 송금 후 최종 처리합니다.",
        roles: ["SUPER"] as AdminRole[],
        risk: "critical" as const,
      },
    ],
  },
  {
    title: "설정/콘텐츠",
    items: [
      {
        label: "게임/서버 설정",
        description: "게임 종류와 서버명을 추가/수정합니다.",
        roles: ["SUPER", "ADMIN"] as AdminRole[],
        risk: "high" as const,
      },
      {
        label: "CMS 문서 관리",
        description: "약관, FAQ, 안내문을 관리합니다.",
        roles: ["SUPER", "ADMIN"] as AdminRole[],
        risk: "high" as const,
      },
      {
        label: "국가별 설정",
        description: "국가별 언어, 결제, 규제 설정을 관리합니다.",
        roles: ["SUPER", "ADMIN"] as AdminRole[],
        risk: "critical" as const,
      },
      {
        label: "점검 모드 승인",
        description: "서비스 접근 차단과 점검 문구를 관리합니다.",
        roles: ["SUPER"] as AdminRole[],
        risk: "critical" as const,
      },
    ],
  },
  {
    title: "감사/보안",
    items: [
      {
        label: "감사 로그 전체 조회",
        description: "관리자 작업 이력과 변경 전후 값을 확인합니다.",
        roles: ["SUPER", "ADMIN"] as AdminRole[],
        risk: "high" as const,
      },
      {
        label: "관리자 계정 생성",
        description: "새 운영 계정 초대 링크를 발급합니다.",
        roles: ["SUPER"] as AdminRole[],
        risk: "critical" as const,
      },
      {
        label: "권한 변경",
        description: "관리자 역할/상태 변경과 세션 만료를 처리합니다.",
        roles: ["SUPER"] as AdminRole[],
        risk: "critical" as const,
      },
      {
        label: "리포트 다운로드 승인",
        description: "개인정보/금액 데이터가 포함된 리포트를 내보냅니다.",
        roles: ["SUPER", "ADMIN", "FINANCE"] as AdminRole[],
        risk: "high" as const,
      },
    ],
  },
] as const;

export const ADMIN_RISK_ACTIONS = [
  {
    title: "관리자 계정 생성",
    description: "새 계정 생성과 초대 링크 발급은 최고관리자만 수행합니다.",
    state: "SUPER 전용",
    tone: "red" as const,
  },
  {
    title: "권한 변경",
    description: "역할/상태 변경 전후 값과 사유를 감사 로그에 남깁니다.",
    state: "사유 필수",
    tone: "amber" as const,
  },
  {
    title: "출금 최종 승인",
    description:
      "FINANCE 검토 후 실제 송금 확정은 최고관리자 확인 흐름을 권장합니다.",
    state: "이중 확인",
    tone: "red" as const,
  },
  {
    title: "관리자 잠금 해제",
    description: "잠금 해제 후 기존 세션을 만료하고 새 로그인만 허용합니다.",
    state: "세션 만료",
    tone: "blue" as const,
  },
] as const;

export function toAdminRole(role: string): AdminRole | null {
  return ADMIN_ROLES.includes(role as AdminRole) ? (role as AdminRole) : null;
}

export function roleTitle(role: AdminRole) {
  return ADMIN_ROLE_POLICIES[role].title;
}

export function roleDescription(role: AdminRole) {
  return ADMIN_ROLE_POLICIES[role].description;
}

export function roleScope(role: AdminRole) {
  return ADMIN_ROLE_POLICIES[role].scope;
}

export function roleTone(role: AdminRole) {
  return ADMIN_ROLE_POLICIES[role].tone;
}

export function roleRisk(role: AdminRole) {
  return ADMIN_ROLE_POLICIES[role].risk;
}
