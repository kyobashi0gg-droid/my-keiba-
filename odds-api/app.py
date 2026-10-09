"""MY KEIBA LAB personal-use odds bridge (experiment branch only).

The public endpoint is OFF by default. Enable only when provider permissions,
access control and integration tests are satisfactory.
"""
import os
import threading
import time
from flask import Flask, request, jsonify

from netkeiba_bridge import fetch_snapshot, UpstreamFailure
from source_parser import OddsSourceError
from netkeiba_source import UnverifiedOdds

app=Flask(__name__)
ORIGIN="https://kyobashi0gg-droid.github.io"
ENABLED=os.environ.get("MYKEIBA_ODDS_ENABLED","0")=="1"

@app.after_request
def cors(response):
    if request.headers.get("Origin")==ORIGIN:
        response.headers["Access-Control-Allow-Origin"]=ORIGIN
        response.headers["Vary"]="Origin"
    response.headers["Cache-Control"]="no-store"
    return response

@app.get("/health")
def health():
    return jsonify(status="ok",mode="experiment",upstream="netkeiba",
                   publicOddsEnabled=ENABLED)

@app.get("/odds")
def odds():
    if not ENABLED:
        return jsonify(error="試験段階のため自動配信は無効です"),503
    track=str(request.args.get("track","")).strip()
    try:
        race_no=int(request.args.get("raceNo",""))
    except ValueError:
        return jsonify(error="レース番号が不正です"),400
    label=str(request.args.get("dateLabel","")).strip()
    if not label or len(label)>48:
        return jsonify(error="開催日が不明です"),400
    try:
        answer=fetch_snapshot(track=track,race_no=race_no,date_label=label)
        return jsonify(answer)
    except (OddsSourceError,UnverifiedOdds,UpstreamFailure,KeyError,ValueError) as exc:
        app.logger.warning("Odds fetch failed: %s",type(exc).__name__)
        return jsonify(error="出走馬・開催日・オッズの照合ができません"),503

def _one_time_selfcheck():
    """Test representative races without exposing or logging actual odds."""
    time.sleep(3)
    for track,rno,expected in (("東京",9,9),("東京",10,16),("東京",11,11),("京都",10,15),("京都",11,13)):
        try:
            value=fetch_snapshot(track=track,race_no=rno,date_label="2026-10-10")
            n=len(value["horses"])
            print(f"[netkeiba-e2e] {track}{rno}R count={n} expected={expected} "
                  f"pass={n==expected} updatedAt={value['updatedAt']}",flush=True)
        except Exception as exc:
            print(f"[netkeiba-e2e] {track}{rno}R FAILED={type(exc).__name__} "
                  f"detail={str(exc)[:90]}",flush=True)

if os.environ.get("MYKEIBA_RUN_TEST_ON_BOOT","1")=="1":
    threading.Thread(target=_one_time_selfcheck,daemon=True).start()

if __name__=="__main__":
    app.run(host="0.0.0.0",port=int(os.environ.get("PORT","10000")))
