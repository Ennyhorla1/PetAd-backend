import { ApiProperty } from '@nestjs/swagger';
import { EventEntityType } from '@prisma/client';

/**
 * Response of `POST /admin/replay/:aggregateId`.
 */
export class EventReplayResponseDto {
  @ApiProperty({ description: 'The aggregate ID that was replayed.' })
  aggregateId: string;

  @ApiProperty({
    description:
      'Detected aggregate type (USER, PET, ADOPTION, CUSTODY, ESCROW).',
    enum: EventEntityType,
  })
  aggregateType: EventEntityType;

  @ApiProperty({
    description: 'Number of events processed during the replay.',
    example: 4,
  })
  eventsProcessed: number;

  @ApiProperty({
    description:
      'The state reconstructed by replaying the events. Shape depends on aggregate type.',
    example: { status: 'COMPLETED' },
  })
  replayedState: Record<string, unknown>;

  @ApiProperty({
    description:
      'List of fields where the replayed state differs from the current DB state, ' +
      'formatted as "field: replayed=X, current=Y". Empty when state matches.',
    example: ['status: replayed=COMPLETED, current=APPROVED'],
  })
  discrepancies: string[];

  @ApiProperty({
    description:
      'Whether the replayed state was applied to the database. ' +
      'Always false when dryRun is true.',
  })
  appliedToDb: boolean;
}
