import { MessageRole } from '@prisma/client';

export class ConversationListResponseDto {
  id: string;
  title?: string;
  lastMessageAt: Date;
  totalMessages: number;
  isArchived: boolean;
  assistant: {
    id: string;
    name: string;
    specialty: string;
  };
  lastMessage?: {
    role: MessageRole;
    content: string;
    createdAt: Date;
  };
}

export class ConversationDetailResponseDto {
  id: string;
  title?: string;
  lastMessageAt: Date;
  totalMessages: number;
  totalTokensUsed: number;
  isArchived: boolean;
  createdAt: Date;
  assistant: {
    id: string;
    name: string;
    specialty: string;
    description?: string;
  };
  messages: MessageResponseDto[];
}

export class MessageResponseDto {
  id: string;
  role: MessageRole;
  content: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  isEdited: boolean;
  editedAt?: Date;
  createdAt: Date;
}

export class SendMessageResponseDto {
  userMessage: MessageResponseDto;
  assistantMessage: MessageResponseDto;
  conversation: {
    id: string;
    totalMessages: number;
    totalTokensUsed: number;
  };
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costUsd: number;
  };
}