"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import type { TranslationKey } from "@/app/i18n";
import useCountryTranslation from "@/app/use-country-translation";
import { COUNTRY_CHANGE_EVENT, getCurrentCountryCode } from "@/app/country-text";
import { getLocalizedGameName } from "@/app/game-name-text";
import type { LocalizedGameNames } from "@/lib/market/game-localization";
import { accountTransferTypeOptions } from "@/lib/market/account-transfer-types";
import { getServerDetailOptionsForGameCode } from "@/lib/market/server-detail-options";
import {
  GAME_MONEY_PRICE_UNIT_OPTIONS,
  getGameMoneyPriceUnitLabel,
  isGameMoneyQuantityUnit,
} from "@/lib/market/trade-unit";

type ListingCategory = "GAME_MONEY" | "GAME_ITEM" | "GAME_ACCOUNT";
type TFunction = (key: TranslationKey) => string;

export default function CreateBuyRequestForm({
  currency,
  wallet,
  categoryOptions,
  games,
}: {
  currency: string;
  wallet: {
    availableBalance: string;
    buyRequestLocked: string;
    escrowLockedBalance: string;
    currency: string;
  } | null;
  categoryOptions: Array<{ value: ListingCategory; label: string }>;
  games: Array<{
    gameId: string;
    code: string;
    name: string;
    moneyUnitName?: string | null;
    localizedNames: LocalizedGameNames;
    servers: Array<{ serverId: string; name: string }>;
  }>;
}) {
  const router = useRouter();
  const { t } = useCountryTranslation();
  const [gameId, setGameId] = useState(games[0]?.gameId ?? "");
  const [serverId, setServerId] = useState(games[0]?.servers[0]?.serverId ?? "");
  const [serverDetail, setServerDetail] = useState("");
  const [category, setCategory] = useState<ListingCategory>("GAME_MONEY");
  const [quantity, setQuantity] = useState("100000");
  const [minimumQuantity, setMinimumQuantity] = useState("10000");
  const [unitPrice, setUnitPrice] = useState("5");
  const [priceUnitQuantity, setPriceUnitQuantity] = useState("10000");
  const [tradeMode, setTradeMode] = useState<"BULK" | "SPLIT">("BULK");
  const [expiresInDays, setExpiresInDays] = useState("7");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [accountTransferType, setAccountTransferType] = useState("GOOGLE");
  const [accountRank, setAccountRank] = useState("");
  const [accountMemo, setAccountMemo] = useState("");
  const [premiumDurationHours, setPremiumDurationHours] = useState("0");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [createdBuyRequestId, setCreatedBuyRequestId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [countryCode, setCountryCode] = useState(() => getCurrentCountryCode());

  const isAccountRequest = category === "GAME_ACCOUNT";
  const selectedGame = useMemo(
    () => games.find((game) => game.gameId === gameId) ?? null,
    [gameId, games],
  );
  const availableServers = selectedGame?.servers ?? [];
  const serverDetailOptions = useMemo(
    () => getServerDetailOptionsForGameCode(selectedGame?.code),
    [selectedGame?.code],
  );
  const selectedServer = useMemo(
    () => availableServers.find((server) => server.serverId === serverId) ?? null,
    [availableServers, serverId],
  );
  const hasSelectableCatalog = games.length > 0 && availableServers.length > 0;
  const requestQuantity = isAccountRequest ? "1" : quantity;
  const estimatedReserveAmount = useMemo(() => {
    const nextQuantity = Number(requestQuantity);
    const nextUnitPrice = Number(unitPrice);
    const nextPriceUnit = category === "GAME_MONEY" ? Number(priceUnitQuantity) : 1;
    if (!Number.isFinite(nextQuantity) || !Number.isFinite(nextUnitPrice)) return 0;
    if (!Number.isFinite(nextPriceUnit) || nextPriceUnit <= 0) return 0;
    return Math.max((nextQuantity / nextPriceUnit) * nextUnitPrice, 0);
  }, [category, priceUnitQuantity, requestQuantity, unitPrice]);
  const totalAmount = estimatedReserveAmount.toLocaleString("en-US", {
    maximumFractionDigits: 6,
  });
  const premiumHours = Number(premiumDurationHours);
  const premiumUnits = premiumHours > 0 ? premiumHours / 30 : 0;
  const premiumFee = premiumUnits;
  const requiredBalanceAmount = estimatedReserveAmount + premiumFee;
  const requiredBalance = requiredBalanceAmount.toLocaleString("en-US", {
    maximumFractionDigits: 6,
  });
  const availableBalanceAmount = Number(wallet?.availableBalance ?? "0");
  const remainingBalance = Math.max(
    availableBalanceAmount - requiredBalanceAmount,
    0,
  ).toLocaleString("en-US", { maximumFractionDigits: 6 });
  const canReserveBalance =
    Boolean(wallet) &&
    estimatedReserveAmount > 0 &&
    Number.isFinite(availableBalanceAmount) &&
    requiredBalanceAmount <= availableBalanceAmount;

  useEffect(() => {
    if (serverDetail && !serverDetailOptions.includes(serverDetail)) {
      setServerDetail("");
    }
  }, [serverDetail, serverDetailOptions]);

  useEffect(() => {
    const handleCountryChange = () => setCountryCode(getCurrentCountryCode());
    window.addEventListener(COUNTRY_CHANGE_EVENT, handleCountryChange);
    window.addEventListener("storage", handleCountryChange);

    return () => {
      window.removeEventListener(COUNTRY_CHANGE_EVENT, handleCountryChange);
      window.removeEventListener("storage", handleCountryChange);
    };
  }, []);

  function handleCategoryChange(nextCategory: ListingCategory) {
    setCategory(nextCategory);
    setQuantity(nextCategory === "GAME_MONEY" ? "100000" : "1");
    setMinimumQuantity(nextCategory === "GAME_MONEY" ? "10000" : "1");
    setError("");
    setSuccess("");
    setCreatedBuyRequestId(null);

    if (nextCategory === "GAME_ACCOUNT") {
      setAccountTransferType("GOOGLE");
      setUnitPrice("10");
      setTradeMode("BULK");
      return;
    }

    if (nextCategory === "GAME_ITEM") {
      setUnitPrice("1");
      setTradeMode("BULK");
      return;
    }

    setPriceUnitQuantity("10000");
    setTradeMode("BULK");
    setUnitPrice("5");
  }

  function fillSampleBuyRequest() {
    handleCategoryChange("GAME_MONEY");
    setExpiresInDays("7");
    setTitle("");
    setDescription(t("listingForm.defaultMoneyDescription"));
    setAccountTransferType("GOOGLE");
    setAccountRank("");
    setAccountMemo("");
    setError("");
    setSuccess("");
    setCreatedBuyRequestId(null);
  }

  function validateForm() {
    if (!wallet) return t("listingForm.walletLoadFailed");
    if (!gameId || games.length === 0) return t("listingForm.noGame");
    if (!serverId) return t("listingForm.selectServer");

    if (!isPositiveNumber(requestQuantity)) {
      return isAccountRequest
        ? t("listingForm.accountBuyQuantityFixed")
        : t("listingForm.buyQuantityInvalid");
    }
    if (category === "GAME_MONEY" && !isGameMoneyQuantityUnit(requestQuantity)) {
      return "게임머니 구매 수량은 10,000 단위로만 입력할 수 있습니다.";
    }

    if (
      category === "GAME_MONEY" &&
      tradeMode === "SPLIT" &&
      (!isPositiveNumber(minimumQuantity) || !isGameMoneyQuantityUnit(minimumQuantity))
    ) {
      return "분할 구매의 최소 판매 수량은 10,000 단위로 입력해 주세요.";
    }
    if (
      category === "GAME_MONEY" &&
      tradeMode === "SPLIT" &&
      Number(minimumQuantity) > Number(requestQuantity)
    ) {
      return "최소 판매 수량은 총 구매 수량보다 클 수 없습니다.";
    }

    if (!isPositiveNumber(unitPrice)) {
      return isAccountRequest
        ? t("listingForm.accountBudgetRequired")
        : t("listingForm.unitPriceInvalid");
    }

    if (isAccountRequest && !accountTransferType) return t("listingForm.accountTypeRequired");
    if (isAccountRequest && accountMemo.trim().length < 10) {
      return t("listingForm.accountMemoTooShort");
    }
    if (!isAccountRequest && description.trim().length < 6) {
      return t("listingForm.buyDescriptionTooShort");
    }
    if (premiumFee > 0 && premiumFee > availableBalanceAmount) {
      return "프리미엄 노출 비용을 결제할 잔액이 부족합니다.";
    }
    if (!canReserveBalance) return t("listingForm.insufficientBalance");

    return "";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setCreatedBuyRequestId(null);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/market/buy-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId,
          serverId,
          serverDetail: serverDetail || undefined,
          category,
          title:
            title.trim() ||
            defaultBuyRequestTitle({
              category,
              gameName: selectedGame?.name,
              serverName: selectedServer?.name,
              serverDetail,
              t,
            }),
          description: isAccountRequest ? accountMemo.trim() : description.trim(),
          accountTransferType: isAccountRequest ? accountTransferType : undefined,
          accountRank: isAccountRequest ? accountRank.trim() : undefined,
          quantity: requestQuantity,
          unitPrice,
          pricePerUnit: category === "GAME_MONEY" ? unitPrice : undefined,
          priceUnitQuantity: category === "GAME_MONEY" ? priceUnitQuantity : undefined,
          tradeMode: category === "GAME_MONEY" ? tradeMode : undefined,
          minimumQuantity:
            category === "GAME_MONEY"
              ? tradeMode === "BULK"
                ? requestQuantity
                : minimumQuantity
              : requestQuantity,
          expiresInDays: Number(expiresInDays),
          premiumDurationHours: Number(premiumDurationHours),
        }),
      });
      const result = (await response.json()) as {
        message?: string;
        buyRequestId?: string;
      };

      if (!response.ok) throw new Error(result.message ?? t("listingForm.buyFailed"));

      setCreatedBuyRequestId(result.buyRequestId ?? null);
      setSuccess(result.message ?? t("listingForm.buySuccess"));
      router.push("/my/buy-requests");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("listingForm.buyFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <section className="space-y-5">
        <RegistrationFlowGuide
          steps={["카테고리", "게임/서버", "구매 방식", "수량/단위/가격", "내용/프리미엄"]}
        />

        <Panel title={t("listingForm.itemType")}>
          <div className="grid gap-3 md:grid-cols-3">
            {categoryOptions.map((option) => {
              const active = category === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleCategoryChange(option.value)}
                  className={
                    active
                      ? "rounded-2xl border-2 border-[var(--gg-accent)] bg-[color-mix(in_srgb,var(--gg-accent)_14%,white)] p-4 text-left"
                      : "rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-4 text-left hover:border-[var(--gg-accent)] hover:bg-[var(--gg-card-soft-bg)]"
                  }
                >
                  <span className="text-xl font-black">{categoryLabel(option.value, t)}</span>
                  <span className="mt-2 block text-xs font-bold text-[var(--gg-muted)]">
                    {categoryHelp(option.value, t)}
                  </span>
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel title={t("listingForm.gameAndServer")}>
          <div className="grid gap-3 md:grid-cols-2">
            <FieldLabel label={t("listingForm.game")}>
              <select
                value={gameId}
                onChange={(event) => {
                  const nextGameId = event.target.value;
                  const nextGame = games.find((game) => game.gameId === nextGameId);
                  setGameId(nextGameId);
                  setServerId(nextGame?.servers[0]?.serverId ?? "");
                  setServerDetail("");
                }}
                className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
              >
                {games.map((game) => (
                  <option key={game.gameId} value={game.gameId}>
                    {getLocalizedGameName(game.name, game.localizedNames, countryCode)}
                  </option>
                ))}
              </select>
            </FieldLabel>
            <FieldLabel label={t("listingForm.server")}>
              <select
                value={serverId}
                onChange={(event) => setServerId(event.target.value)}
                className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
              >
                {availableServers.map((server) => (
                  <option key={server.serverId} value={server.serverId}>
                    {server.name}
                  </option>
                ))}
              </select>
            </FieldLabel>
            {serverDetailOptions.length > 0 ? (
              <FieldLabel label="서버 상세">
                <select
                  value={serverDetail}
                  onChange={(event) => setServerDetail(event.target.value)}
                  className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
                >
                  <option value="">전체</option>
                  {serverDetailOptions.map((detail) => (
                    <option key={detail} value={detail}>
                      {detail}
                    </option>
                  ))}
                </select>
              </FieldLabel>
            ) : null}
          </div>
        </Panel>

        <Panel title={t("listingForm.priceAndContent")}>
          <div className="grid gap-3">
            <FieldLabel label={t("listingForm.title")}>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t("listingForm.autoTitlePlaceholder")}
                className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
              />
            </FieldLabel>

            {isAccountRequest ? (
              <div className="grid gap-3">
                <FieldLabel label={`${t("listingForm.accountBudget")} (${currency})`}>
                  <input
                    value={unitPrice}
                    onChange={(event) => setUnitPrice(event.target.value)}
                    inputMode="decimal"
                    className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
                  />
                </FieldLabel>
                <FieldLabel label={t("listingForm.accountType")}>
                  <AccountTransferTypeSelector value={accountTransferType} onChange={setAccountTransferType} t={t} />
                </FieldLabel>
                <div className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] p-4">
                  <p className="text-xs font-black text-[var(--gg-accent)]">{t("listingForm.deliveryMethod")}</p>
                  <p className="mt-1 text-sm font-black">{t("listingForm.accountDeliveryNotice")}</p>
                </div>
                <FieldLabel label={t("listingForm.accountSpec")}>
                  <input
                    value={accountRank}
                    onChange={(event) => setAccountRank(event.target.value)}
                    placeholder={t("listingForm.accountSpecPlaceholder")}
                    className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
                  />
                </FieldLabel>
                <FieldLabel label={t("listingForm.buyCondition")}>
                  <textarea
                    value={accountMemo}
                    onChange={(event) => setAccountMemo(event.target.value)}
                    rows={5}
                    className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
                  />
                </FieldLabel>
              </div>
            ) : (
              <div className="grid gap-3">
                {category === "GAME_MONEY" ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <FieldLabel label="구매 방식">
                      <SegmentedTradeMode value={tradeMode} onChange={setTradeMode} labels={["일괄구매", "분할구매"]} />
                    </FieldLabel>
                    <FieldLabel label="가격 기준 단위">
                      <select
                        value={priceUnitQuantity}
                        onChange={(event) => setPriceUnitQuantity(event.target.value)}
                        className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
                      >
                        {GAME_MONEY_PRICE_UNIT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {getGameMoneyPriceUnitLabel(option.value, selectedGame?.moneyUnitName)}
                          </option>
                        ))}
                      </select>
                    </FieldLabel>
                  </div>
                ) : null}
                <div className="grid gap-3 md:grid-cols-2">
                  <FieldLabel label={t("listingForm.buyQuantity")}>
                    <input
                      value={quantity}
                      onChange={(event) => setQuantity(event.target.value)}
                      inputMode={category === "GAME_MONEY" ? "numeric" : "decimal"}
                      step={category === "GAME_MONEY" ? 10000 : undefined}
                      className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
                    />
                  </FieldLabel>
                  <FieldLabel label={category === "GAME_MONEY" ? `선택 단위당 구매가 (${currency})` : `${t("listingForm.unitPrice")} (${currency})`}>
                    <input
                      value={unitPrice}
                      onChange={(event) => setUnitPrice(event.target.value)}
                      inputMode="decimal"
                      className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
                    />
                  </FieldLabel>
                </div>
                {category === "GAME_MONEY" ? (
                  <FieldLabel label="최소 판매 수량">
                    <input
                      value={tradeMode === "BULK" ? requestQuantity : minimumQuantity}
                      onChange={(event) => setMinimumQuantity(event.target.value)}
                      inputMode="numeric"
                      step={10000}
                      disabled={tradeMode === "BULK"}
                      className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)] disabled:bg-[var(--gg-control-bg)] disabled:text-[var(--gg-muted)]"
                    />
                  </FieldLabel>
                ) : null}
                {category === "GAME_MONEY" ? (
                  <p className="text-xs font-bold text-[var(--gg-muted)]">
                    게임머니 구매 수량은 10,000 단위로만 입력할 수 있습니다.
                  </p>
                ) : null}
                <FieldLabel label={t("listingForm.buyCondition")}>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={5}
                    className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
                  />
                </FieldLabel>
              </div>
            )}

            <FieldLabel label={t("listingForm.recruitPeriod")}>
              <select
                value={expiresInDays}
                onChange={(event) => setExpiresInDays(event.target.value)}
                className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
              >
                {["1", "3", "7", "14"].map((day) => (
                  <option key={day} value={day}>
                    {day} {t("listingForm.daysSuffix")}
                  </option>
                ))}
              </select>
            </FieldLabel>
          </div>
        </Panel>

        <Panel title="프리미엄 상위 노출">
          <div className="grid gap-4">
            <div className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] p-4">
              <p className="text-sm font-black text-[var(--gg-accent)]">상단 고정 노출</p>
              <p className="mt-1 text-sm font-bold text-[var(--gg-muted)]">
                선택한 구매글은 프리미엄 영역에 먼저 노출됩니다. 30시간마다 1 USDT가 즉시 차감됩니다.
              </p>
            </div>
            <FieldLabel label="이용 시간">
              <select
                value={premiumDurationHours}
                onChange={(event) => setPremiumDurationHours(event.target.value)}
                className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
              >
                <option value="0">사용 안 함</option>
                {["30", "60", "90", "120", "150", "180"].map((hours) => (
                  <option key={hours} value={hours}>
                    {hours}시간 / {Number(hours) / 30} USDT
                  </option>
                ))}
              </select>
            </FieldLabel>
            <div className="grid gap-3 md:grid-cols-3">
              <MiniSummary label="프리미엄 비용" value={`${premiumFee} ${currency}`} />
              <MiniSummary label="예치 금액" value={`${totalAmount} ${currency}`} />
              <MiniSummary label="총 차감 예정" value={`${requiredBalance} ${currency}`} />
            </div>
          </div>
        </Panel>
      </section>

      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <section className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)]">
          <p className="text-sm font-black text-[var(--gg-muted)]">{t("listingForm.reserveAmount")}</p>
          <p className="mt-2 text-3xl font-black text-[var(--gg-accent)]">
            {totalAmount} {currency}
          </p>
          <div className="mt-4 space-y-2 text-sm font-bold text-[var(--gg-muted)]">
            <p>
              {t("listingForm.availableBalance")} {wallet?.availableBalance ?? "0"} {wallet?.currency ?? currency}
            </p>
            <p>
              {t("listingForm.afterRegisterBalance")} {remainingBalance} {wallet?.currency ?? currency}
            </p>
            {premiumFee > 0 ? (
              <p>
                프리미엄 {premiumDurationHours}시간: {premiumFee} {wallet?.currency ?? currency}
              </p>
            ) : null}
            {isAccountRequest ? (
              <p>
                {t("listingForm.accountType")}: {accountTransferLabel(accountTransferType, t)}
              </p>
            ) : null}
          </div>
        </section>

        {!canReserveBalance ? <Notice tone="error">{t("listingForm.insufficientBalanceNotice")}</Notice> : null}
        {error ? <Notice tone="error">{error}</Notice> : null}
        {success ? <Notice tone="success">{success}</Notice> : null}

        <div className="grid gap-2">
          <button
            type="submit"
            disabled={isSubmitting || !canReserveBalance || !hasSelectableCatalog}
            className="rounded-2xl bg-[var(--gg-accent)] px-5 py-4 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)] disabled:cursor-not-allowed disabled:bg-[#c7d2fe]"
          >
            {isSubmitting ? t("listingForm.creating") : t("listingForm.createBuy")}
          </button>
          <button
            type="button"
            onClick={fillSampleBuyRequest}
            className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-5 py-4 text-sm font-black hover:bg-[var(--gg-control-bg)]"
          >
            {t("listingForm.sampleFill")}
          </button>
          {createdBuyRequestId ? (
            <Link
              href="/my/buy-requests"
              className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-5 py-4 text-center text-sm font-black hover:bg-[var(--gg-control-bg)]"
            >
              {t("listingForm.viewMyBuyRequest")}
            </Link>
          ) : null}
        </div>
      </aside>
    </form>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)]">
      <h2 className="text-xl font-black">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function RegistrationFlowGuide({ steps }: { steps: string[] }) {
  return (
    <div className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-4 shadow-sm shadow-[var(--gg-shadow)]">
      <div className="flex flex-wrap items-center gap-2">
        {steps.map((step, index) => (
          <div key={step} className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--gg-accent)] text-xs font-black text-[var(--gg-inverse-text)]">
              {index + 1}
            </span>
            <span className="text-sm font-black text-[var(--gg-text)]">{step}</span>
            {index < steps.length - 1 ? (
              <span className="hidden text-sm font-black text-[var(--gg-muted)] sm:inline">→</span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function FieldLabel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-black">
      {label}
      {children}
    </label>
  );
}

function MiniSummary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-4">
      <p className="text-xs font-black text-[var(--gg-muted)]">{label}</p>
      <p className="mt-1 text-lg font-black">{value}</p>
    </div>
  );
}

function SegmentedTradeMode({
  value,
  onChange,
  labels,
}: {
  value: "BULK" | "SPLIT";
  onChange: (value: "BULK" | "SPLIT") => void;
  labels: [string, string];
}) {
  const options = [
    { value: "BULK" as const, label: labels[0] },
    { value: "SPLIT" as const, label: labels[1] },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((option) => {
        const active = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={
              active
                ? "rounded-xl border border-[var(--gg-accent)] bg-[color-mix(in_srgb,var(--gg-accent)_14%,white)] px-4 py-3 text-sm font-black text-[var(--gg-text)]"
                : "rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-4 py-3 text-sm font-black text-[var(--gg-muted)] hover:border-[var(--gg-accent)]"
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function AccountTransferTypeSelector({
  value,
  onChange,
  t,
}: {
  value: string;
  onChange: (value: string) => void;
  t: TFunction;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {accountTransferTypeOptions.map((option) => {
        const active = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={
              active
                ? "rounded-xl border border-[var(--gg-accent)] bg-[color-mix(in_srgb,var(--gg-accent)_14%,white)] px-4 py-3 text-left text-sm font-black text-[var(--gg-text)]"
                : "rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-4 py-3 text-left text-sm font-black text-[var(--gg-muted)] hover:border-[var(--gg-accent)]"
            }
          >
            {accountTransferLabel(option.value, t)}
          </button>
        );
      })}
    </div>
  );
}

function Notice({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  return (
    <div
      className={
        tone === "error"
          ? "rounded-2xl border border-[#fecaca] bg-[#fee2e2] p-4 text-sm font-black text-[#b91c1c]"
          : "rounded-2xl border border-[#bbf7d0] bg-[#eaf8ef] p-4 text-sm font-black text-[#15803d]"
      }
    >
      {children}
    </div>
  );
}

function categoryLabel(category: ListingCategory, t: TFunction) {
  const labels: Record<ListingCategory, string> = {
    GAME_MONEY: t("common.gameMoney"),
    GAME_ITEM: t("common.item"),
    GAME_ACCOUNT: t("common.account"),
  };

  return labels[category];
}

function categoryHelp(category: ListingCategory, t: TFunction) {
  const labels: Record<ListingCategory, string> = {
    GAME_MONEY: t("listingForm.categoryMoneyBuyHelp"),
    GAME_ITEM: t("listingForm.categoryItemBuyHelp"),
    GAME_ACCOUNT: t("listingForm.categoryAccountBuyHelp"),
  };

  return labels[category];
}

function accountTransferLabel(value: string, t: TFunction) {
  if (value === "GOOGLE") return t("account.google");
  if (value === "GAME_COMPANY") return t("account.gameCompany");

  return accountTransferTypeOptions.find((option) => option.value === value)?.label ?? t("listingForm.accountType");
}

function defaultBuyRequestTitle({
  category,
  gameName,
  serverName,
  serverDetail,
  t,
}: {
  category: ListingCategory;
  gameName?: string;
  serverName?: string;
  serverDetail?: string;
  t: TFunction;
}) {
  const nextGameName = gameName ?? "GGtem";
  const nextServerName = formatServerLabel(serverName ?? t("listingForm.server"), serverDetail ?? "");
  return `${nextGameName} ${nextServerName} ${categoryLabel(category, t)} ${t("listingForm.createBuy")}`;
}

function isPositiveNumber(value: string) {
  const normalized = value.trim();
  return normalized !== "" && Number.isFinite(Number(normalized)) && Number(normalized) > 0;
}

function formatServerLabel(serverName: string, serverDetail: string) {
  return serverDetail ? `${serverName} ${serverDetail}` : serverName;
}
