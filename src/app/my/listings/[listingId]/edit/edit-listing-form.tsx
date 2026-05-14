"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  GAME_MONEY_PRICE_UNIT_OPTIONS,
  getGameMoneyPriceUnitLabel,
  isGameMoneyDisplayQuantity,
  normalizeGameMoneyPriceUnit,
  toGameMoneyActualQuantity,
  toGameMoneyDisplayQuantity,
} from "@/lib/market/trade-unit";

const LISTING_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const LISTING_IMAGE_ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

type TradeMode = "BULK" | "SPLIT";

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
  initialImageUrl,
  initialImageAlt,
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
  initialImageUrl: string | null;
  initialImageAlt: string;
}) {
  const router = useRouter();
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
  const [imageAlt, setImageAlt] = useState(initialImageAlt);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState(initialImageUrl);
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
  const gameMoneyQuantityHelperText =
    "게임머니 수량과 최소 구매 수량은 선택한 단위 기준으로 입력 가능합니다.";
  const selectedUnitPlaceholder = `예: 1 = ${priceUnitLabel}`;

  useEffect(() => {
    if (isGameMoneyListing && tradeMode === "BULK") {
      setMinimumQuantity(totalQuantity);
    }
  }, [isGameMoneyListing, totalQuantity, tradeMode]);

  const changedFields = [
    title !== initialTitle ? "제목" : null,
    description !== initialDescription ? "내용" : null,
    unitPrice !== initialDisplayUnitPrice ? "단위당 금액" : null,
    priceUnitQuantity !== normalizedInitialPriceUnitQuantity ? "가격 단위" : null,
    tradeMode !== initialNormalizedTradeMode ? "거래 방식" : null,
    actualTotalQuantity !== initialTotalQuantity ? "총 수량" : null,
    actualMinimumQuantity !== initialMinimumQuantity ? "최소 거래 수량" : null,
  ].filter(Boolean);

  const imagePreviewUrl = useMemo(() => {
    if (!selectedImage) return null;
    return URL.createObjectURL(selectedImage);
  }, [selectedImage]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      if (!title.trim()) {
        throw new Error("제목을 입력해 주세요.");
      }

      if (Number(unitPrice) <= 0) {
        throw new Error("단위당 금액은 0보다 커야 합니다.");
      }

      if (isGameMoneyListing && !isGameMoneyDisplayQuantity(totalQuantity)) {
        throw new Error("게임머니 총 수량은 선택한 단위 기준 숫자로 입력해 주세요.");
      }

      if (
        isGameMoneyListing &&
        !isGameMoneyDisplayQuantity(effectiveMinimumQuantity)
      ) {
        throw new Error("게임머니 최소 거래 수량은 선택한 단위 기준 숫자로 입력해 주세요.");
      }

      if (Number(totalQuantity) <= 0) {
        throw new Error("총 수량은 0보다 커야 합니다.");
      }

      if (Number(effectiveMinimumQuantity) <= 0) {
        throw new Error("최소 거래 수량은 0보다 커야 합니다.");
      }

      if (Number(actualMinimumQuantity) > Number(actualTotalQuantity)) {
        throw new Error("최소 거래 수량은 총 수량보다 클 수 없습니다.");
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
      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(result.message ?? "판매글 수정에 실패했습니다.");
      }

      setSuccess(result.message ?? "판매글을 수정했습니다.");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "판매글 수정에 실패했습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    setImageError("");
    setImageSuccess("");
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      setSelectedImage(null);
      return;
    }

    if (!LISTING_IMAGE_ALLOWED_TYPES.includes(file.type)) {
      setSelectedImage(null);
      event.target.value = "";
      setImageError("PNG, JPG, WEBP 이미지만 업로드할 수 있습니다.");
      return;
    }

    if (file.size > LISTING_IMAGE_MAX_BYTES) {
      setSelectedImage(null);
      event.target.value = "";
      setImageError("대표 이미지는 5MB 이하만 업로드할 수 있습니다.");
      return;
    }

    setSelectedImage(file);
  }

  async function handleImageUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setImageError("");
    setImageSuccess("");

    if (!selectedImage) {
      setImageError("업로드할 이미지를 선택해 주세요.");
      return;
    }

    setIsUploadingImage(true);

    try {
      const formData = new FormData();
      formData.set("listingId", listingId);
      formData.set("altText", imageAlt);
      formData.set("image", selectedImage);

      const response = await fetch("/api/market/listing-images", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as {
        message?: string;
        imageUrl?: string;
      };

      if (!response.ok) {
        throw new Error(result.message ?? "대표 이미지 업로드에 실패했습니다.");
      }

      setImageUrl(result.imageUrl ?? imageUrl);
      setImageSuccess(result.message ?? "대표 이미지가 저장되었습니다.");
      setSelectedImage(null);
      router.refresh();
    } catch (uploadError) {
      setImageError(
        uploadError instanceof Error
          ? uploadError.message
          : "대표 이미지 업로드에 실패했습니다.",
      );
    } finally {
      setIsUploadingImage(false);
    }
  }

  async function handleImageRemove() {
    setImageError("");
    setImageSuccess("");
    setIsRemovingImage(true);

    try {
      const response = await fetch(
        `/api/market/listing-images?listingId=${encodeURIComponent(listingId)}`,
        {
          method: "DELETE",
        },
      );
      const result = (await response.json()) as {
        message?: string;
      };

      if (!response.ok) {
        throw new Error(result.message ?? "대표 이미지 삭제에 실패했습니다.");
      }

      setImageUrl(null);
      setImageAlt("");
      setSelectedImage(null);
      setImageSuccess(result.message ?? "대표 이미지가 삭제되었습니다.");
      router.refresh();
    } catch (removeError) {
      setImageError(
        removeError instanceof Error
          ? removeError.message
          : "대표 이미지 삭제에 실패했습니다.",
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
        <p className="text-sm font-black text-[var(--gg-accent)]">SELL</p>
        <h2 className="mt-1 text-2xl font-black">판매글 수정</h2>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-black md:col-span-2">
            제목
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-3 py-3 text-[var(--gg-text)] outline-none focus:border-[var(--gg-accent)]"
            />
          </label>

          {isGameMoneyListing ? (
            <div className="md:col-span-2">
              <p className="text-sm font-black">거래 방식</p>
              <SegmentedTradeMode value={tradeMode} onChange={setTradeMode} />
            </div>
          ) : null}

          {isGameMoneyListing ? (
            <label className="flex flex-col gap-2 text-sm font-black">
              가격 단위
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
            단위당 금액 ({currency})
            <input
              value={unitPrice}
              onChange={(event) => setUnitPrice(event.target.value)}
              inputMode="decimal"
              className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-3 py-3 text-[var(--gg-text)] outline-none focus:border-[var(--gg-accent)]"
            />
            {isGameMoneyListing ? (
              <span className="text-xs font-bold text-[var(--gg-muted)]">
                선택한 {priceUnitLabel}당 금액을 입력합니다.
              </span>
            ) : null}
          </label>

          <label className="flex flex-col gap-2 text-sm font-black">
            총 수량
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
                {gameMoneyQuantityHelperText}
              </span>
            ) : null}
          </label>

          {isGameMoneyListing ? (
            <label className="flex flex-col gap-2 text-sm font-black">
              최소 거래 수량
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
                  ? "일괄판매는 등록된 전체 수량만 거래할 수 있습니다."
                  : "분할판매는 구매자가 최소 거래 수량 이상으로 구매할 수 있습니다."}
              </span>
            </label>
          ) : null}

          <label className="flex flex-col gap-2 text-sm font-black md:col-span-2">
            내용
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={5}
              className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-3 py-3 text-[var(--gg-text)] outline-none focus:border-[var(--gg-accent)]"
            />
          </label>
        </div>

        <div className="mt-5 rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-control-bg)] p-4">
          <p className="text-sm font-black text-[var(--gg-text)]">변경 항목</p>
          <div className="mt-3 grid gap-2 text-sm leading-6 text-[var(--gg-muted)]">
            <p>
              <span className="font-bold text-[var(--gg-text)]">
                {changedFields.length ? changedFields.join(", ") : "변경 없음"}
              </span>
            </p>
            <p>
              현재 금액{" "}
              <span className="font-bold text-[var(--gg-accent)]">
                {unitPrice || "0"} {currency}
                {isGameMoneyListing ? ` / ${priceUnitLabel}` : ""}
              </span>
            </p>
            {isGameMoneyListing ? (
              <p>
                거래 방식{" "}
                <span className="font-bold text-[var(--gg-text)]">
                  {tradeMode === "BULK" ? "일괄 판매" : "분할 판매"}
                </span>
              </p>
            ) : null}
            <p>
              총 수량{" "}
              <span className="font-bold text-[var(--gg-text)]">
                {totalQuantity || "0"}
              </span>
            </p>
            {isGameMoneyListing ? (
              <p>
                최소 거래 수량{" "}
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
            {isSubmitting ? "저장 중..." : "변경사항 저장"}
          </button>
        </div>

        {error ? <Notice tone="error">{error}</Notice> : null}
        {success ? <Notice tone="success">{success}</Notice> : null}
      </form>

      <form
        onSubmit={handleImageUpload}
        className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-lg shadow-[var(--gg-shadow)]"
      >
        <p className="text-sm font-black text-[var(--gg-accent)]">IMAGE</p>
        <h2 className="mt-1 text-2xl font-black">대표 이미지</h2>

        <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--gg-border-soft)] bg-[var(--gg-control-bg)]">
          {imagePreviewUrl ? (
            <Image
              src={imagePreviewUrl}
              alt={imageAlt || title}
              width={960}
              height={720}
              unoptimized
              className="aspect-[4/3] w-full object-cover"
            />
          ) : imageUrl ? (
            <Image
              src={imageUrl}
              alt={imageAlt || title}
              width={960}
              height={720}
              className="aspect-[4/3] w-full object-cover"
            />
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center px-6 text-center text-sm font-bold text-[var(--gg-subtle)]">
              대표 이미지 없음
            </div>
          )}
        </div>

        <div className="mt-4 grid gap-4">
          <label className="flex flex-col gap-2 text-sm font-black">
            이미지 설명
            <input
              value={imageAlt}
              onChange={(event) => setImageAlt(event.target.value)}
              placeholder="이미지 내용을 짧게 입력"
              className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-3 py-3 text-[var(--gg-text)] outline-none placeholder:text-[var(--gg-subtle)] focus:border-[var(--gg-accent)]"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-black">
            이미지 파일
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleImageChange}
              className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-3 py-2 text-sm text-[var(--gg-muted)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--gg-accent)] file:px-3 file:py-2 file:text-sm file:font-black file:text-[var(--gg-inverse-text)] hover:file:bg-[var(--gg-accent-hover)]"
            />
          </label>
        </div>

        {selectedImage ? (
          <p className="mt-3 text-xs text-[var(--gg-muted)]">
            선택한 이미지: {selectedImage.name}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={isUploadingImage}
            className="rounded-xl bg-[var(--gg-accent)] px-4 py-3 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isUploadingImage ? "업로드 중..." : "이미지 저장"}
          </button>
          <button
            type="button"
            disabled={isRemovingImage || !imageUrl}
            onClick={() => void handleImageRemove()}
            className="rounded-xl border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm font-black text-red-600 hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isRemovingImage ? "삭제 중..." : "이미지 삭제"}
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
  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      <TradeModeButton
        active={value === "BULK"}
        title="일괄 판매"
        description="등록한 전체 수량을 한 번에 판매합니다."
        onClick={() => onChange("BULK")}
      />
      <TradeModeButton
        active={value === "SPLIT"}
        title="분할 판매"
        description="구매자가 최소 거래 수량 이상으로 나누어 구매합니다."
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

function formatDisplayNumber(value: number) {
  if (!Number.isFinite(value)) {
    return "";
  }

  return Number.isInteger(value)
    ? String(value)
    : String(value).replace(/0+$/, "").replace(/\.$/, "");
}
