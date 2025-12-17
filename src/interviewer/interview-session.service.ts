import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InterviewSession, SessionStatus, SessionMode } from '../database-test/entities/interview-session-test.entity';
import { SessionMessage, MessageRole, MessageType } from '../database-test/entities/session-message.entity';
import { TemplateService } from './template.service';
import { UserService } from './user.service';

@Injectable()
export class InterviewSessionService {
  private readonly logger = new Logger(InterviewSessionService.name);

  constructor(
    @InjectRepository(InterviewSession)
    private readonly sessionRepo: Repository<InterviewSession>,
    @InjectRepository(SessionMessage)
    private readonly messageRepo: Repository<SessionMessage>,
    private readonly templateService: TemplateService,
    private readonly userService: UserService,
  ) {}

  /**
   * Create new interview session
   */
  async createSession(
    mezonUserId: string,
    username: string,
    channelId: string,
    roomName: string,
    templateId: string,
    mode: SessionMode = SessionMode.TEXT,
  ): Promise<InterviewSession> {
    // Find or create user
    const user = await this.userService.findOrCreateUser(mezonUserId, username);
    
    // Get template with full info
    const template = await this.templateService.getTemplateById(templateId);

    // Check for active session
    const existingSession = await this.getActiveSession(user.id, channelId);
    if (existingSession) {
      throw new BadRequestException(
        'You already have an active interview session. Use *cancel to end it first.'
      );
    }

    // Create session
    const session = this.sessionRepo.create({
      userId: user.mezonUserId,
      channelId,
      roomName,
      templateId,
      template, // Include template relation
      mode,
      status: SessionStatus.PENDING,
      currentQuestionIndex: 0,
      questionScores: [],
      audioFilePaths: [],
    });

    const savedSession = await this.sessionRepo.save(session);
    this.logger.log(`Created session ${savedSession.id} for user ${user.id}`);

    // Return with full relations
    return this.getSessionById(savedSession.id);
  }

  /**
   * Get session by ID with all relations
   */
  async getSessionById(sessionId: string): Promise<InterviewSession | null> {
    return this.sessionRepo.findOne({
      where: { id: sessionId },
      relations: ['template', 'user', 'messages'],
    });
  }

  /**
   * Get active session for user in channel
   */
  async getActiveSession(userId: string, channelId: string): Promise<InterviewSession | null> {
    return this.sessionRepo.findOne({
      where: {
        userId,
        channelId,
        status: SessionStatus.IN_PROGRESS || SessionStatus.COMPLETED,
      },
      relations: ['template', 'user', 'messages'],
    });
  }

  /**
   * Start session
   */
  async startSession(sessionId: string): Promise<InterviewSession> {
    const session = await this.getSessionById(sessionId);
    if (!session) {
      throw new BadRequestException('Session not found');
    }

    session.status = SessionStatus.IN_PROGRESS;
    session.startedAt = new Date();
    await this.sessionRepo.save(session);

    return this.getSessionById(sessionId);
  }

  /**
   * Add message to session - FIX: Ensure session is loaded properly
   */
  async addMessage(
    sessionId: string,
    role: MessageRole,
    content: string,
    type: MessageType = MessageType.TEXT,
    questionNumber?: number,
    audioFilePath?: string,
  ): Promise<SessionMessage> {
    // Verify session exists first
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      throw new BadRequestException(`Session not found: ${sessionId}`);
    }

    // Create message with explicit sessionId
    const message = this.messageRepo.create({
      sessionId: session.id, // Explicitly set sessionId
      role,
      type,
      content,
      questionNumber,
      audioFilePath,
    });

    const savedMessage = await this.messageRepo.save(message);

    // Increment question index if assistant message with question number
    if (role === MessageRole.ASSISTANT && questionNumber) {
      session.currentQuestionIndex = questionNumber;
      await this.sessionRepo.save(session);
    }

    this.logger.log(`Added message to session ${sessionId}, role: ${role}`);
    return savedMessage;
  }

/**
   * Complete session with overall feedback
   */
  async completeSession(
    sessionId: string,
    overallFeedback: InterviewSession['overallFeedback'],
  ): Promise<InterviewSession> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      throw new BadRequestException('Session not found');
    }

    const duration = Math.floor(
      (new Date().getTime() - new Date(session.startedAt).getTime()) / 1000
    );

    session.status = SessionStatus.COMPLETED;
    session.completedAt = new Date();
    session.overallFeedback = overallFeedback;
    session.durationSeconds = duration;

    await this.sessionRepo.save(session);
    this.logger.log(`Completed session ${sessionId}`);

    return this.getSessionById(sessionId);
  }

  async cancelSession(userId: string, channelId: string): Promise<void> {
    const session = await this.getActiveSession(userId, channelId);
    if (session) {
      session.status = SessionStatus.CANCELLED;
      await this.sessionRepo.save(session);
      this.logger.log(`Cancelled session ${session.id}`);
    }
  }

  /**
   * Get user session history
   */
  async getUserSessions(userId: string, limit: number = 10): Promise<InterviewSession[]> {
    return this.sessionRepo.find({
      where: { userId },
      relations: ['template'],
      order: { startedAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Format session history
   */
  formatSessionHistory(sessions: InterviewSession[]): string {
    if (sessions.length === 0) {
      return 'No interview history found.';
    }

    let message = '📊 **Your Interview History:**\n\n';

    sessions.forEach((session, index) => {
      const statusEmoji = {
        pending: '⏳',
        in_progress: '▶️',
        completed: '✅',
        cancelled: '❌',
      }[session.status];

      const modeEmoji = {
        text: '💬',
        voice: '🎤',
        mixed: '🎭',
      }[session.mode];

      message += `${index + 1}. ${statusEmoji} ${session.template.name} ${modeEmoji}\n`;
      message += `   Started: ${new Date(session.startedAt).toLocaleString()}\n`;
      message += `   Status: ${session.status}\n`;

      if (session.overallFeedback?.totalScore) {
        message += `   Score: ${session.overallFeedback.totalScore}/10\n`;
      }

      if (session.durationSeconds) {
        const minutes = Math.floor(session.durationSeconds / 60);
        message += `   Duration: ${minutes} minutes\n`;
      }

      message += '\n';
    });

    return message;
  }
  
}