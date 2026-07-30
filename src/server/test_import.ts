import { Router } from 'express';
export const testRouter = Router();
testRouter.get('/hello', (req, res) => res.json({ msg: 'hello' }));
