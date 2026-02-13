import { Module } from "@nestjs/common";
import { InterviewAudioController } from "@/record-audio/record-audio.controller";
import { InterviewerModule } from "@/interviewer/interviewer.module";

@Module({
  imports: [InterviewerModule],
  controllers: [InterviewAudioController],
  providers: [],
  exports: [],
})
export class RecordAudioModule { }