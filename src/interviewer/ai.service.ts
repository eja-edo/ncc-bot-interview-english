import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';

export enum AIProvider {
    GEMINI = 'gemini',
    OPENAI = 'openai',
}

@Injectable()
export class AIService {
    private readonly logger = new Logger(AIService.name);
    private model: BaseChatModel;
    private currentProvider: AIProvider;

    constructor(private readonly configService: ConfigService) {

        const provider = this.configService.get<string>('AI_PROVIDER', 'openai') as AIProvider;
        this.initializeModel(provider);
    }

    private initializeModel(provider: AIProvider): void {
        this.currentProvider = provider;

        switch (provider) {
            case AIProvider.GEMINI:
                this.model = this.createGeminiModel();
                break;
            case AIProvider.OPENAI:
                this.model = this.createOpenAIModel();
                break;
            default:
                throw new Error(`Unsupported AI provider: ${provider}`);
        }

        this.logger.log(`✅ AI Service initialized with provider: ${provider}`);
    }

    private createGeminiModel(): ChatGoogleGenerativeAI {
        const apiKey = this.configService.get<string>('GOOGLE_API_KEY');

        if (!apiKey) {
            throw new Error('GOOGLE_API_KEY is not set');
        }

        return new ChatGoogleGenerativeAI({
            model: 'gemini-2.0-flash', // or gemini-1.5-pro, gemini-1.5-flash
            apiKey,
            temperature: 0.7,
            maxOutputTokens: 2048,
        });
    }

    private createOpenAIModel(): ChatOpenAI {
        const apiKey = this.configService.get<string>('OPENAI_API_KEY');

        if (!apiKey) {
            throw new Error('OPENAI_API_KEY is not set');
        }

        return new ChatOpenAI({
            modelName: 'gpt-4o-mini', // or gpt-4, gpt-3.5-turbo
            openAIApiKey: apiKey,
            temperature: 0.7,
            maxTokens: 2048,
        });
    }

    switchProvider(provider: AIProvider): void {
        this.logger.log(`🔄 Switching AI provider from ${this.currentProvider} to ${provider}`);
        this.initializeModel(provider);
    }

    async generateText(prompt: string): Promise<string> {
        try {
            const messages = [new HumanMessage(prompt)];
            const response = await this.model.invoke(messages);
            return response.content as string;
        } catch (error) {
            this.logger.error(`Error generating text with ${this.currentProvider}:`, error);
            throw error;
        }
    }

    async generateWithSystemPrompt(systemPrompt: string, userPrompt?: string): Promise<string> {
        try {
            const messages = [
                new SystemMessage(systemPrompt),
                new HumanMessage(userPrompt ?? 'Please respond based on the system instructions.'),
            ];

            const response = await this.model.invoke(messages);
            return response.content as string;
        } catch (error) {
            this.logger.error(`Error generating with system prompt (${this.currentProvider}):`, error);
            throw error;
        }
    }

    async chat(messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>): Promise<string> {
        try {
            const langchainMessages = messages.map(msg => {
                switch (msg.role) {
                    case 'system':
                        return new SystemMessage(msg.content);
                    case 'user':
                        return new HumanMessage(msg.content);
                    case 'assistant':
                        return new AIMessage(msg.content);
                    default:
                        return new HumanMessage(msg.content);
                }
            });

            const response = await this.model.invoke(langchainMessages);
            return response.content as string;
        } catch (error) {
            this.logger.error(`Error in chat with ${this.currentProvider}:`, error);
            throw error;
        }
    }

    async *streamText(prompt: string): AsyncGenerator<string> {
        try {
            const messages = [new HumanMessage(prompt)];
            const stream = await this.model.stream(messages);

            for await (const chunk of stream) {
                const text = chunk.content;
                if (text) {
                    yield text as string;
                }
            }
        } catch (error) {
            this.logger.error(`Error streaming from ${this.currentProvider}:`, error);
            throw error;
        }
    }

    getProviderInfo(): { provider: AIProvider; modelName: string } {
        return {
            provider: this.currentProvider,
            modelName: (this.model as any).modelName || 'unknown',
        };
    }
}