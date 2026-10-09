import os, re, time
from datetime import datetime, timezone
from flask import Flask, request, jsonify
import requests
from bs4 import BeautifulSoup

app=Flask(__name__)
TRACKS={"札幌":"01","函館":"02","福島":"03","新潟":"04","東京":"05","中山":"06","中京":"07","京都":"08","阪神":"09","小倉":"10"}
CACHE={}
ORIGIN="https://kyobashi0gg-droid.github.io"

@app.after_request
def cors(response):
    if request.headers.get("Origin")==ORIGIN:
        response.headers["Access-Control-Allow-Origin"]=ORIGIN
        response.headers["Vary"]="Origin"
    response.headers["Cache-Control"]="no-store"
    return response

@app.get("/health")
def health():
    return jsonify(status="ok",mode="experiment",verified_upstream=False)

def parse_netkeiba(html):
    soup=BeautifulSoup(html,"html.parser")
    out=[]
    for tr in soup.select("tr"):
        n=tr.select_one(".Umaban,.Horse_Num,.HorseNumber,[data-umaban]")
        name=tr.select_one(".Horse_Name,.HorseName,.Horse_Info a,a[href*='/horse/']")
        odd=tr.select_one(".Odds,.Win_Odds,.Tansho,[data-odds]")
        pop=tr.select_one(".Ninki,.Popularity,[data-popularity]")
        if not (n and name and odd): continue
        ns=n.get("data-umaban") or n.get_text(strip=True)
        os_=odd.get("data-odds") or odd.get_text(strip=True)
        if not re.fullmatch(r"(?:[1-9]|1[0-8])",ns): continue
        m=re.search(r"(?<!\d)(\d{1,4}\.\d)(?:倍)?(?!\d)",os_)
        if not m: continue
        nm=re.sub(r"\s+","",name.get_text(strip=True))
        rank=None
        if pop:
            q=re.search(r"\d+",pop.get("data-popularity") or pop.get_text(strip=True))
            if q: rank=int(q.group())
        out.append({"number":int(ns),"name":nm,"odds":float(m.group(1)),"popularity":rank})
    nums=[h["number"] for h in out]
    if len(out)<5 or len(set(nums))!=len(out): raise ValueError("馬番・馬名・単勝オッズを十分に検証できません")
    if sorted(nums)!=list(range(1,len(out)+1)): raise ValueError("全頭分の馬番が確認できません")
    # Do not invent official popularity ranking from rounded win odds.
    if any(h["popularity"] is None for h in out):
        raise ValueError("人気順位は提供元の実データで確認できません")
    if sorted(h["popularity"] for h in out)!=list(range(1,len(out)+1)):
        raise ValueError("人気順位が不整合")
    return sorted(out,key=lambda h:h["number"])

@app.get("/odds")
def odds():
    track=request.args.get("track","").strip()
    try: num=int(request.args.get("raceNo",""))
    except ValueError: num=0
    if track not in TRACKS or not 1<=num<=12:
        return jsonify(error="開催場・Rが不正です"),400
    # Do not guess the meeting number/day. Until automatic race-ID lookup is verified,
    # require a 12-digit raceId. The existing button does not yet pass this parameter.
    raceid=request.args.get("raceId","")
    if not re.fullmatch(r"20\d{10}",raceid) or raceid[4:6]!=TRACKS[track] or int(raceid[-2:])!=num:
        return jsonify(error="raceIdの自動照合は未実装です。未検証データは取り込みません"),422
    cached=CACHE.get(raceid)
    if cached and time.monotonic()-cached[0]<15: return jsonify(cached[1])
    try:
        r=requests.get("https://race.netkeiba.com/odds/index.html",params={"race_id":raceid,"type":"b1"},timeout=12,
            headers={"User-Agent":"Mozilla/5.0","Accept-Language":"ja-JP,ja;q=0.9"})
        r.raise_for_status()
        horses=parse_netkeiba(r.text)
    except (requests.RequestException,ValueError) as exc:
        return jsonify(error="取得元のオッズ検証に失敗しました",detail=str(exc)),503
    # Netkeiba race-date verification is not implemented yet; do not present
    # apparent success to the existing site even if HTML parsing succeeds.
    return jsonify(error="実オッズの開催日照合が未検証のため、自動反映できません"),503

    CACHE[raceid]=(time.monotonic(),data)
    return jsonify(data)

@app.get("/probe")
def probe():
    # Connectivity-only: does not claim successful odds parsing.
    urls={"smartrc":"https://www.smartrc.jp/v3/","netkeiba":"https://race.netkeiba.com/odds/index.html"}
    results={}
    for key,url in urls.items():
        try:
            resp=requests.get(url,timeout=10,headers={"User-Agent":"Mozilla/5.0"})
            results[key]={"status":resp.status_code,"htmlBytes":len(resp.content),"hasHorseOdds":False}
        except requests.RequestException as exc:
            results[key]={"error":str(exc)[:180],"hasHorseOdds":False}
    return jsonify(results)

if __name__=="__main__":
    app.run(host="0.0.0.0",port=int(os.environ.get("PORT","10000")))

# One-shot, bounded experiment on the test service only (no repeated crawling).
# Logs only race/odds diagnostics, never response bodies, cookies or tokens.
def _one_time_netkeiba_probe():
    import json
    time.sleep(3)
    fixed_raceid = "202605040309"  # 2026-10-10 Tokyo 9R, test fixture
    locations = [
        ("mobile-odds", "https://race.sp.netkeiba.com/?pid=odds_view&race_id=" + fixed_raceid + "&type=b1"),
        ("mobile-bias", "https://race.sp.netkeiba.com/?pid=bias&race_id=" + fixed_raceid),
        ("mobile-racecard", "https://race.sp.netkeiba.com/race/shutuba.html?race_id=" + fixed_raceid),
        ("desktop-racecard", "https://race.netkeiba.com/race/shutuba.html?race_id=" + fixed_raceid),
        ("mobile-wide", "https://race.sp.netkeiba.com/?pid=odds_view&race_id=" + fixed_raceid + "&type=b5&housiki=c1"),
        ("race-list", "https://race.sp.netkeiba.com/?pid=race_list&kaisai_date=20261010"),
    ]
    for label, url in locations:
        try:
            resp = requests.get(url, timeout=12, headers={
                "User-Agent": "Mozilla/5.0 (compatible; MYKEIBA-Test/1.0)",
                "Accept-Language": "ja-JP,ja;q=0.9",
            })
            soup = BeautifulSoup(resp.content, "html.parser")
            # Never log full HTML: it could contain unrelated sensitive attributes.
            candidate = []
            for row in soup.select("tr"):
                plain = row.get_text(" ", strip=True)
                if "ノクターン" in plain or "ビップチェイス" in plain:
                    candidate.append({"cells":len(row.select("td")),"text":plain[:160]})
            payload = {
                "name":label,
                "status":resp.status_code,
                "length":len(resp.content),
                "title":(soup.title.get_text(strip=True) if soup.title else "")[:70],
                "rows":len(soup.select("tr")),
                "examples":candidate[:2],
                "oddsBlankCount":soup.get_text(" ",strip=True).count("---.-"),
                "premiumGate":"続きはプレミアム" in soup.get_text(" ",strip=True),
                "raceIdRefs":len(soup.select("a[href*='202605040309']")),
            }
            print("[netkeiba-one-shot] " + json.dumps(payload, ensure_ascii=False), flush=True)
        except requests.RequestException as exc:
            print("[netkeiba-one-shot] " + json.dumps({"name":label,"error":type(exc).__name__}), flush=True)

import threading
threading.Thread(target=_one_time_netkeiba_probe, daemon=True).start()
