import { Injectable } from '@nestjs/common';
import { EventEntityType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface PetMovementEvent {
  eventType: string;
  occurredAt: string;
  actorId: string | null;
  summary: string;
  stellarTxHash?: string;
}

type EventRecord = {
  eventType: string;
  actorId: string | null;
  txHash: string | null;
  createdAt: Date;
  payload: Prisma.JsonValue;
};

type JsonObject = Record<string, unknown>;

const EVENT_SUMMARIES: Record<string, string> = {
  ADOPTION_REQUESTED: 'Adoption requested',
  ADOPTION_APPROVED: 'Adoption approved',
  ADOPTION_REJECTED: 'Adoption rejected',
  ADOPTION_CANCELLED: 'Adoption cancelled',
  ADOPTION_ESCROW_FUNDED: 'Adoption escrow funded',
  ADOPTION_COMPLETED: 'Adoption completed',
  CUSTODY_REQUESTED: 'Custody requested',
  CUSTODY_APPROVED: 'Custody approved',
  CUSTODY_REJECTED: 'Custody rejected',
  CUSTODY_STARTED: 'Custody started',
  CUSTODY_EXTENDED: 'Custody extended',
  CUSTODY_COMPLETED: 'Custody completed',
  CUSTODY_CANCELLED: 'Custody cancelled',
  CUSTODY_VIOLATION_REPORTED: 'Custody violation reported',
};

function asObject(value: Prisma.JsonValue): JsonObject {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as JsonObject;
  }

  return {};
}

function summaryPrefix(eventType: string): string {
  return (
    EVENT_SUMMARIES[eventType] ??
    eventType
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  );
}

@Injectable()
export class PetMovementService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns all movement events associated with a pet across PET, ADOPTION,
   * and CUSTODY aggregates, ordered from oldest to newest.
   */
  async getMovementHistory(petId: string): Promise<PetMovementEvent[]> {
    const events = (await this.prisma.eventLog.findMany({
      where: {
        OR: [
          {
            entityType: EventEntityType.PET,
            entityId: petId,
          },
          {
            entityType: {
              in: [EventEntityType.ADOPTION, EventEntityType.CUSTODY],
            },
            payload: {
              path: ['petId'],
              equals: petId,
            } as Prisma.JsonFilter,
          },
        ],
      },
      orderBy: {
        createdAt: 'asc',
      },
    })) as unknown as EventRecord[];

    return events.map((event) => ({
      eventType: event.eventType,
      occurredAt: event.createdAt.toISOString(),
      actorId: event.actorId,
      summary: this.buildSummary(event),
      ...(event.txHash ? { stellarTxHash: event.txHash } : {}),
    }));
  }

  private buildSummary(event: EventRecord): string {
    const payload = asObject(event.payload);
    let summary = summaryPrefix(event.eventType);

    if (event.actorId) {
      const actor = event.actorId.startsWith('@')
        ? event.actorId
        : `@${event.actorId}`;
      summary += ` by ${actor}`;
    }

    if (typeof payload.reason === 'string' && payload.reason.length > 0) {
      summary += ` — ${payload.reason}`;
    }

    return summary;
  }
}
