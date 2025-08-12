import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { redisClient } from '../cache/redis';
import { sequelize } from '../config/sequelize';
import { env } from '../config/env';

interface UserPayload {
  id: string;
  username: string;
  roles?: string[];
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: UserPayload;
    cookies: { [key: string]: string | undefined };
  }
}

export const authenticate = (secret: string, publicRoutes: string[] = []) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const requestPathname = new URL(request.url, `http://${request.headers.host}`).pathname;

    // Exception for creating the first user
    if (request.method === 'POST' && requestPathname === '/users') {
      try {
        const User = sequelize.model('User');
        const userCount = await User.count();
        if (userCount === 0) {
          console.log('[SECURITY WARNING] No users found. Allowing public access to POST /users to create the first admin.');
          return; // Allow request to proceed without a token
        }
      } catch (e) {
        // This might happen if the User model or table doesn't exist yet, which is fine.
        // The request will proceed and likely be handled by the standard auth flow.
      }
    }

    if (publicRoutes.some(route => requestPathname.startsWith(route))) {
      return; // Allow access to public routes
    }

    let token: string | undefined;

    if (request.cookies && request.cookies.token) {
      token = request.cookies.token;
    } else {
      const authHeader = request.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }

    if (!token) {
      if (request.headers.accept?.includes('text/html')) {
        return reply.redirect('/login.html');
      }
      return reply.code(401).send({ message: 'Authentication token is required.' });
    }

    try {
      if (redisClient) {
        const isBlocked = await redisClient.get(`blocklist:${token}`);
        if (isBlocked) {
          throw new Error('Token is blocklisted');
        }
      }

      const payload = jwt.verify(token, secret) as UserPayload;
      request.user = payload;
    } catch (error) {
      if (request.headers.accept?.includes('text/html')) {
        return reply.redirect('/login.html');
      }
      return reply.code(403).send({ message: 'Invalid or expired token.' });
    }
  };
};

export const authorize = (allowedRoles: string[]) => {
  return (request: FastifyRequest, reply: FastifyReply, done: Function) => {
    if (!request.user || !request.user.roles) {
      return reply.code(403).send({ message: 'Access denied: No user roles found' });
    }

    const hasPermission = allowedRoles.some(role => request.user!.roles!.includes(role));

    if (!hasPermission) {
      return reply.code(403).send({ message: 'Access denied: Insufficient permissions' });
    }
    
    done();
  };
};

export const generateToken = (user: any, secret: string, expiresIn: string = '1h'): string => {
  const payload: UserPayload = {
    id: user.id,
    username: user.username,
    roles: user.roles || [],
  };

  const options: jwt.SignOptions = {
    expiresIn: expiresIn as any,
  };

  return jwt.sign(payload, secret, options);
};

export const blocklistToken = async (token: string): Promise<void> => {
  if (redisClient) {
    const decoded = jwt.decode(token) as { exp?: number };
    if (decoded && decoded.exp) {
      const expiry = decoded.exp - Math.floor(Date.now() / 1000);
      if (expiry > 0) {
        await redisClient.setex(`blocklist:${token}`, expiry, 'blocked');
      }
    }
  }
};