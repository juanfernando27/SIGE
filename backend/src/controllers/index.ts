import type { Request, Response } from "express";
export const ok = (res: Response, data: unknown, status = 200) =>
  res.status(status).json({ data });
export const action =
  (fn: (req: Request) => Promise<unknown>, status = 200) =>
  async (req: Request, res: Response) =>
    ok(res, await fn(req), status);
export const collection =
  (fn: (req: Request) => Promise<unknown>) =>
  async (req: Request, res: Response) =>
    res.json(await fn(req));
