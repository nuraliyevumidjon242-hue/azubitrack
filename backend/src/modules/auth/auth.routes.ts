import { Router } from 'express';
import { asyncHandler } from '../../lib/http.js';
import { requireAuth } from '../../middleware/auth.js';
import { clearRefreshCookie, REFRESH_COOKIE, setRefreshCookie } from '../../lib/tokens.js';
import { demoSchema, loginSchema, refreshSchema, registerSchema } from './auth.schemas.js';
import {
  deleteOwnAccount,
  getUser,
  loginUser,
  logoutSession,
  refreshSession,
  registerUser,
} from './auth.service.js';
import { createOrJoinDemo } from '../demo/demo.service.js';

export const authRouter = Router();

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const { user, tokens } = await registerUser(input);
    setRefreshCookie(res, tokens.refreshToken, new Date(tokens.refreshExpiresAt));
    res.status(201).json({
      user,
      accessToken: tokens.accessToken,
      expiresIn: tokens.accessExpiresIn,
    });
  }),
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const { user, tokens } = await loginUser(input);
    setRefreshCookie(res, tokens.refreshToken, new Date(tokens.refreshExpiresAt));
    res.json({ user, accessToken: tokens.accessToken, expiresIn: tokens.accessExpiresIn });
  }),
);

authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const body = refreshSchema.parse(req.body ?? {});
    const rawToken = (req.cookies?.[REFRESH_COOKIE] as string | undefined) ?? body.refreshToken;
    const { user, tokens } = await refreshSession(rawToken);
    setRefreshCookie(res, tokens.refreshToken, new Date(tokens.refreshExpiresAt));
    res.json({ user, accessToken: tokens.accessToken, expiresIn: tokens.accessExpiresIn });
  }),
);

authRouter.post(
  '/demo',
  asyncHandler(async (req, res) => {
    const input = demoSchema.parse(req.body ?? {});
    const result = await createOrJoinDemo(input.role ?? 'AZUBI', input.sessionId);
    setRefreshCookie(res, result.tokens.refreshToken, new Date(result.tokens.refreshExpiresAt));
    res.json({
      user: result.user,
      accessToken: result.tokens.accessToken,
      expiresIn: result.tokens.accessExpiresIn,
      demoSessionId: result.demoSessionId,
      demoUsers: result.demoUsers,
    });
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const rawToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    await logoutSession(rawToken);
    clearRefreshCookie(res);
    res.status(204).send();
  }),
);

authRouter.delete(
  '/account',
  requireAuth,
  asyncHandler(async (req, res) => {
    await deleteOwnAccount(req.user!.id);
    clearRefreshCookie(res);
    res.status(204).send();
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: await getUser(req.user!.id) });
  }),
);

authRouter.get(
  '/config',
  asyncHandler(async (_req, res) => {
    // Public, non-sensitive UI hints.
    res.json({
      passwordMinLength: 8,
      roles: ['AZUBI', 'AUSBILDER'],
      demoEnabled: true,
    });
  }),
);
