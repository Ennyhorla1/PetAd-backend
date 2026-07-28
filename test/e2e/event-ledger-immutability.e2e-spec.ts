import { PrismaService } from '../../src/prisma/prisma.service';

describe('EventLedger immutability', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();

    await prisma.$executeRawUnsafe(
      'INSERT INTO "EventLedger" ("id") VALUES ($1) ON CONFLICT ("id") DO NOTHING',
      '00000000-0000-4000-8000-000000000001',
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function getLedgerRecord(): Promise<{ id: string }> {
    const records = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      'SELECT "id" FROM "EventLedger" ORDER BY "id" LIMIT 1',
    );

    if (!records[0]) {
      throw new Error(
        'EventLedger immutability tests require at least one existing ledger record',
      );
    }

    return records[0];
  }

  it('rejects updates to an EventLedger record', async () => {
    const record = await getLedgerRecord();

    await expect(
      prisma.$executeRawUnsafe(
        'UPDATE "EventLedger" SET "id" = "id" WHERE "id" = $1',
        record.id,
      ),
    ).rejects.toThrow(/EventLedger is immutable/i);
  });

  it('rejects deletes of an EventLedger record', async () => {
    const record = await getLedgerRecord();

    await expect(
      prisma.$executeRawUnsafe(
        'DELETE FROM "EventLedger" WHERE "id" = $1',
        record.id,
      ),
    ).rejects.toThrow(/EventLedger is immutable/i);
  });
});
