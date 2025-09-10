import { Module } from '@nestjs/common';
import { AssistantsService } from './services/assistants.service';
import { AssistantsController } from './controllers/assistants.controller';
import { OpenAiService } from '../common/services/openai.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AssistantsController],
  providers: [
    AssistantsService,
    OpenAiService,
  ],
  exports: [
    AssistantsService,
    OpenAiService,
  ],
})
export class AssistantsModule {}