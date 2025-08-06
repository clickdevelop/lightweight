import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { redisClient } from '../cache/redis';

interface UserPayload {
  id: string;
  username: string; // Adicionado username para o payload do JWT
  roles?: string[]; // Tornar opcional se não for sempre usado
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: UserPayload;
    cookies: { [key: string]: string | undefined }; // Tipagem mais precisa para cookies
  }
}

export const authenticate = (secret: string, publicRoutes: string[] = []) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const requestPathname = new URL(request.url, `http://${request.headers.host}`).pathname;

    if (publicRoutes.includes(requestPathname)) {
      return; // Permitir acesso sem autenticação
    }

    let token: string | undefined;

    // Tentar obter o token do cookie
    if (request.cookies && request.cookies.token) {
      token = request.cookies.token;
    } else {
      // Tentar obter o token do header Authorization
      const authHeader = request.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }

    if (!token) {
      // Lidar com requisições não autenticadas
      if (request.headers.accept && request.headers.accept.includes('text/html')) {
        return reply.redirect('/login.html'); // Redirecionar para a página de login
      } else {
        return reply.code(401).send({ message: 'No token provided' });
      }
    }

    try {
      // Verificar se o token está na blocklist
      if (redisClient) {
        const isBlocked = await redisClient.get(`blocklist:${token}`);
        if (isBlocked) {
          throw new Error('Token is blocklisted');
        }
      }

      const payload = jwt.verify(token, secret) as UserPayload;
      request.user = payload;
    } catch (error) {
      // Lidar com token inválido
      if (request.headers.accept && request.headers.accept.includes('text/html')) {
        return reply.redirect('/login.html'); // Redirecionar para a página de login
      } else {
        return reply.code(403).send({ message: 'Invalid token' });
      }
    }
  };
};

export const authorize = (allowedRoles: string[]) => {
  return (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user || !request.user.roles) {
      return reply.code(403).send({ message: 'Access denied: No user roles found' });
    }

    const userRoles = request.user.roles;

    const hasPermission = allowedRoles.some(role => userRoles.includes(role));

    if (!hasPermission) {
      return reply.code(403).send({ message: 'Access denied: Insufficient permissions' });
    }
  };
};