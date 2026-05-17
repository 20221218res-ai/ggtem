import { copyFile, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

type UploadScope = "listings" | "buy-requests";

type UploadInput = {
  scope: UploadScope;
  fileName: string;
  contentType: string;
  bytes: Uint8Array;
};

type UploadResult = {
  publicUrl: string;
  storagePath: string;
};

const SUPABASE_STORAGE_PREFIX = "supabase://";

export async function saveUploadObject(input: UploadInput): Promise<UploadResult> {
  if (isSupabaseStorageConfigured()) {
    return saveSupabaseObject(input);
  }

  return saveLocalObject(input);
}

export async function deleteUploadObject(storagePath: string) {
  if (storagePath.startsWith(SUPABASE_STORAGE_PREFIX)) {
    await deleteSupabaseObject(storagePath);
    return;
  }

  if (isSafeLocalUploadPath(storagePath)) {
    await unlink(storagePath);
  }
}

export async function copyUploadObject(input: {
  sourceStoragePath: string;
  scope: UploadScope;
  fileName: string;
  contentType: string;
}): Promise<UploadResult> {
  if (input.sourceStoragePath.startsWith(SUPABASE_STORAGE_PREFIX)) {
    const bytes = await readSupabaseObject(input.sourceStoragePath);
    return saveUploadObject({
      scope: input.scope,
      fileName: input.fileName,
      contentType: input.contentType,
      bytes,
    });
  }

  if (isSupabaseStorageConfigured()) {
    const bytes = await readFile(input.sourceStoragePath);
    return saveUploadObject({
      scope: input.scope,
      fileName: input.fileName,
      contentType: input.contentType,
      bytes,
    });
  }

  const uploadsDirectory = getLocalUploadDirectory(input.scope);
  await mkdir(uploadsDirectory, { recursive: true });
  const absoluteStoragePath = path.join(uploadsDirectory, input.fileName);
  await copyFile(input.sourceStoragePath, absoluteStoragePath);

  return {
    publicUrl: `/uploads/${input.scope}/${input.fileName}`,
    storagePath: absoluteStoragePath,
  };
}

function isSupabaseStorageConfigured() {
  return Boolean(
    process.env.GGITEM_UPLOAD_STORAGE === "supabase" &&
      process.env.SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() &&
      getUploadBucket(),
  );
}

async function saveLocalObject(input: UploadInput): Promise<UploadResult> {
  const uploadsDirectory = getLocalUploadDirectory(input.scope);
  await mkdir(uploadsDirectory, { recursive: true });

  const absoluteStoragePath = path.join(uploadsDirectory, input.fileName);
  await writeFile(absoluteStoragePath, input.bytes);

  return {
    publicUrl: `/uploads/${input.scope}/${input.fileName}`,
    storagePath: absoluteStoragePath,
  };
}

async function saveSupabaseObject(input: UploadInput): Promise<UploadResult> {
  const bucket = getUploadBucket();
  const objectPath = `${input.scope}/${input.fileName}`;
  const baseUrl = getSupabaseUrl();
  const apiUrl = `${baseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeObjectPath(objectPath)}`;
  const body = input.bytes.buffer.slice(
    input.bytes.byteOffset,
    input.bytes.byteOffset + input.bytes.byteLength,
  ) as ArrayBuffer;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${getSupabaseServiceRoleKey()}`,
      "content-type": input.contentType || "application/octet-stream",
      "x-upsert": "false",
    },
    body,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`이미지 저장소 업로드에 실패했습니다. ${body.slice(0, 160)}`);
  }

  return {
    publicUrl: `${baseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodeObjectPath(objectPath)}`,
    storagePath: `${SUPABASE_STORAGE_PREFIX}${bucket}/${objectPath}`,
  };
}

async function deleteSupabaseObject(storagePath: string) {
  const parsed = parseSupabaseStoragePath(storagePath);
  if (!parsed) {
    return;
  }

  const response = await fetch(
    `${getSupabaseUrl()}/storage/v1/object/${encodeURIComponent(parsed.bucket)}`,
    {
      method: "DELETE",
      headers: {
        authorization: `Bearer ${getSupabaseServiceRoleKey()}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ prefixes: [parsed.objectPath] }),
    },
  );

  if (!response.ok && response.status !== 404) {
    throw new Error(`이미지 저장소 삭제에 실패했습니다. ${response.status}`);
  }
}

async function readSupabaseObject(storagePath: string) {
  const parsed = parseSupabaseStoragePath(storagePath);
  if (!parsed) {
    throw new Error("이미지 저장소 경로가 올바르지 않습니다.");
  }

  const response = await fetch(
    `${getSupabaseUrl()}/storage/v1/object/${encodeURIComponent(parsed.bucket)}/${encodeObjectPath(parsed.objectPath)}`,
    {
      headers: {
        authorization: `Bearer ${getSupabaseServiceRoleKey()}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`이미지 저장소 파일을 읽지 못했습니다. ${response.status}`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

function parseSupabaseStoragePath(storagePath: string) {
  if (!storagePath.startsWith(SUPABASE_STORAGE_PREFIX)) {
    return null;
  }

  const rawPath = storagePath.slice(SUPABASE_STORAGE_PREFIX.length);
  const [bucket, ...objectPathParts] = rawPath.split("/");
  const objectPath = objectPathParts.join("/");

  if (!bucket || !objectPath) {
    return null;
  }

  return { bucket, objectPath };
}

function getLocalUploadDirectory(scope: UploadScope) {
  return path.join(process.cwd(), "public", "uploads", scope);
}

function isSafeLocalUploadPath(storagePath: string) {
  const uploadsDirectory = path.resolve(process.cwd(), "public", "uploads");
  const resolvedStoragePath = path.resolve(storagePath);
  return (
    resolvedStoragePath.startsWith(`${uploadsDirectory}${path.sep}`) ||
    resolvedStoragePath === uploadsDirectory
  );
}

function getUploadBucket() {
  return process.env.GGITEM_UPLOAD_BUCKET?.trim() || "ggtem-uploads";
}

function getSupabaseUrl() {
  const url = process.env.SUPABASE_URL?.trim();
  if (!url) {
    throw new Error("SUPABASE_URL 환경변수가 필요합니다.");
  }
  return url.replace(/\/+$/, "");
}

function getSupabaseServiceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.");
  }
  return key;
}

function encodeObjectPath(objectPath: string) {
  return objectPath.split("/").map(encodeURIComponent).join("/");
}
