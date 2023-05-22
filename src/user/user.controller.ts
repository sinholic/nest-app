import {
  Body,
  Controller,
  HttpStatus,
  HttpException,
  Post,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { User } from './user.entity';

interface DBCommand {
  type: string;
  cmd: string;
}

interface RequestData {
  type: string;
  cmd_chain: DBCommand[];
}

interface ReturnObject {
  status: string;
  dbState: string[];
}

@Controller('user')
export class UserController {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  @Post('addMultiple')
  async addMultiple(@Body() requestData: RequestData): Promise<ReturnObject> {
    const { cmd_chain } = requestData;
    const dbState: string[] = [];

    for (const cmd of cmd_chain) {
      const { cmd: sqlQuery } = cmd;

      try {
        await this.userRepository.query(sqlQuery);
        dbState.push(sqlQuery);
      } catch (error) {
        await this.revertChanges(dbState);
        throw new HttpException(
          {
            status: 'error',
            dbState,
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    return {
      status: 'ok',
      dbState,
    };
  }

  private async revertChanges(dbState: string[]): Promise<void> {
    for (let i = dbState.length - 1; i >= 0; i--) {
      const sqlQuery = `DELETE FROM users WHERE ${dbState[i]}`;
      try {
        await this.userRepository.query(sqlQuery);
      } catch (error) {
        // Handle error if needed
      }
    }
  }
}
