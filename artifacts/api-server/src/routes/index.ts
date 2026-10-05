import { Router, type IRouter } from "express";
import healthRouter from "./health";
import shieldRouter from "./shield";

const router: IRouter = Router();

router.use(healthRouter);
router.use(shieldRouter);

export default router;
