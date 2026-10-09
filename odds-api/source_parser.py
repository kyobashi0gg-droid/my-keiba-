"""Parsing and identity checks for an *experimental* public-HTML odds source.

The runtime connector intentionally remains disabled until source-use permission,
rate limits, and freshness are verified. This module does not make HTTP requests.
"""
import re
from datetime import date, datetime, timedelta, timezone
from urllib.parse import parse_qs, urlsplit
from bs4 import BeautifulSoup

JST = timezone(timedelta(hours=9))
VENUES = {"札幌":"01","函館":"02","福島":"03","新潟":"04",
          "東京":"05","中山":"06","中京":"07","京都":"08",
          "阪神":"09","小倉":"10"}


class OddsSourceError(ValueError):
    pass


def resolve_race_date(label, now=None):
    """Resolve site's '10/10(土)' to a year without blindly assuming a season."""
    now = now or datetime.now(JST)
    today = now.astimezone(JST).date()
    label = str(label or "").strip()
    full = re.search(r"(20\d{2})[-/\.年](\d{1,2})[-/\.月](\d{1,2})", label)
    short = re.search(r"(\d{1,2})[/\.月](\d{1,2})", label)
    if not full and not short:
        raise OddsSourceError("開催日が不明です")
    if full:
        try:
            answer = date(int(full[1]), int(full[2]), int(full[3]))
        except ValueError as exc:
            raise OddsSourceError("開催日の形式が不正です") from exc
        if not -1 <= (answer - today).days <= 7:
            raise OddsSourceError("開催日が対象期間外です")
        return answer
    mo,day = int(short[1]), int(short[2])
    candidates = []
    for year in (today.year - 1, today.year, today.year + 1):
        try:
            d = date(year, mo, day)
        except ValueError:
            continue
        if -1 <= (d - today).days <= 7:
            candidates.append(d)
    if len(candidates) != 1:
        raise OddsSourceError("開催年を一意に特定できません")
    return candidates[0]


def race_id_from_index(html, *, track, race_no, race_date):
    """Select a race ID from the date-scoped netkeiba race list; no guessing."""
    if track not in VENUES or not 1 <= race_no <= 12:
        raise OddsSourceError("開催場・Rが不正です")
    soup = BeautifulSoup(html, "html.parser")
    if "レース一覧" not in (soup.title.get_text(" ", strip=True) if soup.title else ""):
        raise OddsSourceError("開催日別レース一覧として確認できません")
    # Date-scoped pages contain the displayed month/day. Do not accept an empty list.
    text = soup.get_text(" ", strip=True)
    m_d = str(race_date.month) + "/" + str(race_date.day)
    if m_d not in text:
        raise OddsSourceError("一覧の開催日を確認できません")
    candidates=set()
    for a in soup.select("a[href]"):
        url=a.get("href","")
        values=parse_qs(urlsplit(url).query).get("race_id",[])
        for val in values:
            if (re.fullmatch(r"20\d{10}",val)
                and val[:4]==str(race_date.year)
                and val[4:6]==VENUES[track]
                and int(val[-2:])==race_no):
                candidates.add(val)
    if len(candidates)!=1:
        raise OddsSourceError("開催日・開催場・レース番号が一意に対応しません")
    return next(iter(candidates))


def parse_sportsnavi_public_html(html, *, track, race_no, race_date):
    """Parse only a complete, source-ranked table; never infer or invent ranks."""
    if track not in VENUES or not 1 <= race_no <= 12:
        raise OddsSourceError("開催場・Rが不正です")
    soup=BeautifulSoup(html,"html.parser")
    text=soup.get_text(" ",strip=True)
    date_marker=f"{race_date.year}年{race_date.month}月{race_date.day}日"
    if date_marker not in text or not re.search(rf"\d+回\s*{re.escape(track)}\s*\d+日",text):
        raise OddsSourceError("オッズ掲載ページの開催日・競馬場が一致しません")

    update=re.search(r"(?<!\d)(20\d{2})/(\d{1,2})/(\d{1,2})\s+(\d{1,2}):(\d{2})\s*更新",text)
    if not update:
        raise OddsSourceError("提供元のオッズ更新時刻が確認できません")
    try:
        updated=datetime(*(int(update[i]) for i in range(1,6)),tzinfo=JST)
    except ValueError as exc:
        raise OddsSourceError("提供元の更新時刻が不正です") from exc
    if updated.date()!=race_date:
        raise OddsSourceError("提供元の更新日が開催日と一致しません")

    candidates=[]
    for table in soup.select("table"):
        headings=" ".join(th.get_text(" ",strip=True) for th in table.select("th"))
        if not all(k in headings for k in ("人気","馬番","馬名","単勝")):
            continue
        group=[]
        for tr in table.select("tr"):
            td=tr.find_all("td",recursive=False)
            if len(td)!=6:
                continue
            parts=[cell.get_text(" ",strip=True) for cell in td]
            # Popularity, frame, horse number, horse name, win odds, place odds
            pop,_,no,name,odds,_=parts
            if not re.fullmatch(r"\d{1,2}",pop) or not re.fullmatch(r"\d{1,2}",no):
                raise OddsSourceError("人気・馬番が取得できません")
            if not re.fullmatch(r"\d{1,4}\.\d",odds):
                raise OddsSourceError("全馬の単勝オッズが取得できません")
            if not name or name in ("-", "----") or len(name)>50:
                raise OddsSourceError("馬名が取得できません")
            group.append({"number":int(no),"name":name,"odds":float(odds),"popularity":int(pop)})
        if group:
            candidates.append(group)
    if len(candidates)!=1:
        raise OddsSourceError("単勝オッズの一覧表を一意に特定できません")
    horses=candidates[0]
    n=len(horses)
    if n<5 or n>18 or sorted(h["number"] for h in horses)!=list(range(1,n+1)):
        raise OddsSourceError("全頭分の馬番を確認できません")
    if sorted(h["popularity"] for h in horses)!=list(range(1,n+1)):
        raise OddsSourceError("全頭分の実人気順位を確認できません")
    return {"track":track,"raceNo":race_no,"raceDate":race_date.isoformat(),
            "source":"sportsnavi (experimental; permission unverified)",
            "updatedAt":updated.isoformat(),
            "horses":sorted(horses,key=lambda h:h["number"])}
