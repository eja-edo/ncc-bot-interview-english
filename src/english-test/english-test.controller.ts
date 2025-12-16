import {
  Args,
  AutoContext,
  ButtonBuilder,
  ButtonStyle,
  ChannelMessagePayload,
  Client,
  Command,
  Component,
  ComponentParams,
  ComponentPayload,
  EmbedBuilder,
  EventPayload,
  Nezon,
  On,
  SmartMessage,
  FormData
} from "@n0xgg04/nezon";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Events } from "mezon-sdk";
import { AgentService } from "@/agent/agent.provider";
import { Account } from "@/agent/agent.type";
import { TemplateService } from '../interviewer/template.service';
import { InterviewSessionService } from '../interviewer/interview-session.service';
import { EnhancedInterviewerService } from '../interviewer/interview.service';
import { InterviewSession, SessionMode } from '../database-test/entities/interview-session-test.entity';
import { MessageRole, MessageType } from '../database-test/entities/session-message.entity';
import { options } from "joi";

@Injectable()
export class EnglishTestController {
  private readonly logger = new Logger(EnglishTestController.name);

  // Track template selections before Start button click
  private readonly pendingSelections = new Map<string, {
    userId: string;
    username: string;
    channelId: string;
    templateId: string;
    messageId: string;
  }>();

  constructor(
    private readonly agentService: AgentService,
    private readonly configService: ConfigService,
    private readonly templateService: TemplateService,
    private readonly sessionService: InterviewSessionService,
    private readonly interviewerService: EnhancedInterviewerService,
  ) { }

  private getAccount(): Account {
    return {
      appid: this.configService.get<string>("MEZON_BOT_ID")!,
      token: this.configService.get<string>("MEZON_TOKEN")!,
    };
  }

  @Command("start")
  async start(
    @AutoContext() [message]: Nezon.AutoContext,
    @ChannelMessagePayload() payload?: Nezon.ChannelMessage
  ) {
    try {
      const channelId = payload?.channel_id || message.channelId;
      const userId = payload?.sender_id;

      if (!channelId || !userId) {
        await message.reply(
          SmartMessage.system("Cannot determine channel or user. Please try again.")
        );
        return;
      }

      // Get templates from DB
      const templates = await this.templateService.getActiveTemplates();

      await message.reply(
        SmartMessage.build()
          .addEmbed(
            new EmbedBuilder()
              .setColor('#0099ff')
              .setTitle('Interview Template Selection')
              .setDescription('👉 Please select a template below')
              .addSelectField(
                'Choose a template...',
                'template',
                (templates).map((template) => ({
                  label: template.name,
                  value: template.id,
                })),
              )
          )
          .addButton(
            new ButtonBuilder()
              .setCustomId(`/interview/start/${userId}`)
              .setLabel('Start')
              .setStyle(ButtonStyle.Success)
          )
          .addButton(
            new ButtonBuilder()
              .setCustomId(`/interview/cancel/${userId}`)
              .setLabel('Cancel')
              .setStyle(ButtonStyle.Danger)
          )
      );
      this.logger.log(`📋 Sent template selector to user ${userId}`);

    } catch (error) {
      this.logger.error("Error in start command:", error);
      await message.reply(
        SmartMessage.system("Failed to start. Please try again.")
      );
    }
  }
  /**
   * FIXED: Handle text messages - Using correct event
   */
  @On(Events.ChannelMessage)
  async onMessage(
    @EventPayload() event: Nezon.ChannelMessage,
    @Client() client: Nezon.Client,
  ) {
    try {
      this.logger.log('Received channel message event');

      // Ignore commands and empty messages
      if (!event.content?.t || event.content.t.startsWith('*')) {
        this.logger.log('Ignoring command or empty message');
        return;
      }

      const userId = event.sender_id;
      const channelId = event.channel_id;
      const userMessage = event.content.t;

      this.logger.log(`Message from user ${userId} in channel ${channelId}: ${userMessage}`);

      // Check for active session
      const session = await this.sessionService.getActiveSession(userId, channelId);

      if (!session) {
        this.logger.log('No active session found for this user/channel');
        return;
      }

      this.logger.log(`Processing answer for session ${session.id}`);

      // Save user answer
      await this.sessionService.addMessage(
        session.id,
        MessageRole.USER,
        userMessage,
        MessageType.TEXT,
        session.currentQuestionIndex,
      );

      // Process the answer
      await this.processUserAnswer(session, userMessage, client, channelId);

    } catch (error) {
      this.logger.error('Error processing message:', error);

      // Send error message
      const channel = client.channels.get(event.channel_id);
      if (channel) {
        await channel.send({
          t: '❌ Sorry, something went wrong. Please try again or use *cancel to restart.'
        });
      }
    }
  }

  /**
   * Common logic to process user's answer (from text or voice)
   */
  async processUserAnswer(
    session: any,
    userMessage: string,
    client: Nezon.Client,
    channelId: string,
  ): Promise<void> {
    const nextQuestionNumber = session.currentQuestionIndex + 1;
    const totalQuestions = session.template.numberOfQuestions;

    // Check if complete
    if (nextQuestionNumber > totalQuestions) {
      this.logger.log('Interview complete, generating feedback');

      const overallFeedback = await this.interviewerService.generateOverallFeedback(
        await this.sessionService.getSessionById(session.id),
      );

      await this.sessionService.completeSession(session.id, overallFeedback);

      const completedSession = await this.sessionService.getSessionById(session.id);

      // Send TTS completion
      const spokenCompletion = 'Congratulations! You have completed the interview. Thank you for your time joining this interview';

      // Save bot's completion message to DB
      await this.sessionService.addMessage(
        session.id,
        MessageRole.ASSISTANT,
        spokenCompletion,
        MessageType.TEXT,
      );
      await this.agentService.sendTTS(session.roomName, spokenCompletion);

      // Completion message
      const completionMessage = `🎉 **Interview Complete!**

"${spokenCompletion}"

**Session Summary:**
 Template: ${session.template.name}
 Questions Answered: ${session.template.numberOfQuestions}

━━━━━━━━━━━━━━━━━━━━━━━━`;
      // Send final feedback to text channel
      const channel = client.channels.get(channelId);
      if (channel) {
        await channel.send({ t: completionMessage });
      }

      return;
    }

    // Send next question
    await this.sendNextQuestion(session, nextQuestionNumber, client, channelId);
  }

  /**
   * Helper: Send next question
   */
  async sendNextQuestion(
    session: any,
    questionNumber: number,
    client: Nezon.Client,
    channelId: string,
  ): Promise<void> {
    this.logger.log(`Generating question ${questionNumber}`);

    // Refresh session to get latest messages
    const refreshedSession = await this.sessionService.getSessionById(session.id);

    const nextQuestion = await this.interviewerService.generateQuestion(
      refreshedSession,
      questionNumber,
    );

    // Save next question to DB
    await this.sessionService.addMessage(
      session.id,
      MessageRole.ASSISTANT,
      nextQuestion,
      MessageType.TEXT,
      questionNumber,
    );

    // Send TTS
    await this.agentService.sendTTS(session.roomName, nextQuestion);

    // Send text confirmation
    const totalQuestions = session.template.numberOfQuestions;
    const responseMessage = ` ${questionNumber > 1 ? 'Answer recorded!' : 'Interview started!'}

**Bot is speaking question ${questionNumber} via voice...**

━━━━━━━━━━━━━━━━━━━━━━━━

**Question ${questionNumber}/${totalQuestions}:**

${nextQuestion}

━━━━━━━━━━━━━━━━━━━━━━━━

 Type your answer or speak in the voice room...`;

    const channel = client.channels.get(channelId);
    if (channel) {
      await channel.send({ t: responseMessage });
    }
  }

  @Command('cancel')
  async cancelInterview(
    @AutoContext() [message]: Nezon.AutoContext,
    @Client() client: Nezon.Client,
    @ChannelMessagePayload() payload?: Nezon.ChannelMessage,
  ) {
    try {
      const userId = payload?.sender_id;
      const channelId = payload?.channel_id || message.channelId;

      if (!userId || !channelId) {
        await message.reply(
          SmartMessage.system('Cannot determine user or channel.')
        );
        return;
      }

      // Get active session first
      const session = await this.sessionService.getActiveSession(userId, channelId);

      if (!session) {
        await message.reply(
          SmartMessage.system('⚠️ No active interview to cancel.')
        );
        return;
      }
      const roomName = session.roomName;

      await this.sessionService.cancelSession(userId, channelId);
      this.logger.log(`✅ Session ${session.id} cancelled`);

      await this.agentService.handleRemoveAgent(
        client,
        { channel_id: channelId },
        this.getAccount(),
      );
      this.logger.log(`✅ Bot removed from room ${roomName}`);
      await message.reply(
        SmartMessage.system(' Interview cancelled. Use *start to begin a new interview.')
      );
    } catch (error) {
      this.logger.error('Error cancelling interview:', error);
      await message.reply(
        SmartMessage.system('Failed to cancel interview.')
      );
    }
  }

  @Command('history')
  async showHistory(
    @AutoContext() [message]: Nezon.AutoContext,
    @ChannelMessagePayload() payload?: Nezon.ChannelMessage,
  ) {
    try {
      const userId = payload?.sender_id;

      if (!userId) {
        await message.reply(
          SmartMessage.system('Cannot determine user.')
        );
        return;
      }

      const sessions = await this.sessionService.getUserSessions(userId);
      const formattedHistory = this.sessionService.formatSessionHistory(sessions);

      await message.reply(SmartMessage.system(formattedHistory));
    } catch (error) {
      this.logger.error('Error showing history:', error);
      await message.reply(
        SmartMessage.system('Failed to load history.')
      );
    }
  }

  // @On(Events.VoiceJoinedEvent)
  // async onVoiceJoined(
  //   @EventPayload() event: Nezon.VoiceJoinedPayload,
  //   @Client() client: Nezon.Client
  // ) {
  //   try {
  //     this.logger.log("Voice joined event:", event);
  //   } catch (error) {
  //     this.logger.error("Error handling voice joined event:", error);
  //   }
  // }

  // @On(Events.VoiceLeavedEvent)
  // async onVoiceLeaved(
  //   @EventPayload() event: Nezon.VoiceLeavedPayload,
  //   @Client() client: Nezon.Client
  // ) {
  //   try {
  //     this.logger.log("Voice leaved event:", event);
  //     const account = this.getAccount();

  //     await this.agentService.handleRemoveAgent(
  //       client,
  //       { voice_channel_id: event.voice_channel_id },
  //       account
  //     );
  //   } catch (error) {
  //     this.logger.error("Error handling voice leaved event:", error);
  //   }
  // }

  /**
   * Handle Start Interview button click
   * This is where we create session and invite bot
   */
  @Component({ pattern: '/interview/start/:user_id' })
  async onStartInterview(
    @ComponentParams('user_id') userId: string | undefined,
    @ChannelMessagePayload() payload: Nezon.ChannelMessage,
    @FormData() formData: Nezon.FormData | undefined,
    @AutoContext() [message]: Nezon.AutoContext,
    @Client() client: Nezon.Client,
  ) {
    try {
      if (!userId) {
        await message.reply(SmartMessage.text(' Invalid request'));
        return;
      }

      // Get selected template from form data
      const selectedTemplateId = formData?.template;

      if (!selectedTemplateId) {
        await message.reply(
          SmartMessage.text(' Please select a template from the dropdown first!')
        );
        return;
      }

      const channelId = payload.channel_id;
      const username = payload.username || 'Candidate';

      // Get template
      const template = await this.templateService.getTemplateById(selectedTemplateId);

      // Get voice channel info
      const channel = await client.channels.fetch(channelId);

      if (!channel?.meeting_code) {
        await message.reply(
          SmartMessage.text(' Please join a voice channel first!')
        );
        return;
      }

      const roomName = channel.meeting_code;
      const clanId = channel.clan.id || '';
      const messageId = payload.message_id;

      this.logger.log(` Starting interview for user ${userId}, template: ${template.name}`);

      // Update message to show "Creating session..."
      await message.update(
        SmartMessage.text(' Creating interview session...')
      );

      // 1. Create session in DB
      const session = await this.sessionService.createSession(
        userId,
        username,
        channelId,
        roomName,
        template.id,
        SessionMode.MIXED,
      );

      if (!session || !session.id) {
        throw new Error('Failed to create session');
      }

      this.logger.log(` Session ${session.id} created`);

      // 2. Save interview room info (clanId, channelId, messageId)
      // await this.sessionService.saveInterviewRoomInfo(
      //   session.id,
      //   clanId,
      //   channelId,
      //   messageId,
      // );

      // 3. Start session
      await this.sessionService.startSession(session.id);
      this.logger.log(` Session ${session.id} started`);

      // Update message: "Bot joining..."
      await message.update(
        SmartMessage.text(' Bot is joining the voice room...')
      );

      // 4. NOW bot joins voice room
      await this.agentService.linkSessionToRoom(roomName, session.id);
      await this.interviewerService.setRoomTemplate(roomName, template);

      // Add verification log
      const linkedSessionId = this.agentService.getSessionIdForRoom(roomName);
      this.logger.log(`🔗 Verified: Room ${roomName} linked to session ${linkedSessionId}`);

      const account = this.getAccount();
      const existingSessionId = this.agentService.getSessionIdForRoom(roomName);
      const botAlreadyInRoom = existingSessionId !== undefined && existingSessionId !== session.id;

      if (!botAlreadyInRoom) {
        // Bot needs to join
        this.logger.log(`🤖 Inviting bot to room ${roomName}...`);

        await this.agentService.handleInviteAgent(
          client,
          { channel_id: channelId },
          account,
        );

        this.logger.log(`✅ Bot invite request sent to room ${roomName}`);

        // ============================================
        // CRITICAL: Wait for bot to fully join
        // ============================================
        this.logger.log(`⏳ Waiting 3 seconds for bot to join voice room...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        this.logger.log(`✅ Bot should be ready in room now`);

      } else {
        this.logger.log(`✅ Bot already in room ${roomName}, no need to wait`);
      }


      const greeting = await this.interviewerService.generateGreeting(template);

      // 6. Save greeting to DB
      await this.sessionService.addMessage(
        session.id,
        MessageRole.ASSISTANT,
        greeting,
        MessageType.TEXT,
      );
      this.logger.log(` Greeting saved to DB`);

      // 7. Bot speaks greeting via TTS
      // 7. Send greeting via TTS (NOW bot is ready!)
      try {
        await this.agentService.sendTTS(roomName, greeting);
        this.logger.log(`🔊 TTS sent successfully to room ${roomName}`);
      } catch (error) {
        this.logger.error(`❌ Failed to send TTS:`, error);
        // Continue even if TTS fails
      }

      // 8. Update message (remove dropdown & buttons, show confirmation)
      await message.update(
        SmartMessage.text(
          ` **Interview Started!**\n\n` +
          ` **Bot has joined the voice room and is speaking:**\n\n` +
          `"${greeting}"\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `**Interview Details:**\n` +
          `Template: **${template.name}**\n` +
          `Level: ${template.level}\n` +
          `Questions: ${template.numberOfQuestions}\n` +
          `Session ID: ${session.id}\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `**Type/Speak your first message to begin the interview!**\n` +
          `(e.g., "Hello", "I'm ready", etc.)`
        )
      );

      this.logger.log(`✅ Interview ready - waiting for user's first message`);

    } catch (error) {
      this.logger.error('Error starting interview:', error);
      await message.update(
        SmartMessage.text(` **Failed to start interview**\n\n${error.message}\n\nPlease try again with *start`)
      );
    }
  }
}