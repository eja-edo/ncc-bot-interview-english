import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MemorySaver } from "@langchain/langgraph";
import { TemplateService } from "./template.service";
import { InterviewSessionService } from "./interview-session.service";
import { EnhancedInterviewerService } from "./interview.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { InterviewTemplate } from "@/database-test/entities/interview-template.entity";
import { InterviewSession } from "@/database-test/entities/interview-session-test.entity";
import { User } from "@/database-test/entities/user-test.entity";
import { CustomPrompt } from "@/database-test/entities/custom-prompt.entity";
import { SessionMessage } from "@/database-test/entities/session-message.entity";
import { UserService } from "./user.service";
import { AIService } from "./ai.service";

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
