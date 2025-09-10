import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { AssistantsService } from '../services/assistants.service';
import { CreateAssistantDto } from '../dto/create-assistant.dto';
import { UpdateAssistantDto } from '../dto/update-assistant.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { CurrentUserData } from '../../auth/decorators/current-user.decorator';

@Controller('assistants')
@UseGuards(JwtAuthGuard)
export class AssistantsController {
  constructor(private readonly assistantsService: AssistantsService) {}

  @Post()
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('content_admin', 'super_admin')
  @RequirePermissions('assistants.create')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createAssistantDto: CreateAssistantDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    const assistant = await this.assistantsService.create(createAssistantDto, user.id);
    
    return {
      message: 'Asistente médico creado exitosamente',
      data: assistant,
    };
  }

  @Get()
  async findAll(@Query('includeInactive') includeInactive?: string) {
    const isActiveOnly = includeInactive !== 'true';
    const assistants = await this.assistantsService.findAll(isActiveOnly);
    
    return {
      message: 'Lista de asistentes médicos obtenida',
      data: assistants,
    };
  }

  @Get('specialty/:specialty')
  async findBySpecialty(@Param('specialty') specialty: string) {
    const assistants = await this.assistantsService.findBySpecialty(specialty);
    
    return {
      message: `Asistentes de ${specialty} obtenidos`,
      data: assistants,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const assistant = await this.assistantsService.findOne(id);
    
    return {
      message: 'Asistente médico obtenido',
      data: assistant,
    };
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('content_admin', 'super_admin')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() updateAssistantDto: UpdateAssistantDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    // Verificar permisos específicos del usuario
    const canModify = await this.assistantsService.canUserModifyAssistant(
      id, 
      user.id, 
      user.roles
    );

    if (!canModify) {
      throw new ForbiddenException('No tienes permisos para modificar este asistente');
    }

    const assistant = await this.assistantsService.update(id, updateAssistantDto);
    
    return {
      message: 'Asistente médico actualizado exitosamente',
      data: assistant,
    };
  }

  @Delete(':id')
  @UseGuards(RolesGuard, PermissionsGuard)
  @Roles('content_admin', 'super_admin')
  @RequirePermissions('assistants.delete')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    // Verificar permisos específicos del usuario (except super_admin)
    if (!user.roles.includes('super_admin')) {
      const canModify = await this.assistantsService.canUserModifyAssistant(
        id, 
        user.id, 
        user.roles
      );

      if (!canModify) {
        throw new ForbiddenException('No tienes permisos para eliminar este asistente');
      }
    }

    await this.assistantsService.remove(id);
    
    return {
      message: 'Asistente médico eliminado exitosamente',
      data: null,
    };
  }

  // Endpoint especial para obtener asistentes disponibles para chat
  @Get('available/for-chat')
  async getAvailableForChat() {
    const assistants = await this.assistantsService.findAll(true);
    
    // Formatear para la interfaz de chat
    const chatAssistants = assistants.map(assistant => ({
      id: assistant.id,
      name: assistant.name,
      specialty: assistant.specialty,
      description: assistant.description,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(assistant.name)}&background=0D8ABC&color=fff&size=128`,
    }));
    
    return {
      message: 'Asistentes disponibles para chat',
      data: chatAssistants,
    };
  }

  // Endpoint para obtener estadísticas de un asistente (para admins)
  @Get(':id/stats')
  @UseGuards(RolesGuard)
  @Roles('content_admin', 'super_admin', 'analytics_admin')
  async getStats(@Param('id') id: string) {
    // Este endpoint se puede expandir con métricas más detalladas
    const assistant = await this.assistantsService.findOne(id);
    
    const stats = {
      totalConversations: assistant.conversationsCount,
      totalFiles: assistant.filesCount,
      isActive: assistant.isActive,
      createdAt: assistant.createdAt,
      // Agregar más estadísticas según necesidad
    };
    
    return {
      message: 'Estadísticas del asistente obtenidas',
      data: stats,
    };
  }
}