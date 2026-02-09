import gspread

from app.config import settings
from app.models.snapshot import Snapshot


def is_sheets_configured() -> bool:
    return bool(settings.google_sheets_key_path and settings.google_sheets_spreadsheet_id)


def export_snapshot_to_sheets(snapshot: Snapshot) -> str:
    """Export a snapshot to Google Sheets. Returns the worksheet URL."""
    gc = gspread.service_account(filename=settings.google_sheets_key_path)
    spreadsheet = gc.open_by_key(settings.google_sheets_spreadsheet_id)

    title = f"Snapshot {snapshot.id} — {snapshot.taken_at:%Y-%m-%d %H:%M}"
    rows = len(snapshot.items) + 2  # header + items + summary
    worksheet = spreadsheet.add_worksheet(title=title, rows=rows, cols=6)

    header = ["Type", "Name", "Shares", "Price", "Value", "Currency"]
    data = [header]
    for item in snapshot.items:
        data.append([
            item.holding_type,
            item.name,
            item.shares if item.shares is not None else "",
            item.price if item.price is not None else "",
            item.value,
            item.currency,
        ])
    data.append(["", "", "", "", snapshot.total_value_ron, "RON (total)"])

    worksheet.update(data, "A1")

    return f"https://docs.google.com/spreadsheets/d/{spreadsheet.id}/edit#gid={worksheet.id}"
