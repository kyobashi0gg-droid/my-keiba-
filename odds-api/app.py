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


# Diagnostic only: check upstream availability at boot without importing odds.
def _startup_probe():
    import threading
    def check():
        for label,url in [("SmartRC","https://www.smartrc.jp/v3/"),("netkeiba","https://race.netkeiba.com/odds/index.html")]:
            try:
                res=requests.get(url,timeout=12,headers={"User-Agent":"Mozilla/5.0","Accept-Language":"ja-JP"})
                print(f"[odds-upstream-test] {label}: HTTP={res.status_code} bytes={len(res.content)} content_type={res.headers.get('Content-Type','')} URL={res.url}",flush=True)
                soup=BeautifulSoup(res.text,"html.parser")
                print(f"[odds-upstream-test] {label}: title={str(soup.title.get_text(' ',strip=True) if soup.title else '')[:90]!r} horse_rows={len(soup.select('tr'))} odds_nodes={len(soup.select('.Odds,.Win_Odds,.Tansho,[data-odds]'))}",flush=True)
            except Exception as ex:
                print(f"[odds-upstream-test] {label}: ERROR {type(ex).__name__} {str(ex)[:150]}",flush=True)
    threading.Thread(target=check,daemon=True).start()

_startup_probe()


# Discovery diagnostics: log only public script asset paths and candidate API strings.
def _inspect_smartrc_assets():
    import threading
    from urllib.parse import urljoin, urlparse
    def run():
        try:
            root="https://www.smartrc.jp/v3/"
            resp=requests.get(root,timeout=12,headers={"User-Agent":"Mozilla/5.0"})
            soup=BeautifulSoup(resp.text,"html.parser")
            assets=[urljoin(root,x.get("src")) for x in soup.select("script[src]") if x.get("src")]
            print("[odds-discover] scripts="+repr(assets[:28]),flush=True)
            for url in assets[:16]:
                parsed=urlparse(url)
                if parsed.hostname not in ("www.smartrc.jp","smartrc.jp"): continue
                try:
                    result=requests.get(url,timeout=12,headers={"User-Agent":"Mozilla/5.0"})
                    body=result.text
                    found=[]
                    for pattern in (r"[^\n;]{0,100}odds_tan[^\n;]{0,160}",r"[^\n;]{0,90}pop_tan[^\n;]{0,160}",r"[^\n;]{0,80}(?:\\.json|/api/|\\.php|\\.asmx)[^\n;]{0,130}"):
                        found.extend(re.findall(pattern,body,re.I)[:5])
                    print(f"[odds-discover] JS={parsed.path} status={result.status_code} bytes={len(result.content)} hints={repr(found[:10])[:2000]}",flush=True)
                except Exception as e:
                    print(f"[odds-discover] JS={parsed.path} ERROR={type(e).__name__}",flush=True)
        except Exception as e:
            print("[odds-discover] error="+str(e)[:150],flush=True)
    threading.Thread(target=run,daemon=True).start()
_inspect_smartrc_assets()


def _scan_inline():
    import threading
    def run():
        try:
            r=requests.get("https://www.smartrc.jp/v3/",timeout=12)
            soup=BeautifulSoup(r.text,"html.parser")
            script_text="\n".join(x.get_text() for x in soup.select("script:not([src])"))
            markers=["odds_tan","pop_tan","fetch(","XMLHttpRequest","axios","$.ajax","/api/","race","firebase"]
            print("[odds-inline] inline_scripts="+str(len(soup.select("script:not([src])")))+" chars="+str(len(script_text))+" marker_counts="+repr({m:script_text.lower().count(m.lower()) for m in markers}),flush=True)
            for needle in ["odds_tan","pop_tan","fetch(","XMLHttpRequest"]:
                pos=script_text.find(needle)
                if pos>=0: print("[odds-inline] near_"+needle+"="+repr(script_text[max(0,pos-100):pos+180])[:420],flush=True)
            links=[x.get("href") for x in soup.select("link[href]")][:30]
            print("[odds-inline] assets="+repr(links)[:1200],flush=True)
        except Exception as e: print("[odds-inline] error="+str(e)[:160],flush=True)
    threading.Thread(target=run,daemon=True).start()
_scan_inline()


def _discover_urls():
    import threading
    from urllib.parse import urlparse
    def run():
        try:
            page=requests.get("https://www.smartrc.jp/v3/",timeout=15).text
            soup=BeautifulSoup(page,"html.parser")
            scripts="\n".join(x.get_text() for x in soup.select("script:not([src])"))
            patterns=[r'(?:(?:https?:)?//)[^\\s\\"\\x27<>]{5,180}',r'[^\\s\\"\\x27<>]{3,100}\\.(?:json|php|jsp|ashx|aspx)(?:\\?[^\\s\\"\\x27<>]{0,70})?',r'(?:url|endpoint|host|server|service|baseUrl)\\s*[:=]\\s*[^,;\\n]{3,130}']
            for pat in patterns:
                vals=list(dict.fromkeys(re.findall(pat,scripts,re.I)))
                print("[odds-urls] pattern="+pat[:30]+" count="+str(len(vals))+" samples="+repr(vals[:35])[:4500],flush=True)
            for term in ("https:","http:","Ajax","ajax","WebSocket","ws://","wss://",".php","cgi","json","getData","getOdds","単勝"):
                p=scripts.lower().find(term.lower())
                if p>=0: print("[odds-urls] term="+term+" excerpt="+repr(scripts[max(0,p-130):p+220])[:400],flush=True)
        except Exception as ex: print("[odds-urls] ERROR "+str(ex)[:150],flush=True)
    threading.Thread(target=run,daemon=True).start()
_discover_urls()


def _inspect_manifest():
    import threading
    from urllib.parse import urljoin
    def run():
        try:
            base="https://www.smartrc.jp/v3/"
            for relative in ("app.json","bootstrap.json","app.js"):
                url=urljoin(base,relative)
                r=requests.get(url,timeout=12)
                print("[odds-manifest] "+relative+" status="+str(r.status_code)+" bytes="+str(len(r.content))+" ct="+str(r.headers.get("Content-Type")),flush=True)
                if relative=="app.json" and r.status_code==200:
                    try:
                        j=r.json()
                        print("[odds-manifest] keys="+repr(list(j.keys()))+" js="+repr(j.get("js",[])[:5])[:900]+" resources="+repr(j.get("resources",{}) if isinstance(j.get("resources"),str) else list(j.get("resources",{}).keys()) if isinstance(j.get("resources"),dict) else '')[:500],flush=True)
                    except Exception as e: print("[odds-manifest] json error="+str(e)[:100],flush=True)
        except Exception as e: print("[odds-manifest] ERROR "+str(e)[:160],flush=True)
    threading.Thread(target=run,daemon=True).start()
_inspect_manifest()


def _inspect_app_bundle():
    import threading
    def run():
        try:
            resp=requests.get("https://www.smartrc.jp/v3/app.js",timeout=25)
            txt=resp.text
            print("[odds-bundle] status="+str(resp.status_code)+" bytes="+str(len(resp.content)),flush=True)
            for key in ("odds_tan","pop_tan","単勝","tansho","odds","Ajax.request","Ext.Ajax","proxy:","url:","url=","smartrc.jp"):
                positions=[m.start() for m in list(re.finditer(re.escape(key),txt,re.I))[:4]]
                print("[odds-bundle] key="+key+" count="+str(len(list(re.finditer(re.escape(key),txt,re.I))))+" contexts="+repr([txt[max(0,p-85):p+125] for p in positions])[:1300],flush=True)
            endpoints=list(dict.fromkeys(re.findall(r"""(?:https?://[^'"\\s]{5,150}|/[a-zA-Z0-9_-]+/[a-zA-Z0-9_./?-]{4,110})""",txt)))
            print("[odds-bundle] path_candidates="+repr([e for e in endpoints if not any(x in e for x in ("sencha","extjs","google","w3.org"))][:60])[:3500],flush=True)
        except Exception as ex: print("[odds-bundle] ERROR="+str(ex)[:170],flush=True)
    threading.Thread(target=run,daemon=True).start()
_inspect_app_bundle()
