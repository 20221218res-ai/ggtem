# GGitem 실서비스 준비 현황

마지막 업데이트: 2026-05-05

## 고정 백로그 진행 상태

1. [DONE] 어드민 UI 마감
2. [DONE] 입출금/지갑 운영 안정화
3. [DONE] 거래/에스크로 완성도
4. [DONE] 유저 페이지 UI 마감
5. [DONE] 신고/분쟁/리스크 운영
6. [DONE] 국가/언어/게임 데이터
7. [DONE] 보안/권한
8. [DONE] 데이터/리포트
9. [IN_PROGRESS] 테스트/출시 준비

## 출시 전 필수 테스트

전체 반복 시뮬레이션:

```powershell
npm run test:service-simulation
```

빠른 1회 시뮬레이션:

```powershell
$env:GGITEM_OVERNIGHT_CYCLES=1
npm run test:service-simulation
```

결과 파일:

```text
test-results/overnight-service-simulation-*/summary.md
test-results/overnight-service-simulation-*/summary.json
```

## 반드시 통과해야 하는 흐름

- 회원가입, 로그인, 로그아웃
- USDT 충전 요청, 관리자 승인, 잔액 반영
- 판매글 즉시구매, 에스크로 잠금, 인수확정, 판매자 정산, 플랫폼 수수료 기록
- 구매요청 즉시판매, 주문 생성, 정산 또는 환불
- 거래 취소, 중복 환불 방어
- 분쟁 접수, 에스크로 유지, 관리자 판정, 중복 판정 방어
- 출금 신청, 정책 검증, 수수료 계산, 관리자 반려/완료, 중복 완료 방어
- 관리자 권한별 접근 제한과 감사 로그
- 날짜별 리포트, CSV/XLSX 다운로드
- PC/모바일 주요 화면 확인

## 운영 전 외부 확인

- 실제 USDT 입금 주소와 출금 처리 절차
- 관리자 2FA, IP/디바이스 제한
- DB 백업, 장애 복구, 모니터링, 에러 알림
- 이용약관, 개인정보처리방침, 환불/분쟁 정책, 국가별 법무 검토
