"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import path from "path";
import { mkdir, unlink, writeFile } from "fs/promises";
import type { Prisma } from "@/generated/prisma/client";
import { normalizeCatalogCode } from "@/lib/admin/game-settings";
import { ROLE_GROUPS, requirePageRole } from "@/lib/auth/guards";
import { getLocalizedGameNameInput } from "@/lib/market/game-localization";
import { getPrismaClient } from "@/lib/prisma";

const GAME_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

type NoticeKind =
  | "created-game"
  | "created-server"
  | "created-servers"
  | "created-note"
  | "updated"
  | "updated-game"
  | "updated-server";

export async function createGameAction(formData: FormData) {
  const admin = await requireCatalogAdmin();
  const name = getText(formData, "name");
  const code = normalizeCatalogCode(getText(formData, "code"));
  const moneyUnitName = normalizeMoneyUnitName(getText(formData, "moneyUnitName"));
  const localizedNames = getLocalizedGameNameInput(formData);
  const image = getFile(formData, "image");
  const imageAlt = getText(formData, "imageAlt") || name;

  if (!name || !code) {
    redirectWithError("게임명과 게임 코드를 모두 입력해야 합니다.");
  }

  const prisma = getPrismaClient();
  const duplicate = await prisma.game.findFirst({
    where: { OR: [{ name }, { code }] },
    select: { id: true },
  });

  if (duplicate) {
    redirectWithError("이미 같은 게임명 또는 게임 코드가 등록되어 있습니다.");
  }

  const game = await prisma.game.create({
    data: { name, code, moneyUnitName, ...localizedNames },
  });
  const uploadedImage = image ? await saveGameImage(game.id, image) : null;
  const createdGame = uploadedImage
    ? await prisma.game.update({
        where: { id: game.id },
        data: {
          imageUrl: uploadedImage.imageUrl,
          imageStoragePath: uploadedImage.storagePath,
          imageAlt,
        },
      })
    : game;

  await createCatalogAuditLog({
    adminId: admin.userId,
    action: "GAME_CREATED",
    targetType: "GAME",
    targetId: game.id,
    after: {
      name: createdGame.name,
      code: createdGame.code,
      moneyUnitName: createdGame.moneyUnitName,
      nameKo: createdGame.nameKo,
      nameCn: createdGame.nameCn,
      nameVn: createdGame.nameVn,
      namePh: createdGame.namePh,
      nameTh: createdGame.nameTh,
      imageUrl: createdGame.imageUrl,
      imageAlt: createdGame.imageAlt,
      isActive: createdGame.isActive,
    },
  });

  redirectWithNotice("created-game");
}

export async function createGameServerAction(formData: FormData) {
  const admin = await requireCatalogAdmin();
  const gameId = getText(formData, "gameId");
  const name = getText(formData, "name");
  const code = normalizeCatalogCode(getText(formData, "code"));

  if (!gameId || !name || !code) {
    redirectWithError("게임, 서버명, 서버 코드를 모두 입력해야 합니다.");
  }

  const prisma = getPrismaClient();
  const game = await prisma.game.findUnique({ where: { id: gameId }, select: { id: true } });

  if (!game) {
    redirectWithError("선택한 게임을 찾을 수 없습니다. 새로고침 후 다시 시도해 주세요.");
  }

  const duplicate = await prisma.gameServer.findFirst({
    where: { gameId, OR: [{ name }, { code }] },
    select: { id: true },
  });

  if (duplicate) {
    redirectWithError("해당 게임에 이미 같은 서버명 또는 서버 코드가 있습니다.");
  }

  const server = await prisma.gameServer.create({ data: { gameId, name, code } });

  await createCatalogAuditLog({
    adminId: admin.userId,
    action: "GAME_SERVER_CREATED",
    targetType: "GAME_SERVER",
    targetId: server.id,
    after: {
      gameId: server.gameId,
      name: server.name,
      code: server.code,
      isActive: server.isActive,
    },
  });

  redirectWithNotice("created-server");
}

export async function createGameServersBulkAction(formData: FormData) {
  const admin = await requireCatalogAdmin();
  const gameId = getText(formData, "bulkGameId");
  const rawServers = getText(formData, "servers");

  if (!gameId || !rawServers) {
    redirectWithError("게임과 서버 목록을 모두 입력해야 합니다.");
  }

  const parsedServers = parseServerLines(rawServers);

  if (parsedServers.length === 0) {
    redirectWithError("등록할 서버명을 1개 이상 입력해야 합니다.");
  }

  const uniqueCodes = new Set(parsedServers.map((server) => server.code));
  const uniqueNames = new Set(parsedServers.map((server) => server.name));

  if (uniqueCodes.size !== parsedServers.length || uniqueNames.size !== parsedServers.length) {
    redirectWithError("입력한 서버 목록 안에 중복된 서버명 또는 서버 코드가 있습니다.");
  }

  const prisma = getPrismaClient();
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, name: true },
  });

  if (!game) {
    redirectWithError("선택한 게임을 찾을 수 없습니다. 새로고침 후 다시 시도해 주세요.");
  }

  const duplicates = await prisma.gameServer.findMany({
    where: {
      gameId,
      OR: [
        { name: { in: parsedServers.map((server) => server.name) } },
        { code: { in: parsedServers.map((server) => server.code) } },
      ],
    },
    select: { name: true, code: true },
  });

  if (duplicates.length > 0) {
    redirectWithError(
      `이미 등록된 서버가 있습니다: ${duplicates
        .map((server) => `${server.name}(${server.code})`)
        .join(", ")}`,
    );
  }

  const created = await prisma.$transaction(
    parsedServers.map((server) =>
      prisma.gameServer.create({
        data: { gameId, name: server.name, code: server.code },
      }),
    ),
  );

  await createCatalogAuditLog({
    adminId: admin.userId,
    action: "GAME_SERVERS_BULK_CREATED",
    targetType: "GAME_SERVER",
    targetId: gameId,
    after: {
      gameId,
      gameName: game.name,
      count: created.length,
      servers: created.map((server) => ({
        id: server.id,
        name: server.name,
        code: server.code,
        isActive: server.isActive,
      })),
    },
  });

  redirectWithNotice("created-servers", {
    game: game.name,
    count: String(created.length),
    servers: created
      .slice(0, 8)
      .map((server) => server.name)
      .join(", "),
  });
}

export async function updateGameAction(formData: FormData) {
  const admin = await requireCatalogAdmin();
  const gameId = getText(formData, "gameId");
  const name = getText(formData, "name");
  const code = normalizeCatalogCode(getText(formData, "code"));
  const moneyUnitName = normalizeMoneyUnitName(getText(formData, "moneyUnitName"));
  const localizedNames = getLocalizedGameNameInput(formData);
  const image = getFile(formData, "image");
  const imageAlt = getText(formData, "imageAlt") || name;

  if (!gameId || !name || !code) {
    redirectWithError("수정할 게임, 게임명, 게임 코드를 모두 입력해야 합니다.");
  }

  const prisma = getPrismaClient();
  const [existing, duplicate] = await Promise.all([
    prisma.game.findUnique({
      where: { id: gameId },
      select: {
        id: true,
        name: true,
        code: true,
        moneyUnitName: true,
        nameKo: true,
        nameCn: true,
        nameVn: true,
        namePh: true,
        nameTh: true,
        imageUrl: true,
        imageStoragePath: true,
        imageAlt: true,
        isActive: true,
      },
    }),
    prisma.game.findFirst({
      where: { id: { not: gameId }, OR: [{ name }, { code }] },
      select: { id: true },
    }),
  ]);

  if (!existing) {
    redirectWithError("수정할 게임을 찾을 수 없습니다. 새로고침 후 다시 시도해 주세요.");
  }

  if (duplicate) {
    redirectWithError("이미 같은 게임명 또는 게임 코드가 등록되어 있습니다.");
  }

  const uploadedImage = image ? await saveGameImage(gameId, image) : null;
  const updated = await prisma.game.update({
    where: { id: gameId },
    data: {
      name,
      code,
      moneyUnitName,
      ...localizedNames,
      imageAlt: uploadedImage || existing.imageUrl ? imageAlt : existing.imageAlt,
      ...(uploadedImage
        ? {
            imageUrl: uploadedImage.imageUrl,
            imageStoragePath: uploadedImage.storagePath,
          }
        : {}),
    },
  });

  if (uploadedImage && existing.imageStoragePath) {
    await removeFileQuietly(existing.imageStoragePath);
  }

  await createCatalogAuditLog({
    adminId: admin.userId,
    action: "GAME_UPDATED",
    targetType: "GAME",
    targetId: updated.id,
    before: existing,
    after: {
      name: updated.name,
      code: updated.code,
      moneyUnitName: updated.moneyUnitName,
      nameKo: updated.nameKo,
      nameCn: updated.nameCn,
      nameVn: updated.nameVn,
      namePh: updated.namePh,
      nameTh: updated.nameTh,
      imageUrl: updated.imageUrl,
      imageAlt: updated.imageAlt,
      isActive: updated.isActive,
    },
  });

  redirectWithNotice("updated-game");
}

export async function updateGameServerAction(formData: FormData) {
  const admin = await requireCatalogAdmin();
  const serverId = getText(formData, "serverId");
  const name = getText(formData, "name");
  const code = normalizeCatalogCode(getText(formData, "code"));

  if (!serverId || !name || !code) {
    redirectWithError("수정할 서버, 서버명, 서버 코드를 모두 입력해야 합니다.");
  }

  const prisma = getPrismaClient();
  const server = await prisma.gameServer.findUnique({
    where: { id: serverId },
    select: { id: true, gameId: true, name: true, code: true, isActive: true },
  });

  if (!server) {
    redirectWithError("수정할 서버를 찾을 수 없습니다. 새로고침 후 다시 시도해 주세요.");
  }

  const duplicate = await prisma.gameServer.findFirst({
    where: { id: { not: serverId }, gameId: server.gameId, OR: [{ name }, { code }] },
    select: { id: true },
  });

  if (duplicate) {
    redirectWithError("해당 게임에 이미 같은 서버명 또는 서버 코드가 있습니다.");
  }

  const updated = await prisma.gameServer.update({
    where: { id: serverId },
    data: { name, code },
  });

  await createCatalogAuditLog({
    adminId: admin.userId,
    action: "GAME_SERVER_UPDATED",
    targetType: "GAME_SERVER",
    targetId: updated.id,
    before: server,
    after: {
      gameId: updated.gameId,
      name: updated.name,
      code: updated.code,
      isActive: updated.isActive,
    },
  });

  redirectWithNotice("updated-server");
}

export async function toggleGameActiveAction(formData: FormData) {
  const admin = await requireCatalogAdmin();
  const gameId = getText(formData, "gameId");
  const nextActive = getText(formData, "nextActive") === "true";

  if (!gameId) {
    redirectWithError("게임을 찾을 수 없습니다. 새로고침 후 다시 시도해 주세요.");
  }

  const prisma = getPrismaClient();
  const existing = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, name: true, code: true, isActive: true },
  });

  if (!existing) {
    redirectWithError("게임을 찾을 수 없습니다. 새로고침 후 다시 시도해 주세요.");
  }

  const updated = await prisma.game.update({
    where: { id: gameId },
    data: { isActive: nextActive },
  });

  await createCatalogAuditLog({
    adminId: admin.userId,
    action: nextActive ? "GAME_ACTIVATED" : "GAME_DEACTIVATED",
    targetType: "GAME",
    targetId: updated.id,
    before: existing,
    after: { name: updated.name, code: updated.code, isActive: updated.isActive },
  });

  redirectWithNotice("updated");
}

export async function toggleGameServerActiveAction(formData: FormData) {
  const admin = await requireCatalogAdmin();
  const serverId = getText(formData, "serverId");
  const nextActive = getText(formData, "nextActive") === "true";

  if (!serverId) {
    redirectWithError("서버를 찾을 수 없습니다. 새로고침 후 다시 시도해 주세요.");
  }

  const prisma = getPrismaClient();
  const existing = await prisma.gameServer.findUnique({
    where: { id: serverId },
    select: { id: true, gameId: true, name: true, code: true, isActive: true },
  });

  if (!existing) {
    redirectWithError("서버를 찾을 수 없습니다. 새로고침 후 다시 시도해 주세요.");
  }

  const updated = await prisma.gameServer.update({
    where: { id: serverId },
    data: { isActive: nextActive },
  });

  await createCatalogAuditLog({
    adminId: admin.userId,
    action: nextActive ? "GAME_SERVER_ACTIVATED" : "GAME_SERVER_DEACTIVATED",
    targetType: "GAME_SERVER",
    targetId: updated.id,
    before: existing,
    after: {
      gameId: updated.gameId,
      name: updated.name,
      code: updated.code,
      isActive: updated.isActive,
    },
  });

  redirectWithNotice("updated");
}

export async function createAdminGameNoteAction(formData: FormData) {
  const admin = await requireCatalogAdmin();
  const gameId = getText(formData, "gameId");
  const body = getText(formData, "body");

  if (!gameId || !body) {
    redirectWithError("메모를 남길 게임과 내용을 모두 입력해야 합니다.");
  }

  if (body.length > 1000) {
    redirectWithError("운영 메모는 1,000자 이하로 입력해 주세요.");
  }

  const prisma = getPrismaClient();
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    select: { id: true, name: true, code: true },
  });

  if (!game) {
    redirectWithError("메모를 남길 게임을 찾을 수 없습니다. 새로고침 후 다시 시도해 주세요.");
  }

  const note = await prisma.adminGameNote.create({
    data: { gameId, adminId: admin.userId, body },
  });

  await createCatalogAuditLog({
    adminId: admin.userId,
    action: "GAME_NOTE_CREATED",
    targetType: "GAME",
    targetId: game.id,
    after: {
      gameId: game.id,
      gameName: game.name,
      gameCode: game.code,
      noteId: note.id,
      bodyPreview: body.slice(0, 120),
    },
  });

  redirectWithNotice("created-note");
}

async function requireCatalogAdmin() {
  return requirePageRole(ROLE_GROUPS.PLATFORM_ADMINS, {
    signInPath: "/admin/sign-in",
    forbiddenPath: "/admin/sign-in",
  });
}

function getText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getFile(formData: FormData, key: string) {
  const value = formData.get(key);

  if (!(value instanceof File) || value.size === 0) {
    return null;
  }

  return value;
}

function normalizeMoneyUnitName(value: string) {
  return value.trim() || "게임머니";
}

async function saveGameImage(gameId: string, image: File) {
  const extension = getGameImageExtension(image.name, image.type);

  if (!extension) {
    throw new Error("게임 이미지는 PNG, JPG, JPEG, WEBP 파일만 사용할 수 있습니다.");
  }

  const bytes = new Uint8Array(await image.arrayBuffer());

  if (bytes.byteLength === 0) {
    throw new Error("이미지 파일이 비어 있습니다.");
  }

  if (bytes.byteLength > GAME_IMAGE_MAX_BYTES) {
    throw new Error("게임 이미지는 5MB 이하만 사용할 수 있습니다.");
  }

  if (!isGameImageSignatureValid(bytes, extension)) {
    throw new Error("이미지 파일 형식이 올바르지 않습니다. 실제 PNG, JPG, WEBP 파일을 업로드해 주세요.");
  }

  const uploadsDirectory = path.join(process.cwd(), "public", "uploads", "games");
  await mkdir(uploadsDirectory, { recursive: true });

  const nextFileName = `${gameId}-${Date.now()}.${extension}`;
  const storagePath = path.join(uploadsDirectory, nextFileName);
  const imageUrl = `/uploads/games/${nextFileName}`;
  await writeFile(storagePath, bytes);

  return { imageUrl, storagePath };
}

function getGameImageExtension(fileName: string, contentType: string) {
  const normalizedType = contentType.toLowerCase();
  const extensionFromName = path.extname(fileName).toLowerCase().replace(".", "");

  if (normalizedType === "image/png") return "png";
  if (normalizedType === "image/jpeg" || normalizedType === "image/jpg") return "jpg";
  if (normalizedType === "image/webp") return "webp";

  if (["png", "jpg", "jpeg", "webp"].includes(extensionFromName)) {
    return extensionFromName === "jpeg" ? "jpg" : extensionFromName;
  }

  return null;
}

function isGameImageSignatureValid(bytes: Uint8Array, extension: string) {
  if (extension === "png") {
    return (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47
    );
  }

  if (extension === "jpg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
  }

  if (extension === "webp") {
    return (
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

  return false;
}

async function removeFileQuietly(storagePath: string) {
  try {
    await unlink(storagePath);
  } catch {
    return;
  }
}

function parseServerLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [rawName, rawCode] = line
        .split(/[,|\t]/)
        .map((item) => item.trim())
        .filter(Boolean);
      const name = rawName ?? "";
      const code = normalizeCatalogCode(rawCode || name);

      return { name, code };
    })
    .filter((server) => server.name && server.code);
}

function redirectWithNotice(kind: NoticeKind, details?: Record<string, string>): never {
  revalidatePath("/admin/game-settings");
  const params = new URLSearchParams({ notice: kind });

  for (const [key, value] of Object.entries(details ?? {})) {
    if (value) params.set(key, value);
  }

  redirect(`/admin/game-settings?${params.toString()}`);
}

function redirectWithError(message: string): never {
  redirect(`/admin/game-settings?error=${encodeURIComponent(message)}`);
}

async function createCatalogAuditLog(input: {
  adminId: string;
  action: string;
  targetType: "GAME" | "GAME_SERVER";
  targetId: string;
  before?: Prisma.InputJsonValue | null;
  after: Prisma.InputJsonValue;
}) {
  const prisma = getPrismaClient();

  await prisma.adminAuditLog.create({
    data: {
      adminId: input.adminId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      before: input.before ?? undefined,
      after: input.after,
      reason: "관리자가 게임/서버 카탈로그 설정을 변경했습니다.",
    },
  });
}
