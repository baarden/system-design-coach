import { Router, Request, Response } from "express";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import type { Problem } from "../types/conversation.js";
import type { AsyncStateManager } from "../managers/types.js";
import { logger } from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ProblemsData {
  problems: Problem[];
}

function loadProblems(): ProblemsData {
  const dataPath = join(__dirname, "../data/problems.json");
  const data = readFileSync(dataPath, "utf-8");
  return JSON.parse(data);
}

interface ProblemRoutesDependencies {
  stateManager: AsyncStateManager;
}

export function createProblemRoutes(deps: ProblemRoutesDependencies): Router {
  const { stateManager } = deps;
  const router = Router();
  const problemsData = loadProblems();

  // Get all problems (list view - excludes full statement)
  router.get("/", (_req: Request, res: Response) => {
    try {
      const problems = problemsData.problems.map(({ id, category, title, description }) => ({
        id,
        category,
        title,
        description,
      }));

      res.json({
        success: true,
        problems,
      });
    } catch (error) {
      logger.error("Error fetching problems", { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  });

  // Get a specific problem by ID (includes full statement)
  router.get("/:problemId", async (req: Request, res: Response) => {
    try {
      const { problemId } = req.params;

      // Handle custom exercise - fetch from conversation state
      if (problemId === 'custom-exercise') {
        // For custom exercises, we need to know which user to fetch from
        // Since we don't have user ID in this route, we can't fetch the actual statement
        // The real statement will come from WebSocket conversation_restore
        const customProblem: Problem = {
          id: 'custom-exercise',
          category: 'Self-directed',
          title: 'Custom Exercise',
          description: 'Your own system design problem',
          statement: '', // Empty statement - will be loaded via WebSocket
        };
        return res.json({
          success: true,
          problem: customProblem,
        });
      }

      const problem = problemsData.problems.find((p) => p.id === problemId);

      if (!problem) {
        return res.status(404).json({
          success: false,
          error: `Problem '${problemId}' not found`,
        });
      }

      res.json({
        success: true,
        problem,
      });
    } catch (error) {
      logger.error("Error fetching problem", { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  });

  return router;
}
