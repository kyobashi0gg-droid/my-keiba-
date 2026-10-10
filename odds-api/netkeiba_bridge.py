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
_ODDS_TTL=180
_MIN_REQUEST_GAP=3.0
_LAST_UPSTREAM_AT=0.0
_BLOCK_UNTIL=0.0

class UpstreamFailure(ValueError):
    pass

def _fetch(url,params):
    global _LAST_UPSTREAM_AT, _BLOCK_UNTIL
    # Serialize upstream fetches across all races; never spin/retry on 429/403.
    with _LOCK:
        now=time.monotonic()
        if now < _BLOCK_UNTIL:
            raise UpstreamFailure("取得元の通信制限中です")
        wait=_MIN_REQUEST_GAP-(now-_LAST_UPSTREAM_AT)
        if wait>0:
            time.sleep(wait)
        _LAST_UPSTREAM_AT=time.monotonic()
        try:
            response=_SESSION.get(url,params=params,timeout=(5,15),headers=HEADERS)
            if response.status_code in (403,429):
                _BLOCK_UNTIL=time.monotonic()+3600
                raise UpstreamFailure("取得元から通信制限を受けました")
            if response.status_code>=500:
                _BLOCK_UNTIL=time.monotonic()+300
                raise UpstreamFailure("取得元が一時的に利用できません")
            response.raise_for_status()
            if len(response.content)>2_000_000:
                raise UpstreamFailure("取得元の応答が大きすぎます")
            return response
        except requests.RequestException as exc:
            raise UpstreamFailure("取得元との通信に失敗しました") from exc

def _cached(key,ttl,fn):
    # Use one lock for lookup + upstream fetch + cache store.
    # Prevent concurrent presses from stampeding the provider.
    with _LOCK:
        now=time.monotonic()
        prior=_CACHE.get(key)
        if prior and now-prior[0]<ttl:
            return prior[1]
        value=fn()
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
