import { NezonModule } from "@n0xgg04/nezon";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { BullModule } from "@nestjs/bull";
import { AgentModule } from "@/agent/agent.module";
import { EnglishTestModule } from "@/english-test/english-test.module";
import { envValidationSchema } from "@/shared/config/env.config";

@Module({
  imports: [
    AgentModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: false,
      },
    }),
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
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
