import type { PrismaClient } from "@/generated/prisma/client";

export type ResolvedGameNameFilter = {
  input: string;
  gameName: string;
  gameCode: string | null;
};

export async function resolveGameNameFilter(
  prisma: PrismaClient,
  value?: string | null,
): Promise<ResolvedGameNameFilter> {
  const input = value?.trim() ?? "";

  if (!input) {
    return {
      input,
      gameName: "",
      gameCode: null,
    };
  }

  const game = await prisma.game.findFirst({
    where: {
      isActive: true,
      OR: [
        { name: { equals: input, mode: "insensitive" } },
        { code: { equals: input, mode: "insensitive" } },
        { nameKo: { equals: input, mode: "insensitive" } },
        { nameCn: { equals: input, mode: "insensitive" } },
        { nameVn: { equals: input, mode: "insensitive" } },
        { namePh: { equals: input, mode: "insensitive" } },
        { nameTh: { equals: input, mode: "insensitive" } },
      ],
    },
    select: {
      name: true,
      code: true,
    },
  });

  return {
    input,
    gameName: game?.name ?? input,
    gameCode: game?.code ?? null,
  };
}
