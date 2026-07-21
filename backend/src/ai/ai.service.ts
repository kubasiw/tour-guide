import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { AREA_THEMES, AreaTheme } from './area-theme.type';

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 200;
// Narration asks for 3-5 sentences (vs. the area description's 2-3) — 200
// tokens was cutting it off mid-sentence in practice.
const NARRATION_MAX_TOKENS = 400;

const SYSTEM_PROMPT =
  'Piszesz krótkie, uczciwe opisy okolic dla aplikacji turystycznej. Odpowiedz w dokładnie takim ' +
  'formacie: pierwsza linia "THEME: <etykieta>", potem pusta linia, potem 2-3 zdania opisu po ' +
  'polsku. Etykieta w THEME musi być dokładnie jednym z tych słów: coastal, mountain-trail, urban, ' +
  'countryside, default — wybierz tę, która najlepiej pasuje do charakteru miejsca (default, jeśli ' +
  'żadna nie pasuje wyraźnie). W opisie skomentuj charakter podanego miejsca — klimat, typ okolicy ' +
  '(np. historyczne centrum, wybrzeże, góry, nowoczesna dzielnica). Nie wymyślaj konkretnych nazw ' +
  'miejsc, atrakcji, restauracji ani faktów, których nie znasz na pewno — pisz ogólnie o charakterze ' +
  'okolicy. Bez nagłówków w opisie, bez list — tylko wskazany format.';

const THEME_LINE_PATTERN = /^THEME:\s*(\S+)\s*\n+([\s\S]*)$/;

const NARRATION_SYSTEM_PROMPT =
  'Piszesz krótkie, zachęcające podsumowania planów podróży dla aplikacji turystycznej. Dostajesz ' +
  'listę wybranych przez użytkownika miejsc (nazwa i typ) oraz jego zainteresowania. Napisz 3-5 ' +
  'zdań po polsku komentujących dobrany zestaw miejsc — czy jest zróżnicowany, co warto zauważyć, ' +
  'jak pasuje do zainteresowań. Nie wymyślaj żadnych faktów o podanych miejscach poza tym, co ' +
  'wynika z ich nazwy i typu — nie zmyślaj godzin otwarcia, ocen, historii itp. Bez nagłówków, bez ' +
  'list, sam tekst.';

@Injectable()
export class AiService {
  private readonly client: Anthropic;

  public constructor(configService: ConfigService) {
    this.client = new Anthropic({
      apiKey: configService.get<string>('ANTHROPIC_API_KEY')!,
    });
  }

  public async generateAreaDescription(
    placeName: string,
  ): Promise<{ description: string; theme: AreaTheme }> {
    try {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Miejsce: ${placeName}` }],
      });

      const block = response.content[0];
      if (block?.type !== 'text') {
        throw new Error('Unexpected response content type from Claude API');
      }

      return this.parseThemedDescription(block.text.trim());
    } catch {
      throw new BadGatewayException('Failed to generate area description');
    }
  }

  public async generatePlanNarration(
    items: { name: string; type: string }[],
    activities: string[],
  ): Promise<string> {
    try {
      const placesList = items
        .map((item) => `- ${item.name} (${item.type})`)
        .join('\n');
      const activitiesList = activities.join(', ');

      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: NARRATION_MAX_TOKENS,
        system: NARRATION_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Wybrane miejsca:\n${placesList}\n\nZainteresowania: ${activitiesList}`,
          },
        ],
      });

      const block = response.content[0];
      if (block?.type !== 'text') {
        throw new Error('Unexpected response content type from Claude API');
      }

      return block.text.trim();
    } catch {
      throw new BadGatewayException('Failed to generate plan narration');
    }
  }

  private parseThemedDescription(text: string): {
    description: string;
    theme: AreaTheme;
  } {
    const match = THEME_LINE_PATTERN.exec(text);
    if (!match) {
      return { description: text, theme: 'default' };
    }

    const candidate = match[1].toLowerCase();
    const theme = (AREA_THEMES as readonly string[]).includes(candidate)
      ? (candidate as AreaTheme)
      : 'default';

    return { description: match[2].trim(), theme };
  }
}
