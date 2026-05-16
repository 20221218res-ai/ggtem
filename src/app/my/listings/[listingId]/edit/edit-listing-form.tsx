"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import type { TranslationKey } from "@/app/i18n";
import useCountryTranslation from "@/app/use-country-translation";
import {
  GAME_MONEY_PRICE_UNIT_OPTIONS,
  getGameMoneyPriceUnitLabel,
  isGameMoneyDisplayQuantity,
  normalizeGameMoneyPriceUnit,
  toGameMoneyActualQuantity,
  toGameMoneyDisplayQuantity,
} from "@/lib/market/trade-unit";

const LISTING_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const LISTING_IMAGE_MAX_COUNT = 8;
const LISTING_IMAGE_ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

type TradeMode = "BULK" | "SPLIT";

type ApiResult = {
  message?: string;
  messageKey?: TranslationKey;
  imageUrl?: string;
  imageId?: string;
};

type ListingContentImage = {
  imageId: string;
  imageUrl: string;
  altText: string | null;
};

export default function EditListingForm({
  listingId,
  currency,
  initialTitle,
  initialDescription,
  initialCategory,
  initialUnitPrice,
  initialPriceUnitQuantity,
  initialTradeMode,
  moneyUnitName,
  initialTotalQuantity,
  initialMinimumQuantity,
  initialImages,
}: {
  listingId: string;
  currency: string;
  initialTitle: string;
  initialDescription: string;
  initialCategory: string;
  initialUnitPrice: string;
  initialPriceUnitQuantity: string;
  initialTradeMode: string;
  moneyUnitName: string | null;
  initialTotalQuantity: string;
  initialMinimumQuantity: string;
  initialImages: ListingContentImage[];
}) {
  const router = useRouter();
  const { t } = useCountryTranslation();
  const isGameMoneyListing = initialCategory === "GAME_MONEY";
  const normalizedInitialPriceUnitQuantity = isGameMoneyListing
    ? normalizeGameMoneyPriceUnit(initialPriceUnitQuantity)
    : "1";
  const initialDisplayUnitPrice = isGameMoneyListing
    ? formatDisplayNumber(
        Number(initialUnitPrice) * Number(normalizedInitialPriceUnitQuantity),
      )
    : initialUnitPrice;
  const initialDisplayTotalQuantity = isGameMoneyListing
    ? toGameMoneyDisplayQuantity(
        initialTotalQuantity,
        normalizedInitialPriceUnitQuantity,
      )
    : initialTotalQuantity;
  const initialDisplayMinimumQuantity = isGameMoneyListing
    ? toGameMoneyDisplayQuantity(
        initialMinimumQuantity,
        normalizedInitialPriceUnitQuantity,
      )
    : initialMinimumQuantity;
  const initialNormalizedTradeMode: TradeMode =
    initialTradeMode === "BULK" ? "BULK" : "SPLIT";

  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [unitPrice, setUnitPrice] = useState(initialDisplayUnitPrice);
  const [priceUnitQuantity, setPriceUnitQuantity] = useState(
    normalizedInitialPriceUnitQuantity,
  );
  const [tradeMode, setTradeMode] = useState<TradeMode>(initialNormalizedTradeMode);
  const [totalQuantity, setTotalQuantity] = useState(initialDisplayTotalQuantity);
  const [minimumQuantity, setMinimumQuantity] = useState(
    initialDisplayMinimumQuantity,
  );
  const [imageAlt, setImageAlt] = useState(initialImages[0]?.altText ?? "");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [contentImages, setContentImages] = useState<ListingContentImage[]>(initialImages);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [imageError, setImageError] = useState("");
  const [imageSuccess, setImageSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isRemovingImage, setIsRemovingImage] = useState(false);

  const effectiveMinimumQuantity =
    isGameMoneyListing && tradeMode === "BULK" ? totalQuantity : minimumQuantity;
  const actualTotalQuantity = isGameMoneyListing
    ? isGameMoneyDisplayQuantity(totalQuantity)
      ? toGameMoneyActualQuantity(totalQuantity, priceUnitQuantity)
      : "0"
    : totalQuantity;
  const actualMinimumQuantity = isGameMoneyListing
    ? isGameMoneyDisplayQuantity(effectiveMinimumQuantity)
      ? toGameMoneyActualQuantity(effectiveMinimumQuantity, priceUnitQuantity)
      : "0"
    : effectiveMinimumQuantity;
  const priceUnitLabel = getGameMoneyPriceUnitLabel(
    priceUnitQuantity,
    moneyUnitName,
  );
  const selectedUnitPlaceholder = t("listingEdit.selectedUnitPlaceholder").replace(
    "{unit}",
    priceUnitLabel,
  );

  useEffect(() => {
    if (isGameMoneyListing && tradeMode === "BULK") {
      setMinimumQuantity(totalQuantity);
    }
  }, [isGameMoneyListing, totalQuantity, tradeMode]);

  const changedFields = [
    title !== initialTitle ? t("listingForm.title") : null,
    description !== initialDescription ? t("listingForm.tradeContent") : null,
    unitPrice !== initialDisplayUnitPrice ? t("listingForm.unitPrice") : null,
    priceUnitQuantity !== normalizedInitialPriceUnitQuantity
      ? t("listingForm.priceUnitBasis")
      : null,
    tradeMode !== initialNormalizedTradeMode ? t("listingForm.sellMode") : null,
    actualTotalQuantity !== initialTotalQuantity ? t("listingEdit.totalQuantity") : null,
    actualMinimumQuantity !== initialMinimumQuantity
      ? t("listingEdit.minimumTradeQuantity")
      : null,
  ].filter(Boolean);

  const imagePreviewUrls = useMemo(
    () => selectedImages.map((file) => URL.createObjectURL(file)),
    [selectedImages],
  );

  useEffect(() => {
    return () => {
      imagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imagePreviewUrls]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      if (!title.trim()) {
        throw new Error(t("listingEdit.titleRequired"));
      }

      if (Number(unitPrice) <= 0) {
        throw new Error(t("listingForm.unitPriceInvalid"));
      }

      if (isGameMoneyListing && !isGameMoneyDisplayQuantity(totalQuantity)) {
        throw new Error(t("listingEdit.gameMoneyTotalQuantityInvalid"));
      }

      if (
        isGameMoneyListing &&
        !isGameMoneyDisplayQuantity(effectiveMinimumQuantity)
      ) {
        throw new Error(t("listingEdit.gameMoneyMinimumQuantityInvalid"));
      }

      if (Number(totalQuantity) <= 0) {
        throw new Error(t("listingEdit.totalQuantityInvalid"));
      }

      if (Number(effectiveMinimumQuantity) <= 0) {
        throw new Error(t("listingForm.minimumQuantityInvalid"));
      }

      if (Number(actualMinimumQuantity) > Number(actualTotalQuantity)) {
        throw new Error(t("listingForm.minimumOverQuantity"));
      }

      const response = await fetch("/api/market/seller-listings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "UPDATE",
          listingId,
          title,
          description,
          unitPrice,
          pricePerUnit: isGameMoneyListing ? unitPrice : undefined,
          priceUnitQuantity: isGameMoneyListing ? priceUnitQuantity : undefined,
          tradeMode: isGameMoneyListing ? tradeMode : undefined,
          minimumQuantity: isGameMoneyListing ? actualMinimumQuantity : undefined,
          totalQuantity: isGameMoneyListing ? actualTotalQuantity : totalQuantity,
        }),
      });
      const result = (await response.json()) as ApiResult;

      if (!response.ok) {
        throw new Error(getApiMessage(result, t, "listingEdit.updateFailed"));
      }

      setSuccess(getApiMessage(result, t, "listingEdit.updateSuccess"));
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : t("listingEdit.updateFailed"),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    setImageError("");
    setImageSuccess("");
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      setSelectedImages([]);
      return;
    }

    if (contentImages.length + files.length > LISTING_IMAGE_MAX_COUNT) {
      setSelectedImages([]);
      event.target.value = "";
      setImageError(t("listingEdit.imageMaxCountError").replace("{count}", String(LISTING_IMAGE_MAX_COUNT)));
      return;
    }

    const invalidTypeFile = files.find((file) => !LISTING_IMAGE_ALLOWED_TYPES.includes(file.type));
    if (invalidTypeFile) {
      setSelectedImages([]);
      event.target.value = "";
      setImageError(`${invalidTypeFile.name}: ${t("listingForm.imageTypeError")}`);
      return;
    }

    const oversizedFile = files.find((file) => file.size > LISTING_IMAGE_MAX_BYTES);
    if (oversizedFile) {
      setSelectedImages([]);
      event.target.value = "";
      setImageError(`${oversizedFile.name}: ${t("listingForm.imageSizeError")}`);
      return;
    }

    setSelectedImages(files);
  }

  function removeSelectedImage(indexToRemove: number) {
    setSelectedImages((currentImages) =>
      currentImages.filter((_, index) => index !== indexToRemove),
    );
  }

  async function handleImageUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setImageError("");
    setImageSuccess("");

    if (selectedImages.length === 0) {
      setImageError(t("listingEdit.imageRequired"));
      return;
    }

    setIsUploadingImage(true);

    try {
      const uploadedImages: ListingContentImage[] = [];

      for (const selectedImage of selectedImages) {
        const formData = new FormData();
        formData.set("listingId", listingId);
        formData.set("altText", imageAlt);
        formData.set("image", selectedImage);

        const response = await fetch("/api/market/listing-images", {
          method: "POST",
          body: formData,
        });
        const result = (await response.json()) as ApiResult;

        if (!response.ok) {
          throw new Error(
            `${selectedImage.name}: ${getApiMessage(result, t, "listingForm.imageUploadFailed")}`,
          );
        }

        if (result.imageUrl) {
          uploadedImages.push({
            imageId: result.imageId ?? result.imageUrl,
            imageUrl: result.imageUrl,
            altText: imageAlt || null,
          });
        }
      }

      setContentImages((currentImages) => [...currentImages, ...uploadedImages]);
      setImageSuccess(t("listingEdit.imageSaveSuccess"));
      setSelectedImages([]);
      router.refresh();
    } catch (uploadError) {
      setImageError(
        uploadError instanceof Error
          ? uploadError.message
          : t("listingForm.imageUploadFailed"),
      );
    } finally {
      setIsUploadingImage(false);
    }
  }

  async function handleImageRemove(imageId: string) {
    setImageError("");
    setImageSuccess("");
    setIsRemovingImage(true);

    try {
      const response = await fetch(
        `/api/market/listing-images?listingId=${encodeURIComponent(listingId)}&imageId=${encodeURIComponent(imageId)}`,
        {
          method: "DELETE",
        },
      );
      const result = (await response.json()) as ApiResult;

      if (!response.ok) {
        throw new Error(getApiMessage(result, t, "listingEdit.imageRemoveFailed"));
      }

      setContentImages((currentImages) =>
        currentImages.filter((image) => image.imageId !== imageId),
      );
      setSelectedImages([]);
      setImageSuccess(getApiMessage(result, t, "listingEdit.imageRemoveSuccess"));
      router.refresh();
    } catch (removeError) {
      setImageError(
        removeError instanceof Error
          ? removeError.message
          : t("listingEdit.imageRemoveFailed"),
      );
    } finally {
      setIsRemovingImage(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-lg shadow-[var(--gg-shadow)]"
      >
        <p className="text-sm font-black text-[var(--gg-accent)]">{t("common.sellModeShort")}</p>
        <h2 className="mt-1 text-2xl font-black">{t("listingEdit.formTitle")}</h2>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-black md:col-span-2">
            {t("listingForm.title")}
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-3 py-3 text-[var(--gg-text)] outline-none focus:border-[var(--gg-accent)]"
            />
          </label>

          {isGameMoneyListing ? (
            <div className="md:col-span-2">
              <p className="text-sm font-black">{t("listingForm.sellMode")}</p>
              <SegmentedTradeMode value={tradeMode} onChange={setTradeMode} />
            </div>
          ) : null}

          {isGameMoneyListing ? (
            <label className="flex flex-col gap-2 text-sm font-black">
              {t("listingForm.priceUnitBasis")}
              <select
                value={priceUnitQuantity}
                onChange={(event) => setPriceUnitQuantity(event.target.value)}
                className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-3 py-3 text-[var(--gg-text)] outline-none focus:border-[var(--gg-accent)]"
              >
                {GAME_MONEY_PRICE_UNIT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {getGameMoneyPriceUnitLabel(option.value, moneyUnitName)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="flex flex-col gap-2 text-sm font-black">
            {t("listingEdit.unitAmount").replace("{currency}", currency)}
            <input
              value={unitPrice}
              onChange={(event) => setUnitPrice(event.target.value)}
              inputMode="decimal"
              className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-3 py-3 text-[var(--gg-text)] outline-none focus:border-[var(--gg-accent)]"
            />
            {isGameMoneyListing ? (
              <span className="text-xs font-bold text-[var(--gg-muted)]">
                {t("listingEdit.selectedUnitPriceHint").replace("{unit}", priceUnitLabel)}
              </span>
            ) : null}
          </label>

          <label className="flex flex-col gap-2 text-sm font-black">
            {t("listingEdit.totalQuantity")}
            <input
              value={totalQuantity}
              onChange={(event) => setTotalQuantity(event.target.value)}
              inputMode={isGameMoneyListing ? "numeric" : "decimal"}
              step={isGameMoneyListing ? 1 : undefined}
              placeholder={isGameMoneyListing ? selectedUnitPlaceholder : undefined}
              className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-3 py-3 text-[var(--gg-text)] outline-none focus:border-[var(--gg-accent)]"
            />
            {isGameMoneyListing ? (
              <span className="text-xs font-bold text-[var(--gg-muted)]">
                {t("listingForm.sellGameMoneyUnitHelper")}
              </span>
            ) : null}
          </label>

          {isGameMoneyListing ? (
            <label className="flex flex-col gap-2 text-sm font-black">
              {t("listingEdit.minimumTradeQuantity")}
              <input
                value={effectiveMinimumQuantity}
                onChange={(event) => setMinimumQuantity(event.target.value)}
                inputMode="numeric"
                step={1}
                placeholder={selectedUnitPlaceholder}
                disabled={tradeMode === "BULK"}
                className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-3 py-3 text-[var(--gg-text)] outline-none focus:border-[var(--gg-accent)] disabled:cursor-not-allowed disabled:opacity-70"
              />
              <span className="text-xs font-bold text-[var(--gg-muted)]">
                {tradeMode === "BULK"
                  ? t("listingEdit.bulkSellHint")
                  : t("listingEdit.splitSellHint")}
              </span>
            </label>
          ) : null}

          <label className="flex flex-col gap-2 text-sm font-black md:col-span-2">
            {t("listingForm.tradeContent")}
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={5}
              className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-3 py-3 text-[var(--gg-text)] outline-none focus:border-[var(--gg-accent)]"
            />
          </label>
        </div>

        <div className="mt-5 rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-control-bg)] p-4">
          <p className="text-sm font-black text-[var(--gg-text)]">
            {t("listingEdit.changedFields")}
          </p>
          <div className="mt-3 grid gap-2 text-sm leading-6 text-[var(--gg-muted)]">
            <p>
              <span className="font-bold text-[var(--gg-text)]">
                {changedFields.length
                  ? changedFields.join(", ")
                  : t("listingEdit.noChanges")}
              </span>
            </p>
            <p>
              {t("listingEdit.currentAmount")}{" "}
              <span className="font-bold text-[var(--gg-accent)]">
                {unitPrice || "0"} {currency}
                {isGameMoneyListing ? ` / ${priceUnitLabel}` : ""}
              </span>
            </p>
            {isGameMoneyListing ? (
              <p>
                {t("listingForm.sellMode")}{" "}
                <span className="font-bold text-[var(--gg-text)]">
                  {tradeMode === "BULK"
                    ? t("listingForm.bulkSell")
                    : t("listingForm.splitSell")}
                </span>
              </p>
            ) : null}
            <p>
              {t("listingEdit.totalQuantity")}{" "}
              <span className="font-bold text-[var(--gg-text)]">
                {totalQuantity || "0"}
              </span>
            </p>
            {isGameMoneyListing ? (
              <p>
                {t("listingEdit.minimumTradeQuantity")}{" "}
                <span className="font-bold text-[var(--gg-text)]">
                  {effectiveMinimumQuantity || "0"}
                </span>
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-xl bg-[var(--gg-accent)] px-5 py-3 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? t("listingEdit.saving") : t("listingEdit.saveChanges")}
          </button>
        </div>

        {error ? <Notice tone="error">{error}</Notice> : null}
        {success ? <Notice tone="success">{success}</Notice> : null}
      </form>

      <form
        onSubmit={handleImageUpload}
        className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-lg shadow-[var(--gg-shadow)]"
      >
        <p className="text-sm font-black text-[var(--gg-accent)]">{t("listingForm.imageSection")}</p>
        <h2 className="mt-1 text-2xl font-black">{t("listingForm.imageSection")}</h2>

        <div className="mt-5 grid gap-3">
          {contentImages.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {contentImages.map((image) => (
                <div
                  key={image.imageId}
                  className="overflow-hidden rounded-2xl border border-[var(--gg-border-soft)] bg-[var(--gg-control-bg)]"
                >
                  <Image
                    src={image.imageUrl}
                    alt={image.altText || title}
                    width={640}
                    height={480}
                    className="aspect-[4/3] w-full object-cover"
                  />
                  <div className="flex items-center justify-between gap-2 border-t border-[var(--gg-border-soft)] bg-[var(--gg-card-bg)] p-3">
                    <p className="truncate text-xs font-bold text-[var(--gg-muted)]">
                      {image.altText || t("listingForm.imageSection")}
                    </p>
                    <button
                      type="button"
                      disabled={isRemovingImage}
                      onClick={() => void handleImageRemove(image.imageId)}
                      className="rounded-lg border border-red-400/40 bg-red-400/10 px-3 py-2 text-xs font-black text-red-600 hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isRemovingImage ? t("listingEdit.removing") : t("listingEdit.imageRemove")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center rounded-2xl border border-[var(--gg-border-soft)] bg-[var(--gg-control-bg)] px-6 text-center text-sm font-bold text-[var(--gg-subtle)]">
              {t("listingForm.noImage")}
            </div>
          )}
          {imagePreviewUrls.length > 0 ? (
            <div className="grid gap-2 rounded-2xl border border-dashed border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] p-3 sm:grid-cols-3">
              {imagePreviewUrls.map((url, index) => (
                <Image
                  key={url}
                  src={url}
                  alt={`${t("listingForm.imageSection")} ${index + 1}`}
                  width={240}
                  height={180}
                  unoptimized
                  className="aspect-[4/3] w-full rounded-xl object-cover"
                />
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-4 grid gap-4">
          <label className="flex flex-col gap-2 text-sm font-black">
            {t("listingForm.imageAltPlaceholder")}
            <input
              value={imageAlt}
              onChange={(event) => setImageAlt(event.target.value)}
              placeholder={t("listingEdit.imageAltInputPlaceholder")}
              className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-3 py-3 text-[var(--gg-text)] outline-none placeholder:text-[var(--gg-subtle)] focus:border-[var(--gg-accent)]"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-black">
            {t("listingEdit.imageFile")}
            <input
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              onChange={handleImageChange}
              className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-3 py-2 text-sm text-[var(--gg-muted)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--gg-accent)] file:px-3 file:py-2 file:text-sm file:font-black file:text-[var(--gg-inverse-text)] hover:file:bg-[var(--gg-accent-hover)]"
            />
          </label>
        </div>

        {selectedImages.length > 0 ? (
          <div className="mt-3 grid gap-2">
            {selectedImages.map((image, index) => (
              <div
                key={`${image.name}-${image.lastModified}-${index}`}
                className="flex items-center justify-between gap-2 rounded-xl border border-[var(--gg-border)] bg-[var(--gg-card-soft-bg)] px-3 py-2 text-xs font-black text-[var(--gg-muted)]"
              >
                <span className="truncate">
                  {t("listingEdit.selectedImage").replace("{name}", image.name)}
                </span>
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

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={isUploadingImage}
            className="rounded-xl bg-[var(--gg-accent)] px-4 py-3 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isUploadingImage ? t("listingEdit.uploading") : t("listingEdit.imageSave")}
          </button>
        </div>

        {imageError ? <Notice tone="error">{imageError}</Notice> : null}
        {imageSuccess ? <Notice tone="success">{imageSuccess}</Notice> : null}
      </form>
    </div>
  );
}

function SegmentedTradeMode({
  value,
  onChange,
}: {
  value: TradeMode;
  onChange: (value: TradeMode) => void;
}) {
  const { t } = useCountryTranslation();

  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      <TradeModeButton
        active={value === "BULK"}
        title={t("listingForm.bulkSell")}
        description={t("listingEdit.bulkSellDescription")}
        onClick={() => onChange("BULK")}
      />
      <TradeModeButton
        active={value === "SPLIT"}
        title={t("listingForm.splitSell")}
        description={t("listingEdit.splitSellDescription")}
        onClick={() => onChange("SPLIT")}
      />
    </div>
  );
}

function TradeModeButton({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-2xl border border-[var(--gg-accent)] bg-[color-mix(in_srgb,var(--gg-accent)_12%,white)] p-4 text-left shadow-sm shadow-[var(--gg-shadow)]"
          : "rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-control-bg)] p-4 text-left hover:border-[var(--gg-accent)]"
      }
    >
      <span className="block text-sm font-black text-[var(--gg-text)]">{title}</span>
      <span className="mt-1 block text-xs font-bold text-[var(--gg-muted)]">
        {description}
      </span>
    </button>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: ReactNode;
}) {
  return (
    <p
      className={
        tone === "error"
          ? "mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm font-bold text-red-600"
          : "mt-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-700"
      }
    >
      {children}
    </p>
  );
}

function getApiMessage(
  result: ApiResult,
  t: (key: TranslationKey) => string,
  fallbackKey: TranslationKey,
) {
  return result.messageKey ? t(result.messageKey) : result.message ?? t(fallbackKey);
}

function formatDisplayNumber(value: number) {
  if (!Number.isFinite(value)) {
    return "";
  }

  return Number.isInteger(value)
    ? String(value)
    : String(value).replace(/0+$/, "").replace(/\.$/, "");
}
