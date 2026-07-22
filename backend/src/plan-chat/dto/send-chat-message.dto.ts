import { IsArray, IsOptional, IsString } from 'class-validator';
import { ChatTurn } from '../plan-chat.types';

export class SendChatMessageDto {
  @IsString()
  public message!: string;

  @IsOptional()
  @IsArray()
  public history?: ChatTurn[];
}
