import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  Get,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InterviewSessionService } from '../interviewer/interview-session.service';
import { UploadAudioDto } from '../record-audio/upload-audio.dto';
import { ChatService } from '../interviewer/chat.service';

@Controller('api/interview')
export class InterviewAudioController {
  private readonly logger = new Logger(InterviewAudioController.name);

  constructor(
    private readonly sessionService: InterviewSessionService,
    private readonly chatService: ChatService,
    private readonly configService: ConfigService,
  ) { }

  /**
   * POST /api/interview/audio
   * Agent uploads audio URLs with timestamps after interview completion
   * Then automatically sends audio links to chat room
   * 
   * Request body format:
   * {
   *   "interview_id": "123456789",
   *   "tracks": {
   *     "1707825600000000000": "https://storage.com/audio1.mp3",
   *     "1707825660000000000": "https://storage.com/audio2.mp3"
   *   }
   * }
   */
  @Post('audio')
  @HttpCode(HttpStatus.OK)
  async uploadAudio(@Body() dto: UploadAudioDto) {
    try {
      // Validate request
      if (!dto.interview_id) {
        throw new BadRequestException('interview_id is required');
      }

      if (!dto.tracks || typeof dto.tracks !== 'object') {
        throw new BadRequestException('tracks must be an object');
      }

      // Extract filenames from tracks object
      const trackEntries = Object.entries(dto.tracks);

      if (trackEntries.length === 0) {
        throw new BadRequestException('tracks object is empty');
      }

      // Get MinIO configuration
      const minioEndpoint = this.configService.get<string>('MINIO_ENDPOINT');
      const minioBucket = this.configService.get<string>('MINIO_BUCKET');

      // Build full URLs from filenames
      const urls = trackEntries.map(([timestamp, filename]) => {
        // Remove leading slash if present
        const cleanFilename = filename.startsWith('/') ? filename.slice(1) : filename;
        return `${minioEndpoint}/${minioBucket}/${cleanFilename}`;
      });

      this.logger.log(
        `Received ${urls.length} audio file(s) for session ${dto.interview_id}\n` +
        `Tracks: ${JSON.stringify(dto.tracks, null, 2)}\n` +
        `Generated URLs: ${JSON.stringify(urls, null, 2)}`
      );

      // 1. Get session info first
      const session = await this.sessionService.getSessionById(dto.interview_id);

      if (!session) {
        return {
          success: false,
          message: `Session ${dto.interview_id} not found`,
        };
      }

      // 2. Save audio URLs to database
      const updatedSession = await this.sessionService.addAudioUrls(
        dto.interview_id,
        urls,
      );

      this.logger.log(
        `✅ Successfully saved ${urls.length} audio URL(s) for session ${dto.interview_id}`
      );

      // 3. Send audio links to chat room
      await this.chatService.sendAudioLinksToChat(
        session.channelId,
        session.template.name,
        urls,
      );

      this.logger.log(
        `📤 Sent audio links to chat channel ${session.channelId}`
      );

      return {
        success: true,
        message: 'Audio URLs saved and sent to chat successfully',
        data: {
          sessionId: updatedSession.id,
          totalAudioFiles: updatedSession.audioFilePaths.length,
          newFiles: urls.length,
          channelId: session.channelId,
          tracksReceived: trackEntries.length,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to process audio: ${error.message}`, error.stack);

      return {
        success: false,
        message: error.message || 'Failed to process audio',
        error: error.message,
      };
    }
  }

  /**
   * GET /api/interview/:sessionId/audio
   * Get all audio URLs for a session
   */
  @Get(':sessionId/audio')
  async getSessionAudio(@Param('sessionId') sessionId: string) {
    try {
      const audioUrls = await this.sessionService.getAudioUrls(sessionId);

      return {
        success: true,
        data: {
          sessionId,
          totalFiles: audioUrls.length,
          audioUrls,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get audio URLs: ${error.message}`);

      return {
        success: false,
        message: error.message,
      };
    }
  }
}