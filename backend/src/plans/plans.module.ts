import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { GeocodingModule } from '../geocoding/geocoding.module';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';

@Module({
  imports: [AiModule, GeocodingModule],
  controllers: [PlansController],
  providers: [PlansService],
  exports: [PlansService],
})
export class PlansModule {}
