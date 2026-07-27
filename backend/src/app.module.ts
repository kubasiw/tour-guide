import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { GeocodingModule } from './geocoding/geocoding.module';
import { HealthModule } from './health/health.module';
import { PlanChatModule } from './plan-chat/plan-chat.module';
import { PlanGeneratorModule } from './plan-generator/plan-generator.module';
import { PlansModule } from './plans/plans.module';
import { PoiModule } from './poi/poi.module';
import { PrismaModule } from './prisma/prisma.module';
import { TrailsModule } from './trails/trails.module';
import { WeatherModule } from './weather/weather.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Domyślny limit dla wszystkich endpointów bez własnego @Throttle — 20 żądań/min per IP.
    // Ciaśniejsze limity na rejestracji/logowaniu/AI ustawione bezpośrednio na kontrolerach
    // (patrz auth.controller.ts, poi.controller.ts, plans.controller.ts,
    // plan-generator.controller.ts, plan-chat.controller.ts) — pierwsza linia obrony przed
    // automatycznym nadużyciem (np. masowa rejestracja kont + bombardowanie endpointów AI),
    // uzupełniona twardym dziennym limitem w samym AiService jako wyłącznikiem bezpieczeństwa.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 20 }]),
    PrismaModule,
    HealthModule,
    AuthModule,
    PlansModule,
    WeatherModule,
    PoiModule,
    PlanGeneratorModule,
    GeocodingModule,
    AiModule,
    PlanChatModule,
    TrailsModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
