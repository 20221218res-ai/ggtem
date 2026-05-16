"use client";

import { useRouter } from "next/navigation";
import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type { TranslationKey } from "@/app/i18n";
import useCountryTranslation from "@/app/use-country-translation";
import BuyRequestImageActions from "../../buy-request-image-actions";

const BUY_REQUEST_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const BUY_REQUEST_IMAGE_MAX_COUNT = 8;
const BUY_REQUEST_IMAGE_ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

type BuyRequestImage = {
  imageId: string;
  imageUrl: string;
  altText: string | null;
};

export default function EditBuyRequestForm({
  buyRequestId,
  category,
  initialTitle,
  initialDescription,
  initialAccountRank,
  initialBuyerGameNickname,
  initialImages,
}: {
  buyRequestId: string;
  category: string;
  initialTitle: string;
  initialDescription: string;
  initialAccountRank: string;
  initialBuyerGameNickname: string;
  initialImages: BuyRequestImage[];
}) {
  const router = useRouter();
  const { t } = useCountryTranslation();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [accountRank, setAccountRank] = useState(initialAccountRank);
  const [buyerGameNickname, setBuyerGameNickname] = useState(initialBuyerGameNickname);
  const [imageAlt, setImageAlt] = useState("");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isAccountRequest = category === "GAME_ACCOUNT";

  const imagePreviewUrls = useMemo(
    () => selectedImages.map((file) => URL.createObjectURL(file)),
    [selectedImages],
  );

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

    if (initialImages.length + files.length > BUY_REQUEST_IMAGE_MAX_COUNT) {
      setSelectedImages([]);
      event.target.value = "";
      setError(t("listingEdit.imageMaxCountError").replace("{count}", String(BUY_REQUEST_IMAGE_MAX_COUNT)));
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/market/buy-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode: "UPDATE_CONTENT",
          buyRequestId,
          title,
          description,
          accountRank: isAccountRequest ? accountRank : undefined,
          buyerGameNickname,
        }),
      });
      const result = (await response.json()) as ApiResult;

      if (!response.ok) {
        throw new Error(getApiMessage(result, t, "buyRequestAction.updateFailed"));
      }

      for (const selectedImage of selectedImages) {
        const formData = new FormData();
        formData.set("buyRequestId", buyRequestId);
        formData.set("altText", imageAlt);
        formData.set("image", selectedImage);

        const imageResponse = await fetch("/api/market/buy-request-images", {
          method: "POST",
          body: formData,
        });
        const imageResult = (await imageResponse.json()) as ApiResult;

        if (!imageResponse.ok) {
          throw new Error(
            `${selectedImage.name}: ${getApiMessage(imageResult, t, "listingForm.imageUploadFailed")}`,
          );
        }
      }

      setSelectedImages([]);
      setSuccess(getApiMessage(result, t, "buyRequestAction.updateSuccess"));
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : t("buyRequestAction.updateFailed"),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-[var(--gg-border)] bg-[var(--gg-card-bg)] p-5 shadow-lg shadow-[var(--gg-shadow)]"
    >
      <div className="grid gap-4">
        <label className="grid gap-2 text-sm font-black">
          {t("listingForm.title")}
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="rounded-xl border border-[var(--gg-border)] bg-white px-4 py-3 text-base font-bold outline-none focus:border-[var(--gg-accent)]"
          />
        </label>

        <label className="grid gap-2 text-sm font-black">
          {t("listingForm.buyerGameNickname")}
          <input
            value={buyerGameNickname}
            onChange={(event) => setBuyerGameNickname(event.target.value)}
            className="rounded-xl border border-[var(--gg-border)] bg-white px-4 py-3 text-base font-bold outline-none focus:border-[var(--gg-accent)]"
          />
        </label>

        {isAccountRequest ? (
          <label className="grid gap-2 text-sm font-black">
            {t("listingForm.accountSpec")}
            <input
              value={accountRank}
              onChange={(event) => setAccountRank(event.target.value)}
              className="rounded-xl border border-[var(--gg-border)] bg-white px-4 py-3 text-base font-bold outline-none focus:border-[var(--gg-accent)]"
            />
          </label>
        ) : null}

        <label className="grid gap-2 text-sm font-black">
          {isAccountRequest ? t("listingForm.accountBuyConditions") : t("listingForm.buyCondition")}
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={6}
            className="rounded-xl border border-[var(--gg-border)] bg-white px-4 py-3 text-base font-bold outline-none focus:border-[var(--gg-accent)]"
          />
        </label>

        <section className="rounded-xl border border-[var(--gg-border-soft)] bg-[var(--gg-card-soft-bg)] p-4">
          <h2 className="text-sm font-black text-[var(--gg-accent)]">{t("listingForm.imageSection")}</h2>
          {initialImages.length > 0 ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {initialImages.map((image) => (
                <div
                  key={image.imageId}
                  className="relative overflow-hidden rounded-xl border border-[var(--gg-border-soft)] bg-white"
                >
                  <img
                    src={image.imageUrl}
                    alt={image.altText || title}
                    loading="lazy"
                    className="h-32 w-full object-cover"
                  />
                  <BuyRequestImageActions buyRequestId={buyRequestId} imageId={image.imageId} />
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm font-bold text-[var(--gg-muted)]">{t("listingForm.noImage")}</p>
          )}

          {imagePreviewUrls.length > 0 ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {imagePreviewUrls.map((url, index) => (
                <div key={`${url}-${index}`} className="overflow-hidden rounded-xl border border-[var(--gg-border-soft)] bg-white">
                  <img
                    src={url}
                    alt={`${t("listingForm.imageSection")} ${index + 1}`}
                    className="h-24 w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeSelectedImage(index)}
                    className="w-full border-t border-[var(--gg-border-soft)] px-3 py-2 text-xs font-black text-red-600"
                  >
                    {t("listingEdit.imageRemove")}
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 md:grid-cols-[220px_1fr]">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={handleImageChange}
              className="rounded-xl border border-[var(--gg-border)] bg-white px-3 py-3 text-sm font-bold"
            />
            <input
              value={imageAlt}
              onChange={(event) => setImageAlt(event.target.value)}
              placeholder={t("listingForm.imageAltPlaceholder")}
              className="rounded-xl border border-[var(--gg-border)] bg-white px-4 py-3 text-sm font-bold outline-none focus:border-[var(--gg-accent)]"
            />
          </div>
        </section>

        {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}
        {success ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-700">{success}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-xl bg-[var(--gg-accent)] px-5 py-4 text-sm font-black text-[var(--gg-inverse-text)] hover:bg-[var(--gg-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? t("listingEdit.saving") : t("listingEdit.saveChanges")}
        </button>
      </div>
    </form>
  );
}

type ApiResult = {
  message?: string;
  messageKey?: TranslationKey;
};

function getApiMessage(
  result: ApiResult,
  t: (key: TranslationKey) => string,
  fallbackKey: TranslationKey,
) {
  if (result.messageKey) {
    return t(result.messageKey);
  }

  return result.message || t(fallbackKey);
}
