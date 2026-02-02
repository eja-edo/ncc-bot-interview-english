import { forwardRef, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { createAgent } from "langchain";
// import { MemorySaver } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { TemplateService } from "./template.service";
import { InterviewSessionService } from "./interview-session.service";
import { EnhancedInterviewerService } from "./interview.service";
import { EnglishTestController } from "@/english-test/english-test.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { InterviewTemplate } from "@/database-test/entities/interview-template.entity";
import { InterviewSession } from "@/database-test/entities/interview-session-test.entity";
import { AgentModule } from "@/agent/agent.module";
import { User } from "@/database-test/entities/user-test.entity";
import { CustomPrompt } from "@/database-test/entities/custom-prompt.entity";
import { SessionMessage } from "@/database-test/entities/session-message.entity";
import { UserService } from "./user.service";
import { AIService } from "./ai.service";

// const checkpointer = new MemorySaver();

@Module({
  imports: [ConfigModule,
    TypeOrmModule.forFeature([User,
      CustomPrompt,
      InterviewTemplate,
      InterviewSession,
      SessionMessage,]),
  ],
  controllers: [],
  providers: [
    UserService,
    TemplateService,
    InterviewSessionService,
    EnhancedInterviewerService,
    AIService,
  ],
  exports: [ TemplateService,
    InterviewSessionService,
    EnhancedInterviewerService,
    UserService,
    AIService,
],
})
export class InterviewerModule {}
