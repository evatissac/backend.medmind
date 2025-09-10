import { 
  Injectable, 
  NotFoundException, 
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OpenAiService } from '../../common/services/openai.service';
import { AssistantsService } from '../../assistants/services/assistants.service';
import { CreateConversationDto } from '../dto/create-conversation.dto';
import { SendMessageDto } from '../dto/send-message.dto';
import { 
  ConversationListResponseDto, 
  ConversationDetailResponseDto,
  SendMessageResponseDto,
  MessageResponseDto 
} from '../dto/conversation-response.dto';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly openAiService: OpenAiService,
    private readonly assistantsService: AssistantsService,
  ) {}

  async create(createConversationDto: CreateConversationDto, userId: string): Promise<ConversationDetailResponseDto> {
    const { assistantId, title } = createConversationDto;

    // Verificar que el asistente existe y está activo
    const assistant = await this.assistantsService.getAssistantForConversation(assistantId);

    try {
      // Crear thread en OpenAI
      const thread = await this.openAiService.createThread();

      // Crear conversación en BD
      const conversation = await this.prisma.conversation.create({
        data: {
          userId,
          assistantId,
          title: title || `Chat con ${assistant.name}`,
          openaiThreadId: thread.id,
        },
        include: {
          assistant: {
            select: {
              id: true,
              name: true,
              specialty: true,
              description: true,
            },
          },
          messages: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      return {
        id: conversation.id,
        title: conversation.title || undefined,
        lastMessageAt: conversation.lastMessageAt,
        totalMessages: conversation.totalMessages,
        totalTokensUsed: conversation.totalTokensUsed,
        isArchived: conversation.isArchived,
        createdAt: conversation.createdAt,
        assistant: conversation.assistant ? {
          ...conversation.assistant,
          description: (conversation.assistant as any).description || undefined,
        } : {
          id: '',
          name: 'Unknown',
          specialty: 'unknown',
        },
        messages: conversation.messages.map(this.formatMessage),
      };
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw new InternalServerErrorException('Error al crear la conversación');
    }
  }

  async findUserConversations(userId: string, includeArchived = false): Promise<ConversationListResponseDto[]> {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        userId,
        ...(includeArchived ? {} : { isArchived: false }),
      },
      include: {
        assistant: {
          select: {
            id: true,
            name: true,
            specialty: true,
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: {
            role: true,
            content: true,
            createdAt: true,
          },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    return conversations.map(conversation => ({
      id: conversation.id,
      title: conversation.title || undefined,
      lastMessageAt: conversation.lastMessageAt,
      totalMessages: conversation.totalMessages,
      isArchived: conversation.isArchived,
      assistant: conversation.assistant ? {
        ...conversation.assistant,
        description: (conversation.assistant as any).description || undefined,
      } : {
        id: '',
        name: 'Unknown',
        specialty: 'unknown',
      },
      lastMessage: conversation.messages[0] || undefined,
    }));
  }

  async findOne(id: string, userId: string): Promise<ConversationDetailResponseDto> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, userId },
      include: {
        assistant: {
          select: {
            id: true,
            name: true,
            specialty: true,
            description: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversación no encontrada');
    }

    return {
      id: conversation.id,
      title: conversation.title || undefined,
      lastMessageAt: conversation.lastMessageAt,
      totalMessages: conversation.totalMessages,
      totalTokensUsed: conversation.totalTokensUsed,
      isArchived: conversation.isArchived,
      createdAt: conversation.createdAt,
      assistant: conversation.assistant ? {
        ...conversation.assistant,
        description: (conversation.assistant as any).description || undefined,
      } : {
        id: '',
        name: 'Unknown',
        specialty: 'unknown',
      },
      messages: conversation.messages.map(this.formatMessage),
    };
  }

  async sendMessage(
    conversationId: string, 
    sendMessageDto: SendMessageDto, 
    userId: string
  ): Promise<SendMessageResponseDto> {
    const { content } = sendMessageDto;

    // Verificar que la conversación pertenece al usuario
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, userId },
      include: {
        assistant: {
          select: {
            id: true,
            openaiAssistantId: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversación no encontrada');
    }

    if (conversation.isArchived) {
      throw new BadRequestException('No se pueden enviar mensajes a una conversación archivada');
    }

    try {
      // Enviar mensaje y obtener respuesta de OpenAI
      const result = await this.openAiService.sendMessageAndGetResponse(
        conversation.openaiThreadId,
        conversation.assistant?.openaiAssistantId || '',
        content
      );

      if (!result.messages || result.messages.length < 2) {
        throw new InternalServerErrorException('Error en la respuesta del asistente');
      }

      // Los mensajes vienen en orden inverso: [assistant_message, user_message]
      const assistantMessage = result.messages[0];
      const userMessage = result.messages[1];

      // Calcular costo
      const tokens = result.usage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
      const cost = this.openAiService.calculateCost(tokens.promptTokens, tokens.completionTokens);

      // Guardar mensajes en BD en una transacción
      const savedMessages = await this.prisma.$transaction(async (tx) => {
        // Guardar mensaje del usuario
        const savedUserMessage = await tx.message.create({
          data: {
            conversationId,
            role: 'USER',
            content,
            openaiMessageId: userMessage.id,
            inputTokens: tokens.promptTokens,
            outputTokens: 0,
            costUsd: 0,
          },
        });

        // Guardar mensaje del asistente
        const assistantContent = this.extractTextContent(assistantMessage.content);
        const savedAssistantMessage = await tx.message.create({
          data: {
            conversationId,
            role: 'ASSISTANT',
            content: assistantContent,
            openaiMessageId: assistantMessage.id,
            inputTokens: 0,
            outputTokens: tokens.completionTokens,
            costUsd: cost,
          },
        });

        // Actualizar estadísticas de la conversación
        const updatedConversation = await tx.conversation.update({
          where: { id: conversationId },
          data: {
            lastMessageAt: new Date(),
            totalMessages: { increment: 2 },
            totalTokensUsed: { increment: tokens.totalTokens },
            title: conversation.totalMessages === 0 ? this.generateTitle(content) : undefined,
          },
        });

        // Actualizar tokens del usuario
        await tx.user.update({
          where: { id: userId },
          data: {
            totalTokensUsed: { increment: tokens.totalTokens },
          },
        });

        return {
          userMessage: savedUserMessage,
          assistantMessage: savedAssistantMessage,
          conversation: updatedConversation,
        };
      });

      return {
        userMessage: this.formatMessage(savedMessages.userMessage),
        assistantMessage: this.formatMessage(savedMessages.assistantMessage),
        conversation: {
          id: savedMessages.conversation.id,
          totalMessages: savedMessages.conversation.totalMessages,
          totalTokensUsed: savedMessages.conversation.totalTokensUsed,
        },
        usage: {
          promptTokens: tokens.promptTokens,
          completionTokens: tokens.completionTokens,
          totalTokens: tokens.totalTokens,
          costUsd: cost,
        },
      };
    } catch (error) {
      console.error('Error sending message:', error);
      
      if (error.message?.includes('OpenAI') || error.message?.includes('timeout')) {
        throw new BadRequestException('Error de comunicación con el asistente. Inténtalo de nuevo.');
      }
      
      throw new InternalServerErrorException('Error al procesar el mensaje');
    }
  }

  async archiveConversation(id: string, userId: string): Promise<void> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, userId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversación no encontrada');
    }

    await this.prisma.conversation.update({
      where: { id },
      data: { isArchived: true },
    });
  }

  async deleteConversation(id: string, userId: string): Promise<void> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, userId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversación no encontrada');
    }

    try {
      // Eliminar thread de OpenAI (no crítico si falla)
      await this.openAiService.deleteThread(conversation.openaiThreadId);
    } catch (error) {
      console.warn('Could not delete OpenAI thread:', error);
    }

    // Eliminar conversación y mensajes (cascada)
    await this.prisma.conversation.delete({
      where: { id },
    });
  }

  // Métodos utilitarios
  private formatMessage(message: any): MessageResponseDto {
    return {
      id: message.id,
      role: message.role,
      content: message.content,
      inputTokens: message.inputTokens,
      outputTokens: message.outputTokens,
      costUsd: parseFloat(message.costUsd.toString()),
      isEdited: message.isEdited,
      editedAt: message.editedAt,
      createdAt: message.createdAt,
    };
  }

  private extractTextContent(content: any[]): string {
    if (!Array.isArray(content)) {
      return String(content);
    }

    return content
      .filter(item => item.type === 'text')
      .map(item => item.text?.value || '')
      .join('\n')
      .trim();
  }

  private generateTitle(firstMessage: string): string {
    // Generar título basado en el primer mensaje (máximo 50 caracteres)
    const words = firstMessage.trim().split(' ');
    let title = '';
    
    for (const word of words) {
      if ((title + ' ' + word).length > 47) {
        title += '...';
        break;
      }
      title += (title ? ' ' : '') + word;
    }
    
    return title || 'Nueva conversación';
  }
}