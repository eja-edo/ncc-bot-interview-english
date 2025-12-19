import { NestFactory } from "@nestjs/core";
import { getQueueToken } from "@nestjs/bull";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "@/app.module";
import { setupBullBoard } from "@/bull-board/bull-board.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  const port = configService.get<number>('PORT')

  const ttsQueue = app.get(getQueueToken("tts"));
  const serverAdapter = setupBullBoard([ttsQueue]);

  app.use("/admin/queues", serverAdapter.getRouter());

  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(
    `Bull Board UI is available at: http://localhost:${port}/admin/queues`
  );
}
bootstrap();
