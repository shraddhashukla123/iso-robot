from __future__ import annotations

from fastapi import APIRouter

from iso_robot.handlers import (
    classifications,
    controls,
    documents,
    export,
    health,
    issues,
    jobs,
    risk,
    summary,
    system_hints,
)

router = APIRouter()

router.add_api_route("/health", health.health, methods=["GET"], tags=["health"])
router.add_api_route("/summary", summary.dashboard_summary, methods=["GET"], tags=["summary"])
router.add_api_route("/system/status", system_hints.system_status, methods=["GET"], tags=["system"])

router.add_api_route("/documents", documents.list_documents, methods=["GET"], tags=["documents"])
router.add_api_route(
    "/documents/scan",
    documents.scan_documents,
    methods=["POST"],
    tags=["documents"],
)
router.add_api_route(
    "/documents/{doc_id}/file",
    documents.get_document_file,
    methods=["GET"],
    tags=["documents"],
)
router.add_api_route("/documents/{doc_id}", documents.get_document, methods=["GET"], tags=["documents"])

router.add_api_route("/jobs", jobs.create_job_handler, methods=["POST"], tags=["jobs"])
router.add_api_route("/jobs", jobs.list_jobs_handler, methods=["GET"], tags=["jobs"])
router.add_api_route("/jobs/{job_id}", jobs.get_job_handler, methods=["GET"], tags=["jobs"])

router.add_api_route("/controls", controls.list_controls, methods=["GET"], tags=["controls"])
router.add_api_route("/controls/extract", controls.extract_controls, methods=["POST"], tags=["controls"])

router.add_api_route("/issues", issues.list_issues, methods=["GET"], tags=["issues"])
router.add_api_route("/issues/seed-from-poc", issues.seed_issues_from_poc, methods=["POST"], tags=["issues"])
router.add_api_route("/issues/import-csv", issues.import_issues_csv, methods=["POST"], tags=["issues"])
router.add_api_route("/issues/classify", issues.classify_issues, methods=["POST"], tags=["issues"])
router.add_api_route("/issues/from-controls", issues.issues_from_controls, methods=["POST"], tags=["issues"])
router.add_api_route("/issues/{issue_id}", issues.get_issue, methods=["GET"], tags=["issues"])
router.add_api_route(
    "/issues/{issue_id}/classification",
    issues.get_issue_classification,
    methods=["GET"],
    tags=["issues"],
)

router.add_api_route(
    "/classifications/aggregate",
    classifications.aggregate,
    methods=["GET"],
    tags=["classifications"],
)

router.add_api_route("/risk-library", risk.list_risk_library, methods=["GET"], tags=["risk-library"])
router.add_api_route("/risk-library/seed-from-poc", risk.seed_risk_library_handler, methods=["POST"], tags=["risk-library"])

router.add_api_route("/candidate-risks", risk.list_candidate_risks, methods=["GET"], tags=["risk-discovery"])
router.add_api_route("/risk-discovery/run", risk.run_risk_discovery, methods=["POST"], tags=["risk-discovery"])
router.add_api_route("/risk-scoring/run", risk.run_risk_scoring, methods=["POST"], tags=["risk-scoring"])
router.add_api_route(
    "/issues/{issue_id}/risk-assessment",
    risk.get_issue_risk_assessment,
    methods=["GET"],
    tags=["risk-scoring"],
)
router.add_api_route("/discovery-export", export.discovery_export, methods=["GET"], tags=["export"])
router.add_api_route(
    "/issues/{issue_id}/controls",
    risk.assign_issue_controls,
    methods=["POST"],
    tags=["risk-scoring"],
)