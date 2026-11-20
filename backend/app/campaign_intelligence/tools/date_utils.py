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

WORD_TO_NUM: dict[str, int] = {
    "a": 1, "an": 1, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10, "twelve": 12,
    "fourteen": 14, "twenty": 20, "thirty": 30,
}

QUARTER_MAP: dict[str, int] = {
    "q1": 1,
    "q2": 4,
    "q3": 7,
    "q4": 10,
}


def _parse_numeric_or_word(val: str | None) -> int | None:
    if not val:
        return None
    s = val.strip().lower()
    if s.isdigit():
        return int(s)
    return WORD_TO_NUM.get(s)


class ParsedDateRange(NamedTuple):
    start_date: date
    end_date: date
    duration_days: int
    period_month: int
    period_year: int


def extract_date_range_from_text(
    text: str,
    default_year: int | None = None,
    reference_start_date: date | str | None = None,
) -> ParsedDateRange | None:
    """
    Attempt to extract a date range (start_date, end_date, duration_days) from free text.
    Handles various standard English date range expressions including:
    - Specific day spans ("8th nov to 11th nov", "nov 8 to 11")
    - Week and day durations with start date ("2-week sprint starting nov 10", "4 days starting nov 8")
    - Quarter-based durations ("2-week Q1 campaign", "Q1 2 weeks")
    - Relative week durations ("make 2 weeks campaign", "2-week campaign", "for 2 weeks", "next 2 weeks")
    - Relative day durations ("for 3 days", "fourteen days", "14 days")
    """
    if not text:
        return None

    year = default_year or date.today().year
    t = text.lower()

    ref_dt: date | None = None
    if reference_start_date:
        if isinstance(reference_start_date, date):
            ref_dt = reference_start_date
        elif isinstance(reference_start_date, str) and len(reference_start_date.strip()) >= 10:
            try:
                ref_dt = date.fromisoformat(reference_start_date.strip()[:10])
            except ValueError:
                ref_dt = None

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

    # Pattern 4: Week or Day duration with explicit start date: "2-week sprint starting nov 10" or "4 days starting 8 nov"
    p4 = re.search(
        r"(\d+|[a-z]+)\s*[- ]?(week|day)s?\s+(?:campaign|sprint)?\s*(?:starting|from)?\s+(?:([a-z]+)\s+)?(\d{1,2})(?:st|nd|rd|th)?(?:\s+([a-z]+))?(?:\s+(\d{4}))?",
        t,
    )
    if p4:
        cnt_str, unit_str, m_pre, d_str, m_post, y_str = p4.groups()
        m_str = m_pre or m_post
        if m_str and m_str in MONTH_MAP:
            target_year = int(y_str) if y_str else year
            num_units = _parse_numeric_or_word(cnt_str)
            if num_units:
                num_days = (num_units * 7) if "week" in unit_str else num_units
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

    # Pattern 5: Quarter-based week duration: "2-week Q1 campaign" or "Q1 2 weeks"
    q_match = re.search(
        r"\b(?:(\d+|[a-z]+)\s*[- ]?weeks?)\s*(?:in\s+)?(q[1-4])\b|\b(q[1-4])\s*(?:[a-z\s]+)?\s*(\d+|[a-z]+)\s*[- ]?weeks?\b",
        t,
    )
    if q_match:
        w_str = q_match.group(1) or q_match.group(4)
        q_str = q_match.group(2) or q_match.group(3)
        num_w = _parse_numeric_or_word(w_str)
        if num_w and 1 <= num_w <= 12 and q_str in QUARTER_MAP:
            num_days = num_w * 7
            q_month = QUARTER_MAP[q_str]
            start_dt = date(year, q_month, 1)
            end_dt = start_dt + timedelta(days=num_days - 1)
            return ParsedDateRange(
                start_date=start_dt,
                end_date=end_dt,
                duration_days=num_days,
                period_month=start_dt.month,
                period_year=start_dt.year,
            )

    # Pattern 6: Relative week duration: "make 2 weeks campaign", "2-week campaign", "for 2 weeks", "next 2 weeks"
    w_match = re.search(
        r"\b(?:for\s+(?:about\s+|like\s+)?)?(\d+|one|two|three|four|five|six|seven|eight|ten|twelve)\s*[- ]?weeks?\b|\b(?:next|upcoming)\s+(\d+|one|two|three|four|five|six|seven|eight|ten|twelve)\s*[- ]?weeks?\b",
        t,
    )
    if w_match:
        w_str = w_match.group(1) or w_match.group(2)
        num_w = _parse_numeric_or_word(w_str)
        if num_w and 1 <= num_w <= 12:
            num_days = num_w * 7
            start_dt = ref_dt or date.today()
            if default_year and default_year != start_dt.year:
                try:
                    start_dt = start_dt.replace(year=default_year)
                except ValueError:
                    pass
            end_dt = start_dt + timedelta(days=num_days - 1)
            return ParsedDateRange(
                start_date=start_dt,
                end_date=end_dt,
                duration_days=num_days,
                period_month=start_dt.month,
                period_year=start_dt.year,
            )

    # Pattern 7: Relative month duration: "1 month campaign", "for 2 months"
    m_match = re.search(
        r"\b(?:for\s+(?:about\s+|like\s+)?)?(\d+|one|two|three|four|six)\s*[- ]?months?\b|\b(?:next|upcoming)\s+(\d+|one|two|three|four|six)\s*[- ]?months?\b",
        t,
    )
    if m_match:
        m_str_val = m_match.group(1) or m_match.group(2)
        num_m = _parse_numeric_or_word(m_str_val)
        if num_m and 1 <= num_m <= 6:
            num_days = num_m * 30
            start_dt = ref_dt or date.today()
            if default_year and default_year != start_dt.year:
                try:
                    start_dt = start_dt.replace(year=default_year)
                except ValueError:
                    pass
            end_dt = start_dt + timedelta(days=num_days - 1)
            return ParsedDateRange(
                start_date=start_dt,
                end_date=end_dt,
                duration_days=num_days,
                period_month=start_dt.month,
                period_year=start_dt.year,
            )

    # Pattern 8: Relative days: "campaign for like 3 days", "for 3 days", "next 14 days", "fourteen days"
    p5 = re.search(
        r"(?:for\s+(?:about\s+|like\s+)?)?(\d+|one|two|three|four|five|six|seven|eight|ten|fourteen|twenty|thirty)\s*[- ]?days?\s*(?:campaign|sprint)?|(?:next|upcoming)\s+(\d+|one|two|three|four|five|six|seven|eight|ten|fourteen|twenty|thirty)\s*[- ]?days?",
        t,
    )
    if p5:
        match_group = p5.group(1) or p5.group(2)
        num_days = _parse_numeric_or_word(match_group)
        if num_days and 1 <= num_days <= 90:
            start_dt = ref_dt or date.today()
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


def extract_format_and_count_from_text(text: str) -> tuple[list[str] | None, int | None]:
    """
    Extracts explicit deliverable format preferences (e.g. ['reel']) and requested deliverable count
    from user prompt or brief text.
    Handles phrases like:
    - 'give me 3 reel ideas' -> (['reel'], 3)
    - '3 reel s' -> (['reel'], 3)
    - 'need 5 carousels' -> (['carousel'], 5)
    - 'reels and carousels' -> (['reel', 'carousel'], None)
    """
    if not text:
        return None, None

    t = text.lower()

    # 1. Check for explicit count + format (e.g. "3 reel ideas", "3 reels", "3 reel s", "5 carousels", "5 deliverables")
    count_match = re.search(
        r"\b(?:give me|generate|create|plan|need|want|show me|for)?\s*(\d{1,2})\s+(?:[a-z]+\s+)?(reel|carousel|static|video|post|deliverable)s?\b",
        t,
        re.IGNORECASE,
    )
    extracted_count: int | None = None
    if count_match:
        try:
            cnt = int(count_match.group(1))
            if 1 <= cnt <= 60:
                extracted_count = cnt
        except ValueError:
            pass

    # 2. Check for explicit format mentions
    wants_reels = bool(re.search(r"\b(reel|reels|reel\s+s|short[- ]?form video|short[- ]?form videos)\b", t))
    wants_carousels = bool(re.search(r"\b(carousel|carousels|multi[- ]?slide|slide deck)\b", t))
    wants_static = bool(re.search(r"\b(static|single[- ]?image|photo post|infographic)\b", t))

    formats: list[str] = []
    if wants_reels and not wants_carousels and not wants_static:
        formats = ["reel"]
    elif wants_carousels and not wants_reels and not wants_static:
        formats = ["carousel"]
    elif wants_static and not wants_reels and not wants_carousels:
        formats = ["static"]
    else:
        if wants_reels:
            formats.append("reel")
        if wants_carousels:
            formats.append("carousel")
        if wants_static:
            formats.append("static")

    return (formats if formats else None, extracted_count)


def extract_reel_duration_from_text(text: str) -> tuple[int, int] | None:
    """
    Extracts requested reel / video duration from user prompt text.
    Handles:
    - '30 to 45 sec', '30 to 45 seconds', '30-45s', '30-45 sec' -> (30, 45)
    - '45 to 60 sec', '45 to 60 seconds', '45-60s' -> (45, 60)
    - '60 seconds', '60 sec', '60s' -> (60, 60)
    - '1 minute', '2 min' -> (60, 60), (120, 120)
    Returns (min_seconds, max_seconds) or None.
    """
    if not text:
        return None

    t = text.lower()

    # 1. Range in seconds: "30 to 45 sec", "30-45s", "45 to 60 seconds", "30 - 45 secs"
    range_match = re.search(
        r"\b(\d+)\s*(?:to|-|–)\s*(\d+)\s*(?:seconds?|secs?|s)\b",
        t,
        re.IGNORECASE,
    )
    if range_match:
        try:
            s_min = int(range_match.group(1))
            s_max = int(range_match.group(2))
            if 5 <= s_min <= s_max <= 180:
                return (s_min, s_max)
        except ValueError:
            pass

    # 2. Single duration in minutes: "1 minute", "2 mins", "1.5 min"
    min_match = re.search(r"\b(\d+(?:\.\d+)?)\s*(?:minutes?|mins?)\b", t, re.IGNORECASE)
    if min_match:
        try:
            val = float(min_match.group(1))
            total_sec = max(5, min(180, int(val * 60)))
            return (total_sec, total_sec)
        except ValueError:
            pass

    # 3. Single duration in seconds: "60 seconds", "45 sec", "30s"
    sec_match = re.search(r"\b(\d+)\s*(?:seconds?|secs?|s)\b", t, re.IGNORECASE)
    if sec_match:
        try:
            s_val = int(sec_match.group(1))
            if 5 <= s_val <= 180:
                return (s_val, s_val)
        except ValueError:
            pass

    return None


