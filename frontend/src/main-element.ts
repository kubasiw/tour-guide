import { createApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { createCustomElement } from '@angular/elements';
import { MiniMapWidget } from './app/mini-map-widget/mini-map-widget';

async function bootstrap(): Promise<void> {
  const app = await createApplication({
    providers: [provideHttpClient()],
  });

  const element = createCustomElement(MiniMapWidget, { injector: app.injector });
  customElements.define('tour-guide-mini-map', element);
}

void bootstrap();
