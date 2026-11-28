# Chicky — Huat tomorrow

Chicky helps hawker stall owners record sales, forecast demand and turn tomorrow's
portions into an ingredient prep list. Uncle, the assistant, accepts text or voice
and shows proposed changes for the owner to review and confirm.

- Main deployment: [chicky-app.duckdns.org](https://chicky-app.duckdns.org)
- Backup deployment: [chicky-zeta.vercel.app](https://chicky-zeta.vercel.app)
- Demo and release checks: [hackathon checklist](docs/hackathon-readiness.md)
- Live voice closing-shift demo: [setup and recording guide](docs/realtime-demo.md)

Deployment addresses are configured in this repository; check their health before
a presentation. Publishing container images does not by itself verify an EC2 deployment.

## Run locally

Requires Java 21+, Node.js and Python 3. The frontend has no build step; the
backend includes a Maven wrapper.

1. Start the backend from `backend/`:

   ```sh
   cd backend
   ./mvnw spring-boot:run
   ```

   Without a `backend/.env`, this uses an in-memory H2 database, which is cleared
   on restart. An existing `.env` may select Supabase: check it before seeding
   data. See [backend setup](backend/README.md) and the optional settings in
   [backend/.env.example](backend/.env.example).

2. In a second terminal, from the repository root:

   ```sh
   node frontend/server.mjs
   ```

3. For a local demo, add `ASSISTANT_PROVIDER=offline` to `backend/.env` and restart
   the backend. This supports typed examples without an API key; voice input and
   generated speech require the OpenAI integration. Google sign-in is optional.

4. With the backend running against the intended local database, populate an
   example account:

   ```sh
   python3 scripts/seed_demo_data.py
   ```

   Sign in at [localhost:5500](http://localhost:5500) with
   `demo@chicky.test` / `chicky-demo-password`. These are public demo credentials;
   use them only for local development. The script creates five dishes, recipes,
   prices and 120 days of invented sales, and can be rerun to fill missing data.

The ML service is optional for this quick start: forecasts fall back to the
historical baseline when it is unavailable. To demonstrate Chronos-2 forecasts,
use a deployed Chicky app with ML configured, or run the ML service locally using
[ML setup](ml/README.md) and [deployment instructions](deploy/README.md). The
deployed ML service is private; a local backend cannot call it through the public
website.

## Architecture

![Chicky backend: web and Telegram connect to Spring Boot, Supabase, OpenAI and Chronos-2 to turn sales into a prep list.](docs/diagrams/chicky-backend.png)

[Editable Excalidraw](docs/diagrams/chicky-backend.excalidraw) ·
[SVG for slides and video](docs/diagrams/chicky-backend.svg) ·
[HTML preview](docs/diagrams/chicky-backend.html)

The Spring Boot backend stores sales and recipes, calls Uncle for text and voice
assistance, and turns demand forecasts into portions and ingredients to buy.
Assistant changes require the owner's confirmation. Chronos-2 uses sales history
and public holidays; the backend falls back to a historical baseline when there
is too little history or the ML service is unavailable. The diagram shows
Supabase Postgres; local development defaults to in-memory H2.

- [Frontend](frontend/README.md): responsive pages, confirm cards and guided tours.
- [Backend](backend/README.md): authentication, sales, imports, documents, forecasts
  and assistant tools. Writes proposed by the assistant require confirmation.
- [ML](ml/README.md): forecasting API, benchmarks and prep-policy simulations.
- [Database](database/README.md): Supabase configuration and migration guidance.
- [Assistant evaluation](assistant-eval/README.md): repeatable text, document and
  recorded-audio evaluations; [report](assistant-eval/REPORT.md) lists limitations.
- [Deployment](deploy/README.md): hosting, container releases and setup checks.

## Verification

```sh
# Backend tests, including API and authorization checks; isolated test database
cd backend
./mvnw verify
```

ML checks and their pinned Python environment are described in
[ml/README.md](ml/README.md); browser checks are in
[frontend/README.md](frontend/README.md). GitHub Actions runs the repository's
automated checks. Real microphone permissions, email delivery, Telegram and
home-screen behavior also need the [manual acceptance pass](docs/hackathon-readiness.md).

The forecast uses sales history and public holidays. Weather-based dashboard
insights are separate from the forecasting model. Simulated improvements are
research results, not measured gains from real hawker stalls.
