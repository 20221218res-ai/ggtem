"use client";

import type { ReactNode } from "react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicDepositWalletAddress } from "@/lib/wallet/deposit-addresses";
import CountryText, { COUNTRY_CHANGE_EVENT, getCurrentCountryCode } from "../../country-text";
import LocalizedInput from "../../localized-input";
import { translate, type CountryCode, type TranslationKey } from "../../i18n";

type DepositOption = PublicDepositWalletAddress;
type DepositChannelView = Pick<
  DepositOption,
  "id" | "chain" | "label" | "networkName" | "minimumAmount"
>;

const fallbackDepositChannels: DepositChannelView[] = [
  {
    id: "fallback-trc20",
    chain: "TRC20",
    label: "USDT TRC20",
    networkName: "TRON",
    minimumAmount: "20",
  },
  {
    id: "fallback-bep20",
    chain: "BEP20",
    label: "USDT BEP20",
    networkName: "BNB Smart Chain",
    minimumAmount: "20",
  },
];

const withdrawalChains = [
  { id: "TRC20", label: "USDT TRC20", note: "TRON" },
  { id: "BEP20", label: "USDT BEP20", note: "BNB Smart Chain" },
] as const;

const withdrawalPolicy = {
  minimumAmount: 20,
  dailyLimit: 2,
  cooldownHours: 4,
};

export default function WalletActions({
  currency,
  mode,
  depositOptions,
}: {
  currency: string;
  mode: "deposit" | "withdraw";
  depositOptions: DepositOption[];
}) {
  const router = useRouter();
  const t = useWalletTranslation();
  const [depositOptionId, setDepositOptionId] = useState("");
  const [depositAmount, setDepositAmount] = useState("100");
  const [depositTxHash, setDepositTxHash] = useState("");
  const [depositStep, setDepositStep] = useState<"method" | "details">("method");
  const [isDepositAddressVisible, setIsDepositAddressVisible] = useState(false);
  const [withdrawChain, setWithdrawChain] =
    useState<(typeof withdrawalChains)[number]["id"]>("TRC20");
  const [withdrawStep, setWithdrawStep] = useState<"method" | "details">("method");
  const [withdrawAmount, setWithdrawAmount] = useState("50");
  const [withdrawDestination, setWithdrawDestination] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWithdrawalConfirmOpen, setIsWithdrawalConfirmOpen] = useState(false);
  const [isWithdrawalFinalConfirmOpen, setIsWithdrawalFinalConfirmOpen] = useState(false);
  const [withdrawalConfirmError, setWithdrawalConfirmError] = useState("");
  const [withdrawPaymentPin, setWithdrawPaymentPin] = useState("");

  useEffect(() => {
    if (!depositOptionId && depositOptions[0]) {
      setDepositOptionId(depositOptions[0].id);
    }
  }, [depositOptionId, depositOptions]);

  const depositOption =
    depositOptions.find((option) => option.id === depositOptionId) ??
    depositOptions[0];
  const visibleDepositChannels =
    depositOptions.length > 0 ? depositOptions : fallbackDepositChannels;
  const feePreview = useMemo(() => getWithdrawalFeePreview(withdrawAmount), [withdrawAmount]);

  function resetDepositAddress() {
    setIsDepositAddressVisible(false);
    setDepositTxHash("");
  }

  function selectDepositMethod(option: DepositChannelView) {
    if (depositOptions.length === 0) {
      setError(t("wallet.depositNoAddressConfigured"));
      return;
    }

    setDepositOptionId(option.id);
    resetDepositAddress();
    setError("");
    setSuccess("");
    setDepositStep("details");
  }

  function selectWithdrawalMethod(chainId: (typeof withdrawalChains)[number]["id"]) {
    setWithdrawChain(chainId);
    setError("");
    setSuccess("");
    setWithdrawalConfirmError("");
    setWithdrawStep("details");
  }

  async function submitRequest(input: {
    kind: "DEPOSIT" | "WITHDRAWAL";
    amount: string;
    memo?: string;
    destination?: string;
    provider?: string;
    chain?: string;
    paymentPin?: string;
  }) {
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/market/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const result = (await response.json()) as {
        requestId?: string;
        kind?: "DEPOSIT" | "WITHDRAWAL";
        message?: string;
      };

      if (!response.ok) {
        throw new Error(result.message ?? t("wallet.requestFailed"));
      }

      setSuccess(result.message ?? t("wallet.requestReceived"));

      if (result.requestId) {
        const detailPath =
          result.kind === "WITHDRAWAL"
            ? `/my/wallet/withdrawals/${result.requestId}`
            : `/my/wallet/deposits/${result.requestId}`;
        router.push(detailPath);
        return;
      }

      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : t("wallet.requestFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  function validateDepositBase() {
    const amount = depositAmount.trim();

    if (!isPositiveDecimal(amount)) {
      setError(t("wallet.depositAmountInvalid"));
      return false;
    }

    if (!depositOption) {
      setError(t("wallet.depositNoAddressConfigured"));
      return false;
    }

    if (Number(amount) < Number(depositOption.minimumAmount)) {
      setError(formatMessage(t("wallet.depositMinimumError"), { amount: depositOption.minimumAmount, currency }));
      return false;
    }

    return true;
  }

  function handleDepositAddressReveal() {
    if (!validateDepositBase()) {
      return;
    }

    setError("");
    setSuccess("");
    setIsDepositAddressVisible(true);
  }

  function handleDepositSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = depositAmount.trim();
    const txHash = depositTxHash.trim();

    if (!validateDepositBase()) {
      return;
    }

    if (!isDepositAddressVisible) {
      setError(t("wallet.depositAddressFirst"));
      return;
    }

    if (txHash.length < 8) {
      setError(t("wallet.txidTooShort"));
      return;
    }

    void submitRequest({
      kind: "DEPOSIT",
      amount,
      provider: `CRYPTO_USDT_${depositOption.chain}`,
      memo: [
        `Network: ${depositOption.networkName}`,
        `Deposit address: ${depositOption.address}`,
        `Tx hash: ${txHash}`,
      ].join(" / "),
    });
  }

  function handleWithdrawalSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!feePreview.isValid) {
      setError(t("wallet.withdrawAmountInvalid"));
      return;
    }

    if (feePreview.amount < withdrawalPolicy.minimumAmount) {
      setError(formatMessage(t("wallet.withdrawMinimumError"), { amount: withdrawalPolicy.minimumAmount, currency }));
      return;
    }

    setError("");
    setSuccess("");
    setWithdrawalConfirmError("");
    setIsWithdrawalConfirmOpen(true);
  }

  function openWithdrawalFinalConfirm() {
    const destination = withdrawDestination.trim();

    if (destination.length < 12) {
      setWithdrawalConfirmError(t("wallet.destinationInvalid"));
      return;
    }

    setIsWithdrawalConfirmOpen(false);
    setIsWithdrawalFinalConfirmOpen(true);
    setWithdrawalConfirmError("");
    setWithdrawPaymentPin("");
  }

  function confirmWithdrawalSubmit() {
    const amount = withdrawAmount.trim();
    const destination = withdrawDestination.trim();
    const paymentPin = withdrawPaymentPin.trim();

    if (!/^\d{4,6}$/.test(paymentPin)) {
      setWithdrawalConfirmError("결제 PIN은 숫자 4~6자리로 입력해 주세요.");
      return;
    }

    void submitRequest({
      kind: "WITHDRAWAL",
      amount,
      destination,
      chain: withdrawChain,
      paymentPin,
      memo: `${withdrawChain} withdrawal request`,
    });
  }

  if (mode === "deposit" && depositStep === "method") {
    return (
      <DepositMethodLanding
        channels={visibleDepositChannels}
        hasActiveChannels={depositOptions.length > 0}
        currency={currency}
        error={error}
        onSelect={selectDepositMethod}
      />
    );
  }

  if (mode === "withdraw" && withdrawStep === "method") {
    return (
      <WithdrawalMethodLanding
        chains={withdrawalChains}
        currency={currency}
        error={error}
        onSelect={selectWithdrawalMethod}
      />
    );
  }

  return (
    <section className="grid gap-5 lg:grid-cols-[1fr_420px]">
      <div className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)]">
        {mode === "deposit" ? (
          <DepositInfo option={depositOption} currency={currency} />
        ) : (
          <WithdrawalInfo currency={currency} />
        )}
      </div>

      <div className="rounded-2xl border border-[color-mix(in_srgb,var(--gg-accent)_28%,transparent)] bg-[color-mix(in_srgb,var(--gg-accent)_8%,white)] p-5 shadow-sm shadow-[var(--gg-shadow)]">
        {mode === "deposit" ? (
          <form onSubmit={handleDepositSubmit} className="grid gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <PanelTitle eyebrowKey="wallet.depositEyebrow" titleKey="wallet.depositActionTitle" />
              <button
                type="button"
                onClick={() => {
                  resetDepositAddress();
                  setError("");
                  setSuccess("");
                  setDepositStep("method");
                }}
                className="rounded-xl border border-[var(--gg-border)] bg-white px-4 py-3 text-sm font-black text-[var(--gg-text)] hover:border-[var(--gg-accent)] hover:text-[var(--gg-accent)]"
              >
                <CountryText id="wallet.depositMethodTitle" />
              </button>
            </div>

            <SelectedDepositMethodCard option={depositOption} currency={currency} />
            <DepositStepProgress isAddressVisible={isDepositAddressVisible} hasTxHash={depositTxHash.trim().length >= 8} />

            <AmountInput
              label={
                <>
                  <CountryText id="wallet.depositAmount" /> ({currency})
                </>
              }
              value={depositAmount}
              onChange={(value) => {
                setDepositAmount(value);
                resetDepositAddress();
              }}
              quickValues={["20", "50", "100", "500"]}
            />

            <DepositRequestSummary
              option={depositOption}
              amount={depositAmount}
              currency={currency}
            />

            <button
              type="button"
              onClick={handleDepositAddressReveal}
              disabled={depositOptions.length === 0}
              className="h-14 rounded-xl bg-[var(--gg-accent)] text-base font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <CountryText id="wallet.depositStartRequest" />
            </button>

            {depositOption && isDepositAddressVisible ? (
              <DepositPaymentModal
                option={depositOption}
                amount={depositAmount}
                currency={currency}
                txHash={depositTxHash}
                isSubmitting={isSubmitting}
                hasActiveChannels={depositOptions.length > 0}
                onTxHashChange={setDepositTxHash}
                onClose={resetDepositAddress}
              />
            ) : null}
          </form>
        ) : (
          <form onSubmit={handleWithdrawalSubmit} className="grid gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <PanelTitle eyebrowKey="wallet.withdrawEyebrow" titleKey="wallet.withdrawActionTitle" />
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setSuccess("");
                  setWithdrawStep("method");
                }}
                className="rounded-xl border border-[var(--gg-border)] bg-white px-4 py-3 text-sm font-black text-[var(--gg-text)] hover:border-[var(--gg-accent)] hover:text-[var(--gg-accent)]"
              >
                <CountryText id="wallet.withdrawMethodTitle" />
              </button>
            </div>

            <SelectedWithdrawalMethodCard chain={withdrawChain} />

            <WithdrawalRequestSummary
              chain={withdrawChain}
              amount={withdrawAmount}
              currency={currency}
              feePreview={feePreview}
            />

            <AmountInput
              label={
                <>
                  <CountryText id="wallet.withdrawAmount" /> ({currency})
                </>
              }
              value={withdrawAmount}
              onChange={setWithdrawAmount}
              quickValues={["20", "50", "100", "500"]}
            />

            <SubmitButton disabled={isSubmitting}>
              <CountryText id="wallet.withdrawSubmit" />
            </SubmitButton>
          </form>
        )}

        {error ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
            {success}
          </p>
        ) : null}
      </div>

      {isWithdrawalConfirmOpen ? (
        <WithdrawalConfirmModal
          amount={withdrawAmount.trim()}
          fee={feePreview.isValid ? feePreview.feeText : "0"}
          totalDebit={feePreview.isValid ? feePreview.totalDebitText : withdrawAmount.trim()}
          currency={currency}
          chain={withdrawChain}
          destination={withdrawDestination.trim()}
          error={withdrawalConfirmError}
          disabled={isSubmitting}
          onDestinationChange={(value) => {
            setWithdrawDestination(value);
            setWithdrawalConfirmError("");
          }}
          onCancel={() => {
            setIsWithdrawalConfirmOpen(false);
            setWithdrawalConfirmError("");
          }}
          onConfirm={openWithdrawalFinalConfirm}
        />
      ) : null}

      {isWithdrawalFinalConfirmOpen ? (
        <WithdrawalFinalConfirmModal
          amount={withdrawAmount.trim()}
          fee={feePreview.isValid ? feePreview.feeText : "0"}
          totalDebit={feePreview.isValid ? feePreview.totalDebitText : withdrawAmount.trim()}
          currency={currency}
          chain={withdrawChain}
          destination={withdrawDestination.trim()}
          paymentPin={withdrawPaymentPin}
          error={withdrawalConfirmError}
          disabled={isSubmitting}
          onPaymentPinChange={(value) => {
            setWithdrawPaymentPin(value.replace(/\D/g, "").slice(0, 6));
            setWithdrawalConfirmError("");
          }}
          onBack={() => {
            setIsWithdrawalFinalConfirmOpen(false);
            setIsWithdrawalConfirmOpen(true);
          }}
          onCancel={() => setIsWithdrawalFinalConfirmOpen(false)}
          onConfirm={confirmWithdrawalSubmit}
        />
      ) : null}
    </section>
  );
}

function DepositMethodLanding({
  channels,
  hasActiveChannels,
  currency,
  error,
  onSelect,
}: {
  channels: DepositChannelView[];
  hasActiveChannels: boolean;
  currency: string;
  error: string;
  onSelect: (option: DepositChannelView) => void;
}) {
  return (
    <section className="mx-auto grid max-w-[900px] gap-8 py-8">
      <div className="text-center">
        <p className="text-sm font-black uppercase tracking-wide text-[var(--gg-accent)]">
          <CountryText id="wallet.depositTitle" />
        </p>
        <h2 className="mt-2 text-3xl font-black">
          <CountryText id="wallet.depositMethodTitle" />
        </h2>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {channels.map((channel) => (
          <button
            key={channel.id}
            type="button"
            onClick={() => onSelect(channel)}
            disabled={!hasActiveChannels}
            className="group grid min-h-[150px] gap-4 rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-6 text-left shadow-sm shadow-[var(--gg-shadow)] transition hover:-translate-y-0.5 hover:border-[var(--gg-accent)] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
          >
            <span className="flex items-center justify-between gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--gg-accent)] text-base font-black text-[var(--gg-inverse-text)]">
                US
              </span>
              <span className="rounded-full border border-[var(--gg-border)] px-3 py-1 text-xs font-black text-[var(--gg-muted)]">
                {hasActiveChannels ? channel.chain : <CountryText id="wallet.channelSetupNeeded" />}
              </span>
            </span>
            <span>
              <span className="block text-xl font-black text-[var(--gg-text)]">{channel.label}</span>
              <span className="mt-1 block text-sm font-bold text-[var(--gg-muted)]">{channel.networkName}</span>
            </span>
            <span className="text-sm font-black text-[var(--gg-muted)]">
              <CountryText id="wallet.minimumAmount" /> {channel.minimumAmount} {currency}
            </span>
          </button>
        ))}
      </div>

      {!hasActiveChannels ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-900">
          <CountryText id="wallet.depositNoAddressConfigured" />
        </p>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </p>
      ) : null}

      <div className="rounded-2xl bg-[color-mix(in_srgb,var(--gg-accent)_8%,white)] p-5">
        <h3 className="text-lg font-black">
          <CountryText id="wallet.depositGuideTitle" />
        </h3>
        <div className="mt-4 grid gap-3 text-sm font-bold leading-6 text-[var(--gg-text)]">
          <p><CountryText id="wallet.depositInstructionA" /></p>
          <p><CountryText id="wallet.depositInstructionB" /></p>
          <p><CountryText id="wallet.depositInstructionC" /></p>
        </div>
      </div>
    </section>
  );
}

function WithdrawalMethodLanding({
  chains,
  currency,
  error,
  onSelect,
}: {
  chains: typeof withdrawalChains;
  currency: string;
  error: string;
  onSelect: (chainId: (typeof withdrawalChains)[number]["id"]) => void;
}) {
  return (
    <section className="mx-auto grid max-w-[900px] gap-8 py-8">
      <div className="text-center">
        <p className="text-sm font-black uppercase tracking-wide text-[var(--gg-accent)]">
          <CountryText id="wallet.withdrawTitle" />
        </p>
        <h2 className="mt-2 text-3xl font-black">
          <CountryText id="wallet.withdrawMethodTitle" />
        </h2>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {chains.map((chain) => (
          <button
            key={chain.id}
            type="button"
            onClick={() => onSelect(chain.id)}
            className="group grid min-h-[150px] gap-4 rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-6 text-left shadow-sm shadow-[var(--gg-shadow)] transition hover:-translate-y-0.5 hover:border-[var(--gg-accent)] hover:shadow-md"
          >
            <span className="flex items-center justify-between gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--gg-accent)] text-base font-black text-[var(--gg-inverse-text)]">
                US
              </span>
              <span className="rounded-full border border-[var(--gg-border)] px-3 py-1 text-xs font-black text-[var(--gg-muted)]">
                {chain.id}
              </span>
            </span>
            <span>
              <span className="block text-xl font-black text-[var(--gg-text)]">{chain.label}</span>
              <span className="mt-1 block text-sm font-bold text-[var(--gg-muted)]">{chain.note}</span>
            </span>
            <span className="text-sm font-black text-[var(--gg-muted)]">
              <CountryText id="wallet.minimumWithdrawal" /> 20 {currency}
            </span>
          </button>
        ))}
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </p>
      ) : null}

      <div className="rounded-2xl bg-[color-mix(in_srgb,var(--gg-accent)_8%,white)] p-5">
        <h3 className="text-lg font-black">
          <CountryText id="wallet.withdrawGuideTitle" />
        </h3>
        <div className="mt-4 grid gap-3 text-sm font-bold leading-6 text-[var(--gg-text)]">
          <p><CountryText id="wallet.withdrawGuideA" /></p>
          <p><CountryText id="wallet.withdrawGuideB" /></p>
          <p><CountryText id="wallet.withdrawGuideC" /></p>
        </div>
      </div>
    </section>
  );
}

function DepositInfo({
  option,
  currency,
}: {
  option?: DepositOption;
  currency: string;
}) {
  if (!option) {
    return (
      <div className="grid gap-5">
        <h2 className="text-2xl font-black">
          <CountryText id="wallet.depositGuideTitle" />
        </h2>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-900">
          <CountryText id="wallet.depositNoAddressConfigured" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <h2 className="text-2xl font-black">
        <CountryText id="wallet.depositGuideTitle" />
      </h2>
      <div className="grid gap-4 rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] p-5">
        <p className="text-sm font-black text-[var(--gg-accent)]">
          <CountryText id="wallet.selectedDepositMethod" />
        </p>
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-xl font-black text-[var(--gg-accent)] shadow-sm">
            {option.chain === "TRC20" ? "T" : "B"}
          </span>
          <div>
            <p className="text-xl font-black">{option.label}</p>
            <p className="text-sm font-bold text-[var(--gg-muted)]">{option.networkName}</p>
          </div>
        </div>
      </div>
      <InfoGrid
        items={[
          [<CountryText key="product" id="wallet.product" />, option.label],
          [<CountryText key="network" id="wallet.network" />, option.networkName],
          [<CountryText key="minimum" id="wallet.minimumAmount" />, `${option.minimumAmount} ${currency}`],
          [<CountryText key="reflect" id="wallet.reflectMethod" />, <CountryText key="approval" id="wallet.adminApproval" />],
        ]}
      />
      <div className="rounded-xl border border-sky-100 bg-sky-50 p-4 text-sm font-black leading-7 text-sky-950">
        <p><CountryText id="wallet.depositInstructionA" /></p>
        <p><CountryText id="wallet.depositInstructionB" /></p>
        <p><CountryText id="wallet.depositInstructionC" /></p>
      </div>
      <CheckList
        itemKeys={[
          "wallet.checkNetwork",
          "wallet.enterTxid",
          "wallet.depositAfterAdminApproval",
        ]}
      />
    </div>
  );
}

function SelectedWithdrawalMethodCard({
  chain,
}: {
  chain: (typeof withdrawalChains)[number]["id"];
}) {
  const selectedChain = withdrawalChains.find((item) => item.id === chain) ?? withdrawalChains[0];

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--gg-border)] bg-white p-4">
      <span className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--gg-accent)] text-sm font-black text-[var(--gg-inverse-text)]">
          US
        </span>
        <span>
          <span className="block text-base font-black text-[var(--gg-text)]">{selectedChain.label}</span>
          <span className="mt-0.5 block text-sm font-bold text-[var(--gg-muted)]">{selectedChain.note}</span>
        </span>
      </span>
      <span className="rounded-full bg-[var(--gg-card-soft-bg)] px-3 py-1 text-xs font-black text-[var(--gg-muted)]">
        <CountryText id="wallet.selected" />
      </span>
    </div>
  );
}

function DepositChannelButton({
  active,
  disabled = false,
  onClick,
  option,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  option: DepositChannelView;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        active
          ? "grid gap-2 rounded-2xl border-2 border-[var(--gg-accent)] bg-white px-4 py-4 text-left shadow-sm shadow-[var(--gg-shadow)]"
          : disabled
            ? "grid cursor-not-allowed gap-2 rounded-2xl border border-[var(--gg-border)] bg-white/60 px-4 py-4 text-left opacity-75"
            : "grid gap-2 rounded-2xl border border-[var(--gg-border)] bg-white/80 px-4 py-4 text-left hover:border-[var(--gg-accent)] hover:bg-white"
      }
    >
      <span className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--gg-accent)] text-sm font-black text-[var(--gg-inverse-text)]">
            US
          </span>
          <span>
            <span className="block text-base font-black text-[var(--gg-text)]">{option.label}</span>
            <span className="block text-xs font-bold text-[var(--gg-muted)]">{option.networkName}</span>
          </span>
        </span>
        <span className={active ? "text-sm font-black text-[var(--gg-accent)]" : "text-sm font-black text-[var(--gg-muted)]"}>
          {disabled ? <CountryText id="wallet.channelSetupNeeded" /> : option.chain}
        </span>
      </span>
      <span className="text-xs font-bold text-[var(--gg-muted)]">
        <CountryText id="wallet.minimumAmount" /> {option.minimumAmount} USDT
      </span>
    </button>
  );
}

function SelectedDepositMethodCard({
  option,
  currency,
}: {
  option?: DepositOption;
  currency: string;
}) {
  if (!option) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-900">
        <CountryText id="wallet.depositNoAddressConfigured" />
      </p>
    );
  }

  return (
    <div className="grid gap-4 rounded-2xl border border-[var(--gg-border)] bg-white p-4">
      <p className="text-sm font-black text-[var(--gg-muted)]">
        <CountryText id="wallet.selectedDepositMethod" />
      </p>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--gg-accent)] text-sm font-black text-[var(--gg-inverse-text)]">
            US
          </span>
          <span>
            <span className="block text-lg font-black text-[var(--gg-text)]">{option.label}</span>
            <span className="block text-xs font-bold text-[var(--gg-muted)]">{option.networkName}</span>
          </span>
        </div>
        <span className="rounded-full bg-[color-mix(in_srgb,var(--gg-accent)_10%,white)] px-3 py-1 text-xs font-black text-[var(--gg-accent)]">
          {option.chain}
        </span>
      </div>
      <div className="rounded-xl bg-[var(--gg-card-soft-bg)] px-4 py-3 text-sm font-bold text-[var(--gg-muted)]">
        <CountryText id="wallet.minimumAmount" /> {option.minimumAmount} {currency}
      </div>
    </div>
  );
}

function DepositStepProgress({
  isAddressVisible,
  hasTxHash,
}: {
  isAddressVisible: boolean;
  hasTxHash: boolean;
}) {
  const steps = [
    { key: "method", label: <CountryText id="wallet.depositMethodTitle" />, active: true, done: true },
    { key: "address", label: <CountryText id="wallet.showDepositAddress" />, active: isAddressVisible, done: isAddressVisible },
    { key: "txid", label: <CountryText id="wallet.enterTxid" />, active: hasTxHash, done: hasTxHash },
  ];

  return (
    <div className="grid gap-2 rounded-2xl border border-[var(--gg-border)] bg-white p-4">
      <p className="text-sm font-black text-[var(--gg-muted)]">
        <CountryText id="wallet.depositProgressTitle" />
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        {steps.map((step, index) => (
          <div
            key={step.key}
            className={`rounded-xl border px-3 py-3 ${
              step.done
                ? "border-[var(--gg-accent)] bg-[color-mix(in_srgb,var(--gg-accent)_10%,white)]"
                : "border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)]"
            }`}
          >
            <span className="text-xs font-black text-[var(--gg-muted)]">STEP {index + 1}</span>
            <p className={`mt-1 text-sm font-black ${step.active ? "text-[var(--gg-accent)]" : "text-[var(--gg-muted)]"}`}>
              {step.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DepositRequestSummary({
  option,
  amount,
  currency,
}: {
  option?: DepositOption;
  amount: string;
  currency: string;
}) {
  return (
    <div className="grid gap-3 rounded-2xl bg-white p-4">
      <p className="text-sm font-black text-[var(--gg-muted)]">
        <CountryText id="wallet.depositRequestPreviewTitle" />
      </p>
      <SummaryLine label={<CountryText id="wallet.product" />} value={option?.label ?? "-"} />
      <SummaryLine label={<CountryText id="wallet.network" />} value={option?.networkName ?? "-"} />
      <SummaryLine label={<CountryText id="wallet.depositAmount" />} value={`${amount || "0"} ${currency}`} strong />
      <SummaryLine label={<CountryText id="wallet.fee" />} value="0 USDT" />
    </div>
  );
}

function WithdrawalRequestSummary({
  chain,
  amount,
  currency,
  feePreview,
}: {
  chain: string;
  amount: string;
  currency: string;
  feePreview: ReturnType<typeof getWithdrawalFeePreview>;
}) {
  return (
    <div className="grid gap-3 rounded-2xl bg-white p-4">
      <p className="text-sm font-black text-[var(--gg-muted)]">
        <CountryText id="wallet.withdrawRequestPreviewTitle" />
      </p>
      <SummaryLine label={<CountryText id="wallet.chain" />} value={`USDT ${chain}`} />
      <SummaryLine label={<CountryText id="wallet.withdrawAmount" />} value={`${amount || "0"} ${currency}`} strong />
      <SummaryLine label={<CountryText id="wallet.fee" />} value={feePreview.isValid ? `${feePreview.feeText} ${currency}` : "-"} />
      <SummaryLine label={<CountryText id="wallet.totalDebit" />} value={feePreview.isValid ? `${feePreview.totalDebitText} ${currency}` : "-"} />
    </div>
  );
}

function WithdrawalInfo({ currency }: { currency: string }) {
  return (
    <div className="grid gap-5">
      <h2 className="text-2xl font-black">
        <CountryText id="wallet.withdrawPolicyTitle" />
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <PolicyCard label={<CountryText id="wallet.minimumWithdrawal" />} value={`20 ${currency}`} />
        <PolicyCard label={<CountryText id="wallet.dailyLimit" />} value={<CountryText id="wallet.dailyLimitValue" />} />
        <PolicyCard label={<CountryText id="wallet.cooldown" />} value={<CountryText id="wallet.cooldownValue" />} />
        <PolicyCard label={<CountryText id="wallet.chain" />} value="TRC20, BEP20" />
      </div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-7 text-amber-900">
        <p>
          <CountryText id="wallet.smallFeePolicy" />
        </p>
        <p>
          <CountryText id="wallet.largeFeePolicy" />
        </p>
        <p>
          <CountryText id="wallet.erc20NotSupported" />
        </p>
        <p>
          <CountryText id="wallet.disputeBlocked" />
        </p>
      </div>
      <CheckList
        itemKeys={[
          "wallet.recentTradeRequired",
          "wallet.withdrawalQueued",
          "wallet.failedRollback",
        ]}
      />
    </div>
  );
}

function DepositAddressPanel({
  option,
  amount,
  currency,
}: {
  option: DepositOption;
  amount: string;
  currency: string;
}) {
  const [isAddressCopied, setIsAddressCopied] = useState(false);

  async function copyDepositAddress() {
    try {
      await navigator.clipboard.writeText(option.address);
      setIsAddressCopied(true);
      window.setTimeout(() => setIsAddressCopied(false), 1800);
    } catch {
      setIsAddressCopied(false);
    }
  }

  return (
    <div className="grid gap-4 rounded-2xl border border-[color-mix(in_srgb,var(--gg-accent)_45%,transparent)] bg-white p-4 shadow-sm shadow-[var(--gg-shadow)]">
      <div>
        <p className="text-sm font-black text-[var(--gg-accent)]">
          <CountryText id="wallet.depositPaymentTitle" />
        </p>
        <p className="mt-1 text-xs font-bold leading-5 text-[var(--gg-muted)]">
          <CountryText id="wallet.depositAddressVisibleNotice" />
        </p>
      </div>

      <div className="grid gap-3 rounded-2xl bg-[color-mix(in_srgb,var(--gg-accent)_7%,white)] p-4">
        <SummaryLine label={<CountryText id="wallet.product" />} value={option.label} />
        <SummaryLine label={<CountryText id="wallet.network" />} value={option.networkName} />
        <SummaryLine label={<CountryText id="wallet.depositAmount" />} value={`${amount || "0"} ${currency}`} strong />
      </div>

      <div className="grid gap-2 rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-black uppercase tracking-wide text-[var(--gg-muted)]">
            <CountryText id="wallet.depositAddress" />
          </span>
          <button
            type="button"
            onClick={copyDepositAddress}
            className="rounded-full border border-[var(--gg-border)] bg-white px-3 py-1.5 text-xs font-black text-[var(--gg-text)] hover:border-[var(--gg-accent)] hover:text-[var(--gg-accent)]"
          >
            <CountryText id={isAddressCopied ? "wallet.addressCopied" : "wallet.copyAddress"} />
          </button>
        </div>
        <span className="break-all rounded-xl bg-white px-4 py-3 text-sm font-black leading-6 text-[var(--gg-text)] shadow-sm">
          {option.address}
        </span>
        <span className="text-xs font-bold leading-5 text-[var(--gg-muted)]">
          <CountryText id="wallet.depositStepHint" />
        </span>
      </div>
    </div>
  );
}

function PolicyCard({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="rounded-2xl bg-[var(--gg-card-soft-bg)] p-4">
      <p className="text-sm font-black text-[var(--gg-muted)]">{label}</p>
      <p className="mt-2 text-xl font-black text-[var(--gg-text)]">{value}</p>
    </div>
  );
}

function DepositPaymentModal({
  option,
  amount,
  currency,
  txHash,
  isSubmitting,
  hasActiveChannels,
  onTxHashChange,
  onClose,
}: {
  option: DepositOption;
  amount: string;
  currency: string;
  txHash: string;
  isSubmitting: boolean;
  hasActiveChannels: boolean;
  onTxHashChange: (value: string) => void;
  onClose: () => void;
}) {
  const isTxHashReady = txHash.trim().length >= 8;
  const t = useWalletTranslation();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="deposit-payment-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6"
    >
      <div className="max-h-[calc(100vh-48px)] w-full max-w-xl overflow-y-auto rounded-2xl border border-[var(--gg-border)] bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-[var(--gg-accent)]">Deposit</p>
            <h2 id="deposit-payment-title" className="mt-1 text-2xl font-black text-[var(--gg-text)]">
              <CountryText id="wallet.depositPaymentTitle" />
            </h2>
            <p className="mt-2 text-sm font-bold leading-6 text-[var(--gg-muted)]">
              <CountryText id="wallet.depositPaymentBody" />
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 rounded-full border border-[var(--gg-border)] bg-white text-lg font-black text-[var(--gg-muted)] hover:border-[var(--gg-accent)] hover:text-[var(--gg-accent)]"
            aria-label={t("wallet.close")}
          >
            x
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          <DepositAddressPanel option={option} amount={amount} currency={currency} />

          <div className="grid gap-3 rounded-2xl border border-[var(--gg-border)] bg-white p-4">
            <div>
              <p className="text-base font-black text-[var(--gg-accent)]">
                <CountryText id="wallet.submitTxidAfterDepositTitle" />
              </p>
              <p className="mt-1 text-sm font-bold leading-6 text-[var(--gg-muted)]">
                <CountryText id="wallet.submitTxidAfterDepositBody" />
              </p>
            </div>
            <label className="grid gap-2 text-sm font-black text-[var(--gg-text)]">
              TXID
              <LocalizedInput
                value={txHash}
                onChange={(event) => onTxHashChange(event.target.value)}
                placeholderKey="wallet.txidPlaceholder"
                className="h-12 rounded-xl border border-[var(--gg-border)] bg-white px-4 text-sm font-bold text-[var(--gg-text)] outline-none focus:border-[var(--gg-accent)]"
              />
            </label>
            <p className="rounded-xl bg-[var(--gg-card-soft-bg)] px-4 py-3 text-xs font-bold leading-5 text-[var(--gg-muted)]">
              <CountryText id="wallet.txidRequiredBeforeSubmit" />
            </p>
          </div>

          <div className="grid gap-3 rounded-2xl bg-[var(--gg-card-soft-bg)] p-4 text-sm font-bold">
            <SummaryLine label={<CountryText id="wallet.fee" />} value={`0 ${currency}`} />
            <SummaryLine label={<CountryText id="wallet.depositAmount" />} value={`${amount || "0"} ${currency}`} strong />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-12 rounded-xl border border-[var(--gg-border)] bg-white text-sm font-black text-[var(--gg-text)] hover:border-[var(--gg-accent)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CountryText id="wallet.cancel" />
            </button>
            <SubmitButton disabled={isSubmitting || !hasActiveChannels || !isTxHashReady}>
              <CountryText id="wallet.depositSubmit" />
            </SubmitButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function WithdrawalConfirmModal({
  amount,
  fee,
  totalDebit,
  currency,
  chain,
  destination,
  error,
  disabled,
  onDestinationChange,
  onCancel,
  onConfirm,
}: {
  amount: string;
  fee: string;
  totalDebit: string;
  currency: string;
  chain: string;
  destination: string;
  error: string;
  disabled: boolean;
  onDestinationChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const selectedChain = withdrawalChains.find((item) => item.id === chain) ?? withdrawalChains[0];
  const t = useWalletTranslation();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="withdrawal-confirm-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6"
    >
      <div className="max-h-[calc(100vh-48px)] w-full max-w-xl overflow-y-auto rounded-2xl border border-[var(--gg-border)] bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-[var(--gg-accent)]">
              <CountryText id="wallet.withdrawEyebrow" />
            </p>
            <h2 id="withdrawal-confirm-title" className="mt-1 text-2xl font-black text-[var(--gg-text)]">
              <CountryText id="wallet.withdrawPaymentInfoTitle" />
            </h2>
            <p className="mt-2 text-sm font-bold leading-6 text-[var(--gg-muted)]">
              <CountryText id="wallet.withdrawPaymentInfoBody" />
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={disabled}
            className="h-10 w-10 rounded-full border border-[var(--gg-border)] bg-white text-lg font-black text-[var(--gg-muted)] hover:border-[var(--gg-accent)] hover:text-[var(--gg-accent)] disabled:cursor-not-allowed disabled:opacity-60"
            aria-label={t("wallet.close")}
          >
            x
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          <div className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] p-4">
            <p className="text-sm font-black text-[var(--gg-muted)]">
              <CountryText id="wallet.selectedWithdrawalMethod" />
            </p>
            <div className="mt-3 flex items-center justify-between gap-4 rounded-2xl bg-white p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--gg-accent)] text-sm font-black text-[var(--gg-inverse-text)]">
                  US
                </span>
                <div>
                  <p className="text-lg font-black text-[var(--gg-text)]">{selectedChain.label}</p>
                  <p className="text-sm font-bold text-[var(--gg-muted)]">{selectedChain.note}</p>
                </div>
              </div>
              <span className="rounded-full bg-[var(--gg-card-soft-bg)] px-3 py-1 text-xs font-black text-[var(--gg-muted)]">
                <CountryText id="wallet.selected" />
              </span>
            </div>
          </div>

          <div className="grid gap-3 rounded-2xl bg-[var(--gg-card-soft-bg)] p-4 text-sm font-bold">
            <SummaryLine label={<CountryText id="wallet.chain" />} value={selectedChain.label} />
            <SummaryLine label={<CountryText id="wallet.network" />} value={selectedChain.note} />
            <SummaryLine label={<CountryText id="wallet.withdrawAmount" />} value={`${amount || "0"} ${currency}`} />
            <SummaryLine label={<CountryText id="wallet.fee" />} value={`${fee} ${currency}`} />
            <SummaryLine label={<CountryText id="wallet.totalDebit" />} value={`${totalDebit} ${currency}`} strong />
          </div>

          <div className="grid gap-3 rounded-2xl border border-[var(--gg-border)] bg-white p-4">
            <div>
              <p className="text-base font-black text-[var(--gg-accent)]">
                <CountryText id="wallet.destinationAddress" />
              </p>
              <p className="mt-1 text-sm font-bold leading-6 text-[var(--gg-muted)]">
                <CountryText id="wallet.withdrawDestinationBody" />
              </p>
            </div>
            <label className="grid gap-2 text-sm font-black text-[var(--gg-text)]">
              <CountryText id="wallet.destinationAddress" />
              <LocalizedInput
                value={destination}
                onChange={(event) => onDestinationChange(event.target.value)}
                placeholderKey="wallet.destinationPlaceholder"
                className="h-12 rounded-xl border border-[var(--gg-border)] bg-white px-4 text-sm font-bold text-[var(--gg-text)] outline-none focus:border-[var(--gg-accent)]"
              />
            </label>
            {error ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {error}
              </p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-900">
            <CountryText id="wallet.withdrawReviewNotice" />
            <br />
            <CountryText id="wallet.withdrawWrongAddressWarning" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={disabled}
              className="h-12 rounded-xl border border-[var(--gg-border)] bg-white text-sm font-black text-[var(--gg-text)] hover:border-[var(--gg-accent)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CountryText id="wallet.cancel" />
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={disabled}
              className="h-12 rounded-xl bg-[var(--gg-accent)] text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <CountryText id="wallet.finalConfirm" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function WithdrawalFinalConfirmModal({
  amount,
  fee,
  totalDebit,
  currency,
  chain,
  destination,
  paymentPin,
  error,
  disabled,
  onPaymentPinChange,
  onBack,
  onCancel,
  onConfirm,
}: {
  amount: string;
  fee: string;
  totalDebit: string;
  currency: string;
  chain: string;
  destination: string;
  paymentPin: string;
  error: string;
  disabled: boolean;
  onPaymentPinChange: (value: string) => void;
  onBack: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const selectedChain = withdrawalChains.find((item) => item.id === chain) ?? withdrawalChains[0];
  const t = useWalletTranslation();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="withdrawal-final-confirm-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 px-4 py-6"
    >
      <div className="max-h-[calc(100vh-48px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--gg-border)] bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-[var(--gg-accent)]">
              <CountryText id="wallet.finalCheckEyebrow" />
            </p>
            <h2 id="withdrawal-final-confirm-title" className="mt-1 text-2xl font-black text-[var(--gg-text)]">
              <CountryText id="wallet.withdrawFinalTitle" />
            </h2>
            <p className="mt-2 text-sm font-bold leading-6 text-[var(--gg-muted)]">
              <CountryText id="wallet.withdrawFinalBody" />
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={disabled}
            className="h-10 w-10 rounded-full border border-[var(--gg-border)] bg-white text-lg font-black text-[var(--gg-muted)] hover:border-[var(--gg-accent)] hover:text-[var(--gg-accent)] disabled:cursor-not-allowed disabled:opacity-60"
            aria-label={t("wallet.close")}
          >
            x
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          <div className="rounded-2xl border-2 border-[var(--gg-accent)] bg-[color-mix(in_srgb,var(--gg-accent)_8%,white)] p-4">
            <p className="text-sm font-black text-[var(--gg-muted)]">
              <CountryText id="wallet.withdrawNetwork" />
            </p>
            <div className="mt-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--gg-accent)] text-sm font-black text-[var(--gg-inverse-text)]">
                  US
                </span>
                <div>
                  <p className="text-lg font-black text-[var(--gg-text)]">{selectedChain.label}</p>
                  <p className="text-sm font-bold text-[var(--gg-muted)]">{selectedChain.note}</p>
                </div>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[var(--gg-accent)]">
                {selectedChain.id}
              </span>
            </div>
          </div>

          <div className="grid gap-3 rounded-2xl bg-[var(--gg-card-soft-bg)] p-4 text-sm font-bold">
            <SummaryLine label={<CountryText id="wallet.withdrawAmount" />} value={`${amount || "0"} ${currency}`} />
            <SummaryLine label={<CountryText id="wallet.fee" />} value={`${fee} ${currency}`} />
            <SummaryLine label={<CountryText id="wallet.totalDebit" />} value={`${totalDebit} ${currency}`} strong />
            <div className="grid gap-2 rounded-xl bg-white p-4">
              <span className="text-sm font-black text-[var(--gg-muted)]">
                <CountryText id="wallet.destinationAddress" />
              </span>
              <span className="break-all text-base font-black text-[var(--gg-text)]">{destination}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold leading-6 text-red-800">
            <CountryText id="wallet.withdrawAssetRiskWarning" />
            <br />
            {selectedChain.id} <CountryText id="wallet.confirmSelectedChain" />
          </div>

          <label className="grid gap-2 text-sm font-black text-[var(--gg-text)]">
            결제 PIN
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={paymentPin}
              onChange={(event) => onPaymentPinChange(event.target.value)}
              autoComplete="one-time-code"
              placeholder="4~6자리 결제 PIN"
              className="h-12 rounded-xl border border-[var(--gg-border)] bg-white px-4 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
            />
          </label>

          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </p>
          ) : null}

          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={onBack}
              disabled={disabled}
              className="h-12 rounded-xl border border-[var(--gg-border)] bg-white text-sm font-black text-[var(--gg-text)] hover:border-[var(--gg-accent)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CountryText id="wallet.edit" />
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={disabled}
              className="h-12 rounded-xl border border-[var(--gg-border)] bg-white text-sm font-black text-[var(--gg-text)] hover:border-[var(--gg-accent)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CountryText id="wallet.cancel" />
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={disabled}
              className="h-12 rounded-xl bg-[var(--gg-accent)] text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <CountryText id="wallet.finalSubmit" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function OptionButton({
  active,
  onClick,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-xl border-2 border-[var(--gg-accent)] bg-[color-mix(in_srgb,var(--gg-accent)_10%,white)] px-4 py-3 text-left text-sm font-black text-[var(--gg-text)]"
          : "rounded-xl border border-[var(--gg-border)] bg-white/70 px-4 py-3 text-left text-sm font-black text-[var(--gg-muted)] hover:bg-[var(--gg-card-bg)]"
      }
    >
      {title}
      <span className="ml-2 text-xs font-bold text-[var(--gg-muted)]">{subtitle}</span>
    </button>
  );
}

function PanelTitle({ eyebrowKey, titleKey }: { eyebrowKey: TranslationKey; titleKey: TranslationKey }) {
  return (
    <div>
      <p className="text-sm font-black text-[var(--gg-muted)]">
        <CountryText id={eyebrowKey} />
      </p>
      <h2 className="mt-2 text-2xl font-black">
        <CountryText id={titleKey} />
      </h2>
    </div>
  );
}

function AmountInput({
  label,
  value,
  onChange,
  quickValues,
}: {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  quickValues: string[];
}) {
  return (
    <label className="grid gap-2 text-sm font-black">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode="decimal"
        className="h-12 rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-4 font-bold outline-none focus:border-[var(--gg-accent)]"
      />
      <div className="grid grid-cols-4 gap-2">
        {quickValues.map((quickValue) => (
          <button
            key={quickValue}
            type="button"
            onClick={() => onChange(quickValue)}
            className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-2 text-sm font-black text-[var(--gg-muted)] hover:border-[var(--gg-accent)] hover:text-[var(--gg-accent)]"
          >
            {quickValue}
          </button>
        ))}
      </div>
    </label>
  );
}

function SubmitButton({ disabled, children }: { disabled: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="h-14 rounded-xl bg-[var(--gg-accent)] text-base font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)] disabled:cursor-not-allowed disabled:bg-slate-300"
    >
      {disabled ? <CountryText id="wallet.processingButton" /> : children}
    </button>
  );
}

function SummaryLine({
  label,
  value,
  strong = false,
}: {
  label: ReactNode;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm font-bold">
      <span className="text-[var(--gg-muted)]">{label}</span>
      <span className={strong ? "text-xl font-black text-[var(--gg-text)]" : ""}>{value}</span>
    </div>
  );
}

function InfoGrid({ items }: { items: Array<[ReactNode, ReactNode]> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map(([label, value], index) => (
        <div key={index} className="rounded-xl bg-[var(--gg-card-soft-bg)] p-4">
          <p className="text-sm font-black text-[var(--gg-muted)]">{label}</p>
          <p className="mt-2 text-lg font-black">{value}</p>
        </div>
      ))}
    </div>
  );
}

function CheckList({ itemKeys }: { itemKeys: TranslationKey[] }) {
  return (
    <div className="grid gap-3">
      {itemKeys.map((itemKey) => (
        <p key={itemKey} className="flex items-center gap-3 text-sm font-black">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--gg-accent)] text-xs text-[var(--gg-inverse-text)]">
            OK
          </span>
          <CountryText id={itemKey} />
        </p>
      ))}
    </div>
  );
}

function useWalletTranslation() {
  const [countryCode, setCountryCode] = useState<CountryCode>("KR");

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

  return (key: TranslationKey) => translate(key, countryCode);
}

function formatMessage(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (message, [key, value]) => message.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

function getWithdrawalFeePreview(value: string) {
  const trimmed = value.trim();

  if (!isPositiveDecimal(trimmed)) {
    return { isValid: false, amount: 0, feeText: "0", totalDebitText: "0" };
  }

  const amount = Number(trimmed);
  const fee = amount >= withdrawalPolicy.minimumAmount && amount <= 100 ? 1 : amount > 100 ? 0.5 : 0;

  return {
    isValid: true,
    amount,
    feeText: trimNumber(fee),
    totalDebitText: trimNumber(amount + fee),
  };
}

function isPositiveDecimal(value: string) {
  if (!/^\d+(\.\d+)?$/.test(value)) {
    return false;
  }

  return Number(value) > 0;
}

function trimNumber(value: number) {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 6,
    useGrouping: false,
  });
}
