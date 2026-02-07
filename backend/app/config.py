from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    database_url: str = f"sqlite:///{Path(__file__).resolve().parent.parent.parent / 'data' / 'vfinance.db'}"
    google_sheets_key_path: str = ""
    google_sheets_spreadsheet_id: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
