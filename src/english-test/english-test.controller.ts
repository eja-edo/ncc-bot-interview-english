import {
  Args,
  AutoContext,
  ChannelMessagePayload,
  Client,
  Command,
  EventPayload,
  Nezon,
  On,
  SmartMessage,
} from "@n0xgg04/nezon";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Events } from "mezon-sdk";
import { AgentService } from "@/agent/agent.provider";
import { Account } from "@/agent/agent.type";

@Injectable()
export class EnglishTestController {
  private readonly logger = new Logger(EnglishTestController.name);

  constructor(
    private readonly agentService: AgentService,
    private readonly configService: ConfigService
  ) {}

  private getAccount(): Account {
    return {
      appid: this.configService.get<string>("MEZON_BOT_ID")!,
      token: this.configService.get<string>("MEZON_TOKEN")!,
    };
  }

  @Command("start")
  async start(
    @AutoContext() [message]: Nezon.AutoContext,
    @Client() client: Nezon.Client,
    @ChannelMessagePayload() payload?: Nezon.ChannelMessage
  ) {
    try {
      const channelId = payload?.channel_id || message.channelId;
      if (!channelId) {
        await message.reply(
          SmartMessage.system("Cannot determine channel. Please try again.")
        );
        return;
      }

      const account = this.getAccount();

      await this.agentService.handleInviteAgent(
        client,
        { channel_id: channelId },
        account
      );

      await message.reply(
        SmartMessage.system("Agent has been invited successfully!")
      );
    } catch (error) {
      this.logger.error("Error in start command:", error);
      await message.reply(
        SmartMessage.system("Failed to invite agent. Please try again.")
      );
    }
  }

  @Command("test")
  async test(@AutoContext() [message]: Nezon.AutoContext) {
    await message.reply(SmartMessage.system("hello"));
  }

  @Command("tts")
  async tts(
    @AutoContext() [message]: Nezon.AutoContext,
    @Args() args: Nezon.Args
  ) {
    await message.reply(SmartMessage.system("tts"));
  }

  @Command({ name: "interview help", aliases: ["help"] })
  async interviewHelp(@AutoContext() [message]: Nezon.AutoContext) {
    const helpText = `
*Interview Bot Commands:*

• *start - Start the interview session and invite agent
• *interview help or *help - Show this help message

The bot will automatically invite the agent when you join a voice channel and remove it when you leave.
    `.trim();

    await message.reply(SmartMessage.system(helpText));
  }

  @On(Events.VoiceJoinedEvent)
  async onVoiceJoined(
    @EventPayload() event: Nezon.VoiceJoinedPayload,
    @Client() client: Nezon.Client
  ) {
    try {
      this.logger.log("Voice joined event:", event);
    } catch (error) {
      this.logger.error("Error handling voice joined event:", error);
    }
  }

  @On(Events.VoiceLeavedEvent)
  async onVoiceLeaved(
    @EventPayload() event: Nezon.VoiceLeavedPayload,
    @Client() client: Nezon.Client
  ) {
    try {
      this.logger.log("Voice leaved event:", event);
      const account = this.getAccount();

      await this.agentService.handleRemoveAgent(
        client,
        {
          voice_channel_id: event.voice_channel_id,
        },
        account
      );
    } catch (error) {
      this.logger.error("Error handling voice leaved event:", error);
    }
  }
}
