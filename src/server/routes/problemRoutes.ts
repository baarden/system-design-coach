import { Router, Request, Response } from "express";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import type { Problem } from "../types/conversation.js";

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

export function createProblemRoutes(): Router {
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
      console.error("Error fetching problems:", error);
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  });

  // Get a specific problem by ID (includes full statement)
  router.get("/:problemId", (req: Request, res: Response) => {
    try {
      const { problemId } = req.params;
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
      console.error("Error fetching problem:", error);
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      });
    }
  });

  return router;
}
