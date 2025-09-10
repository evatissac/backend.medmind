import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CreateConversationDto {
  @IsString({ message: 'El ID del asistente es requerido' })
  @IsNotEmpty({ message: 'El ID del asistente no puede estar vacío' })
  assistantId: string;

  @IsOptional()
  @IsString({ message: 'El título debe ser una cadena de texto' })
  @MaxLength(200, { message: 'El título no puede tener más de 200 caracteres' })
  title?: string;
}