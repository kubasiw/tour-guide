import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { PlansModule } from '../plans/plans.module';
import { PoiModule } from '../poi/poi.module';
import { PlanGeneratorController } from './plan-generator.controller';
import { PlanGeneratorService } from './plan-generator.service';

@Module({
  imports: [PlansModule, PoiModule, AiModule],
  controllers: [PlanGeneratorController],
  providers: [PlanGeneratorService],
  exports: [PlanGeneratorService],
})
export class PlanGeneratorModule {}
