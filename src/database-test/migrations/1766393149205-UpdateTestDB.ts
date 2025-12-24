import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class UpdateTestDB1766393149205 implements MigrationInterface {
    name = 'UpdateTestDB1766393149205'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn('interview_sessions', new TableColumn({
            name: 'selectedQuestions',
            type: 'jsonb',
            isNullable: true,
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "interview_sessions" DROP COLUMN "selectedQuestions"`);
    }

}
