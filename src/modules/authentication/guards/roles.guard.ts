import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { AdminJwtPayload } from '../auth.types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AdminRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authentication token missing or malformed.');
    }

    const token = authHeader.split(' ')[1];
    const accessSecret = this.configService.get<string>('jwt.accessSecret') || 'default_secret';

    let payload: AdminJwtPayload;
    try {
      payload = jwt.verify(token, accessSecret) as AdminJwtPayload;
    } catch {
      throw new UnauthorizedException('Authentication token is invalid or expired.');
    }

    request.admin = payload;

    // Super Admin has universal access
    if (payload.role === AdminRole.SUPER_ADMIN) {
      return true;
    }

    const hasPermission = requiredRoles.includes(payload.role);
    if (!hasPermission) {
      throw new ForbiddenException(
        `Access denied. Role ${payload.role} does not possess permissions for this administrative resource.`,
      );
    }

    return true;
  }
}
