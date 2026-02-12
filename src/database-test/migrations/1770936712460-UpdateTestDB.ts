import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateTestDB1770936712460 implements MigrationInterface {
    name = 'UpdateTestDB1770936712460'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop the old simple-array column
        await queryRunner.query(`ALTER TABLE "interview_sessions" DROP COLUMN "audioFilePaths"`);
        
        // Add new jsonb column with default empty array
        // This will store array of URL strings: ["url1", "url2", "url3"]
        await queryRunner.query(`
            ALTER TABLE "interview_sessions" 
            ADD "audioFilePaths" jsonb DEFAULT '[]'::jsonb
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert back to simple-array
        await queryRunner.query(`ALTER TABLE "interview_sessions" DROP COLUMN "audioFilePaths"`);
        
        await queryRunner.query(`
            ALTER TABLE "interview_sessions" 
            ADD "audioFilePaths" text
        `);
    }

}
