"""Netkeiba HTML roster and JSON win-odds parsers.

No authentication or paid/premium content. Personal testing only until allowed
use, stability, and freshness are confirmed. No HTTP I/O in this module.
"""
import re
from datetime import datetime, date, timedelta, timezone
from bs4 import BeautifulSoup

JST = timezone(timedelta(hours=9))
TRACKS = {"札幌":"01","函館":"02","福島":"03","新潟":"04","東京":"05",
          "中山":"06","中京":"07","京都":"08","阪神":"09","小倉":"10"}

class UnverifiedOdds(ValueError):
    pass

def parse_roster(html, *, race_id, race_date, track, race_no):
    soup = BeautifulSoup(html, "html.parser")
    title = soup.title.get_text(" ", strip=True) if soup.title else ""
    if (f"{race_date.year}年{race_date.month}月{race_date.day}日" not in title or
        f"{track}{race_no}R" not in title):
        raise UnverifiedOdds("出馬表の開催日・開催場・Rが一致しません")
    horses={}
    for row in soup.select("tr.HorseList"):
        cells=row.find_all("td",recursive=False)
        if len(cells)<3:
            continue
        horse_td=row.select_one("td.Horse_Info")
        if horse_td is None:
            continue
        no_text=cells[0].get_text(" ",strip=True)
        if not re.fullmatch(r"\d{1,2}",no_text):
            continue
        no=int(no_text)
        # In netkeiba mobile tables the *first* Horse_Info anchor is the
        # visible horse name. The next horse link is merely an accessibility
        # tooltip ending "のデータベース", and later anchors are jockeys.
        link=horse_td.select_one("a[href]")
        names=[link.get_text(" ",strip=True)] if link else []
        if len(names)!=1 or names[0].endswith("のデータベース"):
            continue
        name=re.sub(r"\s+","",names[0])
        if not name or len(name)>45:
            continue
        if no in horses and horses[no]!=name:
            raise UnverifiedOdds(f"{no}番の馬名が複数あります")
        horses[no]=name
    if len(horses)<5 or len(horses)>18 or sorted(horses)!=list(range(1,len(horses)+1)):
        raise UnverifiedOdds("出馬表から全頭の馬番・馬名を取得できません")
    return horses


def parse_win_odds(json_data, *, race_id, race_date, track, race_no, roster, now=None):
    if (not isinstance(json_data,dict) or
        json_data.get("status") not in ("middle","result")):
        raise UnverifiedOdds("実オッズのステータスが確認できません")
    data=json_data.get("data")
    if not isinstance(data,dict):
        raise UnverifiedOdds("オッズ本体がありません")
    expected={"yy":str(race_date.year)[-2:],"jyo":TRACKS[track],
              "kai":race_id[6:8],"nichi":race_id[8:10],"rno":f"{race_no:02d}"}
    for key, val in expected.items():
        raw=data.get(key)
        if not str(raw).isdigit() or int(raw)!=int(val):
            raise UnverifiedOdds("オッズの開催場・開催回・日・Rが一致しません")
    raw_time=data.get("update_datetime") or data.get("official_datetime")
    if not raw_time:
        raise UnverifiedOdds("提供元の更新時刻がありません")
    try:
        update_dt=datetime.strptime(raw_time,"%Y-%m-%d %H:%M:%S").replace(tzinfo=JST)
    except (ValueError,TypeError) as exc:
        raise UnverifiedOdds("更新時刻が不正です") from exc
    now=now or datetime.now(JST)
    if update_dt.date() not in (race_date,race_date-timedelta(days=1)):
        raise UnverifiedOdds("更新日が開催日と大きく異なります")
    if update_dt>now+timedelta(minutes=5):
        raise UnverifiedOdds("オッズ更新時刻が未来です")
    # Do not reflect stale market quotes as "latest" odds. Overnight odds
    # are allowed only before 09:00 JST on race day; otherwise <= 30 min.
    if now.astimezone(JST).date()==race_date:
        current=now.astimezone(JST)
        maximum_age=timedelta(hours=16) if current.hour<9 else timedelta(minutes=30)
        if current-update_dt > maximum_age:
            raise UnverifiedOdds("取得元のオッズ更新時刻が古すぎます")
    wins=data.get("odds",{}).get("1") if isinstance(data.get("odds"),dict) else None
    if not isinstance(wins,dict) or len(wins)!=len(roster):
        raise UnverifiedOdds("出馬表と単勝オッズの全頭数が一致しません")
    result=[]
    for raw_no, vals in wins.items():
        if not str(raw_no).isdigit() or not isinstance(vals,(list,tuple)) or len(vals)<3:
            raise UnverifiedOdds("オッズの馬番・形式が不正です")
        no=int(raw_no)
        if no not in roster:
            raise UnverifiedOdds("オッズに出馬表と異なる馬番があります")
        raw_odds=str(vals[0]).strip()
        raw_rank=str(vals[2]).strip()
        if not re.fullmatch(r"\d{1,4}\.\d",raw_odds) or not raw_rank.isdigit():
            raise UnverifiedOdds("実単勝オッズ・人気順位が不正です")
        odds=float(raw_odds)
        popularity=int(raw_rank)
        if odds<1.0 or not 1<=popularity<=len(roster):
            raise UnverifiedOdds("実単勝オッズ・人気順位が範囲外です")
        result.append({"number":no,"name":roster[no],"odds":odds,"popularity":popularity})
    if (sorted(h["number"] for h in result)!=list(range(1,len(roster)+1)) or
        sorted(h["popularity"] for h in result)!=list(range(1,len(roster)+1))):
        raise UnverifiedOdds("馬番または人気順位に重複・欠落があります")
    return {"track":track,"raceNo":race_no,"raceDate":race_date.isoformat(),
            "updatedAt":update_dt.isoformat(),
            "source":"netkeiba.com","horses":sorted(result,key=lambda h:h["number"])}
