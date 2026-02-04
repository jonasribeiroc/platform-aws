import { Router, Response } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// GET /system/secret - Return the injected SSM secret
router.get('/secret', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const secret = process.env.SYSTEM_SECRET;
    
    if (!secret) {
      res.status(500).json({ error: 'System secret not configured' });
      return;
    }

    res.json({ secret });
  } catch (error) {
    console.error('Error fetching secret:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

