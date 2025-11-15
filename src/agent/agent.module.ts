import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bull";
import { AgentService } from "@/agent/agent.provider";
import { TTSProcessor } from "@/agent/tts.processor";
import { AxiosClient } from "@/shared/lib/axios-client";
import { TTSProvider } from "./tts.provider";
import { InterviewerModule } from "@/interviewer/interviewer.module";

@Module({
  imports: [
    BullModule.registerQueue({
      name: "tts",
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    }),
    InterviewerModule,
  ],
  controllers: [],
  providers: [AgentService, TTSProcessor, AxiosClient, TTSProvider],
  exports: [AgentService],
})
export class AgentModule {}
