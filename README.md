# Neon Serpents

A polished, single-player snake arena game inspired by the grow-and-survive style of games such as Slither.io. It runs fully in the browser and does not need a server, database, framework, or API key.

## Features

- Smooth full-screen neon canvas graphics
- 12 computer-controlled opponents, including large expert bots
- Bot food-seeking, collision avoidance, wall avoidance, boosting, and player pressure
- Score, personal best, leaderboard, boost meter, minimap, and game-over statistics
- Six selectable snake skins
- Mouse, keyboard, touchscreen joystick, and mobile boost controls
- Sound effects generated in the browser
- Responsive design for computers, tablets, and phones
- Pause/restart/menu controls
- Works offline after the Google Font has been cached; system fonts are used if it is unavailable

## Controls

- **Move:** Point with the mouse or use the mobile joystick
- **Boost:** Hold the left mouse button, Space, Shift, or the mobile Boost button
- **Turn:** A/D or Left/Right arrow keys also work
- **Pause:** P or Escape

## Run locally

Open `index.html` in a browser. For the most reliable test, use a simple local server:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Publish on GitHub Pages

1. Create a new public GitHub repository.
2. Upload `index.html`, `style.css`, `game.js`, and `favicon.svg` to the repository's main branch.
3. Open the repository's **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the `main` branch and `/ (root)`, then click **Save**.
6. Wait a minute or two and open the website link shown by GitHub.

## Notes

This is an original browser game and does not use Slither.io code, images, servers, branding, or online multiplayer services. The opponents are local AI bots, so the game works without accounts or a backend.
