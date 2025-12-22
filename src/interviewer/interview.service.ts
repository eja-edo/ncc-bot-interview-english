import { Injectable, Logger } from '@nestjs/common';
import { InterviewSession } from '../database-test/entities/interview-session-test.entity';
import { MessageRole } from '../database-test/entities/session-message.entity';
import { InterviewTemplate } from '@/database-test/entities/interview-template.entity';
import { AIService } from './ai.service'; 

@Injectable()
export class EnhancedInterviewerService {
  private readonly logger = new Logger(EnhancedInterviewerService.name);

  private roomTemplates = new Map<string, InterviewTemplate>();

  constructor(
    private readonly aiService: AIService,
  ) {
    const info = this.aiService.getProviderInfo();
    this.logger.log(`🤖 Using AI provider: ${info.provider} (${info.modelName})`);
  }

  async setRoomTemplate(roomName: string, template: InterviewTemplate): Promise<void> {
    this.roomTemplates.set(roomName, template);
    this.logger.log(`Set template "${template.name}" for room ${roomName}`);
  }

  async generateGreeting(template: InterviewTemplate): Promise<string> {
    if (template.name === 'Non-AI Generate Interview') {
    return `Hello! Welcome to the Non-AI Generate Interview. I'll be asking you ${template.numberOfQuestions} pre-defined questions. Please answer each question clearly and take your time. When you're ready, type or say "ready" to begin.`;
  }

    const systemPrompt = `${template.systemPrompt}

You are starting an interview using the "${template.name}" template.
Level: ${template.level}
Number of questions: ${template.numberOfQuestions}

TASK: Generate a warm, professional greeting (2-3 sentences).
- Welcome the candidate and don't need to mention their name here just welcome without mention their or your name
- Briefly explain you'll ask ${template.numberOfQuestions} questions
- Ask them to speak or type "start", "ready", or "begin" when they're ready to start

Keep it warm and encouraging.`;

    try {
      const response = await this.aiService.generateWithSystemPrompt(
        systemPrompt,
      );
      return response.trim();
    } catch (error) {
      this.logger.error('Error getting response:', error);
      throw error;
    }
  }
  
  async generateQuestion(
    session: InterviewSession,
    questionNumber: number,
  ): Promise<string> {
    const isLastQuestion = questionNumber === session.template.numberOfQuestions;

    if (session.template.name === 'Non-AI Generate Interview') {
      return this.getPreDefinedQuestion(session, questionNumber);
    }

    // OPTIMIZED: Chỉ lấy recent messages thay vì load toàn bộ
    const recentMessages = this.buildRecentConversation(session, 10);
    
    const conversationContext = recentMessages.length > 0
      ? `\n\nCONVERSATION SO FAR:\n${recentMessages.map(m =>
        `${m.role === 'user' ? 'Candidate' : 'Interviewer'}: ${m.content}`
      ).join('\n')}`
      : '';

    const systemPrompt = `${session.template.systemPrompt}

CURRENT STATE:
- Question ${questionNumber} of ${session.template.numberOfQuestions}
- Template: ${session.template.name}
- Level: ${session.template.level}
${isLastQuestion ? '- ⚠️ THIS IS THE FINAL QUESTION!' : ''}

${conversationContext}

SAMPLE QUESTIONS FOR REFERENCE:
${session.template.sampleQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

INSTRUCTIONS FOR QUESTION ${questionNumber}:
1. Follow the interview structure and rules defined in your system prompt above
2. Review the conversation history carefully
3. Reference specific details the candidate mentioned
4. ${recentMessages.length > 0 ? 'Acknowledge their previous answer naturally' : 'Start the interview appropriately'}
5. Generate ONE clear, engaging question that fits this point in the interview
6. ${isLastQuestion ? 'Make it a strong closing question' : 'Maintain natural conversation flow'}
7. Adjust difficulty and depth based on their previous responses

CRITICAL:
- Ask ONLY the question itself
- Do NOT provide answers or commentary
- Make it feel conversational, not robotic
- Be warm and professional

Generate question ${questionNumber} now:`;

    try {
      const response = await this.aiService.generateText(systemPrompt);
      return response.trim();
    } catch (error) {
      this.logger.error('Error generating question:', error);
      throw error;
    }
  }

  async generateOverallFeedback(
    session: InterviewSession,
  ): Promise<{
    overall: string;
    strengths: string[];
    improvements: string[];
    totalScore: number;
  }> {
    if (session.template.name === 'Non-AI Generate Interview') {
    return {
      overall: `Thank you for completing the ${session.template.name}. All ${session.template.numberOfQuestions} questions have been answered.`,
      strengths: [],
      improvements: [],
      totalScore: 0,
    };
  }
    // OPTIMIZED: Chỉ lấy messages cần thiết (không load toàn bộ)
    const messages = session.messages || [];
    
    // Limit conversation text để tránh quá dài
    const conversationText = messages
      .slice(-20) // Chỉ lấy 20 messages gần nhất
      .map((msg) => `${msg.role === MessageRole.USER ? 'Candidate' : 'Interviewer'}: ${msg.content}`)
      .join('\n\n');

    // OPTIMIZED: Truncate sớm để tiết kiệm memory
    const truncatedConversation = conversationText.substring(0, 4000);

    const systemPrompt = `You are an English language assessor providing comprehensive feedback.

INTERVIEW DETAILS:
- Template: ${session.template.name}
- Level: ${session.template.level}
- Type: ${session.template.type}
- Questions: ${session.template.numberOfQuestions}

FULL CONVERSATION:
${truncatedConversation}${conversationText.length > 4000 ? '...(truncated)' : ''}

TASK: Provide comprehensive feedback with these sections:

SECTION 1 - OVERALL ASSESSMENT:
Write 3-4 paragraphs covering:
- Overall performance and communication effectiveness
- Language proficiency (grammar, vocabulary, fluency)
- Content quality (relevance, depth, examples)
- Areas of strength and areas needing improvement
- Encouragement and next steps

SECTION 2 - KEY STRENGTHS (list 3-4 items):
1. [First strength with specific example from their answers]
2. [Second strength with specific example]
3. [Third strength with specific example]
4. [Optional fourth strength]

SECTION 3 - AREAS FOR IMPROVEMENT (list 3-4 items):
1. [First area with actionable advice]
2. [Second area with actionable advice]
3. [Third area with actionable advice]
4. [Optional fourth area]

SECTION 4 - OVERALL SCORE:
Provide a score from 1-10 based on their overall performance.
Consider: grammar accuracy, vocabulary range, fluency, coherence, task completion

Be specific, encouraging, and reference actual examples from their answers.`;

    try {
      const response = await this.aiService.generateText(systemPrompt);

      const parsed = this.parseFeedbackSections(response);

      return {
        overall: parsed.overall || response.substring(0, 1000),
        strengths: parsed.strengths,
        improvements: parsed.improvements,
        totalScore: parsed.score,
      };
    } catch (error) {
      this.logger.error('Error generating overall feedback:', error);

      return {
        overall: `Thank you for completing the ${session.template.name}. You demonstrated good communication skills throughout the interview.`,
        strengths: [
          'Good communication skills',
          'Clear expression of ideas',
          'Engaged throughout the interview',
        ],
        improvements: [
          'Continue practicing regularly',
          'Expand vocabulary in specific areas',
          'Work on fluency and confidence',
        ],
        totalScore: 7,
      };
    }
  }

  private parseFeedbackSections(response: string): {
    overall: string;
    strengths: string[];
    improvements: string[];
    score: number;
  } {
    // Extract overall assessment
    const overallMatch = response.match(/SECTION 1.*?OVERALL ASSESSMENT:?\s*([\s\S]*?)(?=SECTION 2|KEY STRENGTHS|$)/i);
    const overall = overallMatch?.[1]?.trim() || response.substring(0, 1000);

    // Extract strengths
    const strengthsMatch = response.match(/SECTION 2.*?(?:KEY STRENGTHS|STRENGTHS).*?:\s*([\s\S]*?)(?=SECTION 3|AREAS FOR IMPROVEMENT|$)/i);
    const strengthsText = strengthsMatch?.[1] || '';
    const strengths = this.extractListItems(strengthsText);

    // Extract improvements
    const improvementsMatch = response.match(/SECTION 3.*?(?:AREAS FOR IMPROVEMENT|IMPROVEMENTS).*?:\s*([\s\S]*?)(?=SECTION 4|OVERALL SCORE|$)/i);
    const improvementsText = improvementsMatch?.[1] || '';
    const improvements = this.extractListItems(improvementsText);

    // Extract score
    const scoreMatch = response.match(/(?:SECTION 4|OVERALL SCORE|Score).*?[\s:]*(\d+)(?:\/10)?/i);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 7;

    return {
      overall: overall.substring(0, 1500),
      strengths: strengths.slice(0, 4),
      improvements: improvements.slice(0, 4),
      score: Math.max(1, Math.min(10, score)),
    };
  }

  private extractListItems(text: string): string[] {
    const items = text.match(/(?:^|\n)(?:\d+\.|[-*•])\s*(.+?)(?=\n(?:\d+\.|[-*•])|$)/gs);

    if (items && items.length > 0) {
      return items
        .map(item => {
          return item
            .replace(/^(?:\n)?(?:\d+\.|[-*•])\s*/, '')
            .replace(/^\[|\]$/g, '')
            .trim();
        })
        .filter(item => item.length > 15);
    }

    const lines = text.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 20 && !line.match(/^(SECTION|STRENGTHS|IMPROVEMENTS)/i));

    return lines.slice(0, 4);
  }

  private buildRecentConversation(
    session: InterviewSession,
    limit: number = 6,
  ): Array<{ role: 'user' | 'model'; content: string }> {
    if (!session.messages || session.messages.length === 0) {
      return [];
    }

    // OPTIMIZED: Slice từ messages đã có, không query lại
    const recentMessages = session.messages.slice(-limit);

    return recentMessages.map((msg) => ({
      role: msg.role === MessageRole.USER ? 'user' as const : 'model' as const,
      content: msg.content,
    }));
  }

  private getPreDefinedQuestion(
    session: InterviewSession,
    questionNumber: number,
  ): string {
    const questionIndex = questionNumber - 1;

    if (questionIndex >= session.template.sampleQuestions.length) {
      this.logger.warn(
        `Question ${questionNumber} exceeds available questions (${session.template.sampleQuestions.length})`
      );
      return 'Thank you for your answers so far. This concludes our interview.';
    }

    const question = session.template.sampleQuestions[questionIndex];

    this.logger.log(
      `Using pre-defined question ${questionNumber}: "${question.substring(0, 50)}..."`
    );

    return question;
  }
}