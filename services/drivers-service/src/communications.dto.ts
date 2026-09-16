import { IsIn, IsString, IsUUID, Length } from 'class-validator';
export class MessageDto {
  @IsUUID() clientMessageId!: string;
  @IsString() @Length(1, 2000) body!: string;
}
export class CallActionDto {
  @IsIn(['ACCEPT', 'REJECT', 'END']) action!: 'ACCEPT' | 'REJECT' | 'END';
}
