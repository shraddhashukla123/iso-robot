from __future__ import annotations

import json
import os
import re
import sqlite3
from dataclasses import dataclass, field, asdict
from typing import Callable, Optional



# 1. CONTROLLED VOCABULARIES  (the only legal values; used to validate output)


LIKELIHOOD = ["Rare", "Unlikely", "Possible", "Likely", "Almost Certain"]
CONSEQUENCE = ["Insignificant", "Minor", "Moderate", "Major", "Severe"]
VELOCITY = ["Very Slow", "Slow", "Moderate", "Fast", "Immediate"]
EFFECTIVENESS = ["Effective", "Partially Effective", "Ineffective", "Uncontrolled"]
RISK_LEVELS = ["Low", "Medium", "High", "Extreme"]
RESPONSES = ["Accept", "Mitigate", "Transfer", "Avoid"]
RISK_TYPES = [
    "Strategic", "Operational", "Financial", "Compliance", "Regulatory",
    "Reputational", "Information Security", "Cyber Security", "Legal",
    "Third Party", "Business Continuity", "Other",
]



# 2. SCORING MATRICES  (the auditable heart of the engine — tune these freely)


# Inherent risk = f(consequence, likelihood). Standard 5x5 ISO heat-map.
# Index by [consequence][likelihood] using the order of the lists above.
INHERENT_MATRIX = {
    # consequence       Rare       Unlikely   Possible   Likely     Almost Certain
    "Insignificant": ["Low",     "Low",     "Low",     "Medium",  "Medium"],
    "Minor":         ["Low",     "Low",     "Medium",  "Medium",  "High"],
    "Moderate":      ["Low",     "Medium",  "Medium",  "High",    "High"],
    "Major":         ["Medium",  "Medium",  "High",    "High",    "Extreme"],
    "Severe":        ["Medium",  "High",    "High",    "Extreme", "Extreme"],
}

# Velocity does not change the *magnitude* of a risk, but Immediate velocity
# leaves no time to react, so policy here escalates an already-High risk by one
# band. Toggle with APPLY_VELOCITY_ESCALATION below.
APPLY_VELOCITY_ESCALATION = True
VELOCITY_ESCALATES = {"Immediate"}            # which velocities trigger a bump
VELOCITY_ESCALATE_FROM = {"High"}             # only escalate risks at/above this

# Residual risk = f(inherent risk, overall control effectiveness).
# Stronger controls pull the residual down; Uncontrolled can push it up because
# the organisation has no visibility into the exposure.
RESIDUAL_MATRIX = {
    # inherent     Effective   Partially Eff.  Ineffective  Uncontrolled
    "Low":      {"Effective": "Low",    "Partially Effective": "Low",    "Ineffective": "Low",     "Uncontrolled": "Medium"},
    "Medium":   {"Effective": "Low",    "Partially Effective": "Medium", "Ineffective": "Medium",  "Uncontrolled": "High"},
    "High":     {"Effective": "Medium", "Partially Effective": "High",   "Ineffective": "High",    "Uncontrolled": "Extreme"},
    "Extreme":  {"Effective": "High",   "Partially Effective": "High",   "Ineffective": "Extreme", "Uncontrolled": "Extreme"},
}

# Numeric weights used to aggregate many per-control ratings into one overall
# rating (Step 8).
EFFECTIVENESS_SCORE = {
    "Effective": 3, "Partially Effective": 2, "Ineffective": 1, "Uncontrolled": 0,
}



# 3. DATA MODELS



class ControlAssessment:
    control: str
    effectiveness: str
    explanation: str



class RiskAssessment:
    issue_id: object
    issue: str
    primary_risk: str = ""
    risk_domain: str = ""
    risk_type: str = ""
    likelihood: str = ""
    consequence: str = ""
    velocity: str = ""
    inherent_risk: str = ""
    controls: list[ControlAssessment] = field(default_factory=list)
    overall_control_effectiveness: str = ""
    residual_risk: str = ""
    risk_response: str = ""
    error: Optional[str] = None

    def to_dict(self) -> dict:
        d = asdict(self)
        return d



# 4. DETERMINISTIC SCORING FUNCTIONS  


def compute_inherent_risk(likelihood: str, consequence: str, velocity: str) -> str:
    """Step 6. Look up the 5x5 matrix, then optionally escalate for velocity."""
    level = INHERENT_MATRIX[consequence][LIKELIHOOD.index(likelihood)]
    if (APPLY_VELOCITY_ESCALATION
            and velocity in VELOCITY_ESCALATES
            and level in VELOCITY_ESCALATE_FROM):
        idx = min(RISK_LEVELS.index(level) + 1, len(RISK_LEVELS) - 1)
        level = RISK_LEVELS[idx]
    return level


def compute_overall_effectiveness(controls: list[ControlAssessment]) -> str:
    """Step 8. Aggregate per-control ratings into one overall rating.

    Default rule = rounded mean of the numeric scores. This is intentionally
    simple and transparent; for a more conservative posture switch to a
    'weakest-link' rule (return the worst rating among controls).
    """
    if not controls:
        return "Uncontrolled"
    avg = sum(EFFECTIVENESS_SCORE[c.effectiveness] for c in controls) / len(controls)
    # Map the average score back to a band.
    if avg >= 2.5:
        return "Effective"
    if avg >= 1.5:
        return "Partially Effective"
    if avg >= 0.5:
        return "Ineffective"
    return "Uncontrolled"


def compute_residual_risk(inherent_risk: str, overall_effectiveness: str) -> str:
    """Step 9. Look up residual risk from inherent risk + control strength."""
    return RESIDUAL_MATRIX[inherent_risk][overall_effectiveness]


def recommend_response(residual_risk: str, risk_type: str) -> str:
    """Step 10. Policy rule mapping residual risk to a response strategy.

    Edit this to match your risk appetite. Current policy:
      - Low      -> Accept
      - Medium   -> Mitigate (Transfer if financially insurable)
      - High     -> Mitigate (Transfer for Financial / Third Party exposure)
      - Extreme  -> Mitigate and flag for senior review; Avoid if no treatment
                    is feasible (handled upstream by the risk owner)
    """
    insurable = risk_type in {"Financial", "Third Party", "Business Continuity"}
    if residual_risk == "Low":
        return "Accept"
    if residual_risk == "Medium":
        return "Transfer" if insurable else "Mitigate"
    if residual_risk == "High":
        return "Transfer" if insurable else "Mitigate"
    return "Mitigate"  # Extreme -> always treat; risk owner decides Avoid vs Mitigate



# 5. LLM LAYER  


def build_prompt(issue: str, controls: list[str]) -> str:
    """Construct a strict-JSON assessment prompt with controlled vocabularies."""
    controls_block = "\n".join(f"- {c}" for c in controls) if controls else "- (none provided)"
    return f"""You are a senior ISO 31000 / ISO 27001 enterprise risk assessor.
Assess the issue below. Use ONLY the allowed values for each field.

ISSUE:
{issue}

EXISTING CONTROLS:
{controls_block}

Allowed values:
- likelihood: {LIKELIHOOD}
- consequence: {CONSEQUENCE}
- velocity: {VELOCITY}
- risk_type: {RISK_TYPES}
- control effectiveness: {EFFECTIVENESS}

Return ONLY valid JSON, no markdown, no commentary, in exactly this shape:
{{
  "primary_risk": "one-sentence description of the core risk",
  "risk_domain": "short domain label",
  "risk_type": "<one allowed risk_type>",
  "likelihood": "<one allowed likelihood>",
  "consequence": "<one allowed consequence>",
  "velocity": "<one allowed velocity>",
  "controls": [
    {{"control": "<control text>", "effectiveness": "<one allowed effectiveness>", "explanation": "<short reason>"}}
  ]
}}
Assess EVERY control listed. Do NOT compute inherent, residual, or response — those are derived downstream."""


def get_client():
    """Instantiate the Azure OpenAI client from environment variables.

    Required env: AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY.
    Optional:     AZURE_OPENAI_API_VERSION (default 2024-06-01).
    """
    from openai import AzureOpenAI
    return AzureOpenAI(
        azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
        api_key=os.environ["AZURE_OPENAI_API_KEY"],
        api_version=os.environ.get("AZURE_OPENAI_API_VERSION", "2024-06-01"),
    )


def _strip_json(text: str) -> str:
    """Remove ```json fences and surrounding prose, returning the JSON body."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    # Fallback: grab the outermost {...} block.
    if not text.startswith("{"):
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            text = m.group(0)
    return text


def _validate(value: str, allowed: list[str], field_name: str) -> str:
    """Case-insensitive validation against a controlled vocabulary."""
    for a in allowed:
        if value.strip().lower() == a.lower():
            return a
    raise ValueError(f"{field_name}={value!r} not in allowed values {allowed}")


def llm_assess(client, issue: str, controls: list[str], deployment: str) -> dict:
    """Call the model and return the validated qualitative judgment dict."""
    resp = client.chat.completions.create(
        model=deployment,
        temperature=0,
        response_format={"type": "json_object"},   # forces JSON when supported
        messages=[{"role": "user", "content": build_prompt(issue, controls)}],
    )
    raw = resp.choices[0].message.content
    data = json.loads(_strip_json(raw))

    # Validate / normalise every field against the controlled vocabularies.
    data["likelihood"] = _validate(data["likelihood"], LIKELIHOOD, "likelihood")
    data["consequence"] = _validate(data["consequence"], CONSEQUENCE, "consequence")
    data["velocity"] = _validate(data["velocity"], VELOCITY, "velocity")
    data["risk_type"] = _validate(data["risk_type"], RISK_TYPES, "risk_type")
    for c in data.get("controls", []):
        c["effectiveness"] = _validate(c["effectiveness"], EFFECTIVENESS, "effectiveness")
    return data



# 6. ORCHESTRATION  (combine LLM judgment + deterministic scoring)


def assess_issue(client, issue_id, issue: str, controls: list[str], deployment: str) -> RiskAssessment:
    """Run the full 10-step assessment for a single issue."""
    result = RiskAssessment(issue_id=issue_id, issue=issue)
    try:
        j = llm_assess(client, issue, controls, deployment)

        result.primary_risk = j.get("primary_risk", "")
        result.risk_domain = j.get("risk_domain", "")
        result.risk_type = j["risk_type"]
        result.likelihood = j["likelihood"]
        result.consequence = j["consequence"]
        result.velocity = j["velocity"]
        result.controls = [
            ControlAssessment(c.get("control", ""), c["effectiveness"], c.get("explanation", ""))
            for c in j.get("controls", [])
        ]

        # Deterministic scoring (Steps 6, 8, 9, 10).
        result.inherent_risk = compute_inherent_risk(
            result.likelihood, result.consequence, result.velocity)
        result.overall_control_effectiveness = compute_overall_effectiveness(result.controls)
        result.residual_risk = compute_residual_risk(
            result.inherent_risk, result.overall_control_effectiveness)
        result.risk_response = recommend_response(result.residual_risk, result.risk_type)
    except Exception as exc:  # never let one bad row kill the whole batch
        result.error = f"{type(exc).__name__}: {exc}"
    return result



# 7. DATA ACCESS LAYER  


def split_controls(raw) -> list[str]:
    """Normalise a controls field into a list of control strings.

    Accepts a JSON list, or a string delimited by newlines / ';' / '|'.
    """
    if raw is None:
        return []
    if isinstance(raw, list):
        return [str(c).strip() for c in raw if str(c).strip()]
    text = str(raw).strip()
    if text.startswith("["):
        try:
            return [str(c).strip() for c in json.loads(text) if str(c).strip()]
        except json.JSONDecodeError:
            pass
    parts = re.split(r"[\n;|]+", text)
    return [p.strip() for p in parts if p.strip()]


def fetch_issues_from_sqlite(db_path: str = "iso_robot.db") -> list[dict]:
    """Default source: a SQLite `issues(id, issue, controls)` table.

    Returns a list of {"id", "issue", "controls"} dicts. Replace this whole
    function with your real source (API, Azure synthesis output, CSV, ...)
    keeping the same return shape, and nothing else changes.
    """
    conn = sqlite3.connect(db_path)
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, issue, controls FROM issues")
        return [
            {"id": r[0], "issue": r[1], "controls": split_controls(r[2])}
            for r in cur.fetchall()
        ]
    finally:
        conn.close()


def persist_results(results: list[RiskAssessment], db_path: str = "iso_robot.db") -> None:
    """Write assessments back to a `risk_assessments` table (created if absent)."""
    conn = sqlite3.connect(db_path)
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS risk_assessments (
                issue_id TEXT, primary_risk TEXT, risk_domain TEXT, risk_type TEXT,
                likelihood TEXT, consequence TEXT, velocity TEXT, inherent_risk TEXT,
                overall_control_effectiveness TEXT, residual_risk TEXT,
                risk_response TEXT, controls_json TEXT, error TEXT
            )""")
        for r in results:
            conn.execute(
                """INSERT INTO risk_assessments VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (str(r.issue_id), r.primary_risk, r.risk_domain, r.risk_type,
                 r.likelihood, r.consequence, r.velocity, r.inherent_risk,
                 r.overall_control_effectiveness, r.residual_risk, r.risk_response,
                 json.dumps([asdict(c) for c in r.controls]), r.error),
            )
        conn.commit()
    finally:
        conn.close()


# 8. ENTRY POINT


def run(
    fetch_issues: Callable[[], list[dict]] = fetch_issues_from_sqlite,
    deployment: str = None,
    persist: bool = True,
) -> list[RiskAssessment]:
    """Assess every issue returned by `fetch_issues` and (optionally) persist."""
    deployment = deployment or os.environ.get("AZURE_OPENAI_DEPLOYMENT", "gpt-4o")
    client = get_client()

    issues = fetch_issues()
    if not issues:
        print("No issues returned by the source. Nothing to assess.")
        return []

    results = [
        assess_issue(client, it["id"], it["issue"], it.get("controls", []), deployment)
        for it in issues
    ]

    if persist:
        persist_results(results)

    for r in results:
        if r.error:
            print(f"[{r.issue_id}] ERROR: {r.error}")
        else:
            print(f"[{r.issue_id}] inherent={r.inherent_risk} "
                  f"controls={r.overall_control_effectiveness} "
                  f"residual={r.residual_risk} -> {r.risk_response}")
    return results


if __name__ == "__main__":
    run()
