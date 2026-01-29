import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum InterviewLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
}

export enum InterviewType {
  GENERAL = 'general',
  TECHNICAL = 'technical',
  BEHAVIORAL = 'behavioral',
  SITUATIONAL = 'situational',
}

export interface QuestionSection {
  name: string;
  description?: string;
  questions: string[];
  questionsToSelect: number; // How many questions to randomly select from this section
}

@Entity('interview_templates')
export class InterviewTemplate {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column()
  name: string;

  @Column('text')
  description: string;

  @Column({
    type: 'enum',
    enum: InterviewType,
    default: InterviewType.GENERAL,
  })
  type: InterviewType;

  @Column({
    type: 'enum',
    enum: InterviewLevel,
    default: InterviewLevel.INTERMEDIATE,
  })
  level: InterviewLevel;

  @Column('text')
  systemPrompt: string;

  @Column('simple-array')
  sampleQuestions: string[];
  // NEW: Structured sections for Non-AI templates
  @Column('jsonb', { nullable: true })
  questionSections: QuestionSection[];

  @Column({ default: 5 })
  numberOfQuestions: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
