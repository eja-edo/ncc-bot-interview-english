import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany,} from 'typeorm';
import { InterviewTemplate } from './interview-template.entity';
import { User } from './user-test.entity';
import { SessionMessage } from './session-message.entity';

export enum SessionStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum SessionMode {
  TEXT = 'text',
  VOICE = 'voice',
  MIXED = 'mixed',
}

@Entity('interview_sessions')
export class InterviewSession {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'varchar', length: 50 })
  userId: string;

  @ManyToOne(() => User, user => user.sessions)
  @JoinColumn({ name: 'userId', referencedColumnName: 'mezonUserId' })
  user: User;

  @Column()
  channelId: string;

  @Column({ nullable: true })
  roomName: string; // Voice room name/meeting code

  @Column()
  templateId: string;

  @ManyToOne(() => InterviewTemplate)
  @JoinColumn({ name: 'templateId' })
  template: InterviewTemplate;

  @Column({
    type: 'enum',
    enum: SessionStatus,
    default: SessionStatus.PENDING,
  })
  status: SessionStatus;

  @Column({
    type: 'enum',
    enum: SessionMode,
    default: SessionMode.MIXED,
  })
  mode: SessionMode;

  @Column({ default: 0 })
  currentQuestionIndex: number;

  @OneToMany(() => SessionMessage, message => message.session, { cascade: true })
  messages: SessionMessage[];

  // Overall feedback
  @Column('jsonb', { nullable: true })
  overallFeedback: {
    overall: string;
    strengths: string[];
    improvements: string[];
    totalScore: number;
  };

  // Per-question scoring
  @Column('jsonb', { default: [] })
  questionScores: {
    questionNumber: number;
    question: string;
    answer: string;
    score: number;
    feedback: string;
  }[];

  // Audio file paths
  @Column('simple-array', { nullable: true })
  audioFilePaths: string[];

  // Full transcript for voice mode
  @Column('text', { nullable: true })
  fullTranscript: string;

  @CreateDateColumn()
  startedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  completedAt: Date;

  @Column({ nullable: true, type: 'int' })
  durationSeconds: number; // Total duration in seconds
}