import { IsString, IsOptional, MinLength, MaxLength, IsIn } from 'class-validator';

const MEDICAL_SPECIALTIES = [
  'cardiologia',
  'neurologia',
  'medicina_interna',
  'pediatria',
  'ginecologia',
  'urologia',
  'traumatologia',
  'dermatologia',
  'psiquiatria',
  'oftalmologia',
  'otorrinolaringologia',
  'anestesiologia',
  'radiologia',
  'patologia',
  'medicina_familiar',
  'medicina_emergencia',
  'oncologia',
  'endocrinologia',
  'gastroenterologia',
  'neumologia',
  'nefrologia',
  'reumatologia',
  'infectologia',
  'hematologia',
  'medicina_intensiva',
] as const;

export class CreateAssistantDto {
  @IsString({ message: 'El nombre es requerido' })
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres' })
  @MaxLength(100, { message: 'El nombre no puede tener más de 100 caracteres' })
  name: string;

  @IsString({ message: 'La especialidad es requerida' })
  @IsIn(MEDICAL_SPECIALTIES, { 
    message: `La especialidad debe ser una de: ${MEDICAL_SPECIALTIES.join(', ')}` 
  })
  specialty: string;

  @IsString({ message: 'Las instrucciones son requeridas' })
  @MinLength(10, { message: 'Las instrucciones deben tener al menos 10 caracteres' })
  @MaxLength(32000, { message: 'Las instrucciones son demasiado largas' })
  instructions: string;

  @IsOptional()
  @IsString({ message: 'La descripción debe ser una cadena de texto' })
  @MaxLength(500, { message: 'La descripción no puede tener más de 500 caracteres' })
  description?: string;

  @IsOptional()
  @IsString({ message: 'El modelo debe ser una cadena de texto' })
  @IsIn(['gpt-4-turbo-preview', 'gpt-4', 'gpt-3.5-turbo'], {
    message: 'El modelo debe ser uno de: gpt-4-turbo-preview, gpt-4, gpt-3.5-turbo'
  })
  model?: string;
}