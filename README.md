# Northstar XAU/USD Trading

Express backend and frontend for Twelve Data XAU/USD 1-minute candles and a
uniform-size virtual trading engine.

## Local setup

1. Create a Twelve Data account and rotate the API key that was previously used
   in source code.
2. Create `.env` or set a shell variable:

   ```bash
   TWELVE_DATA_API_KEY=your_new_key npm start
   ```

   Windows PowerShell:

   ```powershell
   $env:TWELVE_DATA_API_KEY="your_new_key"
   npm start
   ```

3. Open `http://localhost:3000`.

## Tests

```bash
npm test
```

## Production deployment

The application is a Node server, not a static page. GitHub Pages alone cannot
run the Express API or trading engine.

### Render

1. Push this repository to GitHub.
2. Create a Render Web Service and connect the repository.
3. Select Node as the runtime.
4. Set Build Command to `npm ci`.
5. Set Start Command to `npm start`.
6. Set `TWELVE_DATA_API_KEY` to a rotated Twelve Data key.
7. Set `NODE_ENV=production`.
8. Deploy and verify `/api/health`.

The included `render.yaml` can create this service with one Blueprints deploy.

### Docker

```bash
docker build -t northstar-xau .
docker run --rm -p 3000:3000 \
  -e TWELVE_DATA_API_KEY=your_new_key \
  -e NODE_ENV=production \
  northstar-xau
```

### Twelve Data

The server requests:

`https://api.twelvedata.com/time_series?apikey=...&interval=1min&symbol=XAU/USD`

The key must be supplied through `TWELVE_DATA_API_KEY`; it must not be committed
to source control.

### Production notes

- Virtual orders, deals, positions, and history are stored in process memory.
- Restarting or deploying replaces that state.
- For durable accounts/history, add PostgreSQL or Redis and persist snapshots.
- The `/api/health` endpoint is intended for platform health checks.
