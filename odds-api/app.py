import os, re, time
from datetime import datetime, timezone
from flask import Flask, request, jsonify
import requests
from bs4 import BeautifulSoup
from source_parser import parse_sportsnavi_public_html, race_id_from_index, resolve_race_date
from netkeiba_source import parse_roster, parse_win_odds

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
            if label=="race-list":
                try:
                    payload["resolvedRaceId"]=race_id_from_index(resp.content,track="東京",race_no=9,race_date=datetime(2026,10,10).date())
                except ValueError as ex:
                    payload["resolutionError"]=str(ex)
            print("[netkeiba-one-shot] " + json.dumps(payload, ensure_ascii=False), flush=True)
        except requests.RequestException as exc:
            print("[netkeiba-one-shot] " + json.dumps({"name":label,"error":type(exc).__name__}), flush=True)

import threading
threading.Thread(target=_one_time_netkeiba_probe, daemon=True).start()

# Temporary one-shot availability experiment for fully public SportsNavi
# odds table. Does not log responses, headers, cookies or personal data.
def _one_time_yahoo_probe():
    import json
    time.sleep(4)
    urls = [
        ("yahoo-tokyo9", "https://sports.yahoo.co.jp/keiba/race/odds/tfw/2605040309?ninki=1"),
        ("yahoo-kyoto10", "https://sports.yahoo.co.jp/keiba/race/odds/tfw/2608040310?ninki=1"),
    ]
    for label, url in urls:
        try:
            resp=requests.get(url,timeout=12,headers={
                "User-Agent":"Mozilla/5.0",
                "Accept-Language":"ja-JP,ja;q=0.9",
            })
            soup=BeautifulSoup(resp.content,"html.parser")
            rows=[]
            for tr in soup.select("tr"):
                t=tr.get_text(" ",strip=True)
                if any(n in t for n in ("ノクターン", "ビップチェイス", "エルハーベン", "ワンコールアウェイ")):
                    rows.append({"columns":len(tr.find_all(["td","th"])),"text":t[:150]})
            txt=soup.get_text(" ",strip=True)
            updated=re.findall(r"20\\d{2}[/年]\\d{1,2}[/月]\\d{1,2}日?\\s+\\d{1,2}:\\d{2}\\s*更新",txt)
            target_track,target_no = (("東京",9) if label=="yahoo-tokyo9" else ("京都",10))
            try:
                parsed=parse_sportsnavi_public_html(resp.content,track=target_track,race_no=target_no,race_date=datetime(2026,10,10).date())
                result={"count":len(parsed["horses"]),"sourceUpdatedAt":parsed["updatedAt"],"first":parsed["horses"][0]}
            except ValueError as err:
                result={"error":str(err)}
            print("[yahoo-public-probe] "+json.dumps({
                "source":label,"status":resp.status_code,"htmlBytes":len(resp.content),
                "title":soup.title.get_text(strip=True)[:65] if soup.title else "",
                "rows":len(soup.select("tr")),
                "samples":rows[:3],
                "updateMarkers":updated[:2],
                "missingOddsCount":txt.count("---.-"),
                "hasAllExpectedNames":all(n in txt for n in (("ノクターン","ビップチェイス") if label=="yahoo-tokyo9" else ("エルハーベン","ワンコールアウェイ"))),
                "parser":result,
                "updateContext":txt[max(0,txt.rfind(" 更新")-28):txt.rfind(" 更新")+6],
            },ensure_ascii=False),flush=True)
        except requests.RequestException as e:
            print("[yahoo-public-probe] "+json.dumps({"source":label,"error":type(e).__name__}),flush=True)

threading.Thread(target=_one_time_yahoo_probe,daemon=True).start()

# One-time, publicly accessible Netkeiba JSON odds endpoint experiment.
# Inspect response schema only (no cookies, credentials, full raw payload or bulk fetch).
def _one_time_netkeiba_json_probe():
    import json
    time.sleep(3)
    url="https://race.netkeiba.com/api/api_get_jra_odds.html"
    for rid in ["202605040309","202608040310"]:
        try:
            resp=requests.get(url,params={"race_id":rid,"type":"1","action":"update"},timeout=15,
                headers={"User-Agent":"Mozilla/5.0","Accept-Language":"ja-JP,ja;q=0.9","Accept":"application/json"})
            detail={"id":rid,"status":resp.status_code,"bytes":len(resp.content),"contentType":resp.headers.get("Content-Type","")[:60]}
            try:
                js=resp.json()
                detail["rootKeys"]=list(js)[:12] if isinstance(js,dict) else []
                detail["statusValue"]=js.get("status") if isinstance(js,dict) else ""
                data=js.get("data") if isinstance(js,dict) else None
                if isinstance(data,dict):
                    detail["dataKeys"]=list(data)[:12]
                    odds=data.get("odds")
                    if isinstance(odds,dict):
                        detail["oddsGroups"]=list(odds)[:6]
                        wins=odds.get("1")
                        if isinstance(wins,dict):
                            detail["winEntries"]=len(wins)
                            detail["sample"]=list(wins.items())[:2]
            except ValueError:
                detail["json"]=False
            print("[netkeiba-json-probe] "+json.dumps(detail,ensure_ascii=False),flush=True)
        except requests.RequestException as ex:
            print("[netkeiba-json-probe] "+json.dumps({"id":rid,"error":type(ex).__name__}),flush=True)

threading.Thread(target=_one_time_netkeiba_json_probe,daemon=True).start()

def _race_id_resolution_probe():
    import json
    time.sleep(3)
    targets=[
        ("mobile-list","https://race.sp.netkeiba.com/?pid=race_list&kaisai_date=20261010"),
        ("desktop-sub","https://race.netkeiba.com/top/race_list_sub.html?kaisai_date=20261010"),
    ]
    for label,url in targets:
        try:
            resp=requests.get(url,timeout=15,headers={"User-Agent":"Mozilla/5.0","Accept-Language":"ja-JP"})
            sou=BeautifulSoup(resp.content,"html.parser")
            from urllib.parse import parse_qs,urlsplit
            hits=set()
            for a in sou.select("a[href]"):
                for rid in parse_qs(urlsplit(a.get("href","")).query).get("race_id",[]):
                    if re.fullmatch(r"202605\\d{4}09",rid):
                        hits.add(rid)
            ids_by_url=set()
            example_urls=[]
            for a in sou.select("a[href]"):
                href=a.get("href","")
                matched=re.findall(r"202605[0-9]{4}09",href)
                if matched:
                    ids_by_url.update(matched)
                    if len(example_urls)<2:example_urls.append(href[:100])
            compact={"page":label,"status":resp.status_code,"bytes":len(resp.content),"idsTokyo9":sorted(hits)[:15],"idsCount":len(hits),"pathIds":sorted(ids_by_url)[:12],"samplePaths":example_urls,"title":sou.title.get_text(strip=True)[:70] if sou.title else ""}
            try:
                compact["resolved"]=race_id_from_index(resp.content,track="東京",race_no=9,race_date=datetime(2026,10,10).date())
            except ValueError as e:compact["resolutionError"]=str(e)
            print("[race-identity-probe] "+json.dumps(compact,ensure_ascii=False),flush=True)
        except requests.RequestException as e:
            print("[race-identity-probe] "+json.dumps({"page":label,"error":type(e).__name__}),flush=True)

threading.Thread(target=_race_id_resolution_probe,daemon=True).start()

def _roster_probe():
    import json
    time.sleep(4)
    rid="202605040309"
    try:
        url="https://race.sp.netkeiba.com/race/shutuba.html"
        r=requests.get(url,params={"race_id":rid},timeout=15,headers={"User-Agent":"Mozilla/5.0"})
        soup=BeautifulSoup(r.content,"html.parser")
        samples=[]
        for row in soup.select("tr"):
            txt=row.get_text(" ",strip=True)
            if "ノクターン" in txt or "ビップチェイス" in txt:
                samples.append({"tagClass":row.get("class",[]),"cells":[{"class":td.get("class",[]),"text":td.get_text(" ",strip=True)[:65],"anchors":[{"text":a.get_text(" ",strip=True)[:35],"class":a.get("class",[]),"horseLink":"/horse/" in a.get("href","")} for a in td.select("a[href]")][:5]} for td in row.find_all("td",recursive=False)]})
        try:
            roster=parse_roster(r.content,race_id=rid,race_date=datetime(2026,10,10).date(),track="東京",race_no=9)
            status={"rosterSize":len(roster),"names":list(roster.items())[:2]}
        except ValueError as e:
            status={"rosterError":str(e)}
        print("[netkeiba-roster-probe] "+json.dumps({"status":r.status_code,"HorseListRows":len(soup.select("tr.HorseList")),"parse":status,"samples":samples[:2]},ensure_ascii=False),flush=True)
        x=requests.get("https://race.netkeiba.com/api/api_get_jra_odds.html",params={"race_id":rid,"type":"1","action":"update"},timeout=12,headers={"User-Agent":"Mozilla/5.0"})
        z=x.json()
        data=z.get("data",{})
        verified={}
        if isinstance(status,dict) and "rosterSize" in status:
            try:
                output=parse_win_odds(z,race_id=rid,race_date=datetime(2026,10,10).date(),track="東京",race_no=9,roster=roster)
                verified={"verifiedCount":len(output["horses"]),"verifiedUpdatedAt":output["updatedAt"],"first":output["horses"][0]}
            except ValueError as e: verified={"verifyError":str(e)}
        print("[netkeiba-meta-probe] "+json.dumps({"meta":{key:data.get(key) for key in ("send_date","send_time","official_datetime","update_datetime","yy","jyo","kai","nichi","rno","touroku","shusso")},"status":z.get("status"),"verified":verified},ensure_ascii=False),flush=True)
    except (requests.RequestException,ValueError) as e:
        print("[netkeiba-roster-probe] "+json.dumps({"error":type(e).__name__}),flush=True)

threading.Thread(target=_roster_probe,daemon=True).start()
