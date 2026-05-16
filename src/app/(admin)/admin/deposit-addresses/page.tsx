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
      icon="USDT"
      title="입금 주소"
      subtitle=""
      actions={null}
    >
      <MetricGrid
        items={[
          {
            label: "등록",
            value: `${state.configuredCount}개`,
            hint: "TRC20/BEP20",
            tone: state.configuredCount >= 2 ? "green" : "amber",
          },
          {
            label: "활성",
            value: `${state.activeCount}개`,
            hint: "유저 충전 화면",
            tone: state.activeCount > 0 ? "cyan" : "red",
          },
          {
            label: "미설정",
            value: `${state.missingChains.length}개`,
            hint: state.missingChains.join(", ") || "없음",
            tone: state.missingChains.length === 0 ? "green" : "red",
          },
        ]}
      />

      {params?.error ? <SoftNotice tone="red">{params.error}</SoftNotice> : null}
      {params?.notice ? <SoftNotice tone="green">저장 완료</SoftNotice> : null}

      <Panel title="현재 주소">
        <DataTable
          headers={["체인", "네트워크", "주소", "최소 입금", "상태", "수정"]}
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
                    <StatusPill key="active" tone="green">
                      활성
                    </StatusPill>
                  ) : (
                    <StatusPill key="inactive" tone="slate">
                      비활성
                    </StatusPill>
                  ),
                  new Date(address.updatedAt).toLocaleString("ko-KR"),
                ])
              : [["-", "-", "주소 없음", "-", "-", "-"]]
          }
        />
      </Panel>

      <section className="grid gap-5 xl:grid-cols-2">
        {(["TRC20", "BEP20"] as const).map((chain) => {
          const current = state.addresses.find((address) => address.chain === chain);
          const defaults = DEFAULT_DEPOSIT_WALLET_ADDRESSES[chain];

          return (
            <Panel key={chain} title={`${chain} 주소`}>
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
        최고관리자 전용 작업입니다. 저장 시 비밀번호 재확인과 감사 로그가 남습니다.
      </SoftNotice>
    </AdminMockPage>
  );
}
