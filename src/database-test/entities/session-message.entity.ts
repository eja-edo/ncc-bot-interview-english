import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, ValueTransformer } from 'typeorm';
import { InterviewSession } from './interview-session-test.entity';

// Transformer để convert bigint <-> string
const BigIntTransformer: ValueTransformer = {
  to: (value: string | number) => value?.toString(),
  from: (value: string | number) => value?.toString(),
};

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
}

export enum MessageType {
  TEXT = 'text',
  AUDIO = 'audio',
  TRANSCRIPT = 'transcript',
}

@Entity('session_messages')
export class SessionMessage {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'bigint', transformer: BigIntTransformer })
  sessionId: string;

  @ManyToOne(() => InterviewSession, session => session.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sessionId' })
  session: InterviewSession;

  @Column({
    type: 'enum',
    enum: MessageRole,
  })
  role: MessageRole;

  @Column({
    type: 'enum',
    enum: MessageType,
    default: MessageType.TEXT,
  })
  type: MessageType;

  @Column('text')
  content: string;

  // For audio messages
  @Column({ nullable: true })
  audioFilePath: string;

  @Column({ nullable: true })
  audioDurationMs: number;

  // For transcript from audio
  @Column('text', { nullable: true })
  transcript: string;

  @Column({ nullable: true })
  questionNumber: number; // Which question this relates to

  @Column('jsonb', { nullable: true })
  metadata: {
    confidence?: number; // STT confidence
    language?: string;
    emotion?: string; // Future: emotion detection
  };

  @CreateDateColumn()
  createdAt: Date;
}