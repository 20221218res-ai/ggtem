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
    name: string;
    localizedNames: LocalizedGameNames;
    servers: Array<{ serverId: string; name: string }>;
  }>;
}) {
  const router = useRouter();
  const { t } = useCountryTranslation();
  const [gameId, setGameId] = useState(games[0]?.gameId ?? "");
  const [serverId, setServerId] = useState(games[0]?.servers[0]?.serverId ?? "");
  const [category, setCategory] = useState<ListingCategory>("GAME_MONEY");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState(t(defaultDescriptionKey.GAME_MONEY));
  const [accountTransferType, setAccountTransferType] = useState("GOOGLE");
  const [unitPrice, setUnitPrice] = useState("0.0005");
  const [quantity, setQuantity] = useState("100000");
  const [minimumQuantity, setMinimumQuantity] = useState("1000");
  const [premiumDurationHours, setPremiumDurationHours] = useState("0");
  const [imageAlt, setImageAlt] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [createdListingId, setCreatedListingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [countryCode, setCountryCode] = useState(() => getCurrentCountryCode());

  const isAccountListing = category === "GAME_ACCOUNT";
  const selectedGame = useMemo(
    () => games.find((game) => game.gameId === gameId) ?? null,
    [gameId, games],
  );
  const availableServers = selectedGame?.servers ?? [];
  const selectedServer = useMemo(
    () => availableServers.find((server) => server.serverId === serverId) ?? null,
    [availableServers, serverId],
  );
  const hasSelectableCatalog = games.length > 0 && availableServers.length > 0;
  const imagePreviewUrl = useMemo(() => {
    if (!selectedImage) return null;
    return URL.createObjectURL(selectedImage);
  }, [selectedImage]);
  const saleQuantity = isAccountListing ? "1" : quantity;
  const saleMinimumQuantity = isAccountListing ? "1" : minimumQuantity;
  const selectedGameName = selectedGame
    ? getLocalizedGameName(selectedGame.name, selectedGame.localizedNames, countryCode)
    : "GGtem";
  const premiumUnits = Number(premiumDurationHours) > 0 ? Number(premiumDurationHours) / 30 : 0;
  const premiumFee = premiumUnits;
  const availableBalanceAmount = Number(availableBalance || "0");
  const estimatedFullAmount = useMemo(() => {
    const nextQuantity = Number(saleQuantity);
    const nextUnitPrice = Number(unitPrice);
    if (!Number.isFinite(nextQuantity) || !Number.isFinite(nextUnitPrice)) return "0";
    return Math.max(nextQuantity * nextUnitPrice, 0).toLocaleString("en-US", {
      maximumFractionDigits: 6,
    });
  }, [saleQuantity, unitPrice]);

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
    setCreatedListingId(null);
    setError("");
    setSuccess("");
    setDescription(t(defaultDescriptionKey[nextCategory]));

    if (nextCategory === "GAME_ACCOUNT") {
      setAccountTransferType("GOOGLE");
      setQuantity("1");
      setMinimumQuantity("1");
      setUnitPrice("10");
      return;
    }

    if (nextCategory === "GAME_ITEM") {
      setQuantity("1");
      setMinimumQuantity("1");
      setUnitPrice("1");
      return;
    }

    setQuantity("100000");
    setMinimumQuantity("1000");
    setUnitPrice("0.0005");
  }

  function fillSampleListing() {
    const gameName = selectedGameName;
    const serverName = selectedServer?.name ?? t("listingForm.server");

    handleCategoryChange("GAME_MONEY");
    setTitle(`${gameName} ${serverName} ${t("common.gameMoney")} ${t("listingForm.createSell")}`);
    setDescription(`${gameName} ${serverName}\n${t("listingForm.defaultMoneyDescription")}`);
    setImageAlt(`${gameName} ${serverName}`);
  }

  function validateForm() {
    if (!gameId || games.length === 0) return t("listingForm.noGame");
    if (!serverId) return t("listingForm.selectServer");
    if (title.trim().length < 4) return t("listingForm.titleTooShort");
    if (description.trim().length < 10) return t("listingForm.descriptionTooShort");
    if (!isPositiveNumber(unitPrice)) return t("listingForm.unitPriceInvalid");

    if (!isPositiveNumber(saleQuantity)) {
      return isAccountListing
        ? t("listingForm.accountSellQuantityFixed")
        : t("listingForm.sellQuantityInvalid");
    }

    if (!isPositiveNumber(saleMinimumQuantity)) return t("listingForm.minimumQuantityInvalid");
    if (Number(saleMinimumQuantity) > Number(saleQuantity)) {
      return t("listingForm.minimumOverQuantity");
    }
    if (isAccountListing && !accountTransferType) return t("listingForm.accountTypeRequired");
    if (premiumFee > 0 && availableBalanceAmount < premiumFee) {
      return "프리미엄 이용료를 결제할 지갑 잔액이 부족합니다.";
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
          category,
          accountTransferType: isAccountListing ? accountTransferType : undefined,
          title: title.trim(),
          description: description.trim(),
          unitPrice,
          quantity: saleQuantity,
          minimumQuantity: saleMinimumQuantity,
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
          </div>
        </Panel>

        <Panel title={t("listingForm.priceAndContent")}>
          <div className="grid gap-3">
            {isAccountListing ? (
              <FieldLabel label={t("listingForm.accountType")}>
                <AccountTransferTypeSelector value={accountTransferType} onChange={setAccountTransferType} t={t} />
              </FieldLabel>
            ) : null}

            {isAccountListing ? (
              <div className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] p-4">
                <p className="text-xs font-black text-[var(--gg-accent)]">{t("listingForm.deliveryMethod")}</p>
                <p className="mt-1 text-sm font-black">{t("listingForm.accountDeliveryNotice")}</p>
              </div>
            ) : null}

            <FieldLabel label={t("listingForm.title")}>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t("listingForm.titlePlaceholder")}
                className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
              />
            </FieldLabel>
            <div className="grid gap-3 md:grid-cols-3">
              <FieldLabel label={`${t("listingForm.unitPrice")} (${currency})`}>
                <input
                  value={unitPrice}
                  onChange={(event) => setUnitPrice(event.target.value)}
                  inputMode="decimal"
                  className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
                />
              </FieldLabel>
              <FieldLabel label={isAccountListing ? t("common.account") : t("listingForm.sellQuantity")}>
                <input
                  value={saleQuantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  disabled={isAccountListing}
                  inputMode="decimal"
                  className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)] disabled:bg-[var(--gg-control-bg)]"
                />
              </FieldLabel>
              <FieldLabel label={t("listingForm.minimumQuantity")}>
                <input
                  value={saleMinimumQuantity}
                  onChange={(event) => setMinimumQuantity(event.target.value)}
                  disabled={isAccountListing}
                  inputMode="decimal"
                  className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)] disabled:bg-[var(--gg-control-bg)]"
                />
              </FieldLabel>
            </div>
            <FieldLabel label={t("listingForm.tradeContent")}>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={5}
                className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
              />
            </FieldLabel>
          </div>
        </Panel>

        <Panel title="프리미엄 상위 노출">
          <div className="grid gap-4">
            <div className="rounded-2xl border border-pink-200 bg-pink-50 p-4">
              <p className="text-sm font-black text-pink-700">30시간 1 USDT</p>
              <p className="mt-1 text-sm font-bold text-slate-700">
                프리미엄 판매글은 일반글보다 위에 노출되며, 판매 완료 또는 만료 시 자동 해제됩니다.
              </p>
            </div>
            <FieldLabel label="이용 설정">
              <select
                value={premiumDurationHours}
                onChange={(event) => setPremiumDurationHours(event.target.value)}
                className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] px-3 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
              >
                <option value="0">선택 안 함</option>
                {[30, 60, 90, 120, 150, 180].map((hours) => (
                  <option key={hours} value={hours}>
                    {hours}시간 / {hours / 30} USDT
                  </option>
                ))}
              </select>
            </FieldLabel>
            <div className="grid gap-2 rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] p-4 text-sm font-bold text-[var(--gg-muted)]">
              <p>총 결제 금액: <strong className="text-[var(--gg-text)]">{premiumFee} {currency}</strong></p>
              <p>보유 잔액: {availableBalance || "0"} {currency}</p>
            </div>
          </div>
        </Panel>

        <details className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)]">
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
      </section>

      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <section className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)]">
          <p className="text-sm font-black text-[var(--gg-muted)]">{t("listingForm.totalSellAmount")}</p>
          <p className="mt-2 text-3xl font-black text-[var(--gg-accent)]">
            {estimatedFullAmount} {currency}
          </p>
          <div className="mt-4 space-y-2 text-sm font-bold text-[var(--gg-muted)]">
            <p>{selectedGame?.name ?? t("listingForm.game")}</p>
            <p>{selectedServer?.name ?? t("listingForm.server")}</p>
            <p>{categoryLabel(category, t)}</p>
            {isAccountListing ? (
              <p>
                {t("listingForm.deliveryMethod")}: {accountTransferLabel(accountTransferType, t)}
              </p>
            ) : null}
            <p>
              프리미엄: {premiumFee > 0 ? `${premiumDurationHours}시간 / ${premiumFee} ${currency}` : "선택 안 함"}
            </p>
          </div>
        </section>

        {error ? <Notice tone="error">{error}</Notice> : null}
        {success ? <Notice tone="success">{success}</Notice> : null}

        <div className="grid gap-2">
          <button
            type="submit"
            disabled={isSubmitting || !hasSelectableCatalog}
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

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-sm shadow-[var(--gg-shadow)]">
      <h2 className="text-xl font-black">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
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
