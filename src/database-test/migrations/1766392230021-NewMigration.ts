import { MigrationInterface, QueryRunner } from "typeorm";

export class NewMigration1766392230021 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        const questionPool = [
            // REQUIRED FIRST QUESTION (index 0) - ALWAYS ASKED
            "Can you introduce yourself and your background?",
            
            "Why did you choose to become a developer?",
            "What are your short-term and long-term career goals?",
            "What motivates you to keep learning and improving yourself?",
            
            "Can you describe the most impressive project you've worked on and your role in it?",
            
            "Do you prefer working in a team or working independently? Why?",
            "How do you usually handle conflicts or misunderstandings within a team or with customers?",
            "If team performance is below expectations how would you handle that situation?",
            "What values do you think are important in a high-performing tech team?",
            "How do you usually share knowledge or support other team members especially juniors?",
            
            "How do you approach learning a new technology or framework under a tight deadline?",
            "What is the first thing you do when your code doesn't work as expected?",
            "When you're stuck how long do you try to solve the problem on your own before asking for help?",
            "Have you ever had to discard your first solution and start over? What did you learn from that experience?",
            "After fixing a difficult bug what do you do to avoid repeating the same issue in the future?",
            
            "What tools resources or methods do you usually use to solve coding problems?",
            "Where do you usually look for answers when facing technical challenges?",
            "How do you stay updated with the latest trends in technology?",
            
            "Among the four English skills listening speaking reading writing which one are you most confident in? Which one do you want to improve and how?",
            "Have you ever worked with foreign clients or teammates? How was your experience?",
            
            "What expectations do you have for this position?",
            "If you join as an intern would you prefer close guidance from a mentor or more independence to explore and learn on your own? Why?",
            "Do you see yourself becoming a full-stack developer in the future? Why or why not?"
        ];

        await queryRunner.query(`
            UPDATE interview_templates 
            SET 
                "sampleQuestions" = $1,
                "systemPrompt" = $2,
                "description" = $3,
                "numberOfQuestions" = $4
            WHERE name = 'Non-AI Generate Interview'
        `, [
            questionPool,
            `You are conducting a structured interview with randomized pre-defined questions.

QUESTION SELECTION LOGIC:
- Question 1: ALWAYS "Can you tell me about yourself and your background?"
- Questions 2-8: Randomly selected from the question pool (no repeats)
- Each interview session gets a unique set of 8 questions

IMPORTANT: 
- You do NOT generate questions
- Questions are pre-selected at the start of the interview
- Simply present the questions one by one
- Wait for answers
- Move to next question

This format ensures consistency while providing variety through randomization.`,
            'Pre-defined questions with random selection - each interview gets 8 unique questions from a larger pool',
            8
        ]);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert to original 8 questions
        const originalQuestions = [
            'What is your full name and current occupation?',
            'How many years of work experience do you have?',
            'What are your main responsibilities in your current role?',
            'Can you describe one major project you completed recently?',
            'What programming languages or tools do you use regularly?',
            'How do you prioritize tasks when you have multiple deadlines?',
            'What is your biggest professional achievement so far?',
            'What are your career goals for the next 2-3 years?',
        ];

        await queryRunner.query(`
            UPDATE interview_templates 
            SET 
                "sampleQuestions" = $1,
                "systemPrompt" = $2,
                "description" = $3,
                "numberOfQuestions" = $4
            WHERE name = 'Non-AI Generate Interview'
        `, [
            originalQuestions,
            `You are conducting a structured interview with pre-defined questions.

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
            'Pre-defined questions without AI generation - straightforward Q&A format',
            8
        ]);
    }

}
