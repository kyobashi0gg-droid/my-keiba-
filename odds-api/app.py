"""MY KEIBA LAB personal-use odds bridge (experiment branch only).

The public endpoint is OFF by default. Enable only when provider permissions,
access control and integration tests are satisfactory.
"""
import os
import hmac
import threading
import time
from flask import Flask, request, jsonify, Response

from netkeiba_bridge import fetch_snapshot, UpstreamFailure
from source_parser import OddsSourceError
from netkeiba_source import UnverifiedOdds

app=Flask(__name__)
ORIGIN="https://kyobashi0gg-droid.github.io"
ACCESS_KEY=os.environ.get("MYKEIBA_ODDS_ACCESS_KEY","")
ENABLED=(os.environ.get("MYKEIBA_ODDS_ENABLED","0")=="1" and len(ACCESS_KEY)>=32)

@app.after_request
def cors(response):
    if request.headers.get("Origin")==ORIGIN:
        response.headers["Access-Control-Allow-Origin"]=ORIGIN
        response.headers["Vary"]="Origin"
        response.headers["Access-Control-Allow-Methods"]="GET, OPTIONS"
        response.headers["Access-Control-Allow-Headers"]="Accept, X-MYKEIBA-ACCESS"
    response.headers["Cache-Control"]="no-store"
    return response

@app.get("/private-test")
def private_test():
    # Isolated smartphone smoke-test. Does not store a key in localStorage,
    # transmit it to third-party code or add odds to the production website.
    # Odds themselves remain gated by the server access-key check.
    html = """<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>MY KEIBA LAB — 個人用オッズ接続テスト</title>
<style>body{font-family:system-ui,sans-serif;max-width:580px;margin:auto;padding:22px;background:#f5f7fa;color:#182633}h1{font-size:21px}p{line-height:1.6}label{display:block;margin:18px 0 5px;font-weight:600}input,select,button{box-sizing:border-box;width:100%;font-size:16px;padding:12px;border:1px solid #bbc8cf;border-radius:9px}button{background:#1f7a4c;color:white;font-weight:700;margin:18px 0}button:disabled{opacity:.5}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:white;border-radius:10px;padding:14px}small{color:#536874}table{width:100%;border-collapse:collapse}td,th{padding:7px;border-bottom:1px solid #ccd3d9;text-align:left}td:nth-child(3),td:nth-child(4){text-align:right}</style></head>
<body><h1>MY KEIBA LAB 個人用オッズ接続テスト</h1>
<p>テストサーバーで全頭の単勝オッズと人気を確認するためのページです。MY KEIBA LAB本番の予想データは変更しません。</p>
<label>個人用アクセスキー（ここでは保存しません）</label>
<input type="password" id="key" autocomplete="off" minlength="32">
<label>確認するレース（2026年10月10日）</label>
<select id="race"><option value="東京|9">東京9R（9頭）</option><option value="東京|10">東京10R（16頭）</option><option value="東京|11">東京11R（11頭）</option><option value="京都|10">京都10R（15頭）</option><option value="京都|11">京都11R（13頭）</option></select>
<button id="go">取得して確認</button><div id="result" role="status"></div>
<small>取得元：netkeiba。接続は HTTPS。キーはこの画面のブラウザ保存領域に記録しません。サーバーのオッズ配信が無効の間は取得できません。</small>
<script>
const btn=document.getElementById('go'),out=document.getElementById('result');
btn.onclick=async()=>{
  const [track,raceNo]=document.getElementById('race').value.split('|');
  const key=document.getElementById('key').value;
  if(key.length<32){out.textContent='32文字以上のアクセスキーを入力してください';return;}
  btn.disabled=true;out.textContent='通信中…';
  try{
    const url=new URL('/odds',location.href);
    url.searchParams.set('track',track);url.searchParams.set('raceNo',raceNo);url.searchParams.set('dateLabel','2026-10-10');
    const res=await fetch(url,{headers:{'Accept':'application/json','X-MYKEIBA-ACCESS':key},cache:'no-store',credentials:'omit'});
    const data=await res.json();
    if(!res.ok)throw Error('HTTP '+res.status+'：'+(data.error||'照合不可'));
    const expected=({東京:{9:9,10:16,11:11},京都:{10:15,11:13}})[track][raceNo];
    if(data.track!==track||Number(data.raceNo)!==Number(raceNo)||data.horses?.length!==expected)throw Error('レース・全頭数が一致しません');
    const lines=data.horses.map(h=>'<tr><td>'+h.number+'</td><td>'+escapeText(h.name)+'</td><td>'+h.popularity+'</td><td>'+h.odds+'</td></tr>').join('');
    out.innerHTML='<p>✅ 全'+expected+'頭照合／元データ更新：'+escapeText(data.updatedAt)+'</p><table><tr><th>馬番</th><th>馬名</th><th>人気</th><th>単勝</th></tr>'+lines+'</table>';
  }catch(err){out.textContent='取得不可：'+err.message;}finally{btn.disabled=false;document.getElementById('key').value='';}
};
function escapeText(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
</script></body></html>"""
    response=Response(html, content_type="text/html; charset=utf-8")
    response.headers["Content-Security-Policy"]="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
    response.headers["X-Frame-Options"]="DENY"
    response.headers["Referrer-Policy"]="no-referrer"
    return response

@app.get("/health")
def health():
    return jsonify(status="ok",mode="experiment",upstream="netkeiba",
                   publicOddsEnabled=ENABLED)

@app.route("/odds",methods=["GET","OPTIONS"])
def odds():
    if request.method=="OPTIONS":
        return ("",204)
    if not ENABLED:
        return jsonify(error="試験段階のため自動配信は無効です"),503
    supplied=request.headers.get("X-MYKEIBA-ACCESS","")
    if not supplied or not hmac.compare_digest(ACCESS_KEY,supplied):
        return jsonify(error="個人用アクセスキーが必要です"),403
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

if os.environ.get("MYKEIBA_RUN_TEST_ON_BOOT","0")=="1":
    threading.Thread(target=_one_time_selfcheck,daemon=True).start()

if __name__=="__main__":
    app.run(host="0.0.0.0",port=int(os.environ.get("PORT","10000")))
