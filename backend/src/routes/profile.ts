import { Router, Response } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { getProfileByCognitoSub, createOrUpdateProfile } from '../services/profileService';

const router = Router();

// GET /profile - Get user profile
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.sub) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const profile = await getProfileByCognitoSub(req.user.sub);

    if (!profile) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }

    res.json(profile);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /profile - Update user profile
router.put('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.sub) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { first_name, last_name } = req.body;

    const profile = await createOrUpdateProfile(
      req.user.sub,
      first_name,
      last_name
    );

    res.json(profile);
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

