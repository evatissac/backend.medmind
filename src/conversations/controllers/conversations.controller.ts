import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
  Patch,
} from '@nestjs/common';
import { ConversationsService } from '../services/conversations.service';
import { CreateConversationDto } from '../dto/create-conversation.dto';
import { SendMessageDto } from '../dto/send-message.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TokenLimitGuard } from '../guards/token-limit.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { CurrentUserData } from '../../auth/decorators/current-user.decorator';

@Controller('conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createConversationDto: CreateConversationDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    const conversation = await this.conversationsService.create(createConversationDto, user.id);
    
    return {
      message: 'Conversación creada exitosamente',
      data: conversation,
    };
  }

  @Get()
  async findUserConversations(
    @CurrentUser() user: CurrentUserData,
    @Query('includeArchived') includeArchived?: string,
  ) {
    const includeArchivedBool = includeArchived === 'true';
    const conversations = await this.conversationsService.findUserConversations(
      user.id, 
      includeArchivedBool
    );
    
    return {
      message: 'Conversaciones obtenidas',
      data: conversations,
    };
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    const conversation = await this.conversationsService.findOne(id, user.id);
    
    return {
      message: 'Conversación obtenida',
      data: conversation,
    };
  }

  @Post(':id/messages')
  @UseGuards(TokenLimitGuard)
  @HttpCode(HttpStatus.CREATED)
  async sendMessage(
    @Param('id') id: string,
    @Body() sendMessageDto: SendMessageDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    const result = await this.conversationsService.sendMessage(id, sendMessageDto, user.id);
    
    return {
      message: 'Mensaje enviado exitosamente',
      data: result,
    };
  }

  @Patch(':id/archive')
  @HttpCode(HttpStatus.OK)
  async archive(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    await this.conversationsService.archiveConversation(id, user.id);
    
    return {
      message: 'Conversación archivada exitosamente',
      data: null,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    await this.conversationsService.deleteConversation(id, user.id);
    
    return {
      message: 'Conversación eliminada exitosamente',
      data: null,
    };
  }

  // Endpoint para obtener límites de tokens del usuario actual
  @Get('user/limits')
  async getUserLimits(@CurrentUser() user: CurrentUserData) {
    // Este endpoint podría expandirse para mostrar estadísticas de uso
    const userDetails = await this.conversationsService['prisma'].user.findUnique({
      where: { id: user.id },
      select: {
        subscriptionStatus: true,
        totalTokensUsed: true,
        subscriptionExpiresAt: true,
      },
    });

    // Obtener límites (duplicamos lógica del guard para consistencia)
    const tokenLimits = {
      TRIAL: 10000,
      ACTIVE: 100000,
      PREMIUM: 500000,
    };

    const limit = tokenLimits[userDetails?.subscriptionStatus || 'TRIAL'] || tokenLimits.TRIAL;
    
    return {
      message: 'Límites de usuario obtenidos',
      data: {
        subscription: userDetails?.subscriptionStatus || 'TRIAL',
        tokensUsed: userDetails?.totalTokensUsed || 0,
        tokenLimit: limit,
        tokensRemaining: Math.max(0, limit - (userDetails?.totalTokensUsed || 0)),
        percentageUsed: Math.round(((userDetails?.totalTokensUsed || 0) / limit) * 100),
        subscriptionExpiresAt: userDetails?.subscriptionExpiresAt || null,
      },
    };
  }

  // Endpoint para obtener estadísticas básicas del chat
  @Get('user/stats')
  async getUserStats(@CurrentUser() user: CurrentUserData) {
    const stats = await this.conversationsService['prisma'].conversation.aggregate({
      where: { userId: user.id },
      _count: {
        id: true,
      },
      _sum: {
        totalMessages: true,
        totalTokensUsed: true,
      },
    });

    const activeConversations = await this.conversationsService['prisma'].conversation.count({
      where: { 
        userId: user.id,
        isArchived: false,
      },
    });

    return {
      message: 'Estadísticas de usuario obtenidas',
      data: {
        totalConversations: stats._count.id || 0,
        activeConversations,
        totalMessages: stats._sum.totalMessages || 0,
        totalTokensUsed: stats._sum.totalTokensUsed || 0,
      },
    };
  }
}