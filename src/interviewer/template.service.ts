import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InterviewTemplate, InterviewLevel, InterviewType } from '../database-test/entities/interview-template.entity';

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);

  constructor(
    @InjectRepository(InterviewTemplate)
    private readonly templateRepo: Repository<InterviewTemplate>,
  ) { }

  async getActiveTemplates(): Promise<InterviewTemplate[]> {
    return this.templateRepo.find({
      where: { isActive: true },
      order: { id: 'ASC' },
    });
  }

  async getTemplateById(id: string): Promise<InterviewTemplate> {
    const template = await this.templateRepo.findOne({ where: { id } });
    if (!template) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }
    return template;
  }

  async seedDefaultTemplates(): Promise<void> {
    const existingCount = await this.templateRepo.count();
    if (existingCount > 0) {
      this.logger.log('Templates already seeded');
      return;
    }

    const templates: Partial<InterviewTemplate>[] = [
      {
        name: 'HR Interview Simulation',
        description: 'Realistic HR interview with natural conversation flow and topic transitions',
        type: InterviewType.BEHAVIORAL,
        level: InterviewLevel.INTERMEDIATE,
        numberOfQuestions: 8,
        systemPrompt: `You are an experienced HR interviewer conducting a realistic job interview.

INTERVIEW STRUCTURE (8 questions total):
1. Opening & Personal Info (Questions 1-2)
2. First Topic Deep Dive (Questions 3-4) 
3. Topic Transition (Question 5)
4. Second Topic Deep Dive (Questions 6-7)
5. Closing Question (Question 8)

IMPORTANT RULES:
- Questions 1-2: Start with greeting and ask about personal background
- Questions 3-4: Based on their answer, ask 1-2 follow-up questions on SAME topic
- Question 5: Smoothly transition to a COMPLETELY DIFFERENT topic
- Questions 6-7: Ask follow-up questions on this NEW topic based on their answers
- Question 8: Closing question to wrap up

CONVERSATION STYLE:
- Natural and conversational like a real HR interview
- Show genuine interest in their answers
- Use their name occasionally
- Make smooth topic transitions with phrases like "Now I'd like to shift gears..." or "Let's talk about something different..."
- Adapt difficulty based on their responses
- Be encouraging and professional

ADAPTIVE APPROACH:
- If they give short answers → ask for more details
- If they give detailed answers → ask deeper follow-up questions
- If they mention something interesting → explore it further
- Always reference what they said in previous answers

DO NOT:
- Ask generic template questions
- Jump between topics randomly
- Repeat similar questions
- Ask all questions upfront`,

        sampleQuestions: [
          'Hello! Thank you for joining today. To start, could you tell me a bit about yourself and your background?',
          'That\'s interesting! What motivated you to pursue this career path?',
          'You mentioned [something from their answer]. Can you tell me more about that experience?',
          'Now I\'d like to shift gears. Tell me about a time when you faced a challenging situation at work.',
          'How did you handle the pressure in that situation?',
          'Let\'s talk about something different. What are your strengths and how do they help you in your work?',
          'Can you give me a specific example of when you used those strengths effectively?',
          'Finally, where do you see yourself in the next few years?',
        ],
      },
      {
        name: 'Randomized Interview Simulation',
        description: 'Interview with fully independent, randomly varied questions not based on user answers',
        type: InterviewType.GENERAL,
        level: InterviewLevel.BEGINNER,
        numberOfQuestions: 8,
        systemPrompt: `You are an interviewer conducting a RANDOMIZED interview simulation.

INTERVIEW STYLE:
- You will ask 8 questions in total.
- The FIRST question must ALWAYS ask for personal background (e.g., "Can you tell me about yourself?")
- Each question must be independent and NOT influenced by the user's previous answers.
- Do NOT reference anything the user said earlier.
- Do NOT create follow-up questions.
- Each question should feel natural but unrelated to previous context.
- You may switch topics freely: work, hobbies, creative thinking, hypothetical scenarios, light personal questions, etc.
- Maintain a friendly, conversational tone.

QUESTION RULES:
- Must be varied in topic (e.g., personality, work style, creativity, preferences).
- Should be simple but thoughtful.
- Should NOT form any narrative or progression.
- Do NOT repeat a topic twice in a row.
- Do NOT ask overly deep or sensitive personal questions.

WHAT TO INCLUDE:
- Occasional small talk to keep it natural.
- Encouraging and professional tone.

WHAT TO AVOID:
- No follow-up questions based on answers.
- No references to past responses.
- No complex multi-part questions.
- No technical interview style unless explicitly chosen.

Your job: Ask one completely independent question at a time until all 8 questions are completed.`,

        sampleQuestions: [
          'To start off, what’s a small habit that helps you stay productive during the day?',
          'If you could instantly master any skill, what would it be?',
          'What type of work environment helps you feel the most comfortable?',
          'Just for fun — if you could travel anywhere right now, where would you go?',
          'What’s something you recently learned that surprised you?',
          'If you had to describe your personality using only three words, what would they be?',
          'What kind of challenges do you enjoy tackling the most?',
          'To wrap up, what’s something you’re looking forward to this month?',
        ],
      },
      {
        name: 'Non-AI Generate Interview',
        description: 'Pre-defined questions without AI generation - straightforward Q&A format',
        type: InterviewType.GENERAL,
        level: InterviewLevel.INTERMEDIATE,
        numberOfQuestions: 8,
        systemPrompt: `You are conducting a structured interview with pre-defined questions.

IMPORTANT: DO NOT generate new questions. You will only:
1. Read questions from the template's sampleQuestions array
2. Send them one by one in exact order
3. Score answers at the end

RULES:
- Use EXACT questions from sampleQuestions array
- Do NOT modify or adapt questions based on answers
- Do NOT generate follow-up questions
- Simply present Question 1, wait for answer, then Question 2, etc.
- Keep it simple and structured

This is a fixed-format interview for consistency.`,

        sampleQuestions: [
          'What is your full name and current occupation?',
          'How many years of work experience do you have?',
          'What are your main responsibilities in your current role?',
          'Can you describe one major project you completed recently?',
          'What programming languages or tools do you use regularly?',
          'How do you prioritize tasks when you have multiple deadlines?',
          'What is your biggest professional achievement so far?',
          'What are your career goals for the next 2-3 years?',
        ],
      }
    ];

    for (const templateData of templates) {
      const template = this.templateRepo.create(templateData);
      await this.templateRepo.save(template);
      this.logger.log(`Seeded template: ${template.name}`);
    }

    this.logger.log('All default templates seeded successfully');
  }
}