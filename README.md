# TVL Gym Helper

Live pose-based exercise tracker and helper built with React + Vite and MediaPipe.

## Features
- Live webcam pose overlay
- Rep counting with smoothing and persistence
- Multi-exercise detection (squats, biceps, pushups, etc.)
- Calibration and offline analysis helpers

## Local setup
1. Install dependencies
```bash
npm install
```
2. Run development server
```bash
npm run dev
# open http://localhost:5173 (or the port Vite reports)
```

## Build
```bash
npm run build
```

## Notes
- Do not commit large model files (`models/*.task`) — use Releases or cloud storage.
- If you plan to deploy, use Vercel or Netlify for easy CI/CD.

## License
MIT — see LICENSE file.