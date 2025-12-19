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

@Injectable()
export class EnglishTestController {
  private readonly logger = new Logger(EnglishTestController.name);

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

      const completedSession = await this.sessionService.getSessionById(session.id);

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

━━━━━━━━━━━━━━━━━━━━━━━━`;
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

      const selectedTemplateId = formData?.template;

      if (!selectedTemplateId) {
        await message.reply(
          SmartMessage.text(' Please select a template from the dropdown first!')
        );
        return;
      }

      const channelId = payload.channel_id;
      const username = payload.username || 'Candidate';

      const template = await this.templateService.getTemplateById(selectedTemplateId);

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

      await message.update(
        SmartMessage.text(' Creating interview session...')
      );

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

      await this.sessionService.startSession(session.id);
      this.logger.log(` Session ${session.id} started`);

      await message.update(
        SmartMessage.text(' Bot is joining the voice room...')
      );

      await this.agentService.linkSessionToRoom(roomName, session.id);
      await this.interviewerService.setRoomTemplate(roomName, template);

      const linkedSessionId = this.agentService.getSessionIdForRoom(roomName);
      this.logger.log(`🔗 Verified: Room ${roomName} linked to session ${linkedSessionId}`);

      const account = this.getAccount();
      const existingSessionId = this.agentService.getSessionIdForRoom(roomName);
      const botAlreadyInRoom = existingSessionId !== undefined && existingSessionId !== session.id;

      if (!botAlreadyInRoom) {
        this.logger.log(`🤖 Inviting bot to room ${roomName}...`);

        await this.agentService.handleInviteAgent(
          client,
          { channel_id: channelId },
          account,
        );

        this.logger.log(`✅ Bot invite request sent to room ${roomName}`);

        this.logger.log(`⏳ Waiting 3 seconds for bot to join voice room...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        this.logger.log(`✅ Bot should be ready in room now`);

      } else {
        this.logger.log(`✅ Bot already in room ${roomName}, no need to wait`);
      }


      const greeting = await this.interviewerService.generateGreeting(template);

      await this.sessionService.addMessage(
        session.id,
        MessageRole.ASSISTANT,
        greeting,
        MessageType.TEXT,
      );
      this.logger.log(` Greeting saved to DB`);

      try {
        await this.agentService.sendTTS(roomName, greeting);
        this.logger.log(`🔊 TTS sent successfully to room ${roomName}`);
      } catch (error) {
        this.logger.error(`❌ Failed to send TTS:`, error);
        
      }

      
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
        
        await this.kickBotFromRoom(client, voiceChannelId, roomName);
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

      // ================================
      // Always kick bot from room
      // ================================
      await this.kickBotFromRoom(client, voiceChannelId, roomName);

    } catch (error) {
      this.logger.error('❌ Error handling voice leave event:', error);
    }
  }

  private async kickBotFromRoom(
    client: Nezon.Client,
    channelId: string,
    roomName: string,
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
      );

      this.logger.log(`✅ Bot removed from room ${roomName}`);
    } catch (error) {
      this.logger.error(`❌ Failed to kick bot from room ${roomName}:`, error);
    }
  }
}