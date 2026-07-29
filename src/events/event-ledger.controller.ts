import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { EventLedgerService } from './event-ledger.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';

@Controller('admin/event-ledger')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class EventLedgerController {
  constructor(private readonly eventLedgerService: EventLedgerService) {}

  @Get(':aggregateId/integrity')
  async checkIntegrity(@Param('aggregateId') aggregateId: string) {
    const gaps = await this.eventLedgerService.detectGaps(aggregateId);

    return {
      aggregateId,
      valid: gaps.length === 0,
      gaps,
    };
  }
}
