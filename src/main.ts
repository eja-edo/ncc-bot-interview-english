import { NestFactory } from "@nestjs/core";
import { getQueueToken } from "@nestjs/bull";
import { AppModule } from "@/app.module";
import { setupBullBoard } from "@/bull-board/bull-board.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const ttsQueue = app.get(getQueueToken("tts"));
  const serverAdapter = setupBullBoard([ttsQueue]);

  app.use("/admin/queues", serverAdapter.getRouter());

  await app.listen(3000);
  console.log(`Application is running on: http://localhost:3000`);
  console.log(
    `Bull Board UI is available at: http://localhost:3000/admin/queues`
  );
}
bootstrap();
