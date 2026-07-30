import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  // Analogiczny audyt do portfolio-shell — helmet daje te same nagłówki (X-Content-Type-Options,
  // Referrer-Policy, X-Frame-Options...) co tam ręcznie w nginx.conf. CSP wyłączony celowo — to
  // czyste API zwracające JSON, nie serwuje HTML-a, więc CSP (myślany dla stron) nie ma tu
  // realnego zastosowania i tylko zaśmiecałby nagłówki.
  app.use(helmet({ contentSecurityPolicy: false }));
  // localhost:4200 = ta appka lokalnie; localhost:5173 = portfolio-shell lokalnie (dev);
  // localhost:4300 = lokalny statyczny serwer testowy dla wyodrębnionego <tour-guide-mini-map>
  // (frontend/dist/frontend-element); kubsiw.com = portfolio-shell produkcyjnie (osadzony
  // widget), tourguide.kubsiw.com = ta appka produkcyjnie (Faza 3, krok 8 w PORTFOLIO_PLAN.md).
  app.enableCors({
    origin: [
      'http://localhost:4200',
      'http://localhost:5173',
      'http://localhost:4300',
      'https://kubsiw.com',
      'https://tourguide.kubsiw.com',
    ],
  });
  // Prefiks /api na wszystkich routach — pozwala Traefikowi na produkcji rozróżnić ruch do
  // backendu od ruchu do frontendu przez PathPrefix('/api') na tej samej domenie
  // (tourguide.kubsiw.com), bez osobnej subdomeny api.*, której nie ma jeszcze w DNS.
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
