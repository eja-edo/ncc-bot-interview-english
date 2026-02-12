export class UploadAudioDto {
  interview_id: string;
  tracks: Record<string, string>; // { "timestamp1": "url1", "timestamp2": "url2", ... }
}

export interface AudioTrack {
  timestamp: string; // started_at_ns
  url: string;
}