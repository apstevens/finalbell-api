import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import prisma from '../config/database';

/**
 * Create a client-trainer relationship
 * POST /client-trainer/assign
 * Body: { clientId: string, trainerId: string }
 */
export const assignClientToTrainer = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { clientId, trainerId } = req.body;
    const requesterId = req.user?.userId;
    const requesterRole = req.user?.role;

    if (!clientId || !trainerId) {
      res.status(400).json({ error: 'clientId and trainerId are required' });
      return;
    }

    // Only admins and the trainer themselves can create relationships
    if (requesterRole !== 'ADMIN' && requesterId !== trainerId) {
      res.status(403).json({ error: 'Unauthorized to create this relationship' });
      return;
    }

    // Verify client exists and is a CLIENT
    const client = await prisma.user.findUnique({
      where: { id: clientId },
    });

    if (!client || client.role !== 'CLIENT') {
      res.status(400).json({ error: 'Invalid client ID' });
      return;
    }

    // Verify trainer exists and is a TRAINER
    const trainer = await prisma.user.findUnique({
      where: { id: trainerId },
    });

    if (!trainer || trainer.role !== 'TRAINER') {
      res.status(400).json({ error: 'Invalid trainer ID' });
      return;
    }

    // Check if relationship already exists
    const existingRelation = await prisma.clientTrainerRelation.findUnique({
      where: {
        clientId_trainerId: {
          clientId,
          trainerId,
        },
      },
    });

    if (existingRelation) {
      // If it exists but is inactive, reactivate it
      if (!existingRelation.isActive) {
        const updated = await prisma.clientTrainerRelation.update({
          where: { id: existingRelation.id },
          data: { isActive: true, endDate: null },
        });
        res.json({
          message: 'Client-trainer relationship reactivated',
          relation: updated,
        });
        return;
      }

      res.status(409).json({ error: 'Relationship already exists' });
      return;
    }

    // Create the relationship
    const relation = await prisma.clientTrainerRelation.create({
      data: {
        clientId,
        trainerId,
        isActive: true,
      },
      include: {
        client: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        trainer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    res.status(201).json({
      message: 'Client-trainer relationship created successfully',
      relation,
    });
  } catch (error) {
    console.error('Error creating client-trainer relationship:', error);
    res.status(500).json({ error: 'Failed to create relationship' });
  }
};

/**
 * Get all users (for admin purposes or to see who can be assigned)
 * GET /client-trainer/users?role=CLIENT|TRAINER
 */
export const getAllUsers = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { role } = req.query;
    const requesterRole = req.user?.role;

    // Only admins and trainers can view user lists
    if (requesterRole !== 'ADMIN' && requesterRole !== 'TRAINER') {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    const whereClause: any = {
      isActive: true,
    };

    // Filter by role if provided
    if (role && (role === 'CLIENT' || role === 'TRAINER')) {
      whereClause.role = role;
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        avatar: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

/**
 * Get client-trainer relationships
 * GET /client-trainer/relationships
 */
export const getRelationships = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    let whereClause: any = {
      isActive: true,
    };

    // Filter based on role
    if (userRole === 'TRAINER') {
      whereClause.trainerId = userId;
    } else if (userRole === 'CLIENT') {
      whereClause.clientId = userId;
    }
    // Admins see all relationships

    const relationships = await prisma.clientTrainerRelation.findMany({
      where: whereClause,
      include: {
        client: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        trainer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(relationships);
  } catch (error) {
    console.error('Error fetching relationships:', error);
    res.status(500).json({ error: 'Failed to fetch relationships' });
  }
};
