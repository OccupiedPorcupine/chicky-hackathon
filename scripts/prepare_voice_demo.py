"""Create a fresh local two-dish account for the closing-shift recording.

Run from the repository root with an isolated local backend running. Every run
creates a new account, leaving previous takes intact. Credentials are written to
the gitignored .local-data/voice-demo.json file; no existing account is reset.
"""

import argparse
import json
from pathlib import Path
import secrets
import sys
from datetime import datetime, timedelta
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse

from seed_demo_data import Api, SINGAPORE, generate_sales, seed


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--api", default="http://localhost:8080", help="isolated local backend URL")
    args = parser.parse_args()
    url = urlparse(args.api)
    if url.hostname not in {"localhost", "127.0.0.1", "::1"} or url.scheme != "http":
        parser.error("Use an isolated localhost HTTP backend for recording-data preparation.")

    now = datetime.now(SINGAPORE)
    today = now.date()
    email = f"voice-demo-{now:%Y%m%d-%H%M%S}-{secrets.token_hex(3)}@chicky.test"
    password = secrets.token_urlsafe(18)
    api = Api(args.api)
    try:
        # Signup only: never sign into and modify an existing account.
        api.request("POST", "/api/auth/signup", {"email": email, "password": password, "name": "Demo Hawker"})
        sales = generate_sales(today - timedelta(days=1), 120, 7)
        seed(api, {name: sales[name] for name in ("Roasted chicken rice", "Char siew rice")})
        dishes = api.request("GET", "/api/dishes")
        for dish in dishes:
            records = api.request("GET", f"/api/dishes/{dish['id']}/sales")
            if any(record["date"] == today.isoformat() for record in records):
                raise RuntimeError("Today's sales must be empty before the take.")
        closures = api.request("GET", "/api/closures")
        if closures.get("restDays") or closures.get("closedDates"):
            raise RuntimeError("A fresh demo account unexpectedly has closures; inspect before recording.")
    except HTTPError as error:
        sys.exit(f"Backend returned HTTP {error.code}; demo preparation stopped.")
    except URLError:
        sys.exit(f"Cannot reach local backend at {args.api}. Start it first.")

    root = Path(__file__).resolve().parents[1]
    destination = root / ".local-data" / "voice-demo.json"
    destination.parent.mkdir(parents=True, exist_ok=True)
    data = {
        "api": args.api.rstrip("/"), "email": email, "password": password,
        "createdAt": now.isoformat(), "today": today.isoformat(),
        "tomorrow": (today + timedelta(days=1)).isoformat(),
        "dishes": [{"id": dish["id"], "name": dish["name"]} for dish in dishes],
        "page": "http://localhost:5500/close-shift.html?sample=1",
        "note": "Fictional local demo data. In-memory H2 is cleared when the backend restarts.",
    }
    destination.write_text(json.dumps(data, indent=2) + "\n")
    destination.chmod(0o600)
    print(f"Ready: two dishes, 120 days, recipes and prices. Today is unrecorded ({today}).")
    print(f"Local sign-in credentials: {destination}")
    print("Sign in at http://localhost:5500, then open /close-shift.html?sample=1.")
    print("Run this script again for a new take/account; it never resets an existing take.")


if __name__ == "__main__":
    main()
