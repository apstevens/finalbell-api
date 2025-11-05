import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import prisma from '../config/database';

/**
 * Get available users to start conversations with
 * For trainers: returns their clients
 * For clients: returns their trainer(s)
 */
export const getAvailableUsers = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    let availableUsers: any[] = [];

    if (userRole === 'TRAINER') {
      // Trainers can message their clients
      const relations = await prisma.clientTrainerRelation.findMany({
        where: {
          trainerId: userId,
          isActive: true,
        },
        include: {
          client: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              avatar: true,
            },
          },
        },
      });

      availableUsers = relations.map((relation) => ({
        id: relation.client.id,
        name: `${relation.client.firstName} ${relation.client.lastName}`,
        email: relation.client.email,
        role: relation.client.role,
        avatar: relation.client.avatar,
      }));
    } else if (userRole === 'CLIENT') {
      // Clients can message their trainer(s)
      const relations = await prisma.clientTrainerRelation.findMany({
        where: {
          clientId: userId,
          isActive: true,
        },
        include: {
          trainer: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              avatar: true,
            },
          },
        },
      });

      availableUsers = relations.map((relation) => ({
        id: relation.trainer.id,
        name: `${relation.trainer.firstName} ${relation.trainer.lastName}`,
        email: relation.trainer.email,
        role: relation.trainer.role,
        avatar: relation.trainer.avatar,
      }));
    } else if (userRole === 'ADMIN') {
      // Admins can message all users
      const users = await prisma.user.findMany({
        where: {
          id: { not: userId }, // Exclude self
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          avatar: true,
        },
      });

      availableUsers = users.map((user) => ({
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      }));
    }

    res.json(availableUsers);
  } catch (error) {
    console.error('Error fetching available users:', error);
    res.status(500).json({ error: 'Failed to fetch available users' });
  }
};
