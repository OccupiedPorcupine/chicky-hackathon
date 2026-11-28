"""Run the packaged backend with an isolated, temporary H2 demo database.

Only OpenAI key and REALTIME_* settings are read from backend/.env or the environment.
Database, SMTP, Telegram and production profile settings are not imported.
Build first: cd backend && ./mvnw package
"""

import argparse
import os
from pathlib import Path
import shutil
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--port", type=int, default=8080)
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("Port must be between 1 and 65535.")
    root = Path(__file__).resolve().parents[1]
    jars = list((root / "backend" / "target").glob("*.jar"))
    if len(jars) != 1:
        sys.exit("Build the backend first: cd backend && ./mvnw package")
    java = shutil.which("java")
    if not java:
        sys.exit("Java 21+ is required.")
    allowed = {"OPENAI_API_KEY", "REALTIME_ENABLED", "REALTIME_MODEL", "REALTIME_VOICE", "REALTIME_TRANSCRIPTION_MODEL"}
    settings = {name: os.environ[name].strip() for name in allowed if os.environ.get(name, "").strip()}
    config = root / "backend" / ".env"
    if config.exists():
        for line in config.read_text().splitlines():
            name, separator, value = line.partition("=")
            if separator and name in allowed and name not in settings and value.strip():
                settings[name] = value.strip()
    environment = {name: os.environ[name] for name in ("PATH", "HOME", "JAVA_HOME", "TMPDIR") if name in os.environ}
    environment.update(settings)
    print(f"Starting isolated H2 demo backend on port {args.port}; all demo data clears on restart.", flush=True)
    print("OpenAI key configured." if settings.get("OPENAI_API_KEY") else "No OpenAI key configured: live voice will be unavailable.", flush=True)
    command = [java, "-jar", str(jars[0]),
               "--spring.config.import=classpath:health.properties",
               "--spring.profiles.active=local-demo", "--server.address=127.0.0.1", f"--server.port={args.port}",
               "--spring.datasource.url=jdbc:h2:mem:voice_demo;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH",
               "--spring.datasource.username=sa", "--spring.datasource.password=",
               "--app.nea.hawker-centre-sync.enabled=false", "--app.weather.enabled=false",
               "--app.setup-checks.on-startup=false", "--app.ml.base-url=http://localhost:8000",
               "--app.base-url=http://localhost:5500"]
    os.execve(java, command, environment)


if __name__ == "__main__":
    main()
