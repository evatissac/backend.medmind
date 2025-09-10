import { 
  Injectable, 
  NotFoundException, 
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OpenAiService } from '../../common/services/openai.service';
import { CreateAssistantDto } from '../dto/create-assistant.dto';
import { UpdateAssistantDto } from '../dto/update-assistant.dto';
import { 
  AssistantResponseDto, 
  AssistantListResponseDto, 
  AssistantDetailResponseDto 
} from '../dto/assistant-response.dto';

@Injectable()
export class AssistantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly openAiService: OpenAiService,
  ) {}

  async create(createAssistantDto: CreateAssistantDto, createdBy: string): Promise<AssistantResponseDto> {
    const { name, specialty, instructions, description, model } = createAssistantDto;

    try {
      // 1. Crear asistente en OpenAI
      const openAiAssistant = await this.openAiService.createAssistant({
        name,
        instructions,
        description,
        model,
      });

      // 2. Guardar en la base de datos
      const assistant = await this.prisma.assistant.create({
        data: {
          name,
          specialty,
          instructions,
          description,
          openaiAssistantId: openAiAssistant.id,
          createdBy,
        },
        include: {
          creator: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      });

      return {
        id: assistant.id,
        name: assistant.name,
        specialty: assistant.specialty,
        description: assistant.description || undefined,
        isActive: assistant.isActive,
        createdAt: assistant.createdAt,
        updatedAt: assistant.updatedAt,
        creator: assistant.creator ? {
          id: assistant.creator.id,
          fullName: assistant.creator.fullName,
        } : undefined,
      };
    } catch (error) {
      // Si falla la creación en OpenAI, no guardamos en BD
      if (error.message?.includes('OpenAI')) {
        throw error;
      }
      
      console.error('Error creating assistant:', error);
      throw new InternalServerErrorException('Error al crear el asistente');
    }
  }

  async findAll(isActiveOnly = true): Promise<AssistantListResponseDto[]> {
    const assistants = await this.prisma.assistant.findMany({
      where: isActiveOnly ? { isActive: true } : undefined,
      select: {
        id: true,
        name: true,
        specialty: true,
        description: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: [
        { isActive: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return assistants.map(assistant => ({
      ...assistant,
      description: assistant.description || undefined,
    }));
  }

  async findOne(id: string): Promise<AssistantDetailResponseDto> {
    const assistant = await this.prisma.assistant.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            fullName: true,
          },
        },
        files: {
          select: {
            id: true,
          },
        },
        conversations: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!assistant) {
      throw new NotFoundException('Asistente no encontrado');
    }

    return {
      id: assistant.id,
      name: assistant.name,
      specialty: assistant.specialty,
      description: assistant.description || undefined,
      instructions: assistant.instructions || '',
      openaiAssistantId: assistant.openaiAssistantId,
      isActive: assistant.isActive,
      createdAt: assistant.createdAt,
      updatedAt: assistant.updatedAt,
      creator: assistant.creator ? {
        id: assistant.creator.id,
        fullName: assistant.creator.fullName,
      } : undefined,
      filesCount: assistant.files.length,
      conversationsCount: assistant.conversations.length,
    };
  }

  async update(id: string, updateAssistantDto: UpdateAssistantDto): Promise<AssistantResponseDto> {
    // Verificar que el asistente existe
    const existingAssistant = await this.prisma.assistant.findUnique({
      where: { id },
    });

    if (!existingAssistant) {
      throw new NotFoundException('Asistente no encontrado');
    }

    const { name, specialty, instructions, description, isActive } = updateAssistantDto;

    try {
      // Si se están actualizando campos que afectan a OpenAI
      if (name || instructions || description) {
        await this.openAiService.updateAssistant(existingAssistant.openaiAssistantId, {
          name,
          instructions,
          description,
        });
      }

      // Actualizar en la base de datos
      const assistant = await this.prisma.assistant.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(specialty && { specialty }),
          ...(instructions && { instructions }),
          ...(description && { description }),
          ...(isActive !== undefined && { isActive }),
        },
        include: {
          creator: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      });

      return {
        id: assistant.id,
        name: assistant.name,
        specialty: assistant.specialty,
        description: assistant.description || undefined,
        isActive: assistant.isActive,
        createdAt: assistant.createdAt,
        updatedAt: assistant.updatedAt,
        creator: assistant.creator ? {
          id: assistant.creator.id,
          fullName: assistant.creator.fullName,
        } : undefined,
      };
    } catch (error) {
      if (error.message?.includes('OpenAI')) {
        throw error;
      }
      
      console.error('Error updating assistant:', error);
      throw new InternalServerErrorException('Error al actualizar el asistente');
    }
  }

  async remove(id: string): Promise<void> {
    // Verificar que el asistente existe
    const assistant = await this.prisma.assistant.findUnique({
      where: { id },
      include: {
        conversations: {
          select: { id: true },
        },
      },
    });

    if (!assistant) {
      throw new NotFoundException('Asistente no encontrado');
    }

    // Verificar que no tiene conversaciones activas
    if (assistant.conversations.length > 0) {
      throw new BadRequestException(
        'No se puede eliminar un asistente que tiene conversaciones asociadas. ' +
        'Desactívalo en su lugar.'
      );
    }

    try {
      // Eliminar de OpenAI primero
      await this.openAiService.deleteAssistant(assistant.openaiAssistantId);

      // Eliminar de la base de datos
      await this.prisma.assistant.delete({
        where: { id },
      });
    } catch (error) {
      if (error.message?.includes('OpenAI')) {
        // Si falla la eliminación en OpenAI, solo marcamos como inactivo
        console.error('Failed to delete assistant from OpenAI, marking as inactive:', error);
        await this.prisma.assistant.update({
          where: { id },
          data: { isActive: false },
        });
        throw new BadRequestException(
          'No se pudo eliminar completamente el asistente. Se marcó como inactivo.'
        );
      }
      
      console.error('Error deleting assistant:', error);
      throw new InternalServerErrorException('Error al eliminar el asistente');
    }
  }

  async findBySpecialty(specialty: string): Promise<AssistantListResponseDto[]> {
    const assistants = await this.prisma.assistant.findMany({
      where: {
        specialty,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        specialty: true,
        description: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return assistants.map(assistant => ({
      ...assistant,
      description: assistant.description || undefined,
    }));
  }

  async validateAssistantExists(id: string): Promise<boolean> {
    const assistant = await this.prisma.assistant.findUnique({
      where: { id, isActive: true },
    });

    return !!assistant;
  }

  async getAssistantForConversation(id: string) {
    const assistant = await this.prisma.assistant.findUnique({
      where: { id, isActive: true },
      select: {
        id: true,
        name: true,
        specialty: true,
        openaiAssistantId: true,
      },
    });

    if (!assistant) {
      throw new NotFoundException('Asistente no encontrado o inactivo');
    }

    return assistant;
  }

  // Método utilitario para verificar permisos de modificación
  async canUserModifyAssistant(assistantId: string, userId: string, userRoles: string[]): Promise<boolean> {
    // Super admin puede modificar cualquier asistente
    if (userRoles.includes('super_admin')) {
      return true;
    }

    // Content admin puede modificar asistentes que creó
    if (userRoles.includes('content_admin')) {
      const assistant = await this.prisma.assistant.findUnique({
        where: { id: assistantId },
        select: { createdBy: true },
      });

      return assistant?.createdBy === userId;
    }

    return false;
  }
}