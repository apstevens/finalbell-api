import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface RequestWithUser extends Request {
    user?: unknown;
}

export function requireAuth(req: RequestWithUser, res: Response, next: NextFunction) {
    const token = req.cookies?.auth;
    if (!token) return res.status(401).json({ error: 'Unauthenticated' });

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET!);
        req.user = payload;
        next();
    } catch {
        return res.status(401).json({ error: 'Invalid token' });
    }
}