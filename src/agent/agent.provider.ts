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

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private readonly sseConnections = new Map<string, EventSource>();
  private readonly roomMessageBuffers = new Map<string, string[]>();
  private readonly roomTimers = new Map<string, NodeJS.Timeout>();
  private readonly BATCH_DELAY_MS = 1000;
  private readonly BATCH_SIZE = 1;

  constructor(
    @InjectQueue("tts") private readonly ttsQueue: Queue,
    private readonly configService: ConfigService,
    private readonly axiosClient: AxiosClient
  ) {}

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
            `Invalid response from API: ${
              error.response.status
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

        const sseKey = `${account.appid}-${meeting_code}`;
        const existingSSE = this.sseConnections.get(sseKey);
        if (existingSSE) {
          existingSSE.close();
        }

        const es = new EventSource(sseUrl);

        es.onmessage = (event) => {
          this.logger.log(`[SSE][Room ${meeting_code}] data: ${event.data}`);
          this.pushSSEMessage(meeting_code, event.data);
        };

        es.onopen = () => {
          this.logger.log(`[SSE][Room ${meeting_code}] connected`);
        };

        es.onerror = (error: Event) => {
          this.logger.error(
            `[SSE][Room ${meeting_code}] error:`,
            error.type,
            error.target ? JSON.stringify(error.target) : "unknown"
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

  private pushSSEMessage(meeting_code: string, data: string): void {
    if (!this.roomMessageBuffers.has(meeting_code)) {
      this.roomMessageBuffers.set(meeting_code, []);
    }

    this.roomMessageBuffers.get(meeting_code)!.push(data);

    this.scheduleRoomProcessing(meeting_code);
  }

  private scheduleRoomProcessing(roomName: string): void {
    const existingTimer = this.roomTimers.get(roomName);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.roomTimers.delete(roomName);
      this.flushRoomBuffer(roomName);
    }, this.BATCH_DELAY_MS);

    this.roomTimers.set(roomName, timer);
  }

  private async flushRoomBuffer(roomName: string): Promise<void> {
    const buffer = this.roomMessageBuffers.get(roomName);
    if (!buffer || buffer.length === 0) {
      return;
    }

    const messages = buffer.splice(0, this.BATCH_SIZE);

    try {
      await this.ttsQueue.add(
        "process-room",
        {
          roomName,
          messages,
        },
        {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        }
      );

      if (buffer.length > 0) {
        this.scheduleRoomProcessing(roomName);
      }
    } catch (error) {
      this.logger.error(
        `[TTS] Error adding job to queue for room ${roomName}: ${error}`,
        (error as Error)?.stack
      );
    }
  }
}
