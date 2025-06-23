import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '../services/config.service';

export interface AuthenticatedRequest extends Request {
  admin?: {
    username: string;
    role: string;
  };
}

export const adminAuthMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const configService = ConfigService.getInstance();
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        success: false,
        error: 'No authorization header provided',
      });
      return;
    }

    // Check for Bearer token
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const jwtSecret = configService.get('JWT_SECRET');
        const decoded = jwt.verify(token, jwtSecret) as any;
        
        // Check if token contains admin role
        if (decoded.role !== 'admin') {
          res.status(403).json({
            success: false,
            error: 'Insufficient permissions',
          });
          return;
        }
        
        req.admin = {
          username: decoded.username,
          role: decoded.role,
        };
        
        return next();
      } catch (error) {
        res.status(401).json({
          success: false,
          error: 'Invalid or expired token',
        });
      }
    }

    // Check for Basic auth (for initial login)
    if (authHeader.startsWith('Basic ')) {
      const base64Credentials = authHeader.substring(6);
      
      try {
        const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8');
        const [username, password] = credentials.split(':');
        
        const adminUsername = configService.get('ADMIN_USERNAME');
        const adminPassword = configService.get('ADMIN_PASSWORD');
        
        if (username !== adminUsername) {
          res.status(401).json({
            success: false,
            error: 'Invalid credentials',
          });
        }
        
        // Check password
        const isValidPassword = await comparePassword(password, adminPassword);
        
        if (!isValidPassword) {
          res.status(401).json({
            success: false,
            error: 'Invalid credentials',
          });
        }
        
        req.admin = {
          username: adminUsername,
          role: 'admin',
        };
        
        return next();
      } catch (error) {
        res.status(401).json({
          success: false,
          error: 'Invalid credentials',
        });
      }
    }

    res.status(401).json({
      success: false,
      error: 'Invalid authorization method',
    });
    return;
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication error',
    });
    return;
  }
};

async function comparePassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  // Check if the stored password is already hashed
  if (hashedPassword.startsWith('$2b$') || hashedPassword.startsWith('$2a$')) {
    return bcrypt.compare(plainPassword, hashedPassword);
  }
  
  // For initial setup, allow plain password comparison
  // This should be replaced with proper hashing in production
  return plainPassword === hashedPassword;
}