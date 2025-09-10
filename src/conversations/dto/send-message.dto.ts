import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsString({ message: 'El contenido del mensaje es requerido' })
  @IsNotEmpty({ message: 'El contenido del mensaje no puede estar vacío' })
  @MinLength(1, { message: 'El mensaje debe tener al menos 1 carácter' })
  @MaxLength(4000, { message: 'El mensaje no puede tener más de 4000 caracteres' })
  content: string;
}