from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class HealthResponse(BaseModel):
    status: str = "ok"


class DocumentResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    filename: str
    path: str
    sha256: str
    mime_type: Optional[str] = None
    size_bytes: int
    framework: Optional[str] = None
    status: str
    source_url: Optional[str] = None
    created_at: str


class DocumentScanRequest(BaseModel):
    folder: Optional[str] = Field(
        default=None,
        description="Optional folder to scan; defaults to settings.DOCUMENTS_DIR",
    )


class DocumentScanResponse(BaseModel):
    scanned: int
    added: int
    updated: int
    skipped: int
    errors: List[str] = Field(default_factory=list)


class JobCreateRequest(BaseModel):
    type: str
    payload: Dict[str, Any] = Field(default_factory=dict)


class JobResponse(BaseModel):
    id: str
    type: str
    status: str
    payload: Dict[str, Any]
    error: Optional[str] = None
    created_at: str
    updated_at: str


class ControlListItem(BaseModel):
    id: str
    document_id: str
    control_text: Optional[str] = None
    section_ref: Optional[str] = None
    framework: Optional[str] = None
    source_page: Optional[int] = None
    created_at: str


class IssueListItem(BaseModel):
    id: str
    risk_source_id: Optional[str] = None
    title: Optional[str] = None
    body: Optional[str] = None
    effective_date: Optional[str] = None
    region_hint: Optional[str] = None
    created_at: str
    classification: Optional[Dict[str, Any]] = None
    issue_scope: Optional[str] = Field(
        default=None,
        description="internal | external when derived from controls payload.",
    )
    sector: Optional[str] = None
    source_document_id: Optional[str] = None
    control_ids: Optional[List[str]] = None
    origin: Optional[str] = Field(default=None, description="e.g. from_controls")


class CandidateRiskListItem(BaseModel):
    id: str
    title: Optional[str] = None
    description: Optional[str] = None
    domain: Optional[str] = None
    confidence: Optional[float] = None
    created_at: str
    issue_ids: List[str] = Field(default_factory=list)
    match_status: Optional[str] = None
    library_risk_id: Optional[str] = None
    match_rationale: Optional[str] = None
    bm25_score: Optional[float] = None


class RiskLibraryListItem(BaseModel):
    id: str
    industry: Optional[str] = None
    risk_domain: Optional[str] = None
    title: str
    description: Optional[str] = None
    tags: Optional[str] = None
    source_ref: Optional[str] = None
    created_at: str


class DiscoveryExportResponse(BaseModel):
    documents_summary: Dict[str, Any] = Field(default_factory=dict)
    controls: List[ControlListItem] = Field(default_factory=list)
    issues: List[IssueListItem] = Field(default_factory=list)
    candidate_risks: List[CandidateRiskListItem] = Field(default_factory=list)
    risk_library_matches: List[Dict[str, Any]] = Field(default_factory=list)
    risk_library: List[RiskLibraryListItem] = Field(default_factory=list)


class DashboardSummaryResponse(BaseModel):
    documents: int
    controls: int
    issues: int
    candidate_risks: int
    risk_library: int
    jobs_running: int


class ExtractControlsRequest(BaseModel):
    document_ids: Optional[List[str]] = Field(
        default=None,
        description="If omitted, all PDFs in the documents table are processed.",
    )


class ClassifyIssuesRequest(BaseModel):
    issue_ids: Optional[List[str]] = Field(
        default=None,
        description="If omitted, classify issues that have no classification row yet.",
    )


class IssuesFromControlsRequest(BaseModel):
    document_id: str = Field(..., description="Document UUID whose controls drive issue synthesis.")
    replace_existing: bool = Field(
        default=True,
        description="Remove prior issues with origin=from_controls for this document before inserting.",
    )
    classify_after: bool = Field(
        default=True,
        description="Run classification for newly created issue ids in the same job.",
    )
    sector_hint: Optional[str] = Field(default=None, description="Optional sector label passed to the model.")
    region_hint: Optional[str] = Field(default=None, description="Default region_hint when the model omits it.")


class IssueClassificationResponse(BaseModel):
    issue_id: str
    classification: Dict[str, Any]
    model_version: Optional[str] = None
    created_at: Optional[str] = None


class SeedPocResponse(BaseModel):
    risk_sources: int
    issues: int
    poc_path: str


class SeedRiskLibraryResponse(BaseModel):
    entries: int
    csv_path: str


class IssuesImportResponse(BaseModel):
    created: int
    errors: List[str] = Field(default_factory=list)
