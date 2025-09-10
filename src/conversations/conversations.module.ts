import { Module } from '@nestjs/common';
import { ConversationsService } from './services/conversations.service';
import { ConversationsController } from './controllers/conversations.controller';
import { TokenLimitGuard } from './guards/token-limit.guard';
import { AssistantsModule } from '../assistants/assistants.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    AssistantsModule, // Para usar AssistantsService
  ],
  controllers: [ConversationsController],
  providers: [
    ConversationsService,
    TokenLimitGuard,
  ],
  exports: [
    ConversationsService,
  ],
})
export class ConversationsModule {}