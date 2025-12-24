import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectQueue } from "@nestjs/bull";
import { Queue } from "bull";
import type { Nezon } from "@n0xgg04/nezon";
import { EventSource } from "eventsource";
import axios from "axios";
import { AxiosClient } from "@/shared/lib/axios-client";
import {
  AGENT_ENDPOINTS,
  buildStreamMessageUrl,
} from "@/shared/constants/agent";
import { AgentEvent } from "@/agent/agent.type";
import { Account } from "@/agent/agent.type";
import { TTSProvider } from "./tts.provider";
import { EnhancedInterviewerService } from "@/interviewer/interview.service";
import { InterviewSessionService } from "@/interviewer/interview-session.service";
import { MessageRole, MessageType } from "@/database-test/entities/session-message.entity";

interface VoiceBuffer {
  chunks: string[];
  lastUpdateTime: number;
  timeoutHandle: NodeJS.Timeout | null;
  isProcessing: boolean;
}

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private readonly sseConnections = new Map<string, EventSource>();
  private readonly roomSessions = new Map<string, string>();

  // Cache sessions để tránh load lại nhiều lần
  private readonly sessionCache = new Map<string, {
    data: any,
    timestamp: number
  }>();
  private readonly CACHE_TTL_MS = 30000;

  constructor(
    @InjectQueue("tts") private readonly ttsQueue: Queue,
    private readonly configService: ConfigService,
    private readonly axiosClient: AxiosClient,
    private readonly interviewer: EnhancedInterviewerService,
    private readonly ttsService: TTSProvider,
    private readonly sessionService: InterviewSessionService,
  ) { }

  async handleRemoveAgent(
    client: Nezon.Client,
    event: AgentEvent,
    account: Account
  ): Promise<void> {
    try {
      const channel = await client.channels.fetch(
        event.voice_channel_id ?? event.channel_id ?? ""
      );

      if (!channel?.meeting_code) {
        this.logger.error("Channel or meeting_code not found");
        return;
      }

      const meeting_code = channel.meeting_code;

      const payload = {
        account,
        room_name: meeting_code,
      };

      const response = await this.axiosClient
        .getInstance()
        .post(AGENT_ENDPOINTS.CANCEL_DISPATCH, payload);

      this.logger.log(
        `Agent removed, API response: ${JSON.stringify(response.data)}`
      );

      const sseKey = `${account.appid}-${meeting_code}`;
      const existingSSE = this.sseConnections.get(sseKey);
      if (existingSSE) {
        existingSSE.close();
        this.sseConnections.delete(sseKey);
        this.logger.log(`🔌 Closed SSE connection for room ${meeting_code}`);
      }

      if (this.roomSessions.has(meeting_code)) {
        const sessionId = this.roomSessions.get(meeting_code);
        this.roomSessions.delete(meeting_code);
        // Clear cache when removing session
        this.sessionCache.delete(sessionId!);
        this.logger.log(`🗑️ Cleared session ${sessionId} mapping for room ${meeting_code}`);
      }
    } catch (error) {
      this.logger.error(
        `Error removing agent: ${error}`,
        (error as Error)?.stack
      );
    }
  }

  async handleInviteAgent(
    client: Nezon.Client,
    event: AgentEvent,
    account: Account
  ): Promise<void> {
    try {
      const channel = await client.channels.fetch(
        event.voice_channel_id ?? event.channel_id ?? ""
      );

      if (!channel?.meeting_code) {
        this.logger.error("Channel or meeting_code not found");
        return;
      }

      const meeting_code = channel.meeting_code;

      const payload = {
        account,
        room_name: meeting_code,
      };

      let data;

      try {
        const response = await this.axiosClient
          .getInstance()
          .post(AGENT_ENDPOINTS.CREATE_DISPATCH, payload);

        data = response.data;
        this.logger.log(`Agent invited, API response: ${JSON.stringify(data)}`);
      } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
          this.logger.error(
            `Invalid response from API: ${error.response.status
            } - ${JSON.stringify(error.response.data)}`
          );
        } else {
          this.logger.error(`Error calling API: ${error}`);
        }
        data = null;
      }

      try {
        const baseurl = this.configService.get<string>("AGENT_BASE_URL")!;
        const sseUrl = buildStreamMessageUrl(
          baseurl,
          account.appid,
          account.token,
          meeting_code
        );
        this.logger.log(`🔗 SSE URL: ${sseUrl}`);

        const sseKey = `${account.appid}-${meeting_code}`;
        const existingSSE = this.sseConnections.get(sseKey);
        if (existingSSE) {
          this.logger.log(`🔌 Closing existing SSE connection for room ${meeting_code}`);
          existingSSE.close();
          this.sseConnections.delete(sseKey);
        }

        this.logger.log(`🔌 Creating NEW SSE connection for room ${meeting_code}`);
        const es = new EventSource(sseUrl);

        es.onopen = () => {
          this.logger.log(`✅ SSE connection OPENED for room ${meeting_code}`);
        };

        es.onmessage = (event) => {
          this.logger.log(`[SSE][Room ${meeting_code}] data: ${event.data}`);
          //this.pushSSEMessage(meeting_code, event.data);

          // Check session mapping
          const sessionId = this.roomSessions.get(meeting_code);
          if (!sessionId) {
            this.logger.error(`❌ [SSE] No session mapped for room ${meeting_code}!`);
            this.logger.log(`📊 Current mappings: ${JSON.stringify(Array.from(this.roomSessions.entries()))}`);
            return;
          }

          this.logger.log(`✅ [SSE] Found session ${sessionId} for room ${meeting_code}`);
          this.handleVoiceMessage(meeting_code, event.data, client);
        };

        es.onerror = (err: any) => {
          this.logger.error(
            `[SSE][Room ${meeting_code}] error`,
            JSON.stringify(err),
          );


          if (es.readyState === EventSource.CLOSED) {
            this.logger.warn(
              `[SSE][Room ${meeting_code}] connection closed, attempting to reconnect...`
            );
          }
        };

        this.sseConnections.set(sseKey, es);
      } catch (error) {
        this.logger.error(
          `Error setting up SSE: ${error}`,
          (error as Error)?.stack
        );
      }
    } catch (error) {
      this.logger.error(
        `Error inviting agent: ${error}`,
        (error as Error)?.stack
      );
    }
  }

  /**
   * OPTIMIZED: Get cached session hoặc load từ DB
   */
  private async getCachedSession(sessionId: string, forceRefresh = false): Promise<any> {
    const cached = this.sessionCache.get(sessionId);
    const now = Date.now();

    // Return cache nếu còn fresh và không force refresh
    if (!forceRefresh && cached && (now - cached.timestamp) < this.CACHE_TTL_MS) {
      this.logger.debug(`Cache hit for session ${sessionId}`);
      return cached.data;
    }

    // Load từ DB
    const session = await this.sessionService.getSessionById(sessionId);
    if (session) {
      this.sessionCache.set(sessionId, {
        data: session,
        timestamp: now
      });
      this.logger.debug(`Cache refreshed for session ${sessionId}`);
    }

    return session;
  }

  /**
   * OPTIMIZED: Clear cache sau khi update
   */
  private clearSessionCache(sessionId: string): void {
    this.sessionCache.delete(sessionId);
  }

  private async handleVoiceMessage(
    roomName: string,
    data: string,
    client: Nezon.Client,
  ): Promise<void> {
    try {
      // Clean and validate data
      const voiceText = data.trim();

      if (!voiceText || voiceText.length < 2) {
        this.logger.log(`[Voice] Skipping empty/short message`);
        return;
      }

      this.logger.log(`[Voice][Room ${roomName}] Processing: "${voiceText}"`);

      // Get session for this room
      const sessionId = this.roomSessions.get(roomName);
      if (!sessionId) {
        this.logger.warn(`[Voice] No session found for room ${roomName}`);
        return;
      }

      const session = await this.getCachedSession(sessionId);
      if (!session) {
        this.logger.warn(`[Voice] Session ${sessionId} not found`);
        return;
      }

      // Check if first message or answer
      const userMessages = session.messages?.filter(m => m.role === MessageRole.USER) || [];
      const isFirstMessage = userMessages.length === 0;

      // Save voice message to DB
      await this.sessionService.addMessage(
        session.id,
        MessageRole.USER,
        voiceText,
        MessageType.AUDIO,
        isFirstMessage ? undefined : session.currentQuestionIndex,
      );

      this.clearSessionCache(sessionId);

      this.logger.log(`[Voice] Saved message to session ${session.id}`);

      // Send confirmation to text channel
      const channel = client.channels.get(session.channelId);
      if (channel) {
        await channel.send({
          t: `${voiceText}`
        });
      }

      // Process the answer
      await this.processUserAnswer(sessionId, client, session.channelId);

    } catch (error) {
      this.logger.error(`[Voice] Error processing message:`, error);
    }
  }

  /**
   * Common logic to process user's answer (from text or voice)
   */
  async processUserAnswer(
    sessionId: string,
    client: Nezon.Client,
    channelId: string,
  ): Promise<void> {

    // Load fresh session with cache
    const session = await this.getCachedSession(sessionId, true); // Force refresh

    const nextQuestionNumber = session.currentQuestionIndex + 1;
    const totalQuestions = session.template.numberOfQuestions;

    // Check if complete
    if (nextQuestionNumber > totalQuestions) {
      this.logger.log('Interview complete, generating feedback');

      const sessionForFeedback = await this.getCachedSession(sessionId, true);
      const overallFeedback = await this.interviewer.generateOverallFeedback(
        sessionForFeedback
      );

      await this.sessionService.completeSession(session.id, overallFeedback);
      this.clearSessionCache(sessionId);

      const completedSession = await this.getCachedSession(sessionId, true);

      // Send TTS completion
      const spokenCompletion = 'Congratulations! You have completed the interview. Thank you for your time joining this interview';

      // Save bot's completion message
      await this.sessionService.addMessage(
        session.id,
        MessageRole.ASSISTANT,
        spokenCompletion,
        MessageType.TEXT,
      );

      this.clearSessionCache(sessionId);

      await this.sendTTS(session.roomName, spokenCompletion);

      // Completion message
      const completionMessage = `🎉 **Interview Complete!**

"${spokenCompletion}"

**Session Summary:**
 Template: ${session.template.name}
 Questions Answered: ${session.template.numberOfQuestions}

━━━━━━━━━━━━━━━━━━━━━━━━

Generating detailed feedback...`;
      // Send final feedback to text channel
      const channel = client.channels.get(channelId);
      if (channel) {
        await channel.send({ t: completionMessage });
      } else {
        this.logger.error(`Channel ${channelId} not found`);
      }
      return;
    }

    // Generate next question
    this.logger.log(`Generating question ${nextQuestionNumber}`);

    // OPTIMIZED: Load session một lần cho question generation
    const sessionForQuestion = await this.getCachedSession(sessionId, true);
    const nextQuestion = await this.interviewer.generateQuestion(
      sessionForQuestion,
      nextQuestionNumber,
    );

    // Save next question
    await this.sessionService.addMessage(
      session.id,
      MessageRole.ASSISTANT,
      nextQuestion,
      MessageType.TEXT,
      nextQuestionNumber,
    );

    this.clearSessionCache(sessionId);

    // Send TTS for next question
    await this.sendTTS(session.roomName, nextQuestion);

    const responseMessage = ` Answer recorded!

**Bot is speaking the next question via voice...**

If you want to see the text:

━━━━━━━━━━━━━━━━━━━━━━━━

**Question ${nextQuestionNumber}/${totalQuestions}:**

${nextQuestion}

━━━━━━━━━━━━━━━━━━━━━━━━

Type your answer or speak in the voice room...`;

    const channel = client.channels.get(channelId);
    if (channel) {
      await channel.send({ t: responseMessage });
    } else {
      this.logger.error(`Channel ${channelId} not found`);
    }
  }
  /**
   * NEW: Link existing session to room (bot already in room)
   */
  async linkSessionToRoom(roomName: string, sessionId: string): Promise<void> {
    this.roomSessions.set(roomName, sessionId);
    this.logger.log(`Linked session ${sessionId} to room ${roomName}`);
  }

  /**
   * NEW: Send TTS directly without going through queue
   */
  async sendTTS(roomName: string, text: string): Promise<void> {
    try {
      await this.ttsService.callTTSAPI(roomName, text);
      this.logger.log(`[TTS SENT] Room ${roomName}: ${text.substring(0, 100)}...`);
    } catch (error) {
      this.logger.error(`Failed to send TTS for room ${roomName}:`, error);
      throw error;
    }
  }

  getSessionIdForRoom(roomName: string): string | undefined {
    return this.roomSessions.get(roomName);
  }

  clearExpiredCache(): void {
    const now = Date.now();
    let cleared = 0;

    for (const [sessionId, cached] of this.sessionCache.entries()) {
      if (now - cached.timestamp > this.CACHE_TTL_MS) {
        this.sessionCache.delete(sessionId);
        cleared++;
      }
    }

    if (cleared > 0) {
      this.logger.debug(`Cleared ${cleared} expired cache entries`);
    }
  }
}
