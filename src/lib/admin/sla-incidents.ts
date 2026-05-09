import { getPrismaClient } from "@/lib/prisma";

export type AdminSlaIncidentActionResult = {
  incidentId: string;
  noteId?: string;
  message: string;
};

export type AdminSlaIncidentsState = {
  summary: {
    totalIncidents: number;
    openIncidents: number;
    acknowledgedOpenIncidents: number;
    resolvedIncidents: number;
    shownIncidents: number;
  };
  filters: {
    status: string;
    queue: string;
    priority: string;
    query: string;
    sort: string;
  };
  queueStats: Array<{
    queueKey: string;
    totalIncidents: number;
    openIncidents: number;
    acknowledgedOpenIncidents: number;
    resolvedIncidents: number;
    averageResolutionHours: string;
  }>;
  operatorStats: Array<{
    operatorId: string;
    operatorName: string;
    operatorEmail: string;
    acknowledgedCount: number;
    openAcknowledgedCount: number;
    resolvedAcknowledgedCount: number;
    lastAcknowledgedAt: string;
  }>;
  incidents: Array<{
    incidentId: string;
    queueKey: string;
    label: string;
    status: string;
    priority: string;
    priorityScore: number;
    slaLabel: string;
    previewLabel: string;
    href: string;
    acknowledgedAt: string | null;
    acknowledgedBy: string | null;
    firstDetectedAt: string;
    lastDetectedAt: string;
    resolvedAt: string | null;
    elapsedTime: string;
    resolutionTime: string | null;
    notes: Array<{
      noteId: string;
      body: string;
      adminName: string;
      adminEmail: string;
      createdAt: string;
    }>;
  }>;
};

export type AdminSlaIncidentDetail = {
  incidentId: string;
  queueKey: string;
  activeKey: string | null;
  label: string;
  status: string;
  priority: string;
  priorityScore: number;
  slaLabel: string;
  previewLabel: string;
  href: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  firstDetectedAt: string;
  lastDetectedAt: string;
  resolvedAt: string | null;
  elapsedTime: string;
  resolutionTime: string | null;
  notes: Array<{
    noteId: string;
    body: string;
    adminName: string;
    adminEmail: string;
    createdAt: string;
  }>;
  auditLogs: Array<{
    auditLogId: string;
    action: string;
    reason: string | null;
    adminName: string;
    adminEmail: string;
    createdAt: string;
  }>;
};

export type AdminSlaIncidentFilters = {
  status?: string | null;
  queue?: string | null;
  priority?: string | null;
  query?: string | null;
  sort?: string | null;
};

export type AdminSlaIncidentExportRow = {
  incidentId: string;
  queueKey: string;
  label: string;
  status: string;
  priority: string;
  priorityScore: number;
  slaLabel: string;
  previewLabel: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  firstDetectedAt: string;
  lastDetectedAt: string;
  resolvedAt: string | null;
  elapsedTime: string;
  resolutionTime: string | null;
  href: string;
};

export async function getAdminSlaIncidentsState(filters?: {
  status?: string | null;
  queue?: string | null;
  priority?: string | null;
  query?: string | null;
  sort?: string | null;
}): Promise<AdminSlaIncidentsState> {
  const prisma = getPrismaClient();
  const normalizedFilters = normalizeSlaIncidentFilters(filters);
  const where = buildIncidentWhere(normalizedFilters);

  const [
    incidents,
    totalIncidents,
    openIncidents,
    acknowledgedOpenIncidents,
    resolvedIncidents,
    allIncidentsForStats,
    operatorStats,
  ] = await Promise.all([
    prisma.adminSlaIncident.findMany({
      where,
      orderBy: buildIncidentOrderBy(normalizedFilters.sort),
      include: {
        notes: {
          orderBy: {
            createdAt: "desc",
          },
          take: 3,
          include: {
            admin: {
              select: {
                displayName: true,
                email: true,
              },
            },
          },
        },
      },
      take: 100,
    }),
    prisma.adminSlaIncident.count(),
    prisma.adminSlaIncident.count({
      where: {
        status: "OPEN",
        acknowledgedAt: null,
      },
    }),
    prisma.adminSlaIncident.count({
      where: {
        status: "OPEN",
        acknowledgedAt: {
          not: null,
        },
      },
    }),
    prisma.adminSlaIncident.count({
      where: {
        status: "RESOLVED",
      },
    }),
    prisma.adminSlaIncident.findMany({
      select: {
        queueKey: true,
        status: true,
        acknowledgedAt: true,
        firstDetectedAt: true,
        resolvedAt: true,
      },
    }),
    buildOperatorStats(),
  ]);

  return {
    summary: {
      totalIncidents,
      openIncidents,
      acknowledgedOpenIncidents,
      resolvedIncidents,
      shownIncidents: incidents.length,
    },
    filters: {
      status: normalizedFilters.status,
      queue: normalizedFilters.queue,
      priority: normalizedFilters.priority,
      query: normalizedFilters.query,
      sort: normalizedFilters.sort,
    },
    queueStats: buildQueueStats(allIncidentsForStats),
    operatorStats,
    incidents: incidents.map((incident) => ({
      incidentId: incident.id,
      queueKey: incident.queueKey,
      label: incident.label,
      status: incident.status,
      priority: incident.priority,
      priorityScore: incident.priorityScore,
      slaLabel: incident.slaLabel,
      previewLabel: incident.previewLabel,
      href: incident.href,
      acknowledgedAt: incident.acknowledgedAt
        ? formatKoreanDate(incident.acknowledgedAt)
        : null,
      acknowledgedBy: incident.acknowledgedBy,
      firstDetectedAt: formatKoreanDate(incident.firstDetectedAt),
      lastDetectedAt: formatKoreanDate(incident.lastDetectedAt),
      resolvedAt: incident.resolvedAt
        ? formatKoreanDate(incident.resolvedAt)
        : null,
      elapsedTime: formatIncidentElapsedTime(incident.firstDetectedAt),
      resolutionTime: incident.resolvedAt
        ? formatDurationLabel(incident.resolvedAt, incident.firstDetectedAt)
        : null,
      notes: incident.notes.map((note) => ({
        noteId: note.id,
        body: note.body,
        adminName: note.admin.displayName,
        adminEmail: note.admin.email,
        createdAt: formatKoreanDate(note.createdAt),
      })),
    })),
  };
}

export async function getAdminSlaIncidentExportRows(
  filters?: AdminSlaIncidentFilters,
): Promise<AdminSlaIncidentExportRow[]> {
  const prisma = getPrismaClient();
  const normalizedFilters = normalizeSlaIncidentFilters(filters);
  const incidents = await prisma.adminSlaIncident.findMany({
    where: buildIncidentWhere(normalizedFilters),
    orderBy: buildIncidentOrderBy(normalizedFilters.sort),
    take: 1000,
  });

  return incidents.map((incident) => ({
    incidentId: incident.id,
    queueKey: incident.queueKey,
    label: incident.label,
    status: incident.status,
    priority: incident.priority,
    priorityScore: incident.priorityScore,
    slaLabel: incident.slaLabel,
    previewLabel: incident.previewLabel,
    acknowledgedAt: incident.acknowledgedAt
      ? formatKoreanDate(incident.acknowledgedAt)
      : null,
    acknowledgedBy: incident.acknowledgedBy,
    firstDetectedAt: formatKoreanDate(incident.firstDetectedAt),
    lastDetectedAt: formatKoreanDate(incident.lastDetectedAt),
    resolvedAt: incident.resolvedAt
      ? formatKoreanDate(incident.resolvedAt)
      : null,
    elapsedTime: formatIncidentElapsedTime(incident.firstDetectedAt),
    resolutionTime: incident.resolvedAt
      ? formatDurationLabel(incident.resolvedAt, incident.firstDetectedAt)
      : null,
    href: incident.href,
  }));
}

export async function getAdminSlaIncidentDetail(
  incidentId: string,
): Promise<AdminSlaIncidentDetail | null> {
  const prisma = getPrismaClient();
  const incident = await prisma.adminSlaIncident.findUnique({
    where: {
      id: incidentId,
    },
    include: {
      notes: {
        orderBy: {
          createdAt: "desc",
        },
        include: {
          admin: {
            select: {
              displayName: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!incident) {
    return null;
  }

  const auditLogs = await prisma.adminAuditLog.findMany({
    where: {
      targetType: "ADMIN_SLA_INCIDENT",
      targetId: incident.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
    include: {
      admin: {
        select: {
          displayName: true,
          email: true,
        },
      },
    },
  });

  return {
    incidentId: incident.id,
    queueKey: incident.queueKey,
    activeKey: incident.activeKey,
    label: incident.label,
    status: incident.status,
    priority: incident.priority,
    priorityScore: incident.priorityScore,
    slaLabel: incident.slaLabel,
    previewLabel: incident.previewLabel,
    href: incident.href,
    acknowledgedAt: incident.acknowledgedAt
      ? formatKoreanDate(incident.acknowledgedAt)
      : null,
    acknowledgedBy: incident.acknowledgedBy,
    firstDetectedAt: formatKoreanDate(incident.firstDetectedAt),
    lastDetectedAt: formatKoreanDate(incident.lastDetectedAt),
    resolvedAt: incident.resolvedAt
      ? formatKoreanDate(incident.resolvedAt)
      : null,
    elapsedTime: formatIncidentElapsedTime(incident.firstDetectedAt),
    resolutionTime: incident.resolvedAt
      ? formatDurationLabel(incident.resolvedAt, incident.firstDetectedAt)
      : null,
    notes: incident.notes.map((note) => ({
      noteId: note.id,
      body: note.body,
      adminName: note.admin.displayName,
      adminEmail: note.admin.email,
      createdAt: formatKoreanDate(note.createdAt),
    })),
    auditLogs: auditLogs.map((log) => ({
      auditLogId: log.id,
      action: log.action,
      reason: log.reason,
      adminName: log.admin?.displayName ?? "System",
      adminEmail: log.admin?.email ?? "system",
      createdAt: formatKoreanDate(log.createdAt),
    })),
  };
}

async function buildOperatorStats() {
  const prisma = getPrismaClient();
  const acknowledgedIncidents = await prisma.adminSlaIncident.findMany({
    where: {
      acknowledgedBy: {
        not: null,
      },
      acknowledgedAt: {
        not: null,
      },
    },
    select: {
      acknowledgedBy: true,
      acknowledgedAt: true,
      status: true,
    },
  });

  const operatorIds = Array.from(
    new Set(
      acknowledgedIncidents
        .map((incident) => incident.acknowledgedBy)
        .filter((operatorId): operatorId is string => Boolean(operatorId)),
    ),
  );

  if (operatorIds.length === 0) {
    return [];
  }

  const operators = await prisma.user.findMany({
    where: {
      id: {
        in: operatorIds,
      },
    },
    select: {
      id: true,
      displayName: true,
      email: true,
    },
  });

  const operatorMap = new Map(
    operators.map((operator) => [operator.id, operator]),
  );
  const stats = new Map<
    string,
    {
      operatorId: string;
      operatorName: string;
      operatorEmail: string;
      acknowledgedCount: number;
      openAcknowledgedCount: number;
      resolvedAcknowledgedCount: number;
      lastAcknowledgedAt: Date;
    }
  >();

  for (const incident of acknowledgedIncidents) {
    if (!incident.acknowledgedBy || !incident.acknowledgedAt) {
      continue;
    }

    const operator = operatorMap.get(incident.acknowledgedBy);
    const current =
      stats.get(incident.acknowledgedBy) ??
      {
        operatorId: incident.acknowledgedBy,
        operatorName: operator?.displayName ?? "Unknown operator",
        operatorEmail: operator?.email ?? "unknown",
        acknowledgedCount: 0,
        openAcknowledgedCount: 0,
        resolvedAcknowledgedCount: 0,
        lastAcknowledgedAt: incident.acknowledgedAt,
      };

    current.acknowledgedCount += 1;

    if (incident.status === "OPEN") {
      current.openAcknowledgedCount += 1;
    }

    if (incident.status === "RESOLVED") {
      current.resolvedAcknowledgedCount += 1;
    }

    if (incident.acknowledgedAt > current.lastAcknowledgedAt) {
      current.lastAcknowledgedAt = incident.acknowledgedAt;
    }

    stats.set(incident.acknowledgedBy, current);
  }

  return Array.from(stats.values())
    .sort((left, right) => {
      if (right.acknowledgedCount !== left.acknowledgedCount) {
        return right.acknowledgedCount - left.acknowledgedCount;
      }

      return right.lastAcknowledgedAt.getTime() - left.lastAcknowledgedAt.getTime();
    })
    .slice(0, 8)
    .map((item) => ({
      operatorId: item.operatorId,
      operatorName: item.operatorName,
      operatorEmail: item.operatorEmail,
      acknowledgedCount: item.acknowledgedCount,
      openAcknowledgedCount: item.openAcknowledgedCount,
      resolvedAcknowledgedCount: item.resolvedAcknowledgedCount,
      lastAcknowledgedAt: formatKoreanDate(item.lastAcknowledgedAt),
    }));
}

function buildQueueStats(
  incidents: Array<{
    queueKey: string;
    status: string;
    acknowledgedAt: Date | null;
    firstDetectedAt: Date;
    resolvedAt: Date | null;
  }>,
) {
  const stats = new Map<
    string,
    {
      queueKey: string;
      totalIncidents: number;
      openIncidents: number;
      acknowledgedOpenIncidents: number;
      resolvedIncidents: number;
      totalResolutionHours: number;
    }
  >();

  for (const incident of incidents) {
    const current =
      stats.get(incident.queueKey) ??
      {
        queueKey: incident.queueKey,
        totalIncidents: 0,
        openIncidents: 0,
        acknowledgedOpenIncidents: 0,
        resolvedIncidents: 0,
        totalResolutionHours: 0,
      };

    current.totalIncidents += 1;

    if (incident.status === "OPEN" && incident.acknowledgedAt) {
      current.acknowledgedOpenIncidents += 1;
    } else if (incident.status === "OPEN") {
      current.openIncidents += 1;
    }

    if (incident.status === "RESOLVED" && incident.resolvedAt) {
      current.resolvedIncidents += 1;
      current.totalResolutionHours +=
        (incident.resolvedAt.getTime() - incident.firstDetectedAt.getTime()) /
        3_600_000;
    }

    stats.set(incident.queueKey, current);
  }

  return Array.from(stats.values())
    .sort((left, right) => right.totalIncidents - left.totalIncidents)
    .map((item) => ({
      queueKey: item.queueKey,
      totalIncidents: item.totalIncidents,
      openIncidents: item.openIncidents,
      acknowledgedOpenIncidents: item.acknowledgedOpenIncidents,
      resolvedIncidents: item.resolvedIncidents,
      averageResolutionHours:
        item.resolvedIncidents > 0
          ? (item.totalResolutionHours / item.resolvedIncidents).toFixed(1)
          : "N/A",
    }));
}

export async function acknowledgeSlaIncident(input: {
  actorId: string;
  incidentId: string;
}): Promise<AdminSlaIncidentActionResult> {
  const prisma = getPrismaClient();

  const incident = await prisma.adminSlaIncident.findUnique({
    where: {
      id: input.incidentId,
    },
  });

  if (!incident) {
    throw new Error("SLA 인시던트를 찾을 수 없습니다.");
  }

  if (incident.status !== "OPEN") {
    throw new Error("열린 SLA 인시던트만 확인 처리할 수 있습니다.");
  }

  if (incident.acknowledgedAt) {
    return {
      incidentId: incident.id,
      message: "이미 확인 처리된 SLA 인시던트입니다.",
    };
  }

  const updatedIncident = await prisma.$transaction(async (tx) => {
    const updated = await tx.adminSlaIncident.update({
      where: {
        id: incident.id,
      },
      data: {
        acknowledgedAt: new Date(),
        acknowledgedBy: input.actorId,
      },
    });

    await tx.adminAuditLog.create({
      data: {
        adminId: input.actorId,
        action: "SLA_INCIDENT_ACKNOWLEDGED",
        targetType: "ADMIN_SLA_INCIDENT",
        targetId: incident.id,
        reason: `${incident.label} 확인 처리`,
        before: {
          acknowledgedAt: incident.acknowledgedAt,
          status: incident.status,
        },
        after: {
          acknowledgedAt: updated.acknowledgedAt,
          status: updated.status,
        },
      },
    });

    return updated;
  });

  return {
    incidentId: updatedIncident.id,
    message: "SLA 인시던트를 확인 처리했습니다.",
  };
}

export async function createSlaIncidentNote(input: {
  actorId: string;
  incidentId: string;
  body: string;
}): Promise<AdminSlaIncidentActionResult> {
  const prisma = getPrismaClient();
  const body = input.body.trim();

  if (body.length < 3) {
    throw new Error("SLA 인시던트 메모는 3자 이상 입력해야 합니다.");
  }

  if (body.length > 1000) {
    throw new Error("SLA 인시던트 메모는 1000자 이하로 입력해야 합니다.");
  }

  const incident = await prisma.adminSlaIncident.findUnique({
    where: {
      id: input.incidentId,
    },
  });

  if (!incident) {
    throw new Error("SLA 인시던트를 찾을 수 없습니다.");
  }

  const note = await prisma.$transaction(async (tx) => {
    const createdNote = await tx.adminSlaIncidentNote.create({
      data: {
        incidentId: incident.id,
        adminId: input.actorId,
        body,
      },
    });

    await tx.adminAuditLog.create({
      data: {
        adminId: input.actorId,
        action: "SLA_INCIDENT_NOTE_CREATED",
        targetType: "ADMIN_SLA_INCIDENT",
        targetId: incident.id,
        reason: body,
        after: {
          noteId: createdNote.id,
          incidentLabel: incident.label,
        },
      },
    });

    return createdNote;
  });

  return {
    incidentId: incident.id,
    noteId: note.id,
    message: "SLA 인시던트 메모를 추가했습니다.",
  };
}

export async function resolveSlaIncident(input: {
  actorId: string;
  incidentId: string;
  note?: string;
}): Promise<AdminSlaIncidentActionResult> {
  const prisma = getPrismaClient();
  const note = input.note?.trim() ?? "";

  if (note.length > 1000) {
    throw new Error("SLA 인시던트 해결 메모는 1000자 이하로 입력해야 합니다.");
  }

  if (note.length < 3) {
    throw new Error("SLA 인시던트 해결 메모는 3자 이상 입력해야 합니다.");
  }

  const incident = await prisma.adminSlaIncident.findUnique({
    where: {
      id: input.incidentId,
    },
  });

  if (!incident) {
    throw new Error("SLA 인시던트를 찾을 수 없습니다.");
  }

  if (incident.status !== "OPEN") {
    throw new Error("열린 SLA 인시던트만 해결 처리할 수 있습니다.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const resolvedAt = new Date();
    const updatedIncident = await tx.adminSlaIncident.update({
      where: {
        id: incident.id,
      },
      data: {
        status: "RESOLVED",
        activeKey: null,
        resolvedAt,
        acknowledgedAt: incident.acknowledgedAt ?? resolvedAt,
        acknowledgedBy: incident.acknowledgedBy ?? input.actorId,
      },
    });

    const createdNote = await tx.adminSlaIncidentNote.create({
      data: {
        incidentId: incident.id,
        adminId: input.actorId,
        body: note,
      },
    });

    await tx.adminAuditLog.create({
      data: {
        adminId: input.actorId,
        action: "SLA_INCIDENT_RESOLVED",
        targetType: "ADMIN_SLA_INCIDENT",
        targetId: incident.id,
        reason: note || `${incident.label} 해결 처리`,
        before: {
          activeKey: incident.activeKey,
          acknowledgedAt: incident.acknowledgedAt,
          acknowledgedBy: incident.acknowledgedBy,
          resolvedAt: incident.resolvedAt,
          status: incident.status,
        },
        after: {
          activeKey: updatedIncident.activeKey,
          acknowledgedAt: updatedIncident.acknowledgedAt,
          acknowledgedBy: updatedIncident.acknowledgedBy,
          noteId: createdNote?.id ?? null,
          resolvedAt: updatedIncident.resolvedAt,
          status: updatedIncident.status,
        },
      },
    });

    return {
      incident: updatedIncident,
      note: createdNote,
    };
  });

  return {
    incidentId: result.incident.id,
    noteId: result.note?.id,
    message: "SLA 인시던트를 해결 처리했습니다.",
  };
}

export async function reopenSlaIncident(input: {
  actorId: string;
  incidentId: string;
  note?: string;
}): Promise<AdminSlaIncidentActionResult> {
  const prisma = getPrismaClient();
  const note = input.note?.trim() ?? "";

  if (note.length > 1000) {
    throw new Error("SLA 인시던트 재오픈 메모는 1000자 이하로 입력해야 합니다.");
  }

  if (note.length < 3) {
    throw new Error("SLA 인시던트 재오픈 메모는 3자 이상 입력해야 합니다.");
  }

  const incident = await prisma.adminSlaIncident.findUnique({
    where: {
      id: input.incidentId,
    },
  });

  if (!incident) {
    throw new Error("SLA 인시던트를 찾을 수 없습니다.");
  }

  if (incident.status !== "RESOLVED") {
    throw new Error("해결된 SLA 인시던트만 다시 열 수 있습니다.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const updatedIncident = await tx.adminSlaIncident.update({
      where: {
        id: incident.id,
      },
      data: {
        status: "OPEN",
        resolvedAt: null,
      },
    });

    const createdNote = await tx.adminSlaIncidentNote.create({
      data: {
        incidentId: incident.id,
        adminId: input.actorId,
        body: note,
      },
    });

    await tx.adminAuditLog.create({
      data: {
        adminId: input.actorId,
        action: "SLA_INCIDENT_REOPENED",
        targetType: "ADMIN_SLA_INCIDENT",
        targetId: incident.id,
        reason: note || `${incident.label} 재오픈`,
        before: {
          acknowledgedAt: incident.acknowledgedAt,
          acknowledgedBy: incident.acknowledgedBy,
          resolvedAt: incident.resolvedAt,
          status: incident.status,
        },
        after: {
          acknowledgedAt: updatedIncident.acknowledgedAt,
          acknowledgedBy: updatedIncident.acknowledgedBy,
          noteId: createdNote?.id ?? null,
          resolvedAt: updatedIncident.resolvedAt,
          status: updatedIncident.status,
        },
      },
    });

    return {
      incident: updatedIncident,
      note: createdNote,
    };
  });

  return {
    incidentId: result.incident.id,
    noteId: result.note?.id,
    message: "SLA 인시던트를 다시 열었습니다.",
  };
}

function normalizeStatusFilter(status?: string | null) {
  const value = status?.trim().toUpperCase() || "OPEN";
  return ["ALL", "OPEN", "ACKNOWLEDGED", "RESOLVED"].includes(value)
    ? value
    : "OPEN";
}

function normalizeSlaIncidentFilters(filters?: AdminSlaIncidentFilters) {
  return {
    status: normalizeStatusFilter(filters?.status),
    queue: filters?.queue?.trim() ?? "",
    priority: normalizePriorityFilter(filters?.priority),
    query: filters?.query?.trim() ?? "",
    sort: normalizeSortFilter(filters?.sort),
  };
}

function buildIncidentWhere(filters: ReturnType<typeof normalizeSlaIncidentFilters>) {
  return {
    ...(filters.status === "OPEN"
      ? { status: "OPEN", acknowledgedAt: null }
      : {}),
    ...(filters.status === "ACKNOWLEDGED"
      ? {
          status: "OPEN",
          acknowledgedAt: {
            not: null,
          },
        }
      : {}),
    ...(filters.status === "RESOLVED" ? { status: "RESOLVED" } : {}),
    ...(filters.queue ? { queueKey: filters.queue } : {}),
    ...(filters.priority !== "ALL" ? { priority: filters.priority } : {}),
    ...(filters.query
      ? {
          OR: [
            {
              label: {
                contains: filters.query,
              },
            },
            {
              previewLabel: {
                contains: filters.query,
              },
            },
            {
              queueKey: {
                contains: filters.query,
              },
            },
          ],
        }
      : {}),
  };
}

function normalizePriorityFilter(priority?: string | null) {
  const value = priority?.trim().toUpperCase() || "ALL";
  return ["ALL", "HIGH", "MEDIUM", "LOW"].includes(value) ? value : "ALL";
}

function normalizeSortFilter(sort?: string | null) {
  const value = sort?.trim().toUpperCase() || "RECENT";
  return ["RECENT", "OLDEST", "PRIORITY", "RESOLVED"].includes(value)
    ? value
    : "RECENT";
}

function buildIncidentOrderBy(sort: string) {
  if (sort === "OLDEST") {
    return [
      {
        status: "asc" as const,
      },
      {
        firstDetectedAt: "asc" as const,
      },
    ];
  }

  if (sort === "PRIORITY") {
    return [
      {
        priorityScore: "desc" as const,
      },
      {
        firstDetectedAt: "asc" as const,
      },
    ];
  }

  if (sort === "RESOLVED") {
    return [
      {
        resolvedAt: {
          sort: "desc" as const,
          nulls: "last" as const,
        },
      },
      {
        lastDetectedAt: "desc" as const,
      },
    ];
  }

  return [
    {
      status: "asc" as const,
    },
    {
      lastDetectedAt: "desc" as const,
    },
  ];
}

function formatIncidentElapsedTime(firstDetectedAt: Date) {
  return formatDurationLabel(new Date(), firstDetectedAt);
}

function formatDurationLabel(end: Date, start: Date) {
  const totalMinutes = Math.max(
    0,
    Math.round((end.getTime() - start.getTime()) / 60_000),
  );
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function formatKoreanDate(date: Date) {
  return date.toLocaleString("ko-KR", {
    hour12: false,
    timeZone: "Asia/Seoul",
  });
}
