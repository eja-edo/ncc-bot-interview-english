import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateEntities1763697716504 implements MigrationInterface {
    name = 'UpdateEntities1763697716504'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "interview_qa" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "session_id" uuid NOT NULL, "question_order" integer NOT NULL, "question" text NOT NULL, "answer_text" text, "question_asked_at" TIMESTAMP, "answer_received_at" TIMESTAMP, "response_time_seconds" double precision, "ai_evaluation" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "question_audio_id" character varying, "answer_audio_id" character varying, CONSTRAINT "PK_d0170b2ece392e745338e3811b4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."audio_records_audio_type_enum" AS ENUM('question', 'answer', 'bot_response', 'full_session')`);
        await queryRunner.query(`CREATE TYPE "public"."audio_records_storage_provider_enum" AS ENUM('local', 's3', 'cloudinary')`);
        await queryRunner.query(`CREATE TABLE "audio_records" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "session_id" uuid NOT NULL, "qa_id" uuid, "audio_type" "public"."audio_records_audio_type_enum" NOT NULL DEFAULT 'answer', "file_path" character varying NOT NULL, "file_url" character varying, "storage_provider" "public"."audio_records_storage_provider_enum" NOT NULL DEFAULT 'local', "file_size_bytes" integer, "duration_seconds" integer, "transcript" text, "transcript_confidence" double precision, "metadata" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ad93fbd2b1307657cab48a6abb2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."conversation_messages_role_enum" AS ENUM('user', 'assistant', 'system')`);
        await queryRunner.query(`CREATE TYPE "public"."conversation_messages_message_type_enum" AS ENUM('text', 'voice', 'command')`);
        await queryRunner.query(`CREATE TABLE "conversation_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "session_id" uuid NOT NULL, "role" "public"."conversation_messages_role_enum" NOT NULL, "message_type" "public"."conversation_messages_message_type_enum" NOT NULL DEFAULT 'text', "content" text NOT NULL, "audio_id" character varying, "metadata" jsonb, "sequence_number" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_113248f25c4c0a7c179b3f5a609" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."interview_sessions_status_enum" AS ENUM('pending', 'in_progress', 'completed', 'cancelled')`);
        await queryRunner.query(`CREATE TABLE "interview_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "room_name" character varying NOT NULL, "meeting_code" character varying NOT NULL, "cv_link" character varying, "prompts" jsonb, "status" "public"."interview_sessions_status_enum" NOT NULL DEFAULT 'pending', "started_at" TIMESTAMP, "ended_at" TIMESTAMP, "current_question_index" integer NOT NULL DEFAULT '0', "total_questions" integer NOT NULL DEFAULT '5', "ai_summary" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "full_session_audio_path" character varying, "full_session_audio_url" character varying, CONSTRAINT "PK_8289f4ee665d0b5e283345db49a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "mezon_user_id" character varying NOT NULL, "username" character varying NOT NULL, "email" character varying, "phone_number" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_93fed282a4b789488e6a76ff5d4" UNIQUE ("mezon_user_id"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "interview_qa" ADD CONSTRAINT "FK_6af64ba866a75193eb11b1fd9ff" FOREIGN KEY ("session_id") REFERENCES "interview_sessions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "audio_records" ADD CONSTRAINT "FK_674225409d54c31d74e92251830" FOREIGN KEY ("session_id") REFERENCES "interview_sessions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "audio_records" ADD CONSTRAINT "FK_67a61de1fce6d191c1e94c3b0ea" FOREIGN KEY ("qa_id") REFERENCES "interview_qa"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "conversation_messages" ADD CONSTRAINT "FK_5f3140e333b75ed2ee4c8d2cbe2" FOREIGN KEY ("session_id") REFERENCES "interview_sessions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "interview_sessions" ADD CONSTRAINT "FK_256af682c73f96827ea2927f99d" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "interview_sessions" DROP CONSTRAINT "FK_256af682c73f96827ea2927f99d"`);
        await queryRunner.query(`ALTER TABLE "conversation_messages" DROP CONSTRAINT "FK_5f3140e333b75ed2ee4c8d2cbe2"`);
        await queryRunner.query(`ALTER TABLE "audio_records" DROP CONSTRAINT "FK_67a61de1fce6d191c1e94c3b0ea"`);
        await queryRunner.query(`ALTER TABLE "audio_records" DROP CONSTRAINT "FK_674225409d54c31d74e92251830"`);
        await queryRunner.query(`ALTER TABLE "interview_qa" DROP CONSTRAINT "FK_6af64ba866a75193eb11b1fd9ff"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TABLE "interview_sessions"`);
        await queryRunner.query(`DROP TYPE "public"."interview_sessions_status_enum"`);
        await queryRunner.query(`DROP TABLE "conversation_messages"`);
        await queryRunner.query(`DROP TYPE "public"."conversation_messages_message_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."conversation_messages_role_enum"`);
        await queryRunner.query(`DROP TABLE "audio_records"`);
        await queryRunner.query(`DROP TYPE "public"."audio_records_storage_provider_enum"`);
        await queryRunner.query(`DROP TYPE "public"."audio_records_audio_type_enum"`);
        await queryRunner.query(`DROP TABLE "interview_qa"`);
    }

}
