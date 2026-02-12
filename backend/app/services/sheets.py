import logging

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from app.config import settings
from app.models.snapshot import Snapshot
from app.models.user import User

logger = logging.getLogger(__name__)

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
]


def _get_credentials(user: User) -> Credentials:
    """Build Google credentials from user's stored tokens, auto-refreshing if needed."""
    creds = Credentials(
        token=user.google_access_token,
        refresh_token=user.google_refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        scopes=SCOPES,
    )
    if creds.expired and creds.refresh_token:
        from google.auth.transport.requests import Request
        creds.refresh(Request())
        user.google_access_token = creds.token
    return creds


def _get_or_create_spreadsheet(user: User, creds: Credentials) -> str:
    """Return the user's spreadsheet ID, creating one if it doesn't exist."""
    sheets_svc = build("sheets", "v4", credentials=creds, cache_discovery=False)

    if user.sheets_spreadsheet_id:
        try:
            sheets_svc.spreadsheets().get(spreadsheetId=user.sheets_spreadsheet_id).execute()
            return user.sheets_spreadsheet_id
        except Exception:
            logger.warning("Stored spreadsheet %s not accessible, creating new one", user.sheets_spreadsheet_id)

    result = sheets_svc.spreadsheets().create(
        body={"properties": {"title": "VFinance Snapshots"}},
    ).execute()
    spreadsheet_id = result["spreadsheetId"]
    user.sheets_spreadsheet_id = spreadsheet_id
    return spreadsheet_id


def export_snapshot_to_sheets(snapshot: Snapshot, user: User) -> str:
    """Export a snapshot to the user's Google Sheets. Returns the worksheet URL."""
    creds = _get_credentials(user)
    spreadsheet_id = _get_or_create_spreadsheet(user, creds)

    sheets_svc = build("sheets", "v4", credentials=creds, cache_discovery=False)

    title = f"Snapshot {snapshot.id} — {snapshot.taken_at:%Y-%m-%d %H:%M}"

    # Fetch current FX rates for EUR conversion
    from app.services.portfolio import _fetch_fx_rates
    fx_rates = _fetch_fx_rates()
    eur_rate = fx_rates.get("EUR", 5.0)

    # Add a new worksheet
    add_resp = sheets_svc.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body={
            "requests": [{
                "addSheet": {
                    "properties": {
                        "title": title,
                        "gridProperties": {
                            "rowCount": len(snapshot.items) + 2,
                            "columnCount": 8,
                        },
                    }
                }
            }]
        },
    ).execute()
    sheet_id = add_resp["replies"][0]["addSheet"]["properties"]["sheetId"]

    # Build data rows
    header = ["Ticker", "Name", "Labels", "Shares", "Price", "Value", "Currency", "Value (EUR)"]
    rows = [header]
    for item in snapshot.items:
        # Convert value_ron to EUR
        value_eur = round(item.value_ron / eur_rate, 2)

        rows.append([
            item.ticker if item.ticker else "",
            item.name,
            item.labels if item.labels else "",
            item.shares if item.shares is not None else "",
            item.price if item.price is not None else "",
            item.value,
            item.currency,
            value_eur,
        ])

    # Total row
    total_eur = round(snapshot.total_value_ron / eur_rate, 2)
    rows.append(["", "", "", "", "", "", "Total (EUR)", total_eur])

    # Write data
    sheets_svc.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id,
        range=f"'{title}'!A1",
        valueInputOption="RAW",
        body={"values": rows},
    ).execute()

    return f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/edit#gid={sheet_id}"
