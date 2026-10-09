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
        m=re.search(r"(?<!\\d)(\\d{1,4}\\.\\d)(?:倍)?(?!\\d)",os_)
        if not m: continue
        nm=re.sub(r"\\s+","",name.get_text(strip=True))
        rank=None
        if pop:
            q=re.search(r"\\d+",pop.get("data-popularity") or pop.get_text(strip=True))
            if q: rank=int(q.group())
        out.append({"number":int(ns),"name":nm,"odds":float(m.group(1)),"popularity":rank})
    nums=[h["number"] for h in out]
    if len(out)<5 or len(set(nums))!=len(out): raise ValueError("馬番・馬名・単勝オッズを十分に検証できません")
    if sorted(nums)!=list(range(1,len(out)+1)): raise ValueError("全頭分の馬番が確認できません")
    if any(h["popularity"] is None for h in out):
        for i,h in enumerate(sorted(out,key=lambda h:(h["odds"],h["number"])),1):
            h["popularity"]=i
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
    if not re.fullmatch(r"20\\d{10}",raceid) or raceid[4:6]!=TRACKS[track] or int(raceid[-2:])!=num:
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
    data={"track":track,"raceNo":num,"raceId":raceid,"source":"netkeiba (unverified experiment)",
        "fetchedAt":datetime.now(timezone.utc).isoformat(),"horses":horses}
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
