import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { InterviewTemplate } from '../database-test/entities/interview-template.entity';
import { InterviewSession } from '../database-test/entities/interview-session-test.entity';
import { TemplateService } from '../interviewer/template.service';
import { UserService } from '@/interviewer/user.service';
import { User } from './entities/user-test.entity';
import { CustomPrompt } from './entities/custom-prompt.entity';
import { SessionMessage } from './entities/session-message.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        entities: [User,
          CustomPrompt,
          InterviewTemplate,
          InterviewSession,
          SessionMessage,],
        synchronize: configService.get<string>('NODE_ENV') === 'development',
        logging: false,
      }),
    }),
    TypeOrmModule.forFeature([User, CustomPrompt, InterviewTemplate, InterviewSession, SessionMessage]),
  ],
  providers: [TemplateService, UserService],
  exports: [TemplateService, TypeOrmModule, UserService],
})
export class DatabaseTestModule implements OnModuleInit {
  constructor(private readonly templateService: TemplateService) {}

  async onModuleInit() {
    await this.templateService.seedDefaultTemplates();
  }
}