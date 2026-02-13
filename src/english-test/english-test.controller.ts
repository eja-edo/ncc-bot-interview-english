import {
  AutoContext,
  ButtonBuilder,
  ButtonStyle,
  ChannelMessagePayload,
  Client,
  Command,
  Component,
  ComponentParams,
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
import { SessionMode, SessionStatus } from '../database-test/entities/interview-session-test.entity';
import { MessageRole, MessageType } from '../database-test/entities/session-message.entity';
import { ChatService } from '../interviewer/chat.service';

@Injectable()
export class EnglishTestController {
  private readonly logger = new Logger(EnglishTestController.name);
  private answerTimeouts = new Map<string, NodeJS.Timeout>();
  private nezonClient?: Nezon.Client; // Store client reference

  constructor(
    private readonly agentService: AgentService,
    private readonly configService: ConfigService,
    private readonly templateService: TemplateService,
    private readonly sessionService: InterviewSessionService,
    private readonly interviewerService: EnhancedInterviewerService,
    private readonly chatService: ChatService,
  ) {
    // Register voice message event handler
    this.agentService.onVoiceMessageProcessed((event) => {
      if (this.nezonClient) {
        this.startAnswerTimeout(
          event.sessionId,
          this.nezonClient,
          event.channelId,
          event.userId,
        );
        this.logger.log(`⏰ Started answer timeout for voice message in session ${event.sessionId}`);
      } else {
        this.logger.warn(`⚠️ Cannot start timeout - Nezon client not initialized`);
      }
    });
  }

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

      const templates = await this.templateService.getActiveTemplates();

      await message.reply(
        SmartMessage.build()
          .addEmbed(
            new EmbedBuilder()
              .setColor('#0099ff')
              .setTitle('Interview Template Selection')
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

  @On(Events.ChannelMessage)
  async onMessage(
    @EventPayload() event: Nezon.ChannelMessage,
    @Client() client: Nezon.Client,
  ) {
    try {
      // Store client reference for later use
      if (!this.nezonClient) {
        this.nezonClient = client;
        this.logger.log('✅ Nezon client initialized');
      }

      this.logger.log('Received channel message event');

      if (!event.content?.t || event.content.t.startsWith('*')) {
        this.logger.log('Ignoring command or empty message');
        return;
      }

      const userId = event.sender_id;
      const channelId = event.channel_id;
      const userMessage = event.content.t;

      this.logger.log(`Message from user ${userId} in channel ${channelId}: ${userMessage}`);

      const session = await this.sessionService.getActiveSession(userId, channelId);

      if (!session) {
        this.logger.log('No active session found for this user/channel');
        return;
      }

      this.logger.log(`Processing answer for session ${session.id}`);

      await this.sessionService.addMessage(
        session.id,
        MessageRole.USER,
        userMessage,
        MessageType.TEXT,
        session.currentQuestionIndex,
      );

      await this.processUserAnswer(session, userMessage, client, channelId);

    } catch (error) {
      this.logger.error('Error processing message:', error);

      const channel = client.channels.get(event.channel_id);
      if (channel) {
        await channel.send({
          t: '❌ Sorry, something went wrong. Please try again or use *cancel to restart.'
        });
      }
    }
  }

  async processUserAnswer(
    session: any,
    userMessage: string,
    client: Nezon.Client,
    channelId: string,
  ): Promise<void> {
    const nextQuestionNumber = session.currentQuestionIndex + 1;
    const totalQuestions = session.template.numberOfQuestions;

    if (nextQuestionNumber > totalQuestions) {
      this.logger.log('Interview complete, generating feedback');

      const overallFeedback = await this.interviewerService.generateOverallFeedback(
        await this.sessionService.getSessionById(session.id),
      );

      await this.sessionService.completeSession(session.id, overallFeedback);

      const spokenCompletion = 'Congratulations! You have completed the interview. Thank you for your time joining this interview';

      await this.sessionService.addMessage(
        session.id,
        MessageRole.ASSISTANT,
        spokenCompletion,
        MessageType.TEXT,
      );
      await this.agentService.sendTTS(session.roomName, spokenCompletion);

      const completionMessage = `🎉 **Interview Complete!**

"${spokenCompletion}"

**Session Summary:**
 Template: ${session.template.name}
 Questions Answered: ${session.template.numberOfQuestions}

━━━━━━━━━━━━━━━━━━━━━━

⏳ Your interview recording will be available shortly...`;
      const channel = client.channels.get(channelId);
      if (channel) {
        await channel.send({ t: completionMessage });
      }

      return;
    }
    await this.sendNextQuestion(session, nextQuestionNumber, client, channelId);
  }

  async sendNextQuestion(
    session: any,
    questionNumber: number,
    client: Nezon.Client,
    channelId: string,
  ): Promise<void> {
    this.logger.log(`Generating question ${questionNumber}`);

    const refreshedSession = await this.sessionService.getSessionById(session.id);

    const nextQuestion = await this.interviewerService.generateQuestion(
      refreshedSession,
      questionNumber,
    );

    await this.sessionService.addMessage(
      session.id,
      MessageRole.ASSISTANT,
      nextQuestion,
      MessageType.TEXT,
      questionNumber,
    );

    await this.agentService.sendTTS(session.roomName, nextQuestion);

    const totalQuestions = session.template.numberOfQuestions;
    const responseMessage = `✅ ${questionNumber > 1 ? 'Answer recorded!' : 'Interview started!'}

**Bot is speaking question ${questionNumber} via voice...**

━━━━━━━━━━━━━━━━━━━━━━

**Question ${questionNumber}/${totalQuestions}:**

${nextQuestion}

━━━━━━━━━━━━━━━━━━━━━━

💬 Speak in the voice room...`;

    const channel = client.channels.get(channelId);
    if (channel) {
      await channel.send({ t: responseMessage });
    }
  }

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
        await message.reply(SmartMessage.text('❌ Invalid request'));
        return;
      }

      const account = this.getAccount();
      const selectedTemplateId = formData?.template;

      if (!selectedTemplateId) {
        await message.reply(
          SmartMessage.text('⚠️ Please select a template from the dropdown first!')
        );
        return;
      }

      const channelId = payload.channel_id;
      const username = payload.username || 'Candidate';

      const template = await this.templateService.getTemplateById(selectedTemplateId);

      const channel = await client.channels.fetch(channelId);

      if (!channel?.meeting_code) {
        await message.reply(
          SmartMessage.text('⚠️ Please join a voice channel first!')
        );
        return;
      }

      const roomName = channel.meeting_code;

      this.logger.log(`🚀 Starting interview for user ${userId}, template: ${template.name}`);

      await message.update(
        SmartMessage.text('⏳ Creating interview session...')
      );

      const session = await this.sessionService.createSession(
        userId,
        username,
        channelId,
        roomName,
        template.id,
        SessionMode.VOICE,
      );

      if (!session || !session.id) {
        throw new Error('Failed to create session');
      }

      this.logger.log(`✅ Session ${session.id} created`);

      await this.sessionService.startSession(session.id);
      this.logger.log(`✅ Session ${session.id} started`);

      await message.update(
        SmartMessage.text('🤖 Bot is joining the voice room...')
      );

      await this.agentService.linkSessionToRoom(roomName, session.id);
      await this.interviewerService.setRoomTemplate(roomName, template);

      const existingSessionId = this.agentService.getSessionIdForRoom(roomName);
      const botAlreadyInRoom = existingSessionId !== undefined && existingSessionId !== session.id;

      if (!botAlreadyInRoom) {
        this.logger.log(`🤖 Inviting bot to room ${roomName}...`);

        await this.agentService.handleInviteAgent(
          client,
          {
            voice_channel_id: channelId,
            channel_id: channelId,
          },
          account,
          session.id, // NEW: Pass sessionId
        );

        this.logger.log(`✅ Bot invite request sent to room ${roomName}`);

        // UPDATED: Wait longer for bot to join AND transcript to be enabled
        this.logger.log(`⏳ Waiting 5 seconds for bot to join and transcript to be enabled...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        this.logger.log(`✅ Bot should be ready with transcript enabled`);

      } else {
        this.logger.log(`✅ Bot already in room ${roomName}, enabling transcript...`);
        
        // If bot already in room, just enable transcript
        try {
          await this.agentService.enableTranscript(roomName);
        } catch (error) {
          this.logger.error('Failed to enable transcript for existing bot:', error);
        }
      }

      const greeting = await this.interviewerService.generateGreeting(template);

      await this.sessionService.addMessage(
        session.id,
        MessageRole.ASSISTANT,
        greeting,
        MessageType.TEXT,
      );
      this.logger.log(`✅ Greeting saved to DB`);

      try {
        await this.agentService.sendTTS(roomName, greeting);
        this.logger.log(`🔊 TTS sent successfully to room ${roomName}`);
      } catch (error) {
        this.logger.error(`❌ Failed to send TTS:`, error);
      }

      await message.update(
        SmartMessage.text(
          `✅ **Interview Started!**\n\n` +
          `🎤 **Bot has joined the voice room and is speaking:**\n\n` +
          `"${greeting}"\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `**Interview Details:**\n` +
          `📝 Template: **${template.name}**\n` +
          `📊 Level: ${template.level}\n` +
          `❓ Questions: ${template.numberOfQuestions}\n` +
          `🆔 Session ID: ${session.id}\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `**💬 Type/Speak your first message to begin the interview!**\n` +
          `(e.g., "Hello", "I'm ready", etc.)`
        )
      );

      this.logger.log(`✅ Interview ready - waiting for user's first message`);

    } catch (error) {
      this.logger.error('Error starting interview:', error);
      await message.update(
        SmartMessage.text(`❌ **Failed to start interview**\n\n${error.message}\n\nPlease try again with *start`)
      );
    }
  }

  private startAnswerTimeout(
      sessionId: string,
      client: Nezon.Client,
      channelId: string,
      userId: string,
  ) {
    const existing = this.answerTimeouts.get(sessionId);
    if (existing) {
      clearTimeout(existing);
    }

    const timeout = setTimeout(async () => {
      const channel = client.channels.get(channelId);
      if (!channel) return;
      await channel.send(
          SmartMessage.build()
              .addEmbed(
                  new EmbedBuilder()
                      .setColor('#0099ff')
                      .setTitle('Did you finish your answer?')
              )
              .addButton(
                  new ButtonBuilder()
                      .setCustomId(`/interview/confirmCompletedAnswer/${userId}`)
                      .setLabel('Yes ')
                      .setStyle(ButtonStyle.Success)
              )
              .addButton(
                  new ButtonBuilder()
                      .setCustomId(`/interview/confirmNotCompletedAnswer/${userId}`)
                      .setLabel('No')
                      .setStyle(ButtonStyle.Danger)
              )
              .toContent()
      );
      this.answerTimeouts.delete(sessionId);
    }, 10_000);
    this.answerTimeouts.set(sessionId, timeout);
  }

  @On(Events.VoiceLeavedEvent)
  async onVoiceLeaved(
    @EventPayload() event: Nezon.VoiceLeavedPayload,
    @Client() client: Nezon.Client,
  ) {
    try {
      this.logger.log(`👋 User left voice channel: ${event.voice_channel_id}`);

      const userId = event.voice_user_id;
      const voiceChannelId = event.voice_channel_id;

      if (!userId || !voiceChannelId) {
        this.logger.warn('Missing userId or voiceChannelId in leave event');
        return;
      }

      const channel = await client.channels.fetch(voiceChannelId);

      if (!channel?.meeting_code) {
        this.logger.warn('Channel or meeting_code not found');
        return;
      }

      const roomName = channel.meeting_code;

      this.logger.log(`👤 User ${userId} left room ${roomName}`);

      const session = await this.sessionService.findSessionByUserAndRoom(
        userId,
        roomName,
      );

      if (!session) {
        this.logger.log(`No active session found for user ${userId} in room ${roomName}`);

        await this.kickBotFromRoom(client, voiceChannelId, roomName, session.id);
        return;
      }

      this.logger.log(`📋 Found session ${session.id} with status: ${session.status}`);

      if (session.status === SessionStatus.IN_PROGRESS) {
        await this.sessionService.cancelSession2(session.id);
        this.logger.log(`❌ Session ${session.id} cancelled (was in progress)`);

        const textChannel = client.channels.get(session.channelId);
        if (textChannel) {
          await textChannel.send({
            t: '👋 **Interview Cancelled**\n\n' +
              'You left the voice channel.\n' +
              'Session has been cancelled.\n\n' +
              'Use `*start` to begin a new interview.',
          });
        }
      } else if (session.status === SessionStatus.COMPLETED) {
        this.logger.log(`✅ Session ${session.id} kept as COMPLETED`);
      } else {
        this.logger.log(`ℹ️ Session ${session.id} status: ${session.status} (no action)`);
      }
      await this.kickBotFromRoom(client, voiceChannelId, roomName, session.id);

    } catch (error) {
      this.logger.error('❌ Error handling voice leave event:', error);
    }
  }

  private async kickBotFromRoom(
    client: Nezon.Client,
    channelId: string,
    roomName: string,
    sessionId: string,
  ): Promise<void> {
    try {
      this.logger.log(`🤖 Kicking bot from room ${roomName}...`);

      await this.agentService.handleRemoveAgent(
        client,
        {
          voice_channel_id: channelId,
          channel_id: channelId,
        },
        this.getAccount(),
        sessionId,
      );

      this.logger.log(`✅ Bot removed from room ${roomName}`);
    } catch (error) {
      this.logger.error(`❌ Failed to kick bot from room ${roomName}:`, error);
    }
  }

  @Component({ pattern: '/interview/cancel/:user_id' })
  async onCancelInterview(
    @ComponentParams('user_id') userId: string | undefined,
    @ChannelMessagePayload() payload: Nezon.ChannelMessage,
    @AutoContext() [message]: Nezon.AutoContext,
  ) {
    try {
      if (!userId) {
        await message.reply(SmartMessage.text('❌ Invalid request'));
        return;
      }

      // Update message để xóa form và hiển thị thông báo
      await message.update(
        SmartMessage.text('❌ **Interview selection cancelled.**\n\nUse `*start` to begin again.')
      );

      this.logger.log(`🚫 User ${userId} cancelled template selection`);

    } catch (error) {
      this.logger.error('Error cancelling interview selection:', error);
      await message.update(
        SmartMessage.text('❌ Failed to cancel selection.')
      );
    }
  }

  /**
   * User confirms they finished speaking - process their answer and send next question
   */
  @Component({ pattern: '/interview/confirmCompleted/:user_id' })
  async onConfirmCompleted(
    @ComponentParams('user_id') userId: string,
    @ChannelMessagePayload() payload: Nezon.ChannelMessage,
    @Client() client: Nezon.Client,
    @AutoContext() [message]: Nezon.AutoContext,
  ) {
    try {
      const session = await this.sessionService.getActiveSession(
        userId,
        payload.channel_id,
      );

      if (!session) {
        this.logger.log(`No active session found for user ${userId}`);
        await message.update(
          SmartMessage.text('❌ No active interview session found.')
        );
        return;
      }

      // Clear the timeout for this session
      const timeout = this.answerTimeouts.get(session.id);
      if (timeout) {
        clearTimeout(timeout);
        this.answerTimeouts.delete(session.id);
      }

      // Check if this is the first message (greeting response)
      const userMessages = session.messages?.filter(m => m.role === MessageRole.USER) || [];
      const isFirstMessage = userMessages.length === 1; // Just the greeting response

      if (isFirstMessage) {
        // User responded to greeting, start first question
        this.logger.log(`User responded to greeting, starting first question`);

        await message.update(
          SmartMessage.text('✅ Great! Let\'s begin the interview...')
        );

        await this.sendNextQuestion(
          session,
          1, // First question
          client,
          payload.channel_id,
        );
        return;
      }

      // Check if interview is complete
      const nextQuestionNumber = session.currentQuestionIndex + 1;
      const totalQuestions = session.template.numberOfQuestions;

      this.logger.log(
        `📊 Confirm completed - Current: ${session.currentQuestionIndex}, ` +
        `Next would be: ${nextQuestionNumber}, Total: ${totalQuestions}`
      );

      if (nextQuestionNumber > totalQuestions) {
        // All questions answered
        this.logger.log('✅ All questions answered, generating feedback');

        await message.update(
          SmartMessage.text('🎉 All questions answered! Generating your feedback...')
        );

        const overallFeedback = await this.interviewerService.generateOverallFeedback(
          await this.sessionService.getSessionById(session.id),
        );

        await this.sessionService.completeSession(session.id, overallFeedback);

        const spokenCompletion = 'Congratulations! You have completed the interview. Thank you for your time joining this interview. You can out voice room to end the interview session';

        await this.sessionService.addMessage(
          session.id,
          MessageRole.ASSISTANT,
          spokenCompletion,
          MessageType.TEXT,
        );
        await this.agentService.sendTTS(session.roomName, spokenCompletion);

        const completionMessage = `🎉 **Interview Complete!**

"${spokenCompletion}"

**Session Summary:**
 Template: ${session.template.name}
 Questions Answered: ${session.template.numberOfQuestions}

━━━━━━━━━━━━━━━━━━━━━━

⏳ Your interview recording will be available shortly...`;

        const channel = client.channels.get(payload.channel_id);
        if (channel) {
          await channel.send({ t: completionMessage });
        }

        return;
      }

      // Continue to next question
      await message.update(
        SmartMessage.text('✅ Answer recorded! Moving to the next question...')
      );

      await this.sendNextQuestion(
        session,
        nextQuestionNumber,
        client,
        payload.channel_id,
      );

    } catch (error) {
      this.logger.error('Error in confirmCompleted:', error);
      await message.update(
        SmartMessage.text('❌ An error occurred. Please try again.')
      );
    }
  }

  /**
   * User says they're still speaking - just acknowledge and wait
   */
  @Component({ pattern: '/interview/confirmNotCompleted/:user_id' })
  async onConfirmNotCompleted(
    @ComponentParams('user_id') userId: string,
    @AutoContext() [message]: Nezon.AutoContext,
  ) {
    try {
      const session = await this.sessionService.getActiveSession(
        userId,
        message.channelId,
      );

      if (session) {
        // Clear the timeout
        const timeout = this.answerTimeouts.get(session.id);
        if (timeout) {
          clearTimeout(timeout);
          this.answerTimeouts.delete(session.id);
        }
      }

      await message.update(
        SmartMessage.text('⏳ No problem. Please continue your answer.\n\nWe\'ll check again in a moment...')
      );

      this.logger.log(`User ${userId} indicated they're still speaking`);

    } catch (error) {
      this.logger.error('Error in confirmNotCompleted:', error);
    }
  }
}