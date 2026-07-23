import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { PoiController } from './poi.controller';
import { PoiService } from './poi.service';

@Module({
  imports: [AiModule],
  controllers: [PoiController],
  providers: [PoiService],
  exports: [PoiService],
})
export class PoiModule {}
