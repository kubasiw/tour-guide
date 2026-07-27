import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SendChatMessageDto } from './dto/send-chat-message.dto';
import { PlanChatService } from './plan-chat.service';
import { ChatTurn } from './plan-chat.types';

@Controller('plans/:planId')
export class PlanChatController {
  public constructor(private readonly planChatService: PlanChatService) {}

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('chat')
  public sendMessage(
    @Param('planId') planId: string,
    @Body() dto: SendChatMessageDto,
  ): Promise<{ reply: string; history: ChatTurn[] }> {
    return this.planChatService.handleMessage(
      planId,
      dto.message,
      dto.history ?? [],
    );
  }
}
