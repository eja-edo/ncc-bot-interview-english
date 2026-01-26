import { Processor, Process } from "@nestjs/bull";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Job } from "bull";
import axios from "axios";
import { AxiosClient } from "@/shared/lib/axios-client";
import { AGENT_ENDPOINTS } from "@/shared/constants/agent";
import { Account } from "@/agent/agent.type";
import { TTSProvider } from "./tts.provider";
import { EnhancedInterviewerService } from "@/interviewer/interview.service";
import { InterviewSessionService } from "@/interviewer/interview-session.service";
import { MessageRole, MessageType } from "@/database-test/entities/session-message.entity";
//import { InterviewerService } from "@/interviewer/interviewer.service";

interface TTSJobData {
  roomName: string;
  messages: string[];
}

@Processor("tts")
export class TTSProcessor {
  private readonly logger = new Logger(TTSProcessor.name);

  constructor(
    private readonly ttsService: TTSProvider,
    private readonly interviewer: EnhancedInterviewerService,
    private readonly sessionService: InterviewSessionService, // ADD THIS
  ) {}

  @Process("process-room")
  async handleTTSProcessing(job: Job<TTSJobData>) {
    const { roomName, messages } = job.data;
    console.log(job.data);

    const joined = messages.join(" ");
    const response = `${joined}`;

    // const aiResponse = await this.interviewer.getResponse(response, roomName);

    // this.logger.log(`[TTS][Batch][Room ${roomName}] ${response}`);

    // await this.ttsService.callTTSAPI(roomName, aiResponse);

    // this.logger.log(`[TTS][Batch][Room ${roomName}] ${aiResponse}`);
  }
}
