import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user-test.entity';

export enum PromptType {
  GREETING = 'greeting',
  QUESTION = 'question',
  FEEDBACK = 'feedback',
  FOLLOW_UP = 'follow_up',
}

@Entity('custom_prompts')
export class CustomPrompt {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column()
  name: string;

  @Column('text')
  content: string;

  @Column({
    type: 'enum',
    enum: PromptType,
  })
  type: PromptType;

  @Column({ nullable: true })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ default: false })
  isGlobal: boolean; // Global prompts can be used by all users

  @Column({ default: true })
  isActive: boolean;

  @Column('jsonb', { nullable: true })
  variables: string[]; // Variables that can be replaced in prompt

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}