import { Module } from '@nestjs/common';
import { PlansModule } from '../plans/plans.module';
import { PoiModule } from '../poi/poi.module';
import { PlanGeneratorController } from './plan-generator.controller';
import { PlanGeneratorService } from './plan-generator.service';

@Module({
  imports: [PlansModule, PoiModule],
  controllers: [PlanGeneratorController],
  providers: [PlanGeneratorService],
})
export class PlanGeneratorModule {}
