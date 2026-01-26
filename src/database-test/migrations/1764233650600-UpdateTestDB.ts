import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateTestDB1764233650600 implements MigrationInterface {
    name = 'UpdateTestDB1764233650600'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "interview_sessions" DROP CONSTRAINT "FK_983f98d1377ff1879132a17e8d9"`);
        await queryRunner.query(`ALTER TABLE "interview_sessions" DROP COLUMN "userId"`);
        await queryRunner.query(`ALTER TABLE "interview_sessions" ADD "userId" character varying(50) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "interview_sessions" ADD CONSTRAINT "FK_983f98d1377ff1879132a17e8d9" FOREIGN KEY ("userId") REFERENCES "users"("mezonUserId") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "interview_sessions" DROP CONSTRAINT "FK_983f98d1377ff1879132a17e8d9"`);
        await queryRunner.query(`ALTER TABLE "interview_sessions" DROP COLUMN "userId"`);
        await queryRunner.query(`ALTER TABLE "interview_sessions" ADD "userId" bigint NOT NULL`);
        await queryRunner.query(`ALTER TABLE "interview_sessions" ADD CONSTRAINT "FK_983f98d1377ff1879132a17e8d9" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
