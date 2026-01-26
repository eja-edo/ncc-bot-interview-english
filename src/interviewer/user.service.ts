import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../database-test/entities/user-test.entity';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async findOrCreateUser(
    mezonUserId: string,
    username: string,
    metadata?: Partial<User['metadata']>,
  ): Promise<User> {
    let user = await this.userRepo.findOne({
      where: { mezonUserId },
    });

    if (!user) {
      user = this.userRepo.create({
        mezonUserId,
        username,
        metadata: metadata || {},
      });
      await this.userRepo.save(user);
      this.logger.log(`Created new user: ${username} (${mezonUserId})`);
    }

    return user;
  }

  async getUserById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  async getUserByMezonId(mezonUserId: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { mezonUserId } });
  }

  async updateUserMetadata(
    id: string,
    metadata: Partial<User['metadata']>,
  ): Promise<User> {
    const user = await this.getUserById(id);
    if (!user) {
      throw new Error('User not found');
    }

    user.metadata = { ...user.metadata, ...metadata };
    return this.userRepo.save(user);
  }
}