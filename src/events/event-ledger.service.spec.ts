import { EventEntityType, EventType } from '@prisma/client';
import { EventLedgerService } from './event-ledger.service';

describe('EventLedgerService', () => {
  const events: Array<Record<string, unknown>> = [];
  const transaction = {
    $executeRaw: jest.fn().mockResolvedValue(0),
    eventLog: {
      findFirst: jest.fn(async () => {
        const aggregateEvents = events.filter(
          (event) => event.entityId === 'aggregate-1',
        );
        const latest = aggregateEvents.reduce<number | null>(
          (maximum, event) =>
            typeof event.sequenceNumber === 'number' &&
            (maximum === null || event.sequenceNumber > maximum)
              ? event.sequenceNumber
              : maximum,
          null,
        );

        return latest === null ? null : { sequenceNumber: latest };
      }),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const event = { id: String(events.length + 1), ...data };
        events.push(event);
        return event;
      }),
    },
  };

  const prisma = {
    $transaction: jest.fn(
      async (callback: (client: typeof transaction) => unknown) =>
        callback(transaction),
    ),
    eventLog: {
      findMany: jest.fn(),
    },
  };

  let service: EventLedgerService;

  beforeEach(() => {
    events.length = 0;
    jest.clearAllMocks();
    service = new EventLedgerService(prisma as never);
  });

  it('assigns sequences 1 through 5 when five events are appended', async () => {
    for (let index = 0; index < 5; index += 1) {
      await service.appendEvent({
        entityType: EventEntityType.ADOPTION,
        aggregateId: 'aggregate-1',
        eventType: EventType.ADOPTION_REQUESTED,
        payload: {},
      });
    }

    expect(events.map((event) => event.sequenceNumber)).toEqual([1, 2, 3, 4, 5]);
  });

  it('detects missing sequence numbers', async () => {
    prisma.eventLog.findMany.mockResolvedValue([
      { sequenceNumber: 1 },
      { sequenceNumber: 2 },
      { sequenceNumber: 4 },
      { sequenceNumber: 6 },
    ]);

    await expect(service.detectGaps('aggregate-1')).resolves.toEqual([3, 5]);
  });
});
