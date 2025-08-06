import { Controller, Post, Body, Ctx } from '../../framework/decorators';
import { LoginDto } from '../dtos/auth.dto';
import { AuthService } from '../../framework/auth/auth.service';
import { container } from '../../framework/di/container';
import jwt from 'jsonwebtoken';
import { env } from '../../framework/config/env';
import { FastifyReply } from 'fastify';
import { redisClient } from '../../framework/cache/redis';

@Controller('/auth')
export class AuthController {
  private authService: AuthService;

  constructor() {
    this.authService = container.resolve('AuthService');
  }

  @Post('/login', {
    schema: {
      summary: 'User login',
      tags: ['Auth'],
      body: { $ref: '#/definitions/LoginDto' },
      response: {
        200: { type: 'object', properties: { message: { type: 'string' } } },
        401: { type: 'object', properties: { message: { type: 'string' } } },
      },
    },
  })
  async login(@Body() loginDto: LoginDto, @Ctx() reply: FastifyReply) {
    const user = await this.authService.validateUser(loginDto.username, loginDto.password);

    if (!user) {
      throw { statusCode: 401, message: 'Invalid credentials' };
    }

    const token = jwt.sign({ id: user.id, username: user.username }, env.JWT_SECRET!, { expiresIn: '1h' });

    reply.setCookie('token', token, {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'strict',
    });

    return { message: 'Login successful' };
  }

  @Post('/logout', {
    schema: {
      summary: 'User logout',
      tags: ['Auth'],
      response: {
        200: { type: 'object', properties: { message: { type: 'string' } } },
      },
    },
  })
  async logout(@Ctx() reply: FastifyReply) {
    const token = reply.request.cookies.token;

    if (token && redisClient) {
      try {
        const decoded = jwt.verify(token, env.JWT_SECRET!) as { exp: number };
        const expiry = decoded.exp;
        const now = Math.floor(Date.now() / 1000);
        const ttl = expiry - now;

        if (ttl > 0) {
          await redisClient.set(`blocklist:${token}`, 'blocked', 'EX', ttl);
        }
      } catch (error) {
        console.error('Error adding token to blocklist:', error);
      }
    }

    reply.clearCookie('token', { path: '/' });
    return { message: 'Logout successful' };
  }
}
