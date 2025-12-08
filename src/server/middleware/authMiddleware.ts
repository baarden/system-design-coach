import type { Request, Response, NextFunction, RequestHandler } from 'express';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  isAuthenticated: boolean;
}

/**
 * Middleware to extract userId from request.
 * In noop mode, looks for x-user-id header.
 * Real auth implementations should replace this.
 */
export const authMiddleware: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authReq = req as AuthenticatedRequest;
  const userId = req.headers['x-user-id'] as string | undefined;

  authReq.userId = userId || undefined;
  authReq.isAuthenticated = !!userId;

  next();
};

/**
 * Middleware that requires authentication.
 * Returns 401 if not authenticated.
 */
export const requireAuth: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.isAuthenticated || !authReq.userId) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
    return;
  }
  next();
};
