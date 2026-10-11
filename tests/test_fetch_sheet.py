"""
Tests for the odds sheet download (pipeline/fetch_sheet.py) with a fake download: a good sheet replaces
the copy, and a broken, shorter or older one never does.
"""

import shutil
import sys
from pathlib import Path
from types import SimpleNamespace

import openpyxl
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "pipeline"))

import fetch_sheet  # noqa: E402
from ingest import ODDS_FILE  # noqa: E402


def serve(monkeypatch, content):
    monkeypatch.setattr(fetch_sheet.requests, "get",
                        lambda url, **kw: SimpleNamespace(content=content, raise_for_status=lambda: None))


@pytest.fixture
def target(tmp_path):
    t = tmp_path / "sheet.xlsx"
    shutil.copyfile(ODDS_FILE, t)
    return t


def test_a_complete_sheet_replaces_the_copy_and_reports_impossible_prices(monkeypatch, target):
    serve(monkeypatch, ODDS_FILE.read_bytes())
    got = fetch_sheet.update(target)
    assert got["status"] == "updated" and got["games"] > 3000 and got["impossible_prices"]["total close"] > 0


def test_a_broken_or_shorter_sheet_is_never_used(monkeypatch, target, tmp_path):
    before = target.read_bytes()
    serve(monkeypatch, b"<html>not a spreadsheet</html>")
    assert fetch_sheet.update(target)["status"] == "kept the current sheet"
    wb = openpyxl.load_workbook(ODDS_FILE)
    ws = wb.worksheets[0]
    ws.delete_rows(3, 50)  # drop 50 games
    short = tmp_path / "short.xlsx"
    wb.save(short)
    serve(monkeypatch, short.read_bytes())
    got = fetch_sheet.update(target)
    assert got["status"] == "kept the current sheet" and "fewer games" in got["reason"]
    assert target.read_bytes() == before
