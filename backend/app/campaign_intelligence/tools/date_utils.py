"""
Utilities for extracting and calculating campaign date ranges, durations, and day distributions.
"""
from __future__ import annotations

import re
from datetime import date, timedelta
from typing import NamedTuple

MONTH_MAP = {
    "jan": 1, "january": 1, "januray": 1,
    "feb": 2, "february": 2, "feburary": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "sept": 9, "september": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11, "nnov": 11, "novembr": 11,
    "dec": 12, "december": 12, "dcember": 12,
}


class ParsedDateRange(NamedTuple):
    start_date: date
    end_date: date
    duration_days: int
    period_month: int
    period_year: int


def extract_date_range_from_text(text: str, default_year: int | None = None) -> ParsedDateRange | None:
    """
    Attempt to extract a date range (start_date, end_date, duration_days) from free text.
    Handles various standard English date range expressions.
    """
    if not text:
        return None

    year = default_year or date.today().year
    t = text.lower()

    # Pattern 1: "8th nov to 11th nov" or "8 nov - 11 nov 2026"
    p1 = re.search(
        r"(?:from\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\s+(?:to|until|-|through)\s+(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)(?:\s+(\d{4}))?",
        t,
    )
    if p1:
        d1, m1_str, d2, m2_str, y_str = p1.groups()
        if m1_str in MONTH_MAP and m2_str in MONTH_MAP:
            target_year = int(y_str) if y_str else year
            try:
                start_dt = date(target_year, MONTH_MAP[m1_str], int(d1))
                end_dt = date(target_year, MONTH_MAP[m2_str], int(d2))
                if end_dt >= start_dt:
                    days = (end_dt - start_dt).days + 1
                    return ParsedDateRange(
                        start_date=start_dt,
                        end_date=end_dt,
                        duration_days=days,
                        period_month=start_dt.month,
                        period_year=start_dt.year,
                    )
            except ValueError:
                pass

    # Pattern 2: "nov 8th to 11th" or "nov 8 - nov 11" or "from november 8 to 11"
    p2 = re.search(
        r"(?:from\s+)?([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\s+(?:to|until|-|through)\s+(?:([a-z]+)\s+)?(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?",
        t,
    )
    if p2:
        m1_str, d1, m2_str, d2, y_str = p2.groups()
        if m1_str in MONTH_MAP:
            m2_val = MONTH_MAP[m2_str] if (m2_str and m2_str in MONTH_MAP) else MONTH_MAP[m1_str]
            target_year = int(y_str) if y_str else year
            try:
                start_dt = date(target_year, MONTH_MAP[m1_str], int(d1))
                end_dt = date(target_year, m2_val, int(d2))
                if end_dt >= start_dt:
                    days = (end_dt - start_dt).days + 1
                    return ParsedDateRange(
                        start_date=start_dt,
                        end_date=end_dt,
                        duration_days=days,
                        period_month=start_dt.month,
                        period_year=start_dt.year,
                    )
            except ValueError:
                pass

    # Pattern 3: "8th to 11th nov" or "8-11 november" or "from 8th until 11th nov"
    p3 = re.search(
        r"(?:from\s+)?(\d{1,2})(?:st|nd|rd|th)?\s*(?:to|until|-|through)\s*(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-z]+)(?:\s+(\d{4}))?",
        t,
    )
    if p3:
        d1, d2, m_str, y_str = p3.groups()
        if m_str in MONTH_MAP:
            target_year = int(y_str) if y_str else year
            try:
                start_dt = date(target_year, MONTH_MAP[m_str], int(d1))
                end_dt = date(target_year, MONTH_MAP[m_str], int(d2))
                if end_dt >= start_dt:
                    days = (end_dt - start_dt).days + 1
                    return ParsedDateRange(
                        start_date=start_dt,
                        end_date=end_dt,
                        duration_days=days,
                        period_month=start_dt.month,
                        period_year=start_dt.year,
                    )
            except ValueError:
                pass

    # Pattern 4: "4 days campaign starting 8 nov" or "3-day sprint starting nov 10"
    p4 = re.search(
        r"(\d+)\s*[- ]?day\s+(?:campaign|sprint)?\s*(?:starting|from)?\s+(?:([a-z]+)\s+)?(\d{1,2})(?:st|nd|rd|th)?(?:\s+([a-z]+))?(?:\s+(\d{4}))?",
        t,
    )
    if p4:
        days_str, m_pre, d_str, m_post, y_str = p4.groups()
        m_str = m_pre or m_post
        if m_str and m_str in MONTH_MAP:
            target_year = int(y_str) if y_str else year
            num_days = int(days_str)
            try:
                start_dt = date(target_year, MONTH_MAP[m_str], int(d_str))
                end_dt = start_dt + timedelta(days=max(num_days - 1, 0))
                return ParsedDateRange(
                    start_date=start_dt,
                    end_date=end_dt,
                    duration_days=num_days,
                    period_month=start_dt.month,
                    period_year=start_dt.year,
                )
            except ValueError:
                pass

    # Pattern 5: Relative duration without specific month: "campaign for like 3 days", "for 3 days", "next 3 days", "3-day campaign"
    p5 = re.search(
        r"(?:for\s+(?:about\s+|like\s+)?)?(\d+)\s*[- ]?days?\s*(?:campaign|sprint)?|(?:next|upcoming)\s+(\d+)\s*[- ]?days?",
        t,
    )
    if p5:
        match_group = p5.group(1) or p5.group(2)
        if match_group:
            num_days = int(match_group)
            if 1 <= num_days <= 60:
                start_dt = date.today()
                if default_year and default_year != start_dt.year:
                    try:
                        start_dt = start_dt.replace(year=default_year)
                    except ValueError:
                        pass
                end_dt = start_dt + timedelta(days=max(num_days - 1, 0))
                return ParsedDateRange(
                    start_date=start_dt,
                    end_date=end_dt,
                    duration_days=num_days,
                    period_month=start_dt.month,
                    period_year=start_dt.year,
                )

    return None


def sanitize_date_year(date_str: str | None, target_year: int, allow_past_year: bool = False) -> str | None:
    """
    Ensures that a YYYY-MM-DD date string conforms to target_year when the year is before target_year,
    unless allow_past_year is True. Prevents LLMs from defaulting to their knowledge-cutoff years (e.g. 2024).
    """
    if not date_str:
        return None
    try:
        parts = date_str.strip().split("-")
        if len(parts) == 3:
            y, m, d = int(parts[0]), int(parts[1]), int(parts[2])
            if not allow_past_year and y < target_year:
                y = target_year
            return f"{y:04d}-{m:02d}-{d:02d}"
    except Exception:
        pass
    return date_str

