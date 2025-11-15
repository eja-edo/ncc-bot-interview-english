import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance } from "axios";

@Injectable()
export class AxiosClient implements OnModuleInit {
  private instance: AxiosInstance | null = null;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const baseURL = this.configService.get<string>("AGENT_BASE_URL")!;

    this.instance = axios.create({
      baseURL,
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 30000,
    });

    this.instance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (axios.isAxiosError(error)) {
          if (error.response) {
            console.error(
              `API Error: ${error.response.status} - ${JSON.stringify(
                error.response.data
              )}`
            );
          } else if (error.request) {
            console.error(`API Request failed: ${error.message}`);
          }
        }
        return Promise.reject(error);
      }
    );
  }

  getInstance(): AxiosInstance {
    if (!this.instance) {
      throw new Error("AxiosClient not initialized. Call onModuleInit first.");
    }
    return this.instance;
  }
}
