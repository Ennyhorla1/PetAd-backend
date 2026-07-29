import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { EventReplayService } from './services/event-replay.service';
import { PrismaModule } from '../prisma/prisma.module';
import { LoggingModule } from '../logging/logging.module';

@Module({
  imports: [PrismaModule, LoggingModule],
  controllers: [AdminController],
  providers: [EventReplayService],
  exports: [EventReplayService],
})
export class AdminModule {}
