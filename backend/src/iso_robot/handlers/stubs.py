from __future__ import annotations

from iso_robot.schemas.api import (
    CandidateRiskListItem,
    ControlListItem,
    DiscoveryExportResponse,
    IssueListItem,
    RiskLibraryListItem,
)


async def list_controls_stub() -> list[ControlListItem]:
    return []


async def list_issues_stub() -> list[IssueListItem]:
    return []


async def list_candidate_risks_stub() -> list[CandidateRiskListItem]:
    return []


async def list_risk_library_stub() -> list[RiskLibraryListItem]:
    return []


async def discovery_export_stub() -> DiscoveryExportResponse:
    return DiscoveryExportResponse()
