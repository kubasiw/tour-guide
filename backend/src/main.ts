import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  // localhost:4200 = ta appka lokalnie; localhost:5173 = portfolio-shell lokalnie (dev);
  // localhost:4300 = lokalny statyczny serwer testowy dla wyodrębnionego <tour-guide-mini-map>
  // (frontend/dist/frontend-element) — realna, trwała potrzeba CORS dla wielu originów, nie
  // tymczasowy hack testowy. Doprecyzować o realną domenę produkcyjną portfolio przy wdrożeniu
  // (Faza 3, krok 8/9 w PORTFOLIO_PLAN.md).
  app.enableCors({
    origin: [
      'http://localhost:4200',
      'http://localhost:5173',
      'http://localhost:4300',
    ],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
