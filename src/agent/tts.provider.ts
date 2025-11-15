import { Injectable, Logger } from "@nestjs/common";
import { Account } from "./agent.type";
import { ConfigService } from "@nestjs/config";
import { AxiosClient } from "@/shared/lib/axios-client";
import { AGENT_ENDPOINTS } from "@/shared/constants/agent";
import axios from "axios";
import { appendFile, mkdir } from "fs/promises";
import { join } from "path";

@Injectable()
export class TTSProvider {
  logger = new Logger(TTSProvider.name);
  private readonly logFilePath = join(process.cwd(), "tts-texts.log");

  constructor(
    private configService: ConfigService,
    private axiosClient: AxiosClient
  ) {}

  async callTTSAPI(roomName: string, text: string): Promise<void> {
    try {
      await appendFile(this.logFilePath, text, "utf-8");
    } catch (error) {
      this.logger.warn(
        `Failed to write to log file: ${this.logFilePath}`,
        (error as Error)?.message
      );
    }

    const account: Account = {
      appid: this.configService.get<string>("MEZON_BOT_ID")!,
      token: this.configService.get<string>("MEZON_TOKEN")!,
    };

    const language = "en";
    const voice = "default";

    const payload = {
      account,
      room_name: roomName,
      text,
      language,
      voice,
    };

    try {
      const response = await this.axiosClient
        .getInstance()
        .post(AGENT_ENDPOINTS.TTS_SPEAK, payload);

      this.logger.verbose(
        `[TTS] API response for room ${roomName}:`,
        response.data
      );
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          const errorMessage = `TTS API error: ${
            error.response.status
          } - ${JSON.stringify(error.response.data)}`;
          this.logger.error(
            `[TTS] Error calling TTS API for room ${roomName}: ${errorMessage}`,
            error.stack
          );
          throw new Error(errorMessage);
        } else if (error.request) {
          this.logger.error(
            `[TTS] No response from TTS API for room ${roomName}: ${error.message}`,
            error.stack
          );
          throw new Error(`TTS API request failed: ${error.message}`);
        }
      }
      this.logger.error(
        `[TTS] Error calling TTS API for room ${roomName}: ${error}`,
        (error as Error)?.stack
      );
      throw error;
    }
  }
}
