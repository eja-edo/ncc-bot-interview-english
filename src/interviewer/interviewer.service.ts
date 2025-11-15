import { Inject, Injectable, Logger } from "@nestjs/common";
import { BaseMessage, createAgent, ReactAgent } from "langchain";

@Injectable()
export class InterviewerService {
  logger = new Logger(InterviewerService.name);

  constructor(
    @Inject("REACT_AGENT") private agent: ReturnType<typeof createAgent>
  ) {}

  async getResponse(content: string, user_id: string): Promise<string> {
    this.logger.log(`asking agent: ${content}`);
    const response = await this.agent.invoke(
      { messages: [{ role: "user", content: content }] },
      { configurable: { thread_id: user_id } }
    );

    const messages =
      (response as any)?.messages || (Array.isArray(response) ? response : []);

    if (!messages || messages.length === 0) {
      this.logger.warn("No messages in agent response");
      return "";
    }

    const lastMessage = messages[messages.length - 1];

    if (typeof lastMessage === "string") {
      return lastMessage;
    }

    if (
      lastMessage instanceof BaseMessage ||
      (lastMessage && typeof lastMessage === "object")
    ) {
      if (typeof (lastMessage as any).getContent === "function") {
        const content = await (lastMessage as any).getContent();
        if (typeof content === "string") {
          return content;
        }
      }

      if ("content" in lastMessage) {
        const content = (lastMessage as any).content;
        if (typeof content === "string") {
          return content;
        }
        if (Array.isArray(content)) {
          const textParts = content
            .filter(
              (item: any) =>
                typeof item === "string" ||
                (item && typeof item.text === "string")
            )
            .map((item: any) => (typeof item === "string" ? item : item.text));
          if (textParts.length > 0) {
            return textParts.join(" ");
          }
        }
      }

      if (
        "kwargs" in lastMessage &&
        typeof (lastMessage as any).kwargs === "object"
      ) {
        const kwargs = (lastMessage as any).kwargs;
        if (kwargs?.content) {
          if (typeof kwargs.content === "string") {
            return kwargs.content;
          }
        }
      }
    }

    this.logger.warn(
      "Could not extract content from agent response",
      JSON.stringify(lastMessage).substring(0, 500)
    );
    return "";
  }
}
