import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface CreateAssistantData {
  name: string;
  instructions: string;
  model?: string;
  description?: string;
}

export interface UpdateAssistantData {
  name?: string;
  instructions?: string;
  description?: string;
}

export interface MessageData {
  role: 'user' | 'assistant';
  content: string;
}

export interface RunResult {
  runId: string;
  status: string;
  messages?: OpenAI.Beta.Threads.Messages.Message[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

@Injectable()
export class OpenAiService {
  private openai: OpenAI;
  private defaultModel: string;
  private maxTokens: number;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    const organization = this.configService.get<string>('OPENAI_ORGANIZATION');

    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required');
    }

    this.openai = new OpenAI({
      apiKey,
      organization,
    });

    this.defaultModel = this.configService.get<string>('OPENAI_MODEL') || 'gpt-4-turbo-preview';
    this.maxTokens = parseInt(this.configService.get<string>('OPENAI_MAX_TOKENS') || '4096');
  }

  // ============================================================================
  // GESTIÓN DE ASISTENTES
  // ============================================================================

  async createAssistant(data: CreateAssistantData): Promise<OpenAI.Beta.Assistants.Assistant> {
    try {
      const assistant = await this.openai.beta.assistants.create({
        name: data.name,
        instructions: data.instructions,
        model: data.model || this.defaultModel,
        description: data.description,
        tools: [], // Sin herramientas por ahora (PDFs vendrán después)
        temperature: 0.3, // Respuestas más consistentes para medicina
        top_p: 1.0,
      });

      return assistant;
    } catch (error) {
      console.error('Error creating OpenAI assistant:', error);
      throw new InternalServerErrorException('Error al crear el asistente en OpenAI');
    }
  }

  async updateAssistant(assistantId: string, data: UpdateAssistantData): Promise<OpenAI.Beta.Assistants.Assistant> {
    try {
      const assistant = await this.openai.beta.assistants.update(assistantId, {
        name: data.name,
        instructions: data.instructions,
        description: data.description,
      });

      return assistant;
    } catch (error) {
      console.error('Error updating OpenAI assistant:', error);
      throw new InternalServerErrorException('Error al actualizar el asistente en OpenAI');
    }
  }

  async deleteAssistant(assistantId: string): Promise<void> {
    try {
      await this.openai.beta.assistants.delete(assistantId);
    } catch (error) {
      console.error('Error deleting OpenAI assistant:', error);
      throw new InternalServerErrorException('Error al eliminar el asistente en OpenAI');
    }
  }

  async getAssistant(assistantId: string): Promise<OpenAI.Beta.Assistants.Assistant> {
    try {
      return await this.openai.beta.assistants.retrieve(assistantId);
    } catch (error) {
      console.error('Error retrieving OpenAI assistant:', error);
      throw new InternalServerErrorException('Error al obtener el asistente de OpenAI');
    }
  }

  // ============================================================================
  // GESTIÓN DE THREADS (CONVERSACIONES)
  // ============================================================================

  async createThread(): Promise<OpenAI.Beta.Threads.Thread> {
    try {
      return await this.openai.beta.threads.create();
    } catch (error) {
      console.error('Error creating OpenAI thread:', error);
      throw new InternalServerErrorException('Error al crear la conversación en OpenAI');
    }
  }

  async deleteThread(threadId: string): Promise<void> {
    try {
      await this.openai.beta.threads.delete(threadId);
    } catch (error) {
      console.error('Error deleting OpenAI thread:', error);
      // No lanzamos error aquí porque el thread podría ya estar eliminado
      console.warn(`Could not delete thread ${threadId}, might already be deleted`);
    }
  }

  // ============================================================================
  // GESTIÓN DE MENSAJES
  // ============================================================================

  async addMessage(threadId: string, content: string): Promise<OpenAI.Beta.Threads.Messages.Message> {
    try {
      return await this.openai.beta.threads.messages.create(threadId, {
        role: 'user',
        content: content,
      });
    } catch (error) {
      console.error('Error adding message to thread:', error);
      throw new InternalServerErrorException('Error al enviar el mensaje');
    }
  }

  async getMessages(threadId: string, limit = 20): Promise<OpenAI.Beta.Threads.Messages.Message[]> {
    try {
      const response = await this.openai.beta.threads.messages.list(threadId, {
        limit,
        order: 'desc', // Más recientes primero
      });
      
      return response.data;
    } catch (error) {
      console.error('Error getting messages from thread:', error);
      throw new InternalServerErrorException('Error al obtener los mensajes');
    }
  }

  // ============================================================================
  // EJECUCIÓN DE ASISTENTES
  // ============================================================================

  async runAssistant(threadId: string, assistantId: string): Promise<string> {
    try {
      const run = await this.openai.beta.threads.runs.create(threadId, {
        assistant_id: assistantId,
        max_completion_tokens: this.maxTokens,
      });

      return run.id;
    } catch (error) {
      console.error('Error running assistant:', error);
      throw new InternalServerErrorException('Error al ejecutar el asistente');
    }
  }

  async getRunStatus(threadId: string, runId: string): Promise<OpenAI.Beta.Threads.Runs.Run> {
    try {
      return await this.openai.beta.threads.runs.retrieve(runId, { thread_id: threadId });
    } catch (error) {
      console.error('Error getting run status:', error);
      throw new InternalServerErrorException('Error al verificar el estado de la ejecución');
    }
  }

  async waitForRunCompletion(threadId: string, runId: string, maxWaitTime = 60000): Promise<RunResult> {
    const startTime = Date.now();
    const pollInterval = 1000; // 1 segundo

    while (Date.now() - startTime < maxWaitTime) {
      const run = await this.getRunStatus(threadId, runId);

      if (run.status === 'completed') {
        // Obtener los mensajes nuevos
        const messages = await this.getMessages(threadId, 10);
        
        return {
          runId,
          status: run.status,
          messages,
          usage: run.usage ? {
            promptTokens: run.usage.prompt_tokens,
            completionTokens: run.usage.completion_tokens,
            totalTokens: run.usage.total_tokens,
          } : undefined,
        };
      }

      if (run.status === 'failed' || run.status === 'cancelled' || run.status === 'expired') {
        throw new BadRequestException(`La ejecución del asistente falló: ${run.status}`);
      }

      // Esperar antes del siguiente poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new BadRequestException('Timeout: El asistente tardó demasiado en responder');
  }

  // ============================================================================
  // UTILIDADES
  // ============================================================================

  async sendMessageAndGetResponse(
    threadId: string, 
    assistantId: string, 
    content: string
  ): Promise<RunResult> {
    // 1. Agregar mensaje del usuario
    await this.addMessage(threadId, content);

    // 2. Ejecutar el asistente
    const runId = await this.runAssistant(threadId, assistantId);

    // 3. Esperar a que complete y retornar resultado
    return await this.waitForRunCompletion(threadId, runId);
  }

  // Calcular costo estimado basado en tokens (precios aproximados)
  calculateCost(promptTokens: number, completionTokens: number, model = 'gpt-4-turbo-preview'): number {
    // Precios aproximados por 1K tokens (actualizar según OpenAI)
    const pricing = {
      'gpt-4-turbo-preview': { input: 0.01, output: 0.03 },
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
    };

    const modelPricing = pricing[model] || pricing['gpt-4-turbo-preview'];
    
    const inputCost = (promptTokens / 1000) * modelPricing.input;
    const outputCost = (completionTokens / 1000) * modelPricing.output;
    
    return inputCost + outputCost;
  }
}