import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '../services/config.service';
import { User, Role } from '../security/rbac-system';

// Extend Request interface to include user
declare module 'express' {
  interface Request {
    user?: User;
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'No valid authorization header provided'
      });
      return;
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      res.status(401).json({
        success: false,
        error: 'No token provided'
      });
      return;
    }

    // Get JWT secret from config
    const configService = ConfigService.getInstance();
    const secret = configService.get('JWT_SECRET');
    
    if (!secret || secret.length < 32) {
      console.error('Invalid JWT secret configuration');
      res.status(500).json({
        success: false,
        error: 'Server configuration error'
      });
      return;
    }
    
    // Verify and decode token
    const decoded = jwt.verify(token, secret) as jwt.JwtPayload;
    
    // Validate token payload
    if (!decoded || typeof decoded !== 'object' || !decoded.id || !decoded.role) {
      res.status(401).json({
        success: false,
        error: 'Invalid token payload'
      });
      return;
    }

    // Add user info to request (mock full user object for RBAC)
    req.user = {
      id: decoded.id,
      username: decoded.username || 'unknown',
      email: decoded.email || `${decoded.username}@company.com`,
      role: decoded.role as Role,
      permissions: [], // Will be populated by RBAC system
      isActive: true,
      lastLogin: new Date().toISOString(),
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: new Date().toISOString()
    };
    
    next();
  } catch (error) {
    let errorMessage = 'Invalid token';
    
    if (error instanceof jwt.TokenExpiredError) {
      errorMessage = 'Token expired';
    } else if (error instanceof jwt.JsonWebTokenError) {
      errorMessage = 'Invalid token format';
    } else if (error instanceof jwt.NotBeforeError) {
      errorMessage = 'Token not active yet';
    }
    
    res.status(401).json({
      success: false,
      error: errorMessage
    });
  }
}

export function authorize(roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
      return;
    }

    next();
  };
}

// Development/test authentication bypass
export function authenticateOrBypass(req: Request, res: Response, next: NextFunction): void {
  const nodeEnv = process.env.NODE_ENV;
  
  // In test environment, use mock authentication
  if (nodeEnv === 'test') {
    req.user = {
      id: 'test-user-123',
      username: 'testuser',
      email: 'test@company.com',
      role: 'admin',
      permissions: [],
      isActive: true,
      lastLogin: new Date().toISOString(),
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: new Date().toISOString()
    };
    return next();
  }
  
  // In development, allow bypass with special header
  if (nodeEnv === 'development' && req.headers['x-dev-bypass'] === 'true') {
    req.user = {
      id: 'dev-user-123',
      username: 'devuser',
      email: 'dev@company.com',
      role: 'admin',
      permissions: [],
      isActive: true,
      lastLogin: new Date().toISOString(),
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: new Date().toISOString()
    };
    return next();
  }
  
  // Otherwise, use standard authentication
  authenticate(req, res, next);
}

// Utility function to generate secure JWT
export function generateToken(payload: { id: string; username: string; role: string }, expiresIn: string = '24h'): string {
  const configService = ConfigService.getInstance();
  const secret = configService.get('JWT_SECRET');
  
  if (!secret || secret.length < 32) {
    throw new Error('Invalid JWT secret configuration');
  }
  
  return jwt.sign(payload, secret as string, { 
    expiresIn,
    issuer: 'datacloak-backend',
    audience: 'datacloak-client'
  } as jwt.SignOptions);
}

// Utility function to validate JWT secret strength
export function validateJWTSecret(secret: string): boolean {
  if (!secret || typeof secret !== 'string') {
    return false;
  }
  
  // Minimum 32 characters
  if (secret.length < 32) {
    return false;
  }
  
  // Should not be the default value
  if (secret.includes('your-super-secret') || secret === 'admin123') {
    return false;
  }
  
  return true;
}