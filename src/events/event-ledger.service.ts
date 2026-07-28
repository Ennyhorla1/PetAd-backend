import { Injectable } from '@nestjs/common';
import { EventType, EventEntityType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventLogDto } from './events.service';

export interface AppendEventDto {
  entityType: EventEntityType;
  aggregateId: string;
  eventType: EventType;
  actorId?: string;
  txHash?: string;
  blockHeight?: number;
  payload: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class EventLedgerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the next one-based sequence number for an aggregate.
   *
   * The aggregate is protected by a PostgreSQL transaction-scoped advisory
   * lock so concurrent writers for the same aggregate serialize while writers
   * for different aggregates remain independent.
   */
  async getNextSequenceNumber(aggregateId: string): Promise<number> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${aggregateId}))
      `;

      const eventLog = transaction.eventLog as any;
      const latestEvent = await eventLog.findFirst({
        where: {
          entityId: aggregateId,
        },
        orderBy: {
          sequenceNumber: 'desc',
        },
        select: {
          sequenceNumber: true,
        },
      });

      return (latestEvent?.sequenceNumber ?? 0) + 1;
    });
  }

  /**
   * Appends an event and allocates its sequence in the same transaction.
   */
  async appendEvent(dto: AppendEventDto | CreateEventLogDto) {
    const aggregateId = 'aggregateId' in dto ? dto.aggregateId : dto.entityId;

    return this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${aggregateId}))
      `;

      const eventLog = transaction.eventLog as any;
      const latestEvent = await eventLog.findFirst({
        where: {
          entityId: aggregateId,
        },
        orderBy: {
          sequenceNumber: 'desc',
        },
        select: {
          sequenceNumber: true,
        },
      });

      const sequenceNumber = (latestEvent?.sequenceNumber ?? 0) + 1;
      const event = await eventLog.create({
        data: {
          entityType: dto.entityType,
          entityId: aggregateId,
          eventType: dto.eventType,
          actorId: dto.actorId,
          txHash: dto.txHash,
          blockHeight: dto.blockHeight,
          payload: dto.payload,
          metadata: dto.metadata,
          sequenceNumber,
        },
      });

      return event;
    });
  }

  /**
   * Returns all missing sequence numbers from one through the aggregate's
   * highest committed sequence number.
   */
  async detectGaps(aggregateId: string): Promise<number[]> {
    const eventLog = this.prisma.eventLog as any;
    const events = await eventLog.findMany({
      where: {
        entityId: aggregateId,
      },
      orderBy: {
        sequenceNumber: 'asc',
      },
      select: {
        sequenceNumber: true,
      },
    });

    const sequences = events
      .map((event: { sequenceNumber?: unknown }) => event.sequenceNumber)
      .filter(
        (sequence: unknown): sequence is number =>
          Number.isInteger(sequence) && (sequence as number) > 0,
      );

    const highestSequence = sequences.length > 0 ? Math.max(...sequences) : 0;
    const presentSequences = new Set(sequences);
    const gaps: number[] = [];

    for (let sequence = 1; sequence <= highestSequence; sequence += 1) {
      if (!presentSequences.has(sequence)) {
        gaps.push(sequence);
      }
    }

    return gaps;
  }
}
