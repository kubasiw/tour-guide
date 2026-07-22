import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { AiService } from '../ai/ai.service';
import { PlanGeneratorService } from '../plan-generator/plan-generator.service';
import { PlanItemWithPoi } from '../plan-generator/plan-generator.types';
import { PlansService } from '../plans/plans.service';
import { Poi } from '../poi/poi.types';
import { ChatTurn } from './plan-chat.types';

const MAX_TOOL_ITERATIONS = 4;

const SYSTEM_PROMPT_INTRO =
  'Jesteś asystentem AI pomagającym użytkownikowi edytować jego plan podróży w aplikacji ' +
  'turystycznej. Możesz dodawać, usuwać i zmieniać kolejność miejsc w planie za pomocą ' +
  'dostępnych narzędzi — rób to od razu, gdy użytkownik o to poprosi, a potem krótko po polsku ' +
  'opisz, co zmieniłeś. Nie masz dostępu do cen ani ocen żadnych miejsc — jeśli użytkownik o nie ' +
  'zapyta, powiedz szczerze, że nie masz takich danych, zamiast zgadywać. Plan nie ma jeszcze ' +
  'podziału na dni — jeśli użytkownik prosi o przypisanie miejsca do konkretnego dnia, dodaj je ' +
  'do planu, ale zaznacz, że dni nie są jeszcze obsługiwane. Nie wymyślaj miejsc ani faktów, ' +
  'których nie ma w poniższych listach.';

@Injectable()
export class PlanChatService {
  public constructor(
    private readonly aiService: AiService,
    private readonly plansService: PlansService,
    private readonly planGeneratorService: PlanGeneratorService,
  ) {}

  public async handleMessage(
    planId: string,
    message: string,
    history: ChatTurn[],
  ): Promise<{ reply: string; history: ChatTurn[] }> {
    const plan = await this.plansService.findOne(planId);
    const items = await this.planGeneratorService.findItems(planId);
    const candidates =
      plan.activities.length > 0
        ? await this.planGeneratorService.findCandidates(planId)
        : [];

    const system = this.buildSystemPrompt(items, candidates);
    const tools = this.buildTools();
    const messages: ChatTurn[] = [
      ...history,
      { role: 'user', content: message },
    ];

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      const response = await this.aiService.sendToolMessage(
        system,
        messages,
        tools,
      );
      // Anthropic's own response content blocks are a valid next-turn input —
      // round-tripped as-is, just cast past the output/input type split.
      messages.push({
        role: 'assistant',
        content: response.content,
      });

      if (response.stop_reason !== 'tool_use') {
        const textBlock = response.content.find(
          (block): block is Anthropic.TextBlock => block.type === 'text',
        );
        return { reply: textBlock?.text.trim() ?? '', history: messages };
      }

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          toolResults.push(await this.executeTool(planId, block));
        }
      }
      messages.push({ role: 'user', content: toolResults });
    }

    return {
      reply:
        'Przepraszam, ta zmiana okazała się zbyt skomplikowana do wykonania za jednym razem.',
      history: messages,
    };
  }

  private async executeTool(
    planId: string,
    block: Anthropic.ToolUseBlock,
  ): Promise<Anthropic.ToolResultBlockParam> {
    const input = block.input as Record<string, unknown>;

    try {
      switch (block.name) {
        case 'add_item': {
          const item = await this.planGeneratorService.addItem(
            planId,
            input.poiId as string,
          );
          return {
            type: 'tool_result',
            tool_use_id: block.id,
            content: `Dodano "${item.poi.name}" do planu.`,
          };
        }
        case 'remove_item': {
          await this.planGeneratorService.removeItem(
            planId,
            input.itemId as string,
          );
          return {
            type: 'tool_result',
            tool_use_id: block.id,
            content: 'Usunięto miejsce z planu.',
          };
        }
        case 'reorder_items': {
          await this.planGeneratorService.reorderItems(
            planId,
            input.itemIds as string[],
          );
          return {
            type: 'tool_result',
            tool_use_id: block.id,
            content: 'Zmieniono kolejność miejsc w planie.',
          };
        }
        default:
          return {
            type: 'tool_result',
            tool_use_id: block.id,
            content: `Nieznane narzędzie: ${block.name}.`,
            is_error: true,
          };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Nieznany błąd.';
      return {
        type: 'tool_result',
        tool_use_id: block.id,
        content: `Nie udało się wykonać tej zmiany: ${message}`,
        is_error: true,
      };
    }
  }

  private buildSystemPrompt(
    items: PlanItemWithPoi[],
    candidates: Poi[],
  ): string {
    const itemsList =
      items.length > 0
        ? items
            .map(
              (item) =>
                `- itemId=${item.id}, ${item.poi.name} (${item.poi.type})`,
            )
            .join('\n')
        : '(plan jest jeszcze pusty)';

    const candidatesList =
      candidates.length > 0
        ? candidates
            .map(
              (poi) =>
                `- poiId=${poi.id}, ${poi.name} (${poi.type})${
                  poi.openingHours ? `, godziny: ${poi.openingHours}` : ''
                }`,
            )
            .join('\n')
        : '(brak dostępnych kandydatów do dodania)';

    return (
      `${SYSTEM_PROMPT_INTRO}\n\n` +
      `Aktualne miejsca w planie:\n${itemsList}\n\n` +
      `Dostępne miejsca do dodania:\n${candidatesList}`
    );
  }

  private buildTools(): Anthropic.Tool[] {
    return [
      {
        name: 'add_item',
        description:
          'Dodaje miejsce do planu podróży użytkownika, na podstawie jego poiId z listy ' +
          'dostępnych kandydatów w kontekście.',
        input_schema: {
          type: 'object',
          properties: {
            poiId: {
              type: 'string',
              description: 'Id miejsca (POI) z listy dostępnych kandydatów.',
            },
          },
          required: ['poiId'],
        },
      },
      {
        name: 'remove_item',
        description:
          'Usuwa miejsce z planu podróży użytkownika, na podstawie itemId z listy aktualnych ' +
          'miejsc w planie w kontekście.',
        input_schema: {
          type: 'object',
          properties: {
            itemId: {
              type: 'string',
              description:
                'Id pozycji planu (nie POI) z listy aktualnych miejsc w planie.',
            },
          },
          required: ['itemId'],
        },
      },
      {
        name: 'reorder_items',
        description:
          'Zmienia kolejność miejsc w planie. Wymaga PEŁNEJ nowej listy itemId w nowej ' +
          'kolejności — musi zawierać dokładnie te same id, które są obecnie w planie, tylko w ' +
          'innej kolejności.',
        input_schema: {
          type: 'object',
          properties: {
            itemIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'Pełna lista itemId w nowej kolejności.',
            },
          },
          required: ['itemIds'],
        },
      },
    ];
  }
}
