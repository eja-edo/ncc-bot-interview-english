import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateTestDB1770978976629 implements MigrationInterface {
    name = 'UpdateTestDB1770978976629'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "interview_sessions" ALTER COLUMN "mode" SET DEFAULT 'mixed'`);
        await queryRunner.query(`ALTER TABLE "interview_sessions" ALTER COLUMN "audioFilePaths" SET NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "interview_sessions" ALTER COLUMN "audioFilePaths" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "interview_sessions" ALTER COLUMN "mode" SET DEFAULT 'text'`);
    }

}
