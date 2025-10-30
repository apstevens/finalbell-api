import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { hashPassword, verifyPassword, setAuthCookie } from "../../auth";
import { z } from "zod";

const prisma = new PrismaClient();
const router = Router();

const registerSchema = z.object({
    email: z.email(),
    password: z.string().min(8),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
});

router.post("/register", async(req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

    const { email, password, firstName, lastName } = parsed.data;

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return res.status(409).json({ error: "User already exists" });

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
        data: { email, passwordHash, firstName, lastName },
    });

    setAuthCookie(res, { userId: user.id });
    return res.status(201).json({ id: user.id, email: user.email });
});

const loginSchema = z.object({
    email: z.email(),
    password: z.string().min(8),
});

router.post("/login", async(req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) return res.status(401).json({ error: "Invalid credentials" });

    setAuthCookie(res, { userId: user.id });
    return res.status(200).json({ id: user.id, email: user.email });
});

router.post("/logout", (req, res) => {
    res.clearCookie("auth", { path: "/" });
    return res.status(204).send();
});

export default router;