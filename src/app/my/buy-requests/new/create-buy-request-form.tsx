"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
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
  type MoneyUnitNameSource,
} from "@/lib/market/trade-unit";

type ListingCategory = "GAME_MONEY" | "GAME_ITEM" | "GAME_ACCOUNT";
type TFunction = (key: TranslationKey) => string;

const BUY_REQUEST_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const BUY_REQUEST_IMAGE_MAX_COUNT = 8;
const BUY_REQUEST_IMAGE_ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

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
    moneyUnitName?: MoneyUnitNameSource;
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
  const [quantity, setQuantity] = useState("10");
  const [minimumQuantity, setMinimumQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("5");
  const [priceUnitQuantity, setPriceUnitQuantity] = useState("10000");
  const [tradeMode, setTradeMode] = useState<"BULK" | "SPLIT">("BULK");
  const [expiresInDays, setExpiresInDays] = useState("7");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [accountTransferType, setAccountTransferType] = useState("GOOGLE");
  const [accountRank, setAccountRank] = useState("");
  const [accountMemo, setAccountMemo] = useState("");
  const [buyerGameNickname, setBuyerGameNickname] = useState("");
  const [premiumDurationHours, setPremiumDurationHours] = useState("0");
  const [imageAlt, setImageAlt] = useState("");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [createdBuyRequestId, setCreatedBuyRequestId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [countryCode, setCountryCode] = useState(() => getCurrentCountryCode());
  const [flowStep, setFlowStep] = useState(1);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  const isAccountRequest = category === "GAME_ACCOUNT";
  const selectedGame = useMemo(
    () => games.find((game) => game.gameId === gameId) ?? null,
    [gameId, games],
  );
  const availableServers = useMemo(
    () => selectedGame?.servers ?? [],
    [selectedGame?.servers],
  );
  const serverDetailOptions = useMemo(
    () => getServerDetailOptionsForGameCode(selectedGame?.code),
    [selectedGame?.code],
  );
  const selectedServer = useMemo(
    () => availableServers.find((server) => server.serverId === serverId) ?? null,
    [availableServers, serverId],
  );
  const hasSelectableCatalog = games.length > 0 && availableServers.length > 0;
  const imagePreviewUrls = useMemo(
    () => selectedImages.map((file) => URL.createObjectURL(file)),
    [selectedImages],
  );
  const isGameMoneyRequest = category === "GAME_MONEY";
  const quantityInput = isAccountRequest ? "1" : quantity;
  const minimumQuantityInput = isAccountRequest ? "1" : minimumQuantity;
  const requestQuantity = isGameMoneyRequest
    ? multiplyQuantityBySelectedUnit(quantityInput, priceUnitQuantity)
    : quantityInput;
  const requestMinimumQuantity = isGameMoneyRequest
    ? multiplyQuantityBySelectedUnit(minimumQuantityInput, priceUnitQuantity)
    : minimumQuantityInput;
  const selectedPriceUnitLabel = isGameMoneyRequest
    ? getGameMoneyPriceUnitLabel(priceUnitQuantity, selectedGame?.moneyUnitName, countryCode)
    : "";
  const gameMoneyUnitHelperText = t("listingForm.buyGameMoneyUnitHelper");
  const gameMoneyQuantityPlaceholder = selectedPriceUnitLabel
    ? `${t("listingForm.exampleUnitQuantity")} (${selectedPriceUnitLabel})`
    : t("listingForm.exampleUnitQuantity");
  const estimatedReserveAmount = useMemo(() => {
    const nextQuantity = Number(quantityInput);
    const nextUnitPrice = Number(unitPrice);
    if (!Number.isFinite(nextQuantity) || !Number.isFinite(nextUnitPrice)) return 0;
    return Math.max(nextQuantity * nextUnitPrice, 0);
  }, [quantityInput, unitPrice]);
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
  const selectedGameName = selectedGame
    ? getLocalizedGameName(selectedGame.name, selectedGame.localizedNames, countryCode)
    : "GGtem";
  const finalSummaryRows: Array<[string, string]> = [
    [t("listingForm.summaryCategory"), categoryLabel(category, t)],
    [t("listingForm.summaryGameServer"), `${selectedGameName} / ${formatServerLabel(selectedServer?.name ?? "-", serverDetail)}`],
    [t("listingForm.summaryTradeMode"), category === "GAME_MONEY" ? (tradeMode === "BULK" ? t("listingForm.bulkBuy") : t("listingForm.splitBuy")) : categoryLabel(category, t)],
    [t("listingForm.summarySelectedUnit"), selectedPriceUnitLabel || "-"],
    [t("listingForm.summaryInputQuantity"), category === "GAME_MONEY" ? `${quantityInput} x ${selectedPriceUnitLabel}` : quantityInput],
    [t("listingForm.summaryActualStoredQuantity"), requestQuantity || "-"],
    [t("listingForm.summaryMinimumQuantity"), category === "GAME_MONEY" ? (tradeMode === "BULK" ? requestQuantity : requestMinimumQuantity) : requestQuantity],
    [t("listingForm.summaryUnitPrice"), `${unitPrice} ${currency}`],
    [t("listingForm.reserveAmount"), `${totalAmount} ${currency}`],
    [t("listingForm.summaryPremium"), premiumFee > 0 ? `${premiumDurationHours}${t("listingForm.hoursSuffix")} / ${premiumFee} ${currency}` : t("listingForm.premiumDisabled")],
    [t("listingForm.totalDebitExpected"), `${requiredBalance} ${currency}`],
  ];

  useEffect(() => {
    const handleCountryChange = () => setCountryCode(getCurrentCountryCode());
    window.addEventListener(COUNTRY_CHANGE_EVENT, handleCountryChange);
    window.addEventListener("storage", handleCountryChange);

    return () => {
      window.removeEventListener(COUNTRY_CHANGE_EVENT, handleCountryChange);
      window.removeEventListener("storage", handleCountryChange);
    };
  }, []);

  useEffect(() => {
    return () => {
      imagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imagePreviewUrls]);

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    setError("");
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      setSelectedImages([]);
      return;
    }

    if (files.length > BUY_REQUEST_IMAGE_MAX_COUNT) {
      setSelectedImages([]);
      event.target.value = "";
      setError(t("listingForm.imageMaxCountError").replace("{count}", String(BUY_REQUEST_IMAGE_MAX_COUNT)));
      return;
    }

    const invalidTypeFile = files.find((file) => !BUY_REQUEST_IMAGE_ALLOWED_TYPES.includes(file.type));
    if (invalidTypeFile) {
      setSelectedImages([]);
      event.target.value = "";
      setError(`${invalidTypeFile.name}: ${t("listingForm.imageTypeError")}`);
      return;
    }

    const oversizedFile = files.find((file) => file.size > BUY_REQUEST_IMAGE_MAX_BYTES);
    if (oversizedFile) {
      setSelectedImages([]);
      event.target.value = "";
      setError(`${oversizedFile.name}: ${t("listingForm.imageSizeError")}`);
      return;
    }

    setSelectedImages(files);
  }

  function removeSelectedImage(indexToRemove: number) {
    setSelectedImages((currentImages) =>
      currentImages.filter((_, index) => index !== indexToRemove),
    );
  }

  function handleCategoryChange(nextCategory: ListingCategory) {
    setCategory(nextCategory);
    setFlowStep(2);
    setQuantity(nextCategory === "GAME_MONEY" ? "10" : "1");
    setMinimumQuantity(nextCategory === "GAME_MONEY" ? "1" : "1");
    setError("");
    setSuccess("");
    setCreatedBuyRequestId(null);
    setIsReviewOpen(false);

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
    setFlowStep(4);
  }

  function validateForm() {
    if (!wallet) return t("listingForm.walletLoadFailed");
    if (!gameId || games.length === 0) return t("listingForm.noGame");
    if (!serverId) return t("listingForm.selectServer");
    if (!buyerGameNickname.trim()) return t("listingForm.buyerGameNicknameRequired");

    if (category === "GAME_MONEY" && !isPositiveWholeNumber(quantityInput)) {
      return t("listingForm.selectedUnitQuantityInvalid");
    }

    if (!isPositiveNumber(requestQuantity)) {
      return isAccountRequest
        ? t("listingForm.accountBuyQuantityFixed")
        : t("listingForm.buyQuantityInvalid");
    }
    if (
      category === "GAME_MONEY" &&
      tradeMode === "SPLIT" &&
      !isPositiveWholeNumber(minimumQuantityInput)
    ) {
      return t("listingForm.selectedUnitMinimumSellInvalid");
    }
    if (
      category === "GAME_MONEY" &&
      tradeMode === "SPLIT" &&
      isQuantityGreater(requestMinimumQuantity, requestQuantity, true)
    ) {
      return t("listingForm.minimumSellOverBuyQuantity");
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
      return t("listingForm.premiumBuyFeeInsufficient");
    }
    if (!canReserveBalance) return t("listingForm.insufficientBalance");

    return "";
  }

  function openFinalReview() {
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      setSuccess("");
      return;
    }

    setError("");
    setSuccess("");
    setFlowStep(4);
    setIsReviewOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setCreatedBuyRequestId(null);
    setIsReviewOpen(false);

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
              gameName: selectedGameName,
              serverName: selectedServer?.name,
              serverDetail,
              t,
            }),
          description: isAccountRequest ? accountMemo.trim() : description.trim(),
          accountTransferType: isAccountRequest ? accountTransferType : undefined,
          accountRank: isAccountRequest ? accountRank.trim() : undefined,
          buyerGameNickname: buyerGameNickname.trim(),
          quantity: requestQuantity,
          unitPrice,
          pricePerUnit: category === "GAME_MONEY" ? unitPrice : undefined,
          priceUnitQuantity: category === "GAME_MONEY" ? priceUnitQuantity : undefined,
          tradeMode: category === "GAME_MONEY" ? tradeMode : undefined,
          minimumQuantity:
            category === "GAME_MONEY"
              ? tradeMode === "BULK"
                ? requestQuantity
                : requestMinimumQuantity
              : requestQuantity,
          expiresInDays: Number(expiresInDays),
          premiumDurationHours: Number(premiumDurationHours),
        }),
      });
      const result = (await response.json()) as {
        message?: string;
        messageKey?: TranslationKey;
        buyRequestId?: string;
      };

      if (!response.ok) {
        throw new Error(getApiMessage(result, t, "listingForm.buyFailed"));
      }

      if (result.buyRequestId) {
        for (const selectedImage of selectedImages) {
          const formData = new FormData();
          formData.set("buyRequestId", result.buyRequestId);
          formData.set("altText", imageAlt);
          formData.set("image", selectedImage);

          const imageResponse = await fetch("/api/market/buy-request-images", {
            method: "POST",
            body: formData,
          });
          const imageResult = (await imageResponse.json()) as {
            message?: string;
            messageKey?: TranslationKey;
          };

          if (!imageResponse.ok) {
            throw new Error(
              `${selectedImage.name}: ${getApiMessage(imageResult, t, "listingForm.imageUploadFailed")}`,
            );
          }
        }
      }

      setCreatedBuyRequestId(result.buyRequestId ?? null);
      setSuccess(getApiMessage(result, t, "listingForm.buySuccess"));
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
        <StepFlowGuide currentStep={flowStep} />

        <Panel step={1} title={t("listingForm.itemType")} description={t("listingForm.buyItemTypeDescription")}>
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

        {flowStep < 2 ? <LockedStepHint step={2} title={t("listingForm.gameServerLockedTitle")} t={t} /> : null}

        {flowStep >= 2 ? (
        <Panel step={2} title={t("listingForm.gameAndServer")} description={t("listingForm.buyGameServerDescription")}>
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
              <FieldLabel label={t("listingForm.serverDetail")}>
                <select
                  value={serverDetail}
                  onChange={(event) => setServerDetail(event.target.value)}
                  className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
                >
                  <option value="">{t("listingForm.allServerDetails")}</option>
                  {serverDetailOptions.map((detail) => (
                    <option key={detail} value={detail}>
                      {detail}
                    </option>
                  ))}
                </select>
              </FieldLabel>
            ) : null}
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              disabled={!hasSelectableCatalog}
              onClick={() => setFlowStep(3)}
              className="rounded-2xl bg-[var(--gg-accent)] px-5 py-3 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)] disabled:cursor-not-allowed disabled:bg-[#c7d2fe]"
            >
              {t("listingForm.nextTradeConditions")}
            </button>
          </div>
        </Panel>
        ) : null}

        {flowStep < 3 ? <LockedStepHint step={3} title={t("listingForm.buyTradeConditionsLockedTitle")} t={t} /> : null}

        {flowStep >= 3 ? (
        <Panel step={3} title={t("listingForm.buyTradeConditionsLockedTitle")} description={t("listingForm.buyTradeConditionsDescription")}>
          <div className="grid gap-5">
            {isAccountRequest ? (
              <FormBlock title={t("listingForm.accountBuyConditions")}>
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
              </FormBlock>
            ) : (
              <FormBlock title={t("listingForm.buyCondition")}>
                {category === "GAME_MONEY" ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    <FieldLabel label={t("listingForm.buyMode")}>
                      <SegmentedTradeMode value={tradeMode} onChange={setTradeMode} labels={[t("listingForm.bulkBuy"), t("listingForm.splitBuy")]} />
                    </FieldLabel>
                    <FieldLabel label={t("listingForm.priceUnitBasis")}>
                      <select
                        value={priceUnitQuantity}
                        onChange={(event) => setPriceUnitQuantity(event.target.value)}
                        className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
                      >
                        {GAME_MONEY_PRICE_UNIT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {getGameMoneyPriceUnitLabel(option.value, selectedGame?.moneyUnitName, countryCode)}
                          </option>
                        ))}
                      </select>
                    </FieldLabel>
                  </div>
                ) : null}
                <div className="grid gap-3 md:grid-cols-2">
                  <FieldLabel label={t("listingForm.buyQuantity")}>
                    <input
                      value={quantityInput}
                      onChange={(event) => setQuantity(event.target.value)}
                      placeholder={category === "GAME_MONEY" ? gameMoneyQuantityPlaceholder : undefined}
                      inputMode={category === "GAME_MONEY" ? "numeric" : "decimal"}
                      step={category === "GAME_MONEY" ? 1 : undefined}
                      className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
                    />
                  </FieldLabel>
                  <FieldLabel label={category === "GAME_MONEY" ? `${t("listingForm.selectedUnitBuyPrice")} (${currency})` : `${t("listingForm.unitPrice")} (${currency})`}>
                    <input
                      value={unitPrice}
                      onChange={(event) => setUnitPrice(event.target.value)}
                      inputMode="decimal"
                      className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
                    />
                  </FieldLabel>
                </div>
                {category === "GAME_MONEY" ? (
                  <FieldLabel label={t("listingForm.minimumSellQuantity")}>
                    <input
                      value={tradeMode === "BULK" ? quantityInput : minimumQuantityInput}
                      onChange={(event) => setMinimumQuantity(event.target.value)}
                      placeholder={
                        tradeMode === "BULK"
                          ? t("listingForm.bulkBuyMinimumSame")
                          : gameMoneyQuantityPlaceholder
                      }
                      inputMode="numeric"
                      step={1}
                      disabled={tradeMode === "BULK"}
                      className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)] disabled:bg-[var(--gg-control-bg)] disabled:text-[var(--gg-muted)]"
                    />
                  </FieldLabel>
                ) : null}
                {category === "GAME_MONEY" ? (
                  <p className="text-xs font-bold text-[var(--gg-muted)]">
                    {gameMoneyUnitHelperText} {t("listingForm.buyGameMoneySaveHelper")}
                  </p>
                ) : null}
              </FormBlock>
            )}

            <FormBlock title={t("listingForm.recruitPeriod")}>
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
            </FormBlock>

            <details className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5">
              <summary className="cursor-pointer text-xl font-black">{t("listingForm.imageSection")}</summary>
              <div className="mt-4 grid gap-3 md:grid-cols-[160px_1fr]">
                <div className="flex h-40 items-center justify-center overflow-hidden rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)]">
                  {imagePreviewUrls.length > 0 ? (
                    <div className="grid h-full w-full grid-cols-2 gap-1 p-1">
                      {imagePreviewUrls.slice(0, 4).map((url, index) => (
                        <Image
                          key={url}
                          src={url}
                          alt={imageAlt || `${t("listingForm.imageSection")} ${index + 1}`}
                          width={160}
                          height={160}
                          className="h-full w-full rounded-xl object-cover"
                        />
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm font-black text-[#9ca3af]">{t("listingForm.noImage")}</span>
                  )}
                </div>
                <div className="space-y-3">
                  <input
                    type="file"
                    multiple
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleImageChange}
                    className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-2 text-sm font-bold file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--gg-accent)] file:px-3 file:py-2 file:text-sm file:font-black file:text-[var(--gg-inverse-text)]"
                  />
                  {selectedImages.length > 0 ? (
                    <div className="grid gap-2">
                      {selectedImages.map((file, index) => (
                        <div
                          key={`${file.name}-${file.lastModified}-${index}`}
                          className="flex items-center justify-between gap-2 rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] px-3 py-2 text-xs font-black text-[var(--gg-muted)]"
                        >
                          <span className="truncate">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => removeSelectedImage(index)}
                            className="rounded-lg border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-2 py-1 text-[var(--gg-text)]"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <input
                    value={imageAlt}
                    onChange={(event) => setImageAlt(event.target.value)}
                    placeholder={t("listingForm.imageAltPlaceholder")}
                    className="w-full rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
                  />
                </div>
              </div>
            </details>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setFlowStep(4)}
                className="rounded-2xl bg-[var(--gg-accent)] px-5 py-3 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)]"
              >
                {t("listingForm.nextContentPremium")}
              </button>
            </div>
          </div>
        </Panel>
        ) : null}

        {flowStep < 4 ? <LockedStepHint step={4} title={t("listingForm.contentPremiumLockedTitle")} t={t} /> : null}

        {flowStep >= 4 ? (
        <Panel step={4} title={t("listingForm.contentPremiumTitle")} description={t("listingForm.contentPremiumDescription")}>
          <div className="grid gap-5">
            <FormBlock title={t("listingForm.titleContent")}>
              <FieldLabel label={t("listingForm.title")}>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={t("listingForm.autoTitlePlaceholder")}
                  className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
                />
              </FieldLabel>
              <FieldLabel label={t("listingForm.buyerGameNickname")}>
                <input
                  value={buyerGameNickname}
                  onChange={(event) => setBuyerGameNickname(event.target.value)}
                  placeholder={t("listingForm.buyerGameNicknamePlaceholder")}
                  maxLength={80}
                  className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
                />
              </FieldLabel>
              {!isAccountRequest ? (
                <FieldLabel label={t("listingForm.buyCondition")}>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={5}
                    className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
                  />
                </FieldLabel>
              ) : null}
            </FormBlock>

            <FormBlock title={t("listingForm.premiumPromotion")}>
              <div className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-4">
                <p className="text-sm font-black text-[var(--gg-accent)]">{t("listingForm.premiumFixedTop")}</p>
                <p className="mt-1 text-sm font-bold text-[var(--gg-muted)]">
                  {t("listingForm.premiumBuyDescription")}
                </p>
              </div>
              <FieldLabel label={t("listingForm.premiumDuration")}>
                <select
                  value={premiumDurationHours}
                  onChange={(event) => setPremiumDurationHours(event.target.value)}
                  className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
                >
                  <option value="0">{t("listingForm.premiumDisabled")}</option>
                  {["30", "60", "90", "120", "150", "180"].map((hours) => (
                    <option key={hours} value={hours}>
                      {hours}{t("listingForm.hoursSuffix")} / {Number(hours) / 30} USDT
                    </option>
                  ))}
                </select>
              </FieldLabel>
              <div className="grid gap-3 md:grid-cols-3">
                <MiniSummary label={t("listingForm.premiumFee")} value={`${premiumFee} ${currency}`} />
                <MiniSummary label={t("listingForm.reserveAmount")} value={`${totalAmount} ${currency}`} />
                <MiniSummary label={t("listingForm.totalDebitExpected")} value={`${requiredBalance} ${currency}`} />
              </div>
            </FormBlock>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={openFinalReview}
                className="rounded-2xl bg-[var(--gg-accent)] px-5 py-3 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)]"
              >
                {t("listingForm.nextFinalReview")}
              </button>
            </div>
          </div>
        </Panel>
        ) : null}
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
                {t("listingForm.summaryPremium")} {premiumDurationHours}{t("listingForm.hoursSuffix")}: {premiumFee} {wallet?.currency ?? currency}
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
            type="button"
            onClick={openFinalReview}
            disabled={isSubmitting || !canReserveBalance || !hasSelectableCatalog || flowStep < 4}
            className="rounded-2xl bg-[var(--gg-accent)] px-5 py-4 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)] disabled:cursor-not-allowed disabled:bg-[#c7d2fe]"
          >
            {t("listingForm.nextFinalReview")}
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
      <FinalReviewModal
        isOpen={isReviewOpen}
        title={t("listingForm.finalReviewTitle")}
        description={t("listingForm.buyFinalReviewDescription")}
        rows={finalSummaryRows}
        confirmLabel={isSubmitting ? t("listingForm.creating") : t("listingForm.createBuy")}
        cancelLabel={t("common.cancel")}
        isSubmitting={isSubmitting}
        onClose={() => setIsReviewOpen(false)}
      />
    </form>
  );
}

function Panel({
  title,
  children,
  step,
  description,
}: {
  title: string;
  children: ReactNode;
  step?: number;
  description?: string;
}) {
  return (
    <section className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)]">
      <div className="flex flex-wrap items-start gap-3">
        {step ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--gg-accent)] text-sm font-black text-[var(--gg-inverse-text)]">
            {step}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-xl font-black">{title}</h2>
          {description ? <p className="mt-1 text-sm font-bold text-[var(--gg-muted)]">{description}</p> : null}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function LockedStepHint({ step, title, t }: { step: number; title: string; t: TFunction }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] p-5 text-sm font-bold text-[var(--gg-muted)]">
      <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--gg-border)] bg-[var(--gg-card-bg)] text-xs font-black">
        {step}
      </span>
      {formatMessage(t("listingForm.lockedStepHint"), { title })}
    </div>
  );
}

function formatMessage(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (message, [key, value]) => message.split(`{${key}}`).join(value),
    template,
  );
}

function FormBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid gap-3 rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] p-4">
      <h3 className="text-sm font-black text-[var(--gg-accent)]">{title}</h3>
      {children}
    </div>
  );
}

function getApiMessage(
  result: { message?: string; messageKey?: TranslationKey },
  t: TFunction,
  fallbackKey: TranslationKey,
) {
  return result.messageKey ? t(result.messageKey) : result.message ?? t(fallbackKey);
}

function StepFlowGuide({ currentStep }: { currentStep: number }) {
  const { t } = useCountryTranslation();
  const steps = [
    t("listingForm.stepCategory"),
    t("listingForm.stepGameServer"),
    t("listingForm.stepTradeQuantity"),
    t("listingForm.stepContentPremium"),
  ];

  return (
    <div className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-4 shadow-sm shadow-[var(--gg-shadow)]">
      <div className="grid gap-3 sm:grid-cols-4">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber <= currentStep;

          return (
            <div
              key={step}
              className={
                isActive
                  ? "flex items-center gap-2 rounded-2xl border border-[var(--gg-accent)] bg-[color-mix(in_srgb,var(--gg-accent)_10%,white)] p-3"
                  : "flex items-center gap-2 rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] p-3"
              }
            >
              <span
                className={
                  isActive
                    ? "flex h-8 w-8 items-center justify-center rounded-full bg-[var(--gg-accent)] text-xs font-black text-[var(--gg-inverse-text)]"
                    : "flex h-8 w-8 items-center justify-center rounded-full border border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] text-xs font-black text-[var(--gg-muted)]"
                }
              >
                {stepNumber}
              </span>
              <span className={isActive ? "text-sm font-black text-[var(--gg-text)]" : "text-sm font-black text-[var(--gg-muted)]"}>
                {step}
              </span>
            </div>
          );
        })}
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

function FinalSummary({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div className="grid gap-2">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="grid gap-1 rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] px-4 py-3 sm:grid-cols-[120px_1fr]"
        >
          <p className="text-xs font-black text-[var(--gg-muted)]">{label}</p>
          <p className="break-words text-sm font-black text-[var(--gg-text)]">{value}</p>
        </div>
      ))}
    </div>
  );
}

function FinalReviewModal({
  isOpen,
  title,
  description,
  rows,
  confirmLabel,
  cancelLabel,
  isSubmitting,
  onClose,
}: {
  isOpen: boolean;
  title: string;
  description: string;
  rows: Array<[string, string]>;
  confirmLabel: string;
  cancelLabel: string;
  isSubmitting: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6">
      <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-[var(--gg-text)]">{title}</h2>
            <p className="mt-1 text-sm font-bold text-[var(--gg-muted)]">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--gg-border)] px-3 py-1 text-sm font-black"
          >
            ×
          </button>
        </div>
        <div className="mt-5">
          <FinalSummary rows={rows} />
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-5 py-4 text-sm font-black hover:bg-[var(--gg-control-bg)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-2xl bg-[var(--gg-accent)] px-5 py-4 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)] disabled:cursor-not-allowed disabled:bg-[#c7d2fe]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
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

function isPositiveWholeNumber(value: string) {
  const normalized = normalizeWholeNumber(value);
  return normalized !== null && BigInt(normalized) > 0n;
}

function multiplyQuantityBySelectedUnit(value: string, unit: string) {
  const normalizedValue = normalizeWholeNumber(value);
  const normalizedUnit = normalizeWholeNumber(unit);

  if (!normalizedValue || !normalizedUnit) {
    return "";
  }

  return (BigInt(normalizedValue) * BigInt(normalizedUnit)).toString();
}

function isQuantityGreater(left: string, right: string, useWholeNumber: boolean) {
  if (!useWholeNumber) {
    return Number(left) > Number(right);
  }

  const normalizedLeft = normalizeWholeNumber(left);
  const normalizedRight = normalizeWholeNumber(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  return BigInt(normalizedLeft) > BigInt(normalizedRight);
}

function normalizeWholeNumber(value: string) {
  const normalized = value.trim();

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  return normalized.replace(/^0+(?=\d)/, "");
}

function formatServerLabel(serverName: string, serverDetail: string) {
  return serverDetail ? `${serverName} ${serverDetail}` : serverName;
}
