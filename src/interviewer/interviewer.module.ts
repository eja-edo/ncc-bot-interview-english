import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { InterviewerService } from "./interviewer.service";
import { createAgent } from "langchain";
import { MemorySaver } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";

const checkpointer = new MemorySaver();

@Module({
  imports: [ConfigModule],
  controllers: [],
  providers: [
    InterviewerService,
    {
      provide: "REACT_AGENT",
      inject: [ConfigService],
      useFactory(configService: ConfigService) {
        const openAIApiKey = configService.get<string>("OPENAI_API_KEY");

        if (!openAIApiKey) {
          throw new Error("OPENAI_API_KEY is not set");
        }

        const model = new ChatOpenAI({
          modelName: "gpt-5-mini",
          openAIApiKey,
        });

        const llm = createAgent({
          model,
          checkpointer,
          systemPrompt:
            "You are a English interviewer. You need to make a question and listen their anwser, and follow up the questions. You need to ask them 5 questions. When all done, give them a helpful feedback to improve their anwser. If message is <start/>, greet to candidate and ask them ready or not. If they are ready.Let start asking .",
        });
        return llm;
      },
    },
  ],
  exports: [InterviewerService],
})
export class InterviewerModule {}
