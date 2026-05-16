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
} from "@/lib/market/trade-unit";

type ListingCategory = "GAME_MONEY" | "GAME_ITEM" | "GAME_ACCOUNT";
type TFunction = (key: TranslationKey) => string;

const LISTING_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const LISTING_IMAGE_ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

const defaultDescriptionKey: Record<ListingCategory, TranslationKey> = {
  GAME_MONEY: "listingForm.defaultMoneyDescription",
  GAME_ITEM: "listingForm.defaultItemDescription",
  GAME_ACCOUNT: "listingForm.defaultAccountDescription",
};

export default function CreateListingForm({
  currency,
  availableBalance,
  categoryOptions,
  games,
}: {
  currency: string;
  availableBalance: string;
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
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState(t(defaultDescriptionKey.GAME_MONEY));
  const [accountTransferType, setAccountTransferType] = useState("GOOGLE");
  const [unitPrice, setUnitPrice] = useState("5");
  const [priceUnitQuantity, setPriceUnitQuantity] = useState("10000");
  const [tradeMode, setTradeMode] = useState<"BULK" | "SPLIT">("SPLIT");
  const [quantity, setQuantity] = useState("10");
  const [minimumQuantity, setMinimumQuantity] = useState("1");
  const [sellerGameNickname, setSellerGameNickname] = useState("");
  const [premiumDurationHours, setPremiumDurationHours] = useState("0");
  const [imageAlt, setImageAlt] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [createdListingId, setCreatedListingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [countryCode, setCountryCode] = useState(() => getCurrentCountryCode());
  const [flowStep, setFlowStep] = useState(1);

  const isAccountListing = category === "GAME_ACCOUNT";
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
  const imagePreviewUrl = useMemo(() => {
    if (!selectedImage) return null;
    return URL.createObjectURL(selectedImage);
  }, [selectedImage]);
  const isGameMoneyListing = category === "GAME_MONEY";
  const quantityInput = isAccountListing ? "1" : quantity;
  const minimumQuantityInput = isAccountListing ? "1" : minimumQuantity;
  const saleQuantity = isGameMoneyListing
    ? multiplyQuantityBySelectedUnit(quantityInput, priceUnitQuantity)
    : quantityInput;
  const saleMinimumQuantity = isGameMoneyListing
    ? multiplyQuantityBySelectedUnit(minimumQuantityInput, priceUnitQuantity)
    : minimumQuantityInput;
  const selectedPriceUnitLabel = isGameMoneyListing
    ? getGameMoneyPriceUnitLabel(priceUnitQuantity, selectedGame?.moneyUnitName)
    : "";
  const gameMoneyUnitHelperText = t("listingForm.sellGameMoneyUnitHelper");
  const gameMoneyQuantityPlaceholder = selectedPriceUnitLabel
    ? `${t("listingForm.exampleUnitQuantity")} (${selectedPriceUnitLabel})`
    : t("listingForm.exampleUnitQuantity");
  const selectedGameName = selectedGame
    ? getLocalizedGameName(selectedGame.name, selectedGame.localizedNames, countryCode)
    : "GGtem";
  const premiumUnits = Number(premiumDurationHours) > 0 ? Number(premiumDurationHours) / 30 : 0;
  const premiumFee = premiumUnits;
  const availableBalanceAmount = Number(availableBalance || "0");
  const estimatedFullAmount = useMemo(() => {
    const nextQuantity = Number(quantityInput);
    const nextUnitPrice = Number(unitPrice);
    if (!Number.isFinite(nextQuantity) || !Number.isFinite(nextUnitPrice)) return "0";
    return Math.max(nextQuantity * nextUnitPrice, 0).toLocaleString("en-US", {
      maximumFractionDigits: 6,
    });
  }, [quantityInput, unitPrice]);

  useEffect(() => {
    const handleCountryChange = () => setCountryCode(getCurrentCountryCode());
    window.addEventListener(COUNTRY_CHANGE_EVENT, handleCountryChange);
    window.addEventListener("storage", handleCountryChange);

    return () => {
      window.removeEventListener(COUNTRY_CHANGE_EVENT, handleCountryChange);
      window.removeEventListener("storage", handleCountryChange);
    };
  }, []);

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    setError("");
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      setSelectedImage(null);
      return;
    }

    if (!LISTING_IMAGE_ALLOWED_TYPES.includes(file.type)) {
      setSelectedImage(null);
      event.target.value = "";
      setError(t("listingForm.imageTypeError"));
      return;
    }

    if (file.size > LISTING_IMAGE_MAX_BYTES) {
      setSelectedImage(null);
      event.target.value = "";
      setError(t("listingForm.imageSizeError"));
      return;
    }

    setSelectedImage(file);
  }

  function handleCategoryChange(nextCategory: ListingCategory) {
    setCategory(nextCategory);
    setFlowStep(2);
    setCreatedListingId(null);
    setError("");
    setSuccess("");
    setDescription(t(defaultDescriptionKey[nextCategory]));

    if (nextCategory === "GAME_ACCOUNT") {
      setAccountTransferType("GOOGLE");
      setQuantity("1");
      setMinimumQuantity("1");
      setTradeMode("BULK");
      setUnitPrice("10");
      return;
    }

    if (nextCategory === "GAME_ITEM") {
      setQuantity("1");
      setMinimumQuantity("1");
      setTradeMode("SPLIT");
      setUnitPrice("1");
      return;
    }

    setQuantity("10");
    setMinimumQuantity("1");
    setPriceUnitQuantity("10000");
    setTradeMode("SPLIT");
    setUnitPrice("5");
  }

  function fillSampleListing() {
    const gameName = selectedGameName;
    const serverName = formatServerLabel(
      selectedServer?.name ?? t("listingForm.server"),
      serverDetail,
    );

    handleCategoryChange("GAME_MONEY");
    setTitle(`${gameName} ${serverName} ${t("common.gameMoney")} ${t("listingForm.createSell")}`);
    setDescription(`${gameName} ${serverName}\n${t("listingForm.defaultMoneyDescription")}`);
    setImageAlt(`${gameName} ${serverName}`);
    setFlowStep(4);
  }

  function validateForm() {
    const effectiveMinimumQuantity =
      category === "GAME_MONEY" && tradeMode === "BULK"
        ? saleQuantity
        : saleMinimumQuantity;

    if (!gameId || games.length === 0) return t("listingForm.noGame");
    if (!serverId) return t("listingForm.selectServer");
    if (title.trim().length < 4) return t("listingForm.titleTooShort");
    if (description.trim().length < 10) return t("listingForm.descriptionTooShort");
    if (!sellerGameNickname.trim()) return t("listingForm.sellerGameNicknameRequired");
    if (!isPositiveNumber(unitPrice)) return t("listingForm.unitPriceInvalid");

    if (category === "GAME_MONEY" && !isPositiveWholeNumber(quantityInput)) {
      return t("listingForm.selectedUnitQuantityInvalid");
    }

    if (!isPositiveNumber(saleQuantity)) {
      return isAccountListing
        ? t("listingForm.accountSellQuantityFixed")
        : t("listingForm.sellQuantityInvalid");
    }

    if (category === "GAME_MONEY" && tradeMode === "SPLIT" && !isPositiveWholeNumber(minimumQuantityInput)) {
      return t("listingForm.selectedUnitMinimumInvalid");
    }

    if (!isPositiveNumber(effectiveMinimumQuantity)) return t("listingForm.minimumQuantityInvalid");
    if (isQuantityGreater(effectiveMinimumQuantity, saleQuantity, category === "GAME_MONEY")) {
      return t("listingForm.minimumOverQuantity");
    }
    if (isAccountListing && !accountTransferType) return t("listingForm.accountTypeRequired");
    if (premiumFee > 0 && availableBalanceAmount < premiumFee) {
      return t("listingForm.premiumFeeInsufficient");
    }

    return "";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setCreatedListingId(null);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/market/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId,
          serverId,
          serverDetail: serverDetail || undefined,
          category,
          accountTransferType: isAccountListing ? accountTransferType : undefined,
          sellerGameNickname: sellerGameNickname.trim(),
          title: title.trim(),
          description: description.trim(),
          unitPrice,
          pricePerUnit: category === "GAME_MONEY" ? unitPrice : undefined,
          priceUnitQuantity: category === "GAME_MONEY" ? priceUnitQuantity : undefined,
          tradeMode: category === "GAME_MONEY" ? tradeMode : undefined,
          quantity: saleQuantity,
          minimumQuantity: tradeMode === "BULK" ? saleQuantity : saleMinimumQuantity,
          premiumDurationHours: Number(premiumDurationHours),
        }),
      });
      const result = (await response.json()) as {
        message?: string;
        listingId?: string;
      };

      if (!response.ok) throw new Error(result.message ?? t("listingForm.sellFailed"));

      if (result.listingId) {
        setCreatedListingId(result.listingId);

        if (selectedImage) {
          const formData = new FormData();
          formData.set("listingId", result.listingId);
          formData.set("altText", imageAlt);
          formData.set("image", selectedImage);

          const imageResponse = await fetch("/api/market/listing-images", {
            method: "POST",
            body: formData,
          });
          const imageResult = (await imageResponse.json()) as { message?: string };

          if (!imageResponse.ok) {
            throw new Error(imageResult.message ?? t("listingForm.imageUploadFailed"));
          }
        }

        setSuccess(result.message ?? t("listingForm.sellSuccess"));
        router.push(`/listings/${result.listingId}`);
        router.refresh();
        return;
      }

      setSuccess(result.message ?? t("listingForm.sellSuccess"));
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("listingForm.sellFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <section className="space-y-5">
        <StepFlowGuide currentStep={flowStep} />

        <Panel step={1} title={t("listingForm.itemType")} description={t("listingForm.sellItemTypeDescription")}>
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
        <Panel step={2} title={t("listingForm.gameAndServer")} description={t("listingForm.sellGameServerDescription")}>
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

        {flowStep < 3 ? <LockedStepHint step={3} title={t("listingForm.sellTradeConditionsLockedTitle")} t={t} /> : null}

        {flowStep >= 3 ? (
        <Panel step={3} title={t("listingForm.sellTradeConditionsLockedTitle")} description={t("listingForm.sellTradeConditionsDescription")}>
          <div className="grid gap-5">
            {isAccountListing ? (
              <FormBlock title={t("listingForm.accountInfo")}>
                <FieldLabel label={t("listingForm.accountType")}>
                  <AccountTransferTypeSelector value={accountTransferType} onChange={setAccountTransferType} t={t} />
                </FieldLabel>
              </FormBlock>
            ) : null}

            {isAccountListing ? (
              <div className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] p-4">
                <p className="text-xs font-black text-[var(--gg-accent)]">{t("listingForm.deliveryMethod")}</p>
                <p className="mt-1 text-sm font-black">{t("listingForm.accountDeliveryNotice")}</p>
              </div>
            ) : null}

            <FormBlock title={t("listingForm.sellConditions")}>
              <div className="grid gap-3 md:grid-cols-3">
                {category === "GAME_MONEY" ? (
                  <FieldLabel label={t("listingForm.sellMode")}>
                    <SegmentedTradeMode value={tradeMode} onChange={setTradeMode} labels={[t("listingForm.bulkSell"), t("listingForm.splitSell")]} />
                  </FieldLabel>
                ) : null}
                {category === "GAME_MONEY" ? (
                  <FieldLabel label={t("listingForm.priceUnitBasis")}>
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
                ) : null}
                <FieldLabel label={category === "GAME_MONEY" ? `${t("listingForm.selectedUnitSellPrice")} (${currency})` : `${t("listingForm.unitPrice")} (${currency})`}>
                  <input
                    value={unitPrice}
                    onChange={(event) => setUnitPrice(event.target.value)}
                    inputMode="decimal"
                    className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
                  />
                </FieldLabel>
                <FieldLabel label={isAccountListing ? t("common.account") : t("listingForm.sellQuantity")}>
                  <input
                    value={quantityInput}
                    onChange={(event) => setQuantity(event.target.value)}
                    placeholder={category === "GAME_MONEY" ? gameMoneyQuantityPlaceholder : undefined}
                    disabled={isAccountListing}
                    inputMode={category === "GAME_MONEY" ? "numeric" : "decimal"}
                    step={category === "GAME_MONEY" ? 1 : undefined}
                    className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)] disabled:bg-[var(--gg-control-bg)]"
                  />
                </FieldLabel>
                <FieldLabel label={t("listingForm.minimumQuantity")}>
                  <input
                    value={category === "GAME_MONEY" && tradeMode === "BULK" ? quantityInput : minimumQuantityInput}
                    onChange={(event) => setMinimumQuantity(event.target.value)}
                    placeholder={
                      category === "GAME_MONEY"
                        ? tradeMode === "BULK"
                          ? t("listingForm.bulkSellMinimumSame")
                          : gameMoneyQuantityPlaceholder
                        : undefined
                    }
                    disabled={isAccountListing || (category === "GAME_MONEY" && tradeMode === "BULK")}
                    inputMode={category === "GAME_MONEY" ? "numeric" : "decimal"}
                    step={category === "GAME_MONEY" ? 1 : undefined}
                    className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)] disabled:bg-[var(--gg-control-bg)]"
                  />
                </FieldLabel>
              </div>
            </FormBlock>
            {category === "GAME_MONEY" ? (
              <p className="text-xs font-bold text-[var(--gg-muted)]">
                {gameMoneyUnitHelperText} {t("listingForm.sellGameMoneySaveHelper")}
              </p>
            ) : null}
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
                  placeholder={t("listingForm.titlePlaceholder")}
                  className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
                />
              </FieldLabel>
              <FieldLabel label={t("listingForm.sellerGameNickname")}>
                <input
                  value={sellerGameNickname}
                  onChange={(event) => setSellerGameNickname(event.target.value)}
                  placeholder={t("listingForm.sellerGameNicknamePlaceholder")}
                  maxLength={80}
                  className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
                />
              </FieldLabel>
              <FieldLabel label={t("listingForm.tradeContent")}>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={5}
                  className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
                />
              </FieldLabel>
            </FormBlock>

            <FormBlock title={t("listingForm.premiumPromotion")}>
              <div className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-4">
                <p className="text-sm font-black text-[var(--gg-accent)]">{t("listingForm.premiumThirtyHourFee")}</p>
                <p className="mt-1 text-sm font-bold text-[var(--gg-muted)]">
                  {t("listingForm.premiumSellDescription")}
                </p>
              </div>
              <FieldLabel label={t("listingForm.premiumSetting")}>
                <select
                  value={premiumDurationHours}
                  onChange={(event) => setPremiumDurationHours(event.target.value)}
                  className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
                >
                  <option value="0">{t("listingForm.premiumDisabled")}</option>
                  {[30, 60, 90, 120, 150, 180].map((hours) => (
                    <option key={hours} value={hours}>
                      {hours}{t("listingForm.hoursSuffix")} / {hours / 30} USDT
                    </option>
                  ))}
                </select>
              </FieldLabel>
              <div className="grid gap-2 rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-4 text-sm font-bold text-[var(--gg-muted)]">
                <p>{t("listingForm.premiumTotalFee")}: <strong className="text-[var(--gg-text)]">{premiumFee} {currency}</strong></p>
                <p>{t("listingForm.walletBalance")}: {availableBalance || "0"} {currency}</p>
              </div>
            </FormBlock>

            <details className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5">
              <summary className="cursor-pointer text-xl font-black">{t("listingForm.imageSection")}</summary>
              <div className="mt-4 grid gap-3 md:grid-cols-[160px_1fr]">
                <div className="flex h-40 items-center justify-center overflow-hidden rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)]">
                  {imagePreviewUrl ? (
                    <Image
                      src={imagePreviewUrl}
                      alt={imageAlt || t("listingForm.imageSection")}
                      width={320}
                      height={320}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-black text-[#9ca3af]">{t("listingForm.noImage")}</span>
                  )}
                </div>
                <div className="space-y-3">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleImageChange}
                    className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-2 text-sm font-bold file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--gg-accent)] file:px-3 file:py-2 file:text-sm file:font-black file:text-[var(--gg-inverse-text)]"
                  />
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
                onClick={() => setFlowStep(5)}
                className="rounded-2xl bg-[var(--gg-accent)] px-5 py-3 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)]"
              >
                {t("listingForm.nextFinalReview")}
              </button>
            </div>
          </div>
        </Panel>
        ) : null}

        {flowStep < 5 ? <LockedStepHint step={5} title={t("listingForm.finalReviewLockedTitle")} t={t} /> : null}

        {flowStep >= 5 ? (
          <Panel step={5} title={t("listingForm.finalReviewTitle")} description={t("listingForm.sellFinalReviewDescription")}>
            <FinalSummary
              rows={[
                [t("listingForm.summaryCategory"), categoryLabel(category, t)],
                [t("listingForm.summaryGameServer"), `${selectedGameName} / ${formatServerLabel(selectedServer?.name ?? "-", serverDetail)}`],
                [t("listingForm.summaryTradeMode"), category === "GAME_MONEY" ? (tradeMode === "BULK" ? t("listingForm.bulkSell") : t("listingForm.splitSell")) : categoryLabel(category, t)],
                [t("listingForm.summarySelectedUnit"), selectedPriceUnitLabel || "-"],
                [t("listingForm.summaryInputQuantity"), category === "GAME_MONEY" ? `${quantityInput} x ${selectedPriceUnitLabel}` : quantityInput],
                [t("listingForm.summaryActualStoredQuantity"), saleQuantity || "-"],
                [t("listingForm.summaryMinimumQuantity"), category === "GAME_MONEY" ? (tradeMode === "BULK" ? saleQuantity : saleMinimumQuantity) : minimumQuantityInput],
                [t("listingForm.summaryUnitPrice"), `${unitPrice} ${currency}`],
                [t("listingForm.summaryPremium"), premiumFee > 0 ? `${premiumDurationHours}${t("listingForm.hoursSuffix")} / ${premiumFee} ${currency}` : t("listingForm.premiumDisabled")],
              ]}
            />
          </Panel>
        ) : null}
      </section>

      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <section className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)]">
          <p className="text-sm font-black text-[var(--gg-muted)]">{t("listingForm.totalSellAmount")}</p>
          <p className="mt-2 text-3xl font-black text-[var(--gg-accent)]">
            {estimatedFullAmount} {currency}
          </p>
          <div className="mt-4 space-y-2 text-sm font-bold text-[var(--gg-muted)]">
            <p>{selectedGameName}</p>
            <p>{selectedServer?.name ?? t("listingForm.server")}</p>
            <p>{categoryLabel(category, t)}</p>
            {isAccountListing ? (
              <p>
                {t("listingForm.deliveryMethod")}: {accountTransferLabel(accountTransferType, t)}
              </p>
            ) : null}
            <p>
              {t("listingForm.summaryPremium")}: {premiumFee > 0 ? `${premiumDurationHours}${t("listingForm.hoursSuffix")} / ${premiumFee} ${currency}` : t("listingForm.premiumDisabled")}
            </p>
          </div>
        </section>

        {error ? <Notice tone="error">{error}</Notice> : null}
        {success ? <Notice tone="success">{success}</Notice> : null}

        <div className="grid gap-2">
          <button
            type="submit"
            disabled={isSubmitting || !hasSelectableCatalog || flowStep < 5}
            className="rounded-2xl bg-[var(--gg-accent)] px-5 py-4 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)] disabled:cursor-not-allowed disabled:bg-[#c7d2fe]"
          >
            {isSubmitting ? t("listingForm.creating") : t("listingForm.createSell")}
          </button>
          <button
            type="button"
            onClick={fillSampleListing}
            className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-5 py-4 text-sm font-black hover:bg-[var(--gg-control-bg)]"
          >
            {t("listingForm.sampleFill")}
          </button>
          {createdListingId ? (
            <Link
              href={`/listings/${createdListingId}`}
              className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-5 py-4 text-center text-sm font-black hover:bg-[var(--gg-control-bg)]"
            >
              {t("listingForm.viewCreatedListing")}
            </Link>
          ) : null}
        </div>
      </aside>
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

function StepFlowGuide({ currentStep }: { currentStep: number }) {
  const { t } = useCountryTranslation();
  const steps = [
    t("listingForm.stepCategory"),
    t("listingForm.stepGameServer"),
    t("listingForm.stepTradeQuantity"),
    t("listingForm.stepContentPremium"),
    t("listingForm.stepFinalReview"),
  ];

  return (
    <div className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-4 shadow-sm shadow-[var(--gg-shadow)]">
      <div className="grid gap-3 sm:grid-cols-5">
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

function SegmentedTradeMode({
  value,
  onChange,
  labels,
}: {
  value: "BULK" | "SPLIT";
  onChange: (value: "BULK" | "SPLIT") => void;
  labels: [string, string];
}) {
  return (
    <div className="grid grid-cols-2 rounded-xl border border-[var(--gg-border)] bg-[var(--gg-control-bg)] p-1">
      {(["BULK", "SPLIT"] as const).map((mode, index) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          className={
            value === mode
              ? "rounded-lg bg-[var(--gg-accent)] px-3 py-2 text-xs font-black text-[var(--gg-inverse-text)]"
              : "rounded-lg px-3 py-2 text-xs font-black text-[var(--gg-muted)]"
          }
        >
          {labels[index]}
        </button>
      ))}
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
                ? "rounded-xl border border-[var(--gg-accent)] bg-[color-mix(in_srgb,var(--gg-accent)_14%,transparent)] px-4 py-3 text-left text-sm font-black text-[var(--gg-accent)]"
                : "rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-4 py-3 text-left text-sm font-black hover:border-[var(--gg-accent)]"
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
    GAME_MONEY: t("listingForm.categoryMoneyHelp"),
    GAME_ITEM: t("listingForm.categoryItemHelp"),
    GAME_ACCOUNT: t("listingForm.categoryAccountHelp"),
  };

  return labels[category];
}

function accountTransferLabel(value: string, t: TFunction) {
  if (value === "GOOGLE") return t("account.google");
  if (value === "GAME_COMPANY") return t("account.gameCompany");

  return accountTransferTypeOptions.find((option) => option.value === value)?.label ?? t("listingForm.accountType");
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
