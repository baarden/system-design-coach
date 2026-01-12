import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { useAuth } from "./providers/auth";
import { useTheme } from "./providers/theme";
import {
  Box,
  Typography,
  Container,
  Grid,
  Card,
  CardActionArea,
  CardContent,
} from "@mui/material";
import { AppBar } from "./components/AppBar";
import { CustomProblemDialog } from "./components/CustomProblemDialog";
import { fetchProblems, createCustomRoom } from "./api";
import type { Problem } from "@shared/types/api";
import iconPng from "./assets/icon.png";
import screenshotLightPng from "./assets/screenshot_light.png";
import screenshotDarkPng from "./assets/screenshot_dark.png";

function groupByCategory(problems: Problem[]): Map<string, Problem[]> {
  const groups = new Map<string, Problem[]>();
  for (const problem of problems) {
    const category = problem.category || "Uncategorized";
    if (!groups.has(category)) {
      groups.set(category, []);
    }
    groups.get(category)!.push(problem);
  }
  return groups;
}

function LandingPage() {
  const navigate = useNavigate();
  const { isSignedIn, userId, signIn, checkAvailability } = useAuth();
  const { mode } = useTheme();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const screenshotPng = mode === "dark" ? screenshotDarkPng : screenshotLightPng;

  // Fetch problems from server on mount
  useEffect(() => {
    fetchProblems()
      .then((data) => {
        if (data.success && data.problems) {
          setProblems(data.problems);
        }
      })
      .catch((error) => {
        console.error("Error fetching problems:", error);
      });
  }, []);

  const handleProblemClick = async (problemId: string) => {
    if (!isSignedIn) {
      signIn();
      return;
    }

    const available = await checkAvailability();
    if (!available) {
      return;
    }

    navigate(`/${userId}/${problemId}`);
  };

  const handleCustomExerciseClick = async () => {
    if (!isSignedIn) {
      signIn();
      return;
    }

    const available = await checkAvailability();
    if (!available) {
      return;
    }

    setCustomDialogOpen(true);
  };

  const handleCustomProblemSubmit = async (statement: string) => {
    try {
      const result = await createCustomRoom(userId!, statement);
      if (result.success) {
        setCustomDialogOpen(false);
        navigate(`/${userId}/custom-exercise`);
      } else {
        throw new Error(result.error || 'Failed to create custom room');
      }
    } catch (error) {
      console.error('Failed to create custom room:', error);
      throw error;
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="fixed" />

      {/* Main Content */}
      <Container maxWidth="lg" sx={{ py: 8, mt: 8 }}>
        {/* Hero Icon */}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            mb: 8,
          }}
        >
          <img
            src={iconPng}
            alt="System Design Coach"
            width={120}
            height={120}
            style={{ borderRadius: 16 }}
          />
          <Typography
            variant="h3"
            component="h1"
            sx={{ mt: 2, fontWeight: 600, textAlign: "center" }}
          >
            System Design Coach
          </Typography>
        </Box>

        {/* Description and Screenshot */}
        <Grid container spacing={4} sx={{ mb: 8, alignItems: "center" }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Box sx={{ px: { xs: 2, md: 6 }, py: { xs: 2, md: 4 } }}>
              <Typography
                variant="h5"
                component="h2"
                sx={{
                  fontWeight: 600,
                  textAlign: { xs: "center", md: "left" },
                  mb: 2,
                }}
              >
                Practice your system design skills
              </Typography>
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{
                  fontSize: "1.1rem",
                  lineHeight: 1.8,
                  textAlign: { xs: "center", md: "left" },
                }}
              >
                Design scalable architectures with an interactive canvas and
                AI-powered feedback. Get real-time guidance from Claude,
                collaborate with friends, and improve your ability to tackle
                complex technical challenges. Perfect for interview preparation
                or expanding your engineering expertise.
              </Typography>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
              }}
            >
              <Box
                component="img"
                src={screenshotPng}
                alt="System Design Coach screenshot"
                sx={{
                  maxWidth: "100%",
                  height: "auto",
                  borderRadius: 2,
                  boxShadow: mode === "dark" ? "0 8px 32px rgba(255, 255, 255, 0.15)" : 3,
                }}
              />
            </Box>
          </Grid>
        </Grid>

        {/* Design Problems by Category */}
        {Array.from(groupByCategory(problems)).map(
          ([category, categoryProblems]) => (
            <Box key={category} sx={{ mb: 6 }}>
              <Typography
                variant="h4"
                component="h2"
                gutterBottom
                sx={{ fontWeight: 600, mb: 3 }}
              >
                {category}
              </Typography>

              <Grid container spacing={3}>
                {categoryProblems.map((problem) => (
                  <Grid key={problem.id} size={{ xs: 12, md: 4 }}>
                    <Card
                      sx={{
                        height: "100%",
                        transition: "transform 0.2s, box-shadow 0.2s",
                        "&:hover": {
                          transform: "translateY(-4px)",
                          boxShadow: 4,
                        },
                      }}
                    >
                      <CardActionArea
                        onClick={() => handleProblemClick(problem.id)}
                        sx={{
                          height: "100%",
                          p: 2,
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "flex-start",
                        }}
                      >
                        <CardContent>
                          <Typography variant="h6" component="h3" gutterBottom>
                            <ReactMarkdown components={{ p: "span" }}>
                              {problem.title}
                            </ReactMarkdown>
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {problem.description}
                          </Typography>
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )
        )}

        {/* Self-directed Section */}
        <Box sx={{ mb: 6 }}>
          <Typography
            variant="h4"
            component="h2"
            gutterBottom
            sx={{ fontWeight: 600, mb: 3 }}
          >
            Self-directed
          </Typography>
          <Grid container spacing={3} justifyContent="flex-start">
            <Grid size={{ xs: 12, md: 4 }}>
              <Card
                sx={{
                  height: "100%",
                  transition: "transform 0.2s, box-shadow 0.2s",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    boxShadow: 4,
                  },
                }}
              >
                <CardActionArea
                  onClick={handleCustomExerciseClick}
                  sx={{
                    height: "100%",
                    p: 2,
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "flex-start",
                  }}
                >
                  <CardContent>
                    <Typography variant="h6" component="h3" gutterBottom>
                      Add your own exercise
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Practice with your own system design problem
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          </Grid>
        </Box>
      </Container>

      <CustomProblemDialog
        open={customDialogOpen}
        onClose={() => setCustomDialogOpen(false)}
        onSubmit={handleCustomProblemSubmit}
      />
    </Box>
  );
}

export default LandingPage;
