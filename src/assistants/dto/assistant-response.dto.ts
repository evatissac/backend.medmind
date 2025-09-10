export class AssistantResponseDto {
  id: string;
  name: string;
  specialty: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  creator?: {
    id: string;
    fullName: string;
  };
}

export class AssistantListResponseDto {
  id: string;
  name: string;
  specialty: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
}

export class AssistantDetailResponseDto extends AssistantResponseDto {
  instructions: string;
  openaiAssistantId: string;
  filesCount: number;
  conversationsCount: number;
}