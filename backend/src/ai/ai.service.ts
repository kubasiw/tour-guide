import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 200;
// Narration asks for 3-5 sentences (vs. the area description's 2-3) — 200
// tokens was cutting it off mid-sentence in practice.
const NARRATION_MAX_TOKENS = 400;

const SYSTEM_PROMPT =
  'Piszesz krótkie, uczciwe opisy okolic dla aplikacji turystycznej. Napisz 2-3 zdania po polsku ' +
  'o charakterze podanego miejsca — klimat, typ okolicy (np. historyczne centrum, wybrzeże, góry, ' +
  'nowoczesna dzielnica). Nie wymyślaj konkretnych nazw miejsc, atrakcji, restauracji ani faktów, ' +
  'których nie znasz na pewno — pisz ogólnie o charakterze okolicy. Bez nagłówków, bez list, sam tekst.';

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

  public async generateAreaDescription(placeName: string): Promise<string> {
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

      return block.text.trim();
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
}
