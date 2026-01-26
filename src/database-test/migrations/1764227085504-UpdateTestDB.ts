import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateTestDB1764227085504 implements MigrationInterface {
    name = 'UpdateTestDB1764227085504'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."interview_templates_type_enum" AS ENUM('general', 'technical', 'behavioral', 'situational')`);
        await queryRunner.query(`CREATE TYPE "public"."interview_templates_level_enum" AS ENUM('beginner', 'intermediate', 'advanced')`);
        await queryRunner.query(`CREATE TABLE "interview_templates" ("id" BIGSERIAL NOT NULL, "name" character varying NOT NULL, "description" text NOT NULL, "type" "public"."interview_templates_type_enum" NOT NULL DEFAULT 'general', "level" "public"."interview_templates_level_enum" NOT NULL DEFAULT 'intermediate', "systemPrompt" text NOT NULL, "sampleQuestions" text NOT NULL, "numberOfQuestions" integer NOT NULL DEFAULT '5', "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_bae62bf68d048511f72f693b12e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."session_messages_role_enum" AS ENUM('user', 'assistant', 'system')`);
        await queryRunner.query(`CREATE TYPE "public"."session_messages_type_enum" AS ENUM('text', 'audio', 'transcript')`);
        await queryRunner.query(`CREATE TABLE "session_messages" ("id" BIGSERIAL NOT NULL, "sessionId" bigint NOT NULL, "role" "public"."session_messages_role_enum" NOT NULL, "type" "public"."session_messages_type_enum" NOT NULL DEFAULT 'text', "content" text NOT NULL, "audioFilePath" character varying, "audioDurationMs" integer, "transcript" text, "questionNumber" integer, "metadata" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_25b3c73b5dd210b40ce5c02ce20" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."interview_sessions_status_enum" AS ENUM('pending', 'in_progress', 'completed', 'cancelled')`);
        await queryRunner.query(`CREATE TYPE "public"."interview_sessions_mode_enum" AS ENUM('text', 'voice', 'mixed')`);
        await queryRunner.query(`CREATE TABLE "interview_sessions" ("id" BIGSERIAL NOT NULL, "userId" bigint NOT NULL, "channelId" character varying NOT NULL, "roomName" character varying, "templateId" bigint NOT NULL, "status" "public"."interview_sessions_status_enum" NOT NULL DEFAULT 'pending', "mode" "public"."interview_sessions_mode_enum" NOT NULL DEFAULT 'text', "currentQuestionIndex" integer NOT NULL DEFAULT '0', "overallFeedback" jsonb, "questionScores" jsonb NOT NULL DEFAULT '[]', "audioFilePaths" text, "fullTranscript" text, "startedAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "completedAt" TIMESTAMP, "durationSeconds" integer, CONSTRAINT "PK_8289f4ee665d0b5e283345db49a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "users" ("id" BIGSERIAL NOT NULL, "mezonUserId" character varying(50) NOT NULL, "username" character varying NOT NULL, "email" character varying, "avatarUrl" character varying, "metadata" jsonb NOT NULL DEFAULT '{}', "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_3c175d1fbdd513f61032f94a1ef" UNIQUE ("mezonUserId"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."custom_prompts_type_enum" AS ENUM('greeting', 'question', 'feedback', 'follow_up')`);
        await queryRunner.query(`CREATE TABLE "custom_prompts" ("id" BIGSERIAL NOT NULL, "name" character varying NOT NULL, "content" text NOT NULL, "type" "public"."custom_prompts_type_enum" NOT NULL, "userId" bigint, "isGlobal" boolean NOT NULL DEFAULT false, "isActive" boolean NOT NULL DEFAULT true, "variables" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4dca1cae5dbf1371c96ab53a693" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "session_messages" ADD CONSTRAINT "FK_be15965a8de3e36645391e8c1ff" FOREIGN KEY ("sessionId") REFERENCES "interview_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "interview_sessions" ADD CONSTRAINT "FK_983f98d1377ff1879132a17e8d9" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "interview_sessions" ADD CONSTRAINT "FK_0bf329e1bf92eb47b5854b2cbc7" FOREIGN KEY ("templateId") REFERENCES "interview_templates"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "custom_prompts" ADD CONSTRAINT "FK_ff9d37f2736b66a125c49f2228b" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "custom_prompts" DROP CONSTRAINT "FK_ff9d37f2736b66a125c49f2228b"`);
        await queryRunner.query(`ALTER TABLE "interview_sessions" DROP CONSTRAINT "FK_0bf329e1bf92eb47b5854b2cbc7"`);
        await queryRunner.query(`ALTER TABLE "interview_sessions" DROP CONSTRAINT "FK_983f98d1377ff1879132a17e8d9"`);
        await queryRunner.query(`ALTER TABLE "session_messages" DROP CONSTRAINT "FK_be15965a8de3e36645391e8c1ff"`);
        await queryRunner.query(`DROP TABLE "custom_prompts"`);
        await queryRunner.query(`DROP TYPE "public"."custom_prompts_type_enum"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TABLE "interview_sessions"`);
        await queryRunner.query(`DROP TYPE "public"."interview_sessions_mode_enum"`);
        await queryRunner.query(`DROP TYPE "public"."interview_sessions_status_enum"`);
        await queryRunner.query(`DROP TABLE "session_messages"`);
        await queryRunner.query(`DROP TYPE "public"."session_messages_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."session_messages_role_enum"`);
        await queryRunner.query(`DROP TABLE "interview_templates"`);
        await queryRunner.query(`DROP TYPE "public"."interview_templates_level_enum"`);
        await queryRunner.query(`DROP TYPE "public"."interview_templates_type_enum"`);
    }

}
