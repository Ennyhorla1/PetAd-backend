import { PrismaService } from '../../prisma/prisma.service';

/**
 * Prisma write verbs that must never execute during a dry run.
 *
 * These cover top-level methods (e.g. `prisma.$executeRaw`) and the standard
 * write methods available on every Prisma model client (e.g.
 * `prisma.adoption.create(...)`).
 */
const WRITE_VERBS = new Set<string>([
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
  '$executeRaw',
  '$executeRawUnsafe',
  '$transaction',
]);

const isWriteCall = (prop: string | symbol): boolean =>
  typeof prop === 'string' && WRITE_VERBS.has(prop);

/**
 * Handler shared by the root Proxy and every recursively-wrapped level.
 * On any property access:
 *   - If the property name matches a write verb, return a function that
 *     throws (so any call through that path surfaces immediately).
 *   - Otherwise return the value. If it's a nested object/array, wrap
 *     it in another Proxy with this same handler so chained access also
 *     fires the trap. If it's a function, bind it to the original target.
 */
const handler: ProxyHandler<object> = {
  get(target, prop, receiver) {
    if (typeof prop === 'symbol' || prop === 'constructor') {
      return Reflect.get(target as object, prop, receiver);
    }
    if (isWriteCall(prop)) {
      return () => {
        throw new Error(
          `Dry-run mode: blocked attempted DB write through "${String(
            prop,
          )}()" — dry runs must not mutate the database.`,
        );
      };
    }
    const value = Reflect.get(target as object, prop, receiver);
    if (typeof value === 'object' && value !== null) {
      // Recursive wrap so `safe.adoption.create(...)` is also caught.
      return new Proxy(value, handler);
    }
    return typeof value === 'function' ? value.bind(target) : value;
  },
};

/**
 * Returns a Proxy around the supplied PrismaService that allows all
 * reads but throws if any write method is invoked — at any depth.
 *
 * Used by EventReplayService when `dryRun: true` to guarantee (at the
 * JS level) that no DB writes happen. Unit tests rely on this behavior
 * to assert dry-run safety.
 */
export function createStrictReadOnlyPrisma(
  prisma: PrismaService,
): PrismaService {
  return new Proxy(
    prisma as unknown as object,
    handler,
  ) as unknown as PrismaService;
}
