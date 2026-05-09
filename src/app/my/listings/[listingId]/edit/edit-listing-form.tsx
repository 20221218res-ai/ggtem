"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import type { ChangeEvent, FormEvent } from "react";
import { useMemo, useState } from "react";

const LISTING_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const LISTING_IMAGE_ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

export default function EditListingForm({
  listingId,
  currency,
  initialTitle,
  initialDescription,
  initialUnitPrice,
  initialTotalQuantity,
  initialImageUrl,
  initialImageAlt,
}: {
  listingId: string;
  currency: string;
  initialTitle: string;
  initialDescription: string;
  initialUnitPrice: string;
  initialTotalQuantity: string;
  initialImageUrl: string | null;
  initialImageAlt: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [unitPrice, setUnitPrice] = useState(initialUnitPrice);
  const [totalQuantity, setTotalQuantity] = useState(initialTotalQuantity);
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

  const changedFields = [
    title !== initialTitle ? "제목" : null,
    description !== initialDescription ? "내용" : null,
    unitPrice !== initialUnitPrice ? "판매 단가" : null,
    totalQuantity !== initialTotalQuantity ? "총 수량" : null,
  ].filter(Boolean);
  const imagePreviewUrl = useMemo(() => {
    if (!selectedImage) return null;
    return URL.createObjectURL(selectedImage);
  }, [selectedImage]);

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
        throw new Error("판매 단가는 0보다 커야 합니다.");
      }

      if (Number(totalQuantity) <= 0) {
        throw new Error("총 수량은 0보다 커야 합니다.");
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
          totalQuantity,
        }),
      });
      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(result.message ?? "판매글 수정에 실패했습니다.");
      }

      setSuccess(result.message ?? "판매글이 수정되었습니다.");
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

          <label className="flex flex-col gap-2 text-sm font-black">
            판매 단가 ({currency})
            <input
              value={unitPrice}
              onChange={(event) => setUnitPrice(event.target.value)}
              inputMode="decimal"
              className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-3 py-3 text-[var(--gg-text)] outline-none focus:border-[var(--gg-accent)]"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-black">
            총 수량
            <input
              value={totalQuantity}
              onChange={(event) => setTotalQuantity(event.target.value)}
              inputMode="decimal"
              className="rounded-xl border border-[var(--gg-border)] bg-[var(--gg-control-bg)] px-3 py-3 text-[var(--gg-text)] outline-none focus:border-[var(--gg-accent)]"
            />
          </label>

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
              현재 단가{" "}
              <span className="font-bold text-[var(--gg-accent)]">
                {unitPrice || "0"} {currency}
              </span>
            </p>
            <p>
              총 수량{" "}
              <span className="font-bold text-[var(--gg-text)]">
                {totalQuantity || "0"}
              </span>
            </p>
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

function Notice({ tone, children }: { tone: "error" | "success"; children: React.ReactNode }) {
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
