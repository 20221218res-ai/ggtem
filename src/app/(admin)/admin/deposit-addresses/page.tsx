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
import { updateDepositWalletAddressAction } from "./actions";

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
              <form action={updateDepositWalletAddressAction} className="grid gap-4">
                <input type="hidden" name="chain" value={chain} />
                <input type="hidden" name="asset" value={defaults.asset} />

                <Field label="표시 이름" name="label" defaultValue={current?.label ?? defaults.label} />
                <Field
                  label="네트워크"
                  name="networkName"
                  defaultValue={current?.networkName ?? defaults.networkName}
                />
                <Field
                  label="입금 주소"
                  name="address"
                  defaultValue={current?.address ?? defaults.address}
                  placeholder={chain === "TRC20" ? "T로 시작하는 TRC20 주소" : "0x로 시작하는 BEP20 주소"}
                  monospace
                />
                <Field
                  label="최소 입금액"
                  name="minimumAmount"
                  defaultValue={current?.minimumAmount ?? defaults.minimumAmount}
                  inputMode="decimal"
                />
                <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black">
                  <input
                    name="isActive"
                    type="checkbox"
                    defaultChecked={current?.isActive ?? true}
                    className="h-4 w-4 accent-[var(--color-primary)]"
                  />
                  유저 충전 화면에 노출
                </label>
                <Field
                  label="변경 사유"
                  name="reason"
                  defaultValue=""
                  placeholder="예: 운영 지갑 주소 교체 또는 보안 주소 변경"
                />
                <Field
                  label="최고관리자 비밀번호"
                  name="adminPassword"
                  defaultValue=""
                  type="password"
                  placeholder="주소 변경을 위해 비밀번호 재확인"
                />
                <button
                  type="submit"
                  className="h-12 rounded-md bg-[var(--color-primary)] px-4 text-sm font-black text-black hover:bg-[var(--color-primary-hover)]"
                >
                  {chain} 주소 저장
                </button>
              </form>
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

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  inputMode,
  type = "text",
  monospace = false,
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder?: string;
  inputMode?: "decimal";
  type?: "text" | "password";
  monospace?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm font-black text-slate-700">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        inputMode={inputMode}
        className={`h-12 rounded-md border border-slate-200 bg-white px-4 text-sm font-bold text-slate-950 outline-none focus:border-[var(--color-primary)] ${
          monospace ? "font-mono" : ""
        }`}
      />
    </label>
  );
}
