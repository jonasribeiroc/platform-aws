import { Router, Response, Request } from 'express';

const router = Router();

// GET /health - Health check
router.get('/', async (req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

export default router;

