import type { Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export const hashPassword = (pw: string) => bcrypt.hash(pw, 12);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

export function setAuthCookie(res: Response, payload: object) {
    const token = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '7d' });
    res.cookie('auth', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
}