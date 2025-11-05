import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  assignClientToTrainer,
  getAllUsers,
  getRelationships,
} from '../controllers/clientTrainerController';

const router = Router();

/**
 * POST /client-trainer/assign
 * Assign a client to a trainer
 * Requires authentication (ADMIN or the trainer themselves)
 */
router.post('/assign', authenticateToken, assignClientToTrainer);

/**
 * GET /client-trainer/users
 * Get all users (optionally filtered by role)
 * Requires authentication (ADMIN or TRAINER)
 */
router.get('/users', authenticateToken, getAllUsers);

/**
 * GET /client-trainer/relationships
 * Get client-trainer relationships for the authenticated user
 * Requires authentication
 */
router.get('/relationships', authenticateToken, getRelationships);

export default router;
