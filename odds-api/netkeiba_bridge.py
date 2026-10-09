"""Private / experimental netkeiba odds fetcher.

No paid pages, cookies or authentication; date and horse identity are verified
against two distinct HTML/JSON public responses. Do not distribute snapshots
via a public unauthenticated API without permission from the provider.
"""
import threading
import time
from datetime import datetime, timedelta
import requests

from source_parser import resolve_race_date, race_id_from_index
from netkeiba_source import JST, UnverifiedOdds, parse_roster, parse_win_odds

HEADERS={"User-Agent":"Mozilla/5.0 (compatible; MYKEIBA-PrivateTest/1.0)",
         "Accept-Language":"ja-JP,ja;q=0.9"}
_SESSION=requests.Session()
_CACHE={}
_LOCK=threading.RLock()
_LIST_TTL=60*30
_ROSTER_TTL=60*60
_ODDS_TTL=45

class UpstreamFailure(ValueError):
    pass

def _fetch(url,params):
    try:
        response=_SESSION.get(url,params=params,timeout=(5,15),headers=HEADERS)
        response.raise_for_status()
        if len(response.content)>2_000_000:
            raise UpstreamFailure("取得元の応答が大きすぎます")
        return response
    except requests.RequestException as exc:
        raise UpstreamFailure("取得元との通信に失敗しました") from exc

def _cached(key,ttl,fn):
    now=time.monotonic()
    with _LOCK:
        prior=_CACHE.get(key)
        if prior and now-prior[0]<ttl:
            return prior[1]
    value=fn()
    with _LOCK:
        _CACHE[key]=(time.monotonic(),value)
    return value

def fetch_snapshot(*,track,race_no,date_label):
    race_no=int(race_no)
    race_date=resolve_race_date(date_label)
    date_key=race_date.strftime("%Y%m%d")
    # This endpoint returns only the races for the requested date; never use
    # the mobile /?pid=race_list page, which contains multiple racing days.
    index=_cached(("index",date_key),_LIST_TTL,lambda:
        _fetch("https://race.netkeiba.com/top/race_list_sub.html",
              {"kaisai_date":date_key}).content)
    raceid=race_id_from_index(index,track=track,race_no=race_no,race_date=race_date)
    racecard=_cached(("roster",raceid),_ROSTER_TTL,lambda:
        _fetch("https://race.sp.netkeiba.com/race/shutuba.html",
              {"race_id":raceid}).content)
    roster=parse_roster(racecard,track=track,race_no=race_no,race_date=race_date,race_id=raceid)

    def get_win_json():
        obj=_fetch("https://race.netkeiba.com/api/api_get_jra_odds.html",
                   {"race_id":raceid,"type":"1","action":"update"})
        try:
            return obj.json()
        except ValueError as exc:
            raise UpstreamFailure("JSONオッズが取得できません") from exc

    odds=_cached(("win",raceid),_ODDS_TTL,get_win_json)
    result=parse_win_odds(odds,track=track,race_no=race_no,
                          race_date=race_date,race_id=raceid,roster=roster)
    return result
