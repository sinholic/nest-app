import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { User } from './user.entity';

describe('UserController (e2e)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        AppModule,
        TypeOrmModule.forRoot({
          type: 'mysql',
          host: 'localhost',
          port: 3306,
          username: 'root',
          password: 'Mekise123!',
          database: 'fabrotech-app',
          synchronize: true,
          entities: [User],
          migrations: [],
        }),
        TypeOrmModule.forFeature([User]),
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    userRepository = moduleFixture.get('UserRepository');
    await app.init();
    // await userRepository.clear();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/user/addMultiple (POST)', () => {
    it('should add a single user without error', async () => {
      const requestBody = {
        type: 'my_login',
        cmd_chain: [
          {
            type: 'sql_safe',
            cmd: "INSERT INTO users (uid, username, city, friend) VALUES (1, 'tom', 'France', NULL)",
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/user/addMultiple')
        .set('Content-Type', 'application/json')
        .send(requestBody);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'ok',
        dbState: ["(1, 'tom', 'France', NULL)"],
      });
    }, 10000);

    it('should return an error and revert changes when adding conflicting users', async () => {
      const requestBody = {
        type: 'my_login',
        cmd_chain: [
          {
            type: 'sql_safe',
            cmd: "INSERT INTO users (uid, username, city, friend) VALUES (2, 'frog', 'France', NULL)",
          },
          {
            type: 'sql_safe',
            cmd: "INSERT INTO users (uid, username, city, friend) VALUES (1, 'sammy', 'France', NULL)",
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/user/addMultiple')
        .set('Content-Type', 'application/json')
        .send(requestBody);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        status: 'error',
        dbState: ["(1, 'tom', 'France', NULL)"],
      });

      const users = await userRepository.find();
      expect(users.length).toBe(1);
      expect(users[0].username).toBe('tom');
    }, 10000);

    it('should add multiple users without error', async () => {
      const requestBody = {
        type: 'my_login',
        cmd_chain: [
          {
            type: 'sql_safe',
            cmd: "INSERT INTO users (uid, username, city, friend) VALUES (2, 'frog', 'France', NULL)",
          },
          {
            type: 'sql_safe',
            cmd: "INSERT INTO users (uid, username, city, friend) VALUES (3, 'sam', 'England', 1)",
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/user/addMultiple')
        .set('Content-Type', 'application/json')
        .send(requestBody);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'ok',
        dbState: [
          "(1, 'tom', 'France', NULL)",
          "(2, 'frog', 'France', NULL)",
          "(3, 'sam', 'England', 1)",
        ],
      });

      const users = await userRepository.find();
      expect(users.length).toBe(3);
      expect(users.map((user) => user.username)).toEqual([
        'tom',
        'frog',
        'sam',
      ]);
    }, 10000);

    it('should return an error and revert changes when encountering invalid foreign key', async () => {
      const requestBody = {
        type: 'my_login',
        cmd_chain: [
          {
            type: 'sql_safe',
            cmd: "INSERT INTO users (uid, username, city, friend) VALUES (4, 'croak', 'Malaysia', NULL)",
          },
          {
            type: 'sql_safe',
            cmd: "INSERT INTO users (uid, username, city, friend) VALUES (5, 'ding', 'Finland', 100)",
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/user/addMultiple')
        .set('Content-Type', 'application/json')
        .send(requestBody);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        status: 'error',
        dbState: [
          "(1, 'tom', 'France', NULL)",
          "(2, 'frog', 'France', NULL)",
          "(3, 'sam', 'England', 1)",
        ],
      });

      const users = await userRepository.find();
      expect(users.length).toBe(3);
      expect(users.map((user) => user.username)).toEqual([
        'tom',
        'frog',
        'sam',
      ]);
    }, 10000);
  });
});
