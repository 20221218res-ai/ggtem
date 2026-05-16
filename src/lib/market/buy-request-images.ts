import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";

const BUY_REQUEST_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export type MarketplaceBuyRequestImageMutationResult = {
  buyRequestId: string;
  imageUrl: string | null;
  altText: string | null;
  message: string;
};

export async function uploadMarketplaceBuyRequestImage(input: {
  buyRequestId: string;
  fileName: string;
  contentType: string;
  bytes: Uint8Array;
  altText?: string;
}): Promise<MarketplaceBuyRequestImageMutationResult> {
  const prisma = getPrismaClient();
  const sessionUser = await getCurrentSessionUser();

  if (!sessionUser) {
    throw new Error("로그인이 필요합니다.");
  }

  const extension = getImageExtension(input.fileName, input.contentType);

  if (!extension) {
    throw new Error("본문 이미지는 PNG, JPG, JPEG, WEBP 파일만 사용할 수 있습니다.");
  }

  if (input.bytes.byteLength === 0) {
    throw new Error("이미지 파일이 비어 있습니다.");
  }

  if (input.bytes.byteLength > BUY_REQUEST_IMAGE_MAX_BYTES) {
    throw new Error("본문 이미지는 5MB 이하만 사용할 수 있습니다.");
  }

  if (!isImageSignatureValid(input.bytes, extension)) {
    throw new Error(
      "이미지 파일 형식이 올바르지 않습니다. 실제 PNG, JPG, WEBP 파일을 업로드해 주세요.",
    );
  }

  const trimmedAltText = input.altText?.trim() || null;

  return prisma.$transaction(async (tx) => {
    const buyRequest = await tx.buyRequest.findFirst({
      where: {
        id: input.buyRequestId,
        buyerId: sessionUser.userId,
      },
      include: {
        images: true,
      },
    });

    if (!buyRequest) {
      throw new Error("구매글을 찾을 수 없습니다.");
    }

    const uploadsDirectory = path.join(
      process.cwd(),
      "public",
      "uploads",
      "buy-requests",
    );
    await mkdir(uploadsDirectory, { recursive: true });

    const nextFileName = `${buyRequest.id}-${Date.now()}.${extension}`;
    const absoluteStoragePath = path.join(uploadsDirectory, nextFileName);
    const publicImageUrl = `/uploads/buy-requests/${nextFileName}`;
    await writeFile(absoluteStoragePath, input.bytes);

    const nextSortOrder =
      buyRequest.images.reduce((max, image) => Math.max(max, image.sortOrder), -1) + 1;

    await tx.buyRequestImage.create({
      data: {
        buyRequestId: buyRequest.id,
        imageUrl: publicImageUrl,
        storagePath: absoluteStoragePath,
        altText: trimmedAltText,
        sortOrder: nextSortOrder,
      },
    });

    return {
      buyRequestId: buyRequest.id,
      imageUrl: publicImageUrl,
      altText: trimmedAltText,
      message: "본문 이미지가 추가되었습니다.",
    };
  });
}

function getImageExtension(fileName: string, contentType: string) {
  const normalizedType = contentType.toLowerCase();

  if (normalizedType === "image/png") {
    return "png";
  }

  if (normalizedType === "image/jpeg" || normalizedType === "image/jpg") {
    return "jpg";
  }

  if (normalizedType === "image/webp") {
    return "webp";
  }

  const loweredFileName = fileName.toLowerCase();

  if (loweredFileName.endsWith(".png")) {
    return "png";
  }

  if (loweredFileName.endsWith(".jpg") || loweredFileName.endsWith(".jpeg")) {
    return "jpg";
  }

  if (loweredFileName.endsWith(".webp")) {
    return "webp";
  }

  return null;
}

function isImageSignatureValid(
  bytes: Uint8Array,
  extension: "png" | "jpg" | "webp",
) {
  if (extension === "png") {
    return (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }

  if (extension === "jpg") {
    return (
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff
    );
  }

  return (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}
