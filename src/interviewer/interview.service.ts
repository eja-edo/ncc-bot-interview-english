import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { createAgent } from 'langchain';
import { MemorySaver } from '@langchain/langgraph';
import { HumanMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';
import { InterviewSession } from '../database-test/entities/interview-session-test.entity';
import { SessionMessage, MessageRole } from '../database-test/entities/session-message.entity';
import { InterviewTemplate } from '@/database-test/entities/interview-template.entity';
import { InterviewSessionService } from './interview-session.service';
import { AIService } from './ai.service'; 

interface QuestionScoreData {
  question: string;
  answer: string;
  score: number;
  feedback: string;
}

@Injectable()
export class EnhancedInterviewerService {
  private readonly logger = new Logger(EnhancedInterviewerService.name);

  // Store template context per room
  private roomTemplates = new Map<string, InterviewTemplate>();

  constructor(
    private readonly aiService: AIService,
  ) {
    // Log current AI provider
    const info = this.aiService.getProviderInfo();
    this.logger.log(`🤖 Using AI provider: ${info.provider} (${info.modelName})`);
  }

  /**
   * Set template context for a room
   */
  async setRoomTemplate(roomName: string, template: InterviewTemplate): Promise<void> {
    this.roomTemplates.set(roomName, template);
    this.logger.log(`Set template "${template.name}" for room ${roomName}`);
  }
  /**
   * Generate greeting message based on template
   */
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
      // Use Gemini instead of OpenAI
      const response = await this.aiService.generateWithSystemPrompt(
        systemPrompt,
      );

      return response.trim();
    } catch (error) {
      this.logger.error('Error getting response:', error);
      throw error;
    }
  }
  /**
   * Clear template context for room
   */
  clearRoomTemplate(roomName: string): void {
    this.roomTemplates.delete(roomName);
    this.logger.log(`Cleared template for room ${roomName}`);
  }

  /**
   * Generate next question - unified approach for all templates
   */
  async generateQuestion(
    session: InterviewSession,
    questionNumber: number,
  ): Promise<string> {
    const threadId = this.getThreadId(session);
    const isLastQuestion = questionNumber === session.template.numberOfQuestions;

    // CHECK: If template is "Structured Q&A Interview", use pre-defined questions
    if (session.template.name === 'Non-AI Generate Interview') {
      return this.getPreDefinedQuestion(session, questionNumber);
    }
    // Build recent conversation for context
    const recentMessages = this.buildRecentConversation(session, 10);
    const conversationContext = recentMessages.length > 0
      ? `\n\nCONVERSATION SO FAR:\n${recentMessages.map(m =>
        `${m.role === 'user' ? 'Candidate' : 'Interviewer'}: ${m.content}`
      ).join('\n')}`
      : '';

    // Unified system prompt for all templates
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

  /**
  * Score answer using Gemini
  */
  async scoreAnswer(
    session: InterviewSession,
    questionNumber: number,
    question: string,
    answer: string,
  ): Promise<QuestionScoreData> {
    // Check if this template should skip scoring
    const skipScoringTemplates = ['HR Interview Simulation', 'Non-AI Generate Interview',];

    if (skipScoringTemplates.includes(session.template.name)) {
      return {
        question,
        answer,
        score: 10, // Default score, not shown to user
        feedback: 'Response recorded.',
      };
    }

    // Scoring prompt for other templates
    const systemPrompt = `You are an English language assessor.

TASK: Score this answer.

Question ${questionNumber}: ${question}
Answer: ${answer}

Template: ${session.template.name}
Level: ${session.template.level}

Provide:
1. Score (1-10):
2. Feedback (2-3 sentences):

Consider grammar, vocabulary, relevance, and completeness.
Be objective but encouraging.`;

    try {
      const response = await this.aiService.generateText(systemPrompt);

      // Parse score and feedback from text
      const scoreMatch = response.match(/(?:Score|1\..*?)[\s:]*(\d+)(?:\/10)?/i);
      const score = scoreMatch ? parseInt(scoreMatch[1]) : 7;

      // Get feedback (everything after "Feedback:" or "2.")
      const feedbackMatch = response.match(/(?:Feedback|2\.)[\s:]*(.+?)$/is);
      const feedback = feedbackMatch
        ? feedbackMatch[1].trim().substring(0, 200)
        : response.substring(0, 200);

      return {
        question,
        answer,
        score: Math.max(1, Math.min(10, score)),
        feedback: feedback || 'Good effort!',
      };
    } catch (error) {
      this.logger.error('Error scoring answer:', error);

      return {
        question,
        answer,
        score: 7,
        feedback: 'Good effort! Keep practicing to improve your skills.',
      };
    }
  }
  /**
   * Generate overall feedback (NO per-question scoring)
   */
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
      totalScore: 0, // No scoring for this template
    };
  }
    const conversationText = session.messages
      .map((msg) => `${msg.role === MessageRole.USER ? 'Candidate' : 'Interviewer'}: ${msg.content}`)
      .join('\n\n');

    const systemPrompt = `You are an English language assessor providing comprehensive feedback.

INTERVIEW DETAILS:
- Template: ${session.template.name}
- Level: ${session.template.level}
- Type: ${session.template.type}
- Questions: ${session.template.numberOfQuestions}

FULL CONVERSATION:
${conversationText.substring(0, 4000)} ${conversationText.length > 4000 ? '...(truncated)' : ''}

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
  /**
  * Parse feedback sections from text response
  */
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

  /**
  * Extract numbered or bulleted list items
  */
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

  /**
   * Format complete feedback for display
   */
  formatCompleteFeedback(session: InterviewSession): string {
    if (!session.overallFeedback) return 'No feedback available.';

    let message = '📊 **Detailed Feedback Report**\n\n';
    message += '╔══════════════════════════════════════╗\n\n';

    message += `**Overall Score: ${session.overallFeedback.totalScore}/10**\n\n`;

    message += '📝 **Overall Assessment:**\n';
    message += `${session.overallFeedback.overall}\n\n`;

    if (session.overallFeedback.strengths.length > 0) {
      message += '✨ **Your Strengths:**\n';
      session.overallFeedback.strengths.forEach((strength, i) => {
        message += `${i + 1}. ${strength}\n`;
      });
      message += '\n';
    }

    if (session.overallFeedback.improvements.length > 0) {
      message += '📈 **Areas for Improvement:**\n';
      session.overallFeedback.improvements.forEach((improvement, i) => {
        message += `${i + 1}. ${improvement}\n`;
      });
      message += '\n';
    }

    if (session.durationSeconds) {
      const minutes = Math.floor(session.durationSeconds / 60);
      const seconds = session.durationSeconds % 60;
      message += `⏱️ Duration: ${minutes}m ${seconds}s\n\n`;
    }

    message += '╔══════════════════════════════════════╗\n';
    message += 'Use `*start` to begin another interview!\n';
    message += 'Use `*history` to see your past sessions.';

    return message;
  }

  /**
   * Get thread ID for conversation persistence
   */
  private getThreadId(session: InterviewSession): string {
    return `session-${session.id}`;
  }

  private buildRecentConversation(
    session: InterviewSession,
    limit: number = 6,
  ): Array<{ role: 'user' | 'model'; content: string }> {
    if (!session.messages || session.messages.length === 0) {
      return [];
    }

    const recentMessages = session.messages.slice(-limit);

    return recentMessages.map((msg) => ({
      role: msg.role === MessageRole.USER ? 'user' as const : 'model' as const,
      content: msg.content,
    }));
  }

  /**
 * NEW: Get pre-defined question from template (no AI generation)
 */
  private getPreDefinedQuestion(
    session: InterviewSession,
    questionNumber: number,
  ): string {
    // Question number is 1-based, array is 0-based
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