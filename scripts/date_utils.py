import hashlib
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional


def parse_date_arg(value: Optional[str], now: Optional[datetime] = None) -> datetime:
    if now is None:
        now = datetime.now()

    if value is None:
        return now

    value = value.strip()
    if value.lower() == "now":
        return now

    return datetime.strptime(value, "%Y-%m-%d")


def format_date(date_value: datetime) -> str:
    return date_value.strftime("%B %d, %Y")


def get_random_date_for_path(
    path: Path, start_date: datetime, end_date: datetime, seed: str = ""
) -> datetime:
    if end_date < start_date:
        raise ValueError("end_date cannot be earlier than start_date")

    resolved_path = path.resolve()
    token = f"{seed}:{resolved_path.as_posix()}".encode("utf-8")
    digest = hashlib.sha256(token).hexdigest()
    ratio = int(digest, 16) / float((1 << 256) - 1)
    delta_seconds = (end_date - start_date).total_seconds()
    return start_date + timedelta(seconds=delta_seconds * ratio)
