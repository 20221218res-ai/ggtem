import { requirePageRole } from "@/lib/auth/guards";
import { DEFAULT_DEPOSIT_WALLET_ADDRESSES } from "@/lib/wallet/deposit-address-defaults";
import { getAdminDepositWalletAddressState } from "@/lib/wallet/deposit-addresses";
import {
  AdminMockPage,
  DataTable,
  MetricGrid,
  Panel,
  SoftNotice,
  StatusPill,
} from "../admin-prototype-ui";
import { DepositAddressForm } from "./deposit-address-form";

type DepositAddressesPageProps = {
  searchParams?: Promise<{
    error?: string;
    notice?: string;
  }>;
};

export default async function AdminDepositAddressesPage({
  searchParams,
}: DepositAddressesPageProps) {
  await requirePageRole(["SUPER"], {
    signInPath: "/admin/sign-in",
    forbiddenPath: "/admin",
  });

  const params = searchParams ? await searchParams : undefined;
  const state = await getAdminDepositWalletAddressState();

  return (
    <AdminMockPage
      icon=""
      title="입금 주소 설정"
      subtitle="유저에게 노출되는 USDT 입금 주소를 최고관리자만 변경합니다."
      actions={null}
    >
      <MetricGrid
        items={[
          {
            label: "등록 주소",
            value: `${state.configuredCount}개`,
            hint: "TRC20/BEP20",
            tone: state.configuredCount >= 2 ? "green" : "amber",
          },
          {
            label: "활성 주소",
            value: `${state.activeCount}개`,
            hint: "유저 충전 화면 노출",
            tone: state.activeCount > 0 ? "cyan" : "red",
          },
          {
            label: "미설정 체인",
            value: `${state.missingChains.length}개`,
            hint: state.missingChains.join(", ") || "없음",
            tone: state.missingChains.length === 0 ? "green" : "red",
          },
        ]}
      />

      {params?.error ? <SoftNotice tone="red">{params.error}</SoftNotice> : null}
      {params?.notice ? <SoftNotice tone="green">입금 주소 설정이 저장되었습니다.</SoftNotice> : null}

      <Panel title="현재 운영 주소">
        <DataTable
          headers={["체인", "네트워크", "주소", "최소 입금", "상태", "수정일"]}
          rows={
            state.addresses.length
              ? state.addresses.map((address) => [
                  address.chain,
                  address.networkName,
                  <span key={address.id} className="break-all font-mono text-xs">
                    {address.address}
                  </span>,
                  `${address.minimumAmount} ${address.asset}`,
                  address.isActive ? (
                    <StatusPill key="active" tone="green">활성</StatusPill>
                  ) : (
                    <StatusPill key="inactive" tone="slate">비활성</StatusPill>
                  ),
                  new Date(address.updatedAt).toLocaleString("ko-KR"),
                ])
              : [["-", "-", "아직 설정된 입금 주소가 없습니다.", "-", "-", "-"]]
          }
        />
      </Panel>

      <section className="grid gap-5 xl:grid-cols-2">
        {(["TRC20", "BEP20"] as const).map((chain) => {
          const current = state.addresses.find((address) => address.chain === chain);
          const defaults = DEFAULT_DEPOSIT_WALLET_ADDRESSES[chain];

          return (
            <Panel key={chain} title={`${chain} 주소 변경`}>
              <DepositAddressForm
                chain={chain}
                defaults={defaults}
                current={
                  current
                    ? {
                        label: current.label,
                        asset: current.asset,
                        networkName: current.networkName,
                        address: current.address,
                        minimumAmount: current.minimumAmount,
                        isActive: current.isActive,
                      }
                    : undefined
                }
              />
            </Panel>
          );
        })}
      </section>

      <SoftNotice tone="amber">
        입금 주소 변경은 최고관리자만 가능하며 저장할 때마다 비밀번호 재확인과 감사 로그가 남습니다.
        잘못된 주소가 노출되면 실제 입금 손실이 발생할 수 있으므로 체인과 주소를 반드시 대조하세요.
      </SoftNotice>
    </AdminMockPage>
  );
}
