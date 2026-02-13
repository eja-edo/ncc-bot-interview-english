import { AgentModule } from "@/agent/agent.module";
import { EnglishTestModule } from "@/english-test/english-test.module";
import { envValidationSchema } from "@/shared/config/env.config";
import { NezonModule } from "@n0xgg04/nezon";
import { BullModule } from "@nestjs/bull";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { InterviewerModule } from "./interviewer/interviewer.module";
import { DatabaseTestModule } from "./database-test/database-test.module";
import { RecordAudioModule } from "./record-audio/record-audio.module";

@Module({
  imports: [
    InterviewerModule,
    AgentModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
    DatabaseTestModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>("REDIS_HOST", "localhost"),
          port: configService.get<number>("REDIS_PORT", 6379),
          password: configService.get<string>("REDIS_PASSWORD"),
        },
      }),
    }),
    NezonModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        token: configService.get<string>("MEZON_TOKEN")!,
        botId: configService.get<string>("MEZON_BOT_ID")!,
        host: "dev-mezon.nccsoft.vn",
        port: "8088",
        mmnApiUrl: "https://dev-mmn.nccsoft.vn/mmn-api/",
        zkApiUrl: "https://dev-mmn.nccsoft.vn/zk-api/",
      }),
    }),
    EnglishTestModule,
    RecordAudioModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule { }
