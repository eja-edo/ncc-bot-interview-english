import { Module } from "@nestjs/common";
import { EnglishTestController } from "@/english-test/english-test.controller";
import { AgentModule } from "@/agent/agent.module";
import { InterviewerModule } from "@/interviewer/interviewer.module";

@Module({
  imports: [InterviewerModule],
  providers: [],
  exports: [],
})
export class RecordAudioModule {}