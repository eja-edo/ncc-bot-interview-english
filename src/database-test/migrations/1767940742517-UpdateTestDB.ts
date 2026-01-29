import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class UpdateTestDB1767940742517 implements MigrationInterface {
    name = 'UpdateTestDB1767940742517'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Add questionSections column to interview_templates
        await queryRunner.addColumn('interview_templates', new TableColumn({
            name: 'questionSections',
            type: 'jsonb',
            isNullable: true,
        }));

        // 2. Add selectedSections column to interview_sessions
        await queryRunner.addColumn('interview_sessions', new TableColumn({
            name: 'selectedSections',
            type: 'jsonb',
            isNullable: true,
        }));

        // 3. Define question sections with proper structure
        const questionSections = [
            {
                name: 'I. Personal Information & Career Orientation',
                description: 'Understanding background and career goals',
                questionsToSelect: 2,
                questions: [
                    'Can you introduce yourself and your background?',
                    'Why did you choose to become a developer?',
                    'What are your short-term and long-term career goals?',
                    'What motivates you to keep learning and improving yourself?',
                    'Do you see yourself becoming a full-stack developer in the future? Why or why not?',
                ]
            },
            {
                name: 'II. Experience & Projects',
                description: 'Past work and project experiences',
                questionsToSelect: 2,
                questions: [
                    'Can you describe the most impressive project you have worked on and your role in it?',
                    'What challenges did you face in that project and how did you overcome them?',
                    'Have you ever had to discard your first solution and start over? What did you learn from that experience?',
                ]
            },
            {
                name: 'III. Problem-Solving & Technical Skills',
                description: 'Approach to learning and problem-solving',
                questionsToSelect: 2,
                questions: [
                    'How do you approach learning a new technology or framework under a tight deadline?',
                    'How do you stay updated with the latest trends in technology?',
                    'What is the first thing you do when your code does not work as expected?',
                    'When you are stuck, how long do you try to solve the problem on your own before asking for help?',
                    'After fixing a difficult bug what do you do to avoid repeating the same issue in the future?',
                    'What tools resources or methods do you usually use to solve coding problems?',
                    'Where do you usually look for answers when facing technical challenges?',
                ]
            },
            {
                name: 'IV. Teamwork & Communication Skills',
                description: 'Team collaboration and communication',
                questionsToSelect: 1,
                questions: [
                    'Do you prefer working in a team or working independently? Why?',
                    'How do you usually handle conflicts or misunderstandings within a team or with customers?',
                    'If team performance is below expectations how would you handle that situation?',
                    'What values do you think are important in a high-performing tech team?',
                    'How do you usually share knowledge or support other team members especially juniors?',
                    'Have you ever worked with foreign clients or teammates? How was your experience?',
                ]
            },
            {
                name: 'V. Expectations & Role Fit',
                description: 'Understanding expectations and fit for the role',
                questionsToSelect: 1,
                questions: [
                    'What expectations do you have for this position?',
                    'If you join as an intern would you prefer close guidance from a mentor or more independence to explore and learn on your own? Why?',
                ]
            }
        ];

        const totalQuestions = questionSections.reduce((sum, section) => sum + section.questionsToSelect, 0);

        await queryRunner.query(`
            UPDATE interview_templates 
            SET 
                "questionSections" = $1,
                "numberOfQuestions" = $2,
                "systemPrompt" = $3,
                "description" = $4
            WHERE name = 'Non-AI Generate Interview'
        `, [
            JSON.stringify(questionSections),
            totalQuestions,
            `You are conducting a structured interview with section-based question selection.

INTERVIEW STRUCTURE:
The interview is organized into ${questionSections.length} sections covering:
${questionSections.map((s, i) => `${i + 1}. ${s.name.replace(/^[IVX]+\.\s*/, '')} (${s.questionsToSelect} question${s.questionsToSelect > 1 ? 's' : ''})`).join('\n')}

QUESTION FLOW:
- Questions are presented IN SECTION ORDER (I → II → III → IV → V)
- Within each section questions are randomly selected
- Total questions per interview: ${totalQuestions}
- This ensures comprehensive coverage while maintaining logical progression

IMPORTANT:
- You do NOT generate questions
- Questions are pre-selected from sections at interview start
- Follow the section order strictly
- Present questions naturally without announcing section names
- Wait for answers between questions
- Maintain professional conversational flow

This format balances structure (section order) with variety (random selection within sections).`,
            'Structured interview with ordered sections and randomized questions within each section'
        ]);

        console.log(`✅ Updated Non-AI Generate Interview with ${questionSections.length} sections (${totalQuestions} total questions)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const flatQuestions = [
            'Can you introduce yourself and your background?',
            'Why did you choose to become a developer?',
            'What are your short-term and long-term career goals?',
            'What motivates you to keep learning and improving yourself?',
            'Can you describe the most impressive project you have worked on and your role in it?',
            'Do you prefer working in a team or working independently? Why?',
            'How do you usually handle conflicts or misunderstandings within a team or with customers?',
            'What are your career goals for the next 2-3 years?',
        ];

        await queryRunner.query(`
            UPDATE interview_templates 
            SET 
                "questionSections" = NULL,
                "sampleQuestions" = $1,
                "numberOfQuestions" = $2,
                "systemPrompt" = $3,
                "description" = $4
            WHERE name = 'Non-AI Generate Interview'
        `, [
            flatQuestions,
            8,
            `You are conducting a structured interview with randomized pre-defined questions.`,
            'Pre-defined questions with random selection'
        ]);

        await queryRunner.dropColumn('interview_sessions', 'selectedSections');
        await queryRunner.dropColumn('interview_templates', 'questionSections');
    }

}
