# System Design Coach

Practice system design skills with an interactive canvas and AI-powered feedback. Design scalable architectures, get real-time guidance from Claude, and improve your ability to tackle complex technical challenges.

**Try it now at [systemdesign.moosibou.com](https://systemdesign.moosibou.com)** - no API key required.

## Features

- **Interactive Diagramming** - Draw system architecture diagrams using Excalidraw's intuitive canvas
- **AI-Powered Feedback** - Get detailed feedback on your designs from Claude
- **Real-time Collaboration** - WebSocket-based sync for multi-device support
- **Guided Practice** - Work through system design problems with progressive prompts
- **Chat Assistant** - Have a side conversation about the design problem

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Material UI, Excalidraw
- **Backend**: Node.js, Express, WebSocket
- **AI**: Anthropic Claude API
- **Storage**: Redis (optional, falls back to in-memory)

## Prerequisites

- Node.js 20+
- npm
- [Anthropic API key](https://console.anthropic.com/)
- Docker (optional, for containerized deployment)

## Getting Started

### Quick Start with Docker

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/system-design-coach.git
   cd system-design-coach
   ```

2. Set up environment variables:

   ```bash
   cp .env_example .env
   ```

   Edit `.env` and add your `CLAUDE_API_KEY`.

3. Build and run:

   ```bash
   npm run docker:build
   npm run docker:up
   ```

4. Open http://localhost:3001 in your browser.

### Local Development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Set up environment variables:

   ```bash
   cp .env_example .env
   ```

   Edit `.env` and add your `CLAUDE_API_KEY`.

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open http://localhost:5173 in your browser.

> **Note**: Local development uses in-memory storage by default. For persistent storage, set `REDIS_URL` in your `.env` file or run `npm run docker:redis` to start a local Redis container.

## Environment Variables

| Variable          | Description                                                              | Required |
| ----------------- | ------------------------------------------------------------------------ | -------- |
| `CLAUDE_API_KEY`  | Anthropic API key                                                        | Yes      |
| `CLAUDE_MODEL`    | Claude model to use (default: `claude-sonnet-4-5`)                       | No       |
| `PORT`            | Server port (default: `3001`)                                            | No       |
| `REDIS_URL`       | Redis connection URL                                                     | No       |
| `VITE_SERVER_URL` | Backend URL for client (required for local dev: `http://127.0.0.1:3001`) | No       |

## Scripts

| Command                | Description                                |
| ---------------------- | ------------------------------------------ |
| `npm run dev`          | Start development server (client + server) |
| `npm run build`        | Build for production                       |
| `npm run test`         | Run tests in watch mode                    |
| `npm run test:run`     | Run tests once                             |
| `npm run docker:build` | Build Docker image                         |
| `npm run docker:up`    | Start Docker containers                    |
| `npm run docker:down`  | Stop Docker containers                     |

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[Mozilla Public License 2.0](LICENSE)

## Acknowledgments

- [Excalidraw](https://github.com/excalidraw/excalidraw) for the open-source diagramming tool
- [mcp-excalidraw](https://github.com/yctimlin/mcp_excalidraw) for the Excalidraw wrapper reference
