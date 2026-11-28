"""Run the packaged backend with an isolated, temporary H2 demo database.

Only OPENAI_API_KEY is read from backend/.env (or the calling environment).
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
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    config = root / "backend" / ".env"
    if not key and config.exists():
        for line in config.read_text().splitlines():
            if line.startswith("OPENAI_API_KEY="):
                key = line.split("=", 1)[1].strip()
                break
    environment = {name: os.environ[name] for name in ("PATH", "HOME", "JAVA_HOME", "TMPDIR") if name in os.environ}
    if key:
        environment["OPENAI_API_KEY"] = key
    print(f"Starting isolated H2 demo backend on port {args.port}; all demo data clears on restart.", flush=True)
    print("OpenAI key configured." if key else "No OpenAI key configured: live voice will be unavailable.", flush=True)
    command = [java, "-jar", str(jars[0]),
               "--spring.config.import=classpath:health.properties",
               "--spring.profiles.active=local-demo", f"--server.port={args.port}",
               "--spring.datasource.url=jdbc:h2:mem:voice_demo;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH",
               "--spring.datasource.username=sa", "--spring.datasource.password=",
               "--app.nea.hawker-centre-sync.enabled=false", "--app.weather.enabled=false",
               "--app.setup-checks.on-startup=false", "--app.ml.base-url=http://localhost:8000",
               "--app.base-url=http://localhost:5500"]
    os.execve(java, command, environment)


if __name__ == "__main__":
    main()
