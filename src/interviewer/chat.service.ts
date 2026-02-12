import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Nezon } from '@n0xgg04/nezon';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private nezonClient?: Nezon.Client;

  constructor(
    private readonly configService: ConfigService,
  ) {}

  /**
   * Set Nezon client instance (called from controller on init)
   */
  setNezonClient(client: Nezon.Client): void {
    this.nezonClient = client;
    this.logger.log('✅ Nezon client set in ChatService');
  }

  /**
   * Send audio links to chat channel after interview completion
   */
  async sendAudioLinksToChat(
    channelId: string,
    templateName: string,
    audioUrls: string[],
  ): Promise<void> {
    if (!this.nezonClient) {
      this.logger.error('❌ Nezon client not initialized');
      throw new Error('Chat service not ready - Nezon client not initialized');
    }

    const channel = this.nezonClient.channels.get(channelId);
    
    if (!channel) {
      this.logger.error(`❌ Channel ${channelId} not found`);
      throw new Error(`Channel ${channelId} not found`);
    }

    // Format message with audio links
    const message = this.formatAudioLinksMessage(templateName, audioUrls);

    try {
      await channel.send({ t: message });
      this.logger.log(`✅ Sent audio links message to channel ${channelId}`);
    } catch (error) {
      this.logger.error(`Failed to send message to channel ${channelId}:`, error);
      throw error;
    }
  }

  /**
   * Format audio links message
   */
  private formatAudioLinksMessage(templateName: string, audioUrls: string[]): string {
    let message = `🎧 **Interview Recording Available**\n\n`;
    message += `Template: ${templateName}\n`;
    message += `Total Audio Files: ${audioUrls.length}\n\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    if (audioUrls.length === 1) {
      // Single audio file
      message += `📎 **Click to listen to your interview:**\n`;
      message += `${audioUrls[0]}\n\n`;
    } else {
      // Multiple audio files
      message += `📎 **Audio Files:**\n\n`;
      audioUrls.forEach((url, index) => {
        message += `${index + 1}. ${url}\n`;
      });
      message += `\n`;
    }
    
    message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `💡 Click on the link(s) above to listen to your interview recording.`;

    return message;
  }

  /**
   * Alternative: Send audio links as separate messages
   */
  async sendAudioLinksAsSeparateMessages(
    channelId: string,
    audioUrls: string[],
  ): Promise<void> {
    if (!this.nezonClient) {
      throw new Error('Nezon client not initialized');
    }

    const channel = this.nezonClient.channels.get(channelId);
    if (!channel) {
      throw new Error(`Channel ${channelId} not found`);
    }

    // Send header
    await channel.send({ 
      t: `🎧 **Your Interview Recording** (${audioUrls.length} file(s))\n\n━━━━━━━━━━━━━━━━━━━━━━` 
    });

    // Send each URL as separate message
    for (let i = 0; i < audioUrls.length; i++) {
      await channel.send({ 
        t: `📎 Audio ${i + 1}/${audioUrls.length}: ${audioUrls[i]}` 
      });
    }

    // Send footer
    await channel.send({ 
      t: `━━━━━━━━━━━━━━━━━━━━━━\n\n💡 Click on the links above to listen.` 
    });
  }
}