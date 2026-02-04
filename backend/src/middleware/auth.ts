import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

export interface AuthenticatedRequest extends Request {
  user?: {
    sub: string;
    email?: string;
  };
}

// Initialize JWKS client for Cognito
const client = jwksClient({
  jwksUri: `https://cognito-idp.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}/.well-known/jwks.json`,
  cache: true,
  cacheMaxAge: 86400000, // 24 hours
});

function getKey(header: jwt.JwtHeader | null, callback: jwt.SigningKeyCallback) {
  if (!header || !header.kid) {
    callback(new Error('Missing kid in token header'));
    return;
  }
  
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid authorization header' });
      return;
    }

    const token = authHeader.substring(7);
    
    // Verify JWT token
    jwt.verify(token, getKey, {
      algorithms: ['RS256'],
      issuer: `https://cognito-idp.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`,
      audience: process.env.COGNITO_CLIENT_ID,
    }, (err: jwt.VerifyErrors | null, decoded: string | jwt.JwtPayload | undefined) => {
      if (err) {
        console.error('Authentication error:', err);
        res.status(401).json({ error: 'Invalid or expired token' });
        return;
      }

      const payload = decoded as jwt.JwtPayload;
      req.user = {
        sub: payload.sub as string,
        email: payload.email as string | undefined,
      };

      next();
    });
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

