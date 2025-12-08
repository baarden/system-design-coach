import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { useAuth } from './providers/auth';
import {
  Box,
  Typography,
  Container,
  Grid,
  Card,
  CardActionArea,
  CardContent,
} from '@mui/material';
import { AppBar } from './components/AppBar';
import { fetchProblems } from './api';
import type { Problem } from '@shared/types/api';

function groupByCategory(problems: Problem[]): Map<string, Problem[]> {
  const groups = new Map<string, Problem[]>();
  for (const problem of problems) {
    const category = problem.category || 'Uncategorized';
    if (!groups.has(category)) {
      groups.set(category, []);
    }
    groups.get(category)!.push(problem);
  }
  return groups;
}

function LandingPage() {
  const navigate = useNavigate();
  const { isSignedIn, userId, signIn } = useAuth();
  const [problems, setProblems] = useState<Problem[]>([]);

  // Fetch problems from server on mount
  useEffect(() => {
    fetchProblems()
      .then((data) => {
        if (data.success && data.problems) {
          setProblems(data.problems);
        }
      })
      .catch((error) => {
        console.error('Error fetching problems:', error);
      });
  }, []);

  const handleProblemClick = (problemId: string) => {
    if (!isSignedIn) {
      signIn();
      return;
    }

    navigate(`/${userId}/${problemId}`);
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="fixed" />

      {/* Main Content */}
      <Container maxWidth="lg" sx={{ py: 8, mt: 8 }}>

        {/* Description */}
        <Typography
          variant="body1"
          align="center"
          color="text.secondary"
          sx={{ mb: 8, maxWidth: '800px', mx: 'auto', fontSize: '1.1rem', lineHeight: 1.8 }}
        >
          Practice your system design skills with an interactive canvas and AI-powered feedback.
          Design scalable architectures, get real-time guidance from Claude, and improve your
          ability to tackle complex technical challenges. Perfect for interview preparation or
          expanding your engineering expertise.
        </Typography>

        {/* Design Problems by Category */}
        {Array.from(groupByCategory(problems)).map(([category, categoryProblems]) => (
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
                      height: '100%',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 4,
                      },
                    }}
                  >
                    <CardActionArea
                      onClick={() => handleProblemClick(problem.id)}
                      sx={{ height: '100%', p: 2, display: 'flex', alignItems: 'flex-start' }}
                    >
                      <CardContent>
                        <Typography variant="h6" component="h3" gutterBottom>
                          <ReactMarkdown components={{ p: 'span' }}>{problem.title}</ReactMarkdown>
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
        ))}
      </Container>
    </Box>
  );
}

export default LandingPage;
