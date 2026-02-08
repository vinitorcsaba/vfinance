from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    database_url: str = f"sqlite:///{Path(__file__).resolve().parent.parent.parent / 'data' / 'vfinance.db'}"
    google_sheets_key_path: str = ""
    google_sheets_spreadsheet_id: str = ""

    # DigitalOcean Spaces (S3-compatible) — leave blank to disable cloud backup
    spaces_endpoint_url: str = ""
    spaces_region: str = ""
    spaces_bucket: str = ""
    spaces_access_key: str = ""
    spaces_secret_key: str = ""

    @property
    def db_file_path(self) -> Path:
        """Extract filesystem path from sqlite:/// URL."""
        return Path(self.database_url.replace("sqlite:///", ""))

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
