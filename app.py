"""
Dark Web Leak Monitor — Flask Backend
Checks a dataset of leaked credentials for a given email domain.
"""

import os
import pandas as pd
from flask import Flask, render_template, request, jsonify

# ── App setup ──────────────────────────────────────────────────────────────────
app = Flask(__name__)

# Path to the leaked-credentials dataset
LEAKS_CSV = os.path.join(os.path.dirname(__file__), "leaks.csv")


# ── Helper functions ───────────────────────────────────────────────────────────

def load_leaks() -> pd.DataFrame:
    """Load leaks.csv into a DataFrame. Returns an empty DataFrame on failure."""
    try:
        df = pd.read_csv(LEAKS_CSV, dtype=str)
        # Normalise column names: strip whitespace, lower-case
        df.columns = df.columns.str.strip().str.lower()
        return df
    except FileNotFoundError:
        app.logger.error("leaks.csv not found at %s", LEAKS_CSV)
        return pd.DataFrame(columns=["email", "password"])
    except Exception as exc:  # noqa: BLE001
        app.logger.error("Error reading leaks.csv: %s", exc)
        return pd.DataFrame(columns=["email", "password"])


def search_domain(domain: str) -> list[dict]:
    """
    Filter the leaks dataset for rows whose email contains *domain*.
    The comparison is case-insensitive.
    Returns a list of {'email': ..., 'password': ...} dicts.
    """
    df = load_leaks()
    if df.empty or "email" not in df.columns:
        return []

    # Case-insensitive substring match on the email column
    mask = df["email"].str.lower().str.contains(domain.lower(), na=False, regex=False)
    hits = df[mask][["email", "password"]].copy()

    # Replace NaN passwords with a placeholder
    hits["password"] = hits["password"].fillna("(unknown)")

    return hits.to_dict(orient="records")


def validate_domain(domain: str) -> tuple[bool, str]:
    """
    Validate that *domain* is non-empty and starts with '@'.
    Returns (is_valid: bool, error_message: str).
    """
    if not domain or not domain.strip():
        return False, "Domain cannot be empty."
    if not domain.strip().startswith("@"):
        return False, "Domain must start with '@' (e.g. @company.com)."
    if len(domain.strip()) < 4:
        return False, "Domain is too short."
    return True, ""


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.route("/", methods=["GET"])
def index():
    """Render the main search page."""
    return render_template("index.html")


@app.route("/search", methods=["POST"])
def search():
    """
    Accept a JSON POST with { "domain": "@company.com" },
    query the dataset, and return results as JSON.
    """
    data = request.get_json(silent=True) or {}
    domain = data.get("domain", "").strip()

    # Validate input
    valid, error = validate_domain(domain)
    if not valid:
        return jsonify({"success": False, "error": error}), 400

    # Run the search
    results = search_domain(domain)

    return jsonify({
        "success": True,
        "domain": domain,
        "count": len(results),
        "results": results,
    })


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)
