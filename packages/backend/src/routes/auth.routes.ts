import { Router, Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '../services/config.service';

const router = Router();

interface LoginDto {
  username: string;
  password: string;
}

// Admin login
router.post('/login', async (req: Request<{}, {}, LoginDto>, res: Response): Promise<void> => {
  try {
    const configService = ConfigService.getInstance();
    const { username, password } = req.body;
    
    if (!username || !password) {
      res.status(400).json({
        success: false,
        error: 'Username and password are required',
      });
      return;
    }
    
    const adminUsername = configService.get('ADMIN_USERNAME');
    const adminPassword = configService.get('ADMIN_PASSWORD');
    
    // Validate username
    if (username !== adminUsername) {
      res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
      return;
    }
    
    // Validate password
    const isValidPassword = await comparePassword(password, adminPassword);
    
    if (!isValidPassword) {
      res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
      return;
    }
    
    // Generate JWT token
    const jwtSecret = configService.get('JWT_SECRET');
    const expiresIn = 3600; // 1 hour
    
    const token = jwt.sign(
      {
        username: adminUsername,
        role: 'admin',
        iat: Math.floor(Date.now() / 1000),
      },
      jwtSecret,
      {
        expiresIn,
      }
    );
    
    res.json({
      success: true,
      token,
      expiresIn,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed',
    });
  }
});

// Verify token
router.post('/verify', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body;
    
    if (!token) {
      res.status(400).json({
        success: false,
        error: 'Token is required',
      });
      return;
    }
    
    const configService = ConfigService.getInstance();
    const jwtSecret = configService.get('JWT_SECRET');
    const decoded = jwt.verify(token, jwtSecret) as any;
    
    res.json({
      success: true,
      valid: true,
      username: decoded.username,
      role: decoded.role,
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      valid: false,
      error: 'Invalid or expired token',
    });
    return;
  }
});

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

export default router;