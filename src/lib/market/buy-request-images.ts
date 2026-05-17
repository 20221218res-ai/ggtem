import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getCurrentSessionUser } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/prisma";

const BUY_REQUEST_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const BUY_REQUEST_IMAGE_MAX_COUNT = 8;

export type MarketplaceBuyRequestImageMutationResult = {
  buyRequestId: string;
  imageId: string | null;
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

    if (buyRequest.images.length >= BUY_REQUEST_IMAGE_MAX_COUNT) {
      throw new Error(`본문 이미지는 최대 ${BUY_REQUEST_IMAGE_MAX_COUNT}장까지 업로드할 수 있습니다.`);
    }

    const uploadsDirectory = path.join(
      process.cwd(),
      "public",
      "uploads",
      "buy-requests",
    );
    await mkdir(uploadsDirectory, { recursive: true });

    const nextFileName = `${buyRequest.id}-${randomUUID()}.${extension}`;
    const absoluteStoragePath = path.join(uploadsDirectory, nextFileName);
    const publicImageUrl = `/uploads/buy-requests/${nextFileName}`;
    await writeFile(absoluteStoragePath, input.bytes);

    const nextSortOrder =
      buyRequest.images.reduce((max, image) => Math.max(max, image.sortOrder), -1) + 1;

    const createdImage = await tx.buyRequestImage.create({
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
      imageId: createdImage.id,
      imageUrl: publicImageUrl,
      altText: trimmedAltText,
      message: "본문 이미지가 추가되었습니다.",
    };
  });
}

export async function removeMarketplaceBuyRequestImage(input: {
  buyRequestId: string;
  imageId: string;
}): Promise<MarketplaceBuyRequestImageMutationResult> {
  const prisma = getPrismaClient();
  const sessionUser = await getCurrentSessionUser();

  if (!sessionUser) {
    throw new Error("로그인이 필요합니다.");
  }

  return prisma.$transaction(async (tx) => {
    const buyRequest = await tx.buyRequest.findFirst({
      where: {
        id: input.buyRequestId,
        buyerId: sessionUser.userId,
        status: "ACTIVE",
      },
      include: {
        images: true,
      },
    });

    if (!buyRequest) {
      throw new Error("구매글을 찾을 수 없습니다.");
    }

    const imageToDelete = buyRequest.images.find((image) => image.id === input.imageId);

    if (!imageToDelete) {
      throw new Error("삭제할 본문 이미지를 찾을 수 없습니다.");
    }

    await tx.buyRequestImage.delete({
      where: {
        id: imageToDelete.id,
      },
    });

    try {
      if (isSafeBuyRequestUploadPath(imageToDelete.storagePath)) {
        await unlink(imageToDelete.storagePath);
      }
    } catch {
      // The database row is the source of truth; missing local files should not block cleanup.
    }

    return {
      buyRequestId: buyRequest.id,
      imageId: imageToDelete.id,
      imageUrl: null,
      altText: null,
      message: "본문 이미지가 삭제되었습니다.",
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

function isSafeBuyRequestUploadPath(storagePath: string) {
  const uploadsDirectory = path.resolve(
    process.cwd(),
    "public",
    "uploads",
    "buy-requests",
  );
  const resolvedStoragePath = path.resolve(storagePath);
  return (
    resolvedStoragePath.startsWith(`${uploadsDirectory}${path.sep}`) ||
    resolvedStoragePath === uploadsDirectory
  );
}
