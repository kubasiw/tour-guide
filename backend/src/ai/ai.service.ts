import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 200;

const SYSTEM_PROMPT =
  'Piszesz krótkie, uczciwe opisy okolic dla aplikacji turystycznej. Napisz 2-3 zdania po polsku ' +
  'o charakterze podanego miejsca — klimat, typ okolicy (np. historyczne centrum, wybrzeże, góry, ' +
  'nowoczesna dzielnica). Nie wymyślaj konkretnych nazw miejsc, atrakcji, restauracji ani faktów, ' +
  'których nie znasz na pewno — pisz ogólnie o charakterze okolicy. Bez nagłówków, bez list, sam tekst.';

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
}
