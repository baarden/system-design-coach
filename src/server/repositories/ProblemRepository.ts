import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import type { Problem } from "../types/conversation.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ProblemsData {
  problems: Problem[];
}

export interface ProblemRepository {
  getProblem(problemId: string): Problem | undefined;
  getAllProblems(): Problem[];
}

function loadProblemsFromFile(): ProblemsData {
  const dataPath = join(__dirname, "../data/problems.json");
  const data = readFileSync(dataPath, "utf-8");
  return JSON.parse(data);
}

/**
 * Creates a ProblemRepository that loads problems from the default file location.
 */
export function createProblemRepository(): ProblemRepository {
  const data = loadProblemsFromFile();
  return {
    getProblem: (problemId: string) =>
      data.problems.find((p) => p.id === problemId),
    getAllProblems: () => data.problems,
  };
}

/**
 * Creates a ProblemRepository with pre-loaded problems for testing.
 */
export function createTestProblemRepository(
  problems: Problem[]
): ProblemRepository {
  return {
    getProblem: (problemId: string) => problems.find((p) => p.id === problemId),
    getAllProblems: () => problems,
  };
}
