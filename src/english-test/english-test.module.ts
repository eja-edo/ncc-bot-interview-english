import { Module } from "@nestjs/common";
import { EnglishTestController } from "@/english-test/english-test.controller";
import { AgentModule } from "@/agent/agent.module";

@Module({
  imports: [AgentModule],
  providers: [EnglishTestController],
  exports: [],
})
export class EnglishTestModule {}
