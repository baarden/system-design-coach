import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Box, CircularProgress, Typography, Alert } from "@mui/material";
import DesignPage from "./DesignPage";
import { resolveToken, type RoomResponse } from "./api";

function GuestRoomPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roomData, setRoomData] = useState<{ roomId: string; problemId: string } | null>(null);

  useEffect(() => {
    if (!token) {
      setError("No share token provided");
      setLoading(false);
      return;
    }

    resolveToken(token)
      .then((data: RoomResponse) => {
        if (data.success && data.room) {
          setRoomData({
            roomId: data.room.roomId,
            problemId: data.room.problemId,
          });
        } else {
          setError(data.error || "Invalid or expired share link");
        }
      })
      .catch((err: Error) => {
        console.error("Error resolving token:", err);
        setError("Failed to load shared room");
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <Box sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
      }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !roomData) {
    return (
      <Box sx={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        gap: 2,
      }}>
        <Alert severity="error">{error || "Room not found"}</Alert>
        <Typography variant="body2">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigate("/");
            }}
            style={{ color: "inherit" }}
          >
            Return to home
          </a>
        </Typography>
      </Box>
    );
  }

  return (
    <DesignPage
      guestMode={true}
      guestToken={token}
      overrideRoomId={roomData.roomId}
    />
  );
}

export default GuestRoomPage;
