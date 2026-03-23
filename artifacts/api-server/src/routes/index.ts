import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import invitationsRouter from "./invitations";
import usersRouter from "./users";
import exercisesRouter from "./exercises";
import plansRouter from "./plans";
import sessionsRouter from "./sessions";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(invitationsRouter);
router.use(usersRouter);
router.use(exercisesRouter);
router.use(plansRouter);
router.use(sessionsRouter);

export default router;
