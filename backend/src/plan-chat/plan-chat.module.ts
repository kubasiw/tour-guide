import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { PlanGeneratorModule } from '../plan-generator/plan-generator.module';
import { PlansModule } from '../plans/plans.module';
import { PlanChatController } from './plan-chat.controller';
import { PlanChatService } from './plan-chat.service';

@Module({
  imports: [AiModule, PlanGeneratorModule, PlansModule],
  controllers: [PlanChatController],
  providers: [PlanChatService],
})
export class PlanChatModule {}
