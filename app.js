// ============================================
//  加密雷达 - K线版
// ============================================

const COINS = [
    '1INCH','2Z','A','AAVE','ACE','ACH','ACT','ADA','AERGO','AEVO','AGLD','AI','AIXBT','ALGO','ALLO','ANIME','APE','API3','APT','AR','ARB','ARG','ARKM','ASP','ASTER','ASTR','ATH','ATOM','AUCTION','AVAX','AVNT','AXS',
    'BABY','BABYDOGE','BANANA','BAND','BARD','BASED','BAT','BCH','BERA','BETH','BICO','BIGTIME','BIO','BLUR','BNB','BNT','BOME','BONK','BREV','BTC','CAT','CATI','CC','CELO','CELR','CETUS','CFG','CFX','CHIP','CHZ','CITY','COMP','CORE','CRO','CRV','CSPR','CTC','CVC','CVX',
    'DASH','DEGEN','DGB','DOGE','DOGS','DOOD','DORA','DOT','DUCK','DYDX',
    'EDGE','EGLD','EIGEN','ELF','ENA','ENJ','ENS','ETC','ETH','ETHFI','ETHW',
    'FET','FIL','FLOKI','FLOW','FLR','FLUID','FOGO',
    'G','GALA','GALFT','GAS','GLM','GMT','GMX','GOAT','GODS','GRASS','GRT',
    'HBAR','HMSTR','HUMA','HYPE',
    'ICP','ICX','ID','ILV','IMX','INJ','IOST','IOTA','IP','IRYS',
    'JITOSOL','JOE','JTO','JUP',
    'KAIA','KAITO','KAT','KITE','KMNO','KNC','KSM',
    'LAT','LAYER','LDO','LEO','LINEA','LINK','LIT','LPT','LQTY','LRC','LSK','LTC','LUNA',
    'MAGIC','MANA','MASK','ME','MEGA','MEME','MENGO','MERL','MET','METIS','MEW','MINA','MMT','MON','MOODENG','MORPHO','MOVE',
    'NAVX','NEAR','NEIRO','NEO','NFT','NIGHT','NMR','NOT',
    'OFC','OKB','OKSOL','OL','OMI','ONDO','ONE','ONT','OP','ORBS','ORDI',
    'PARTI','PAXG','PENDLE','PENGU','PEOPLE','PEPE','PHA','PI','PIXEL','PNUT','POL','POR','PRCL','PROMPT','PROS','PROVE','PUMP','PYTH',
    'QTUM',
    'RAY','RENDER','RESOLV','ROBO','RON','RPL','RSR','RVN',
    'S','SAFE','SAHARA','SAND','SATS','SCR','SD','SEI','SENT','SHIB','SKL','SKY','SLP','SNT','SNX','SOL','SONIC','SOPH','SPACE','SPK','SPURS','SSV','STETH','STORJ','STRK','STX','SUI','SUSHI','SWFTC',
    'T','THETA','TIA','TNSR','TON','TOSHI','TRA','TRB','TRUMP','TRX','TURBO',
    'UMA','UNI',
    'VELO','VELODROME','VINE','VIRTUAL',
    'W','WAXP','WCT','WET','WIF','WIN','WLD','WLFI','WOO',
    'XAUT','XCH','XLM','XPL','XRP','XTZ',
    'YB','YFI','YGG',
    'ZAMA','ZBCN','ZEC','ZEN','ZENT','ZETA','ZEUS','ZIL','ZK','ZKJ','ZORA','ZRO','ZRX'
];

// 排序：BTC ETH固定前二，其余按置信度从高到低
const CONF_ORDER = {'高':0,'中':1,'--':2};
function sortData(){
    allData.sort((a,b)=>{
        // BTC ETH 固定前二
        if(a.sym==='BTC')return -1;if(b.sym==='BTC')return 1;
        if(a.sym==='ETH')return -1;if(b.sym==='ETH')return 1;
        // 其余按置信度排
        const aConf = CONF_ORDER[a.verdict?a.verdict.confidence:'--'] ?? 2;
        const bConf = CONF_ORDER[b.verdict?b.verdict.confidence:'--'] ?? 2;
        if(aConf !== bConf) return aConf - bConf;
        const aDiff = a.verdict ? Math.abs(a.verdict.bullScore - a.verdict.bearScore) : 0;
        const bDiff = b.verdict ? Math.abs(b.verdict.bullScore - b.verdict.bearScore) : 0;
        return bDiff - aDiff;
    });
}

// 同源相对路径：由 Pages Function (functions/api/v5/[[path]].js) 代理转发到 OKX
const OKX = '/api/v5';
// 行情轮询间隔，硬性下限 10 秒。配合代理侧 15 秒边缘缓存，
// 即使多端访问或频繁刷新，也不会因为轮询过密触发 OKX 429。
const PRICE_POLL_MS = 10000;
// 拉取失败后的自动重试延迟
const RETRY_DELAY_MS = 10000;
const CACHE = {};
const CACHE_TTL = 30*60*1000;

let allData = [];
let curFilter = 'all';
let searchQuery = '';
let priceTimer = null, candleTimer = null;
let cdSec=0, cdTimer=null;
let domReady = false;
let curTF = 'short'; // short | long

// 时间段配置
const TF_CONFIG = {
    short: { bar:'1H', days:7,   limit:168, label:'1小时K线 · 7天数据',  indLabel:'1H' },
    long:  { bar:'1D', days:90,  limit:100, label:'日线K线 · 90天数据',  indLabel:'日线' }
};

// ---- 工具 ----
const F=(n,d=2)=>n==null||isNaN(n)?'--':Number(n).toFixed(d);
const FK=n=>{if(n==null||isNaN(n))return'--';if(n>=1e12)return(n/1e12).toFixed(2)+'万亿';if(n>=1e9)return(n/1e9).toFixed(2)+'亿';if(n>=1e6)return(n/1e6).toFixed(1)+'M';if(n>=1e3)return(n/1e3).toFixed(1)+'K';return n.toFixed(2);};
const FP=n=>n==null||isNaN(n)?'--':(n>=0?'+':'')+n.toFixed(2)+'%';
const FU=n=>{if(n==null||isNaN(n))return'--';if(n>=1000)return'$'+n.toLocaleString('en-US',{maximumFractionDigits:0});if(n>=1)return'$'+n.toFixed(2);if(n>=0.01)return'$'+n.toFixed(4);return'$'+n.toFixed(6);};

// ---- 指标 ----
function ema(p,per){const k=2/(per+1),r=[p[0]];for(let i=1;i<p.length;i++)r.push(p[i]*k+r[i-1]*(1-k));return r;}
function rsi(p,per=14){const g=[],l=[];for(let i=1;i<p.length;i++){const d=p[i]-p[i-1];g.push(Math.max(0,d));l.push(Math.max(0,-d));}if(g.length<per)return[];let ag=g.slice(0,per).reduce((a,b)=>a+b)/per,al=l.slice(0,per).reduce((a,b)=>a+b)/per;const r=[];for(let i=per;i<g.length;i++){ag=(ag*(per-1)+g[i])/per;al=(al*(per-1)+l[i])/per;r.push(al===0?100:100-100/(1+ag/al));}return r;}
function macd(p,f=12,s=26,sig=9){const ef=ema(p,f),es=ema(p,s),ml=ef.map((v,i)=>v-es[i]),sl=ema(ml,sig);return{ml,sl,hist:ml.map((v,i)=>v-sl[i])};}
function boll(p,per=20,mult=2){const u=[],m=[],lo=[];for(let i=per-1;i<p.length;i++){const s=p.slice(i-per+1,i+1),avg=s.reduce((a,b)=>a+b)/per;const std=Math.sqrt(s.reduce((a,b)=>a+(b-avg)**2,0)/per);m.push(avg);u.push(avg+mult*std);lo.push(avg-mult*std);}return{u,m,lo};}

// ADX - 趋势强度 (0-100, >25趋势, >50强趋势)
function adx(highs,lows,closes,per=14){
    if(highs.length<per*2) return {adx:0,plusDI:0,minusDI:0};
    const tr=[],plusDM=[],minusDM=[];
    for(let i=1;i<highs.length;i++){
        tr.push(Math.max(highs[i]-lows[i],Math.abs(highs[i]-closes[i-1]),Math.abs(lows[i]-closes[i-1])));
        const up=highs[i]-highs[i-1], dn=lows[i-1]-lows[i];
        plusDM.push(up>dn&&up>0?up:0);
        minusDM.push(dn>up&&dn>0?dn:0);
    }
    // Smoothed
    let sTR=tr.slice(0,per).reduce((a,b)=>a+b);
    let sPDM=plusDM.slice(0,per).reduce((a,b)=>a+b);
    let sMDM=minusDM.slice(0,per).reduce((a,b)=>a+b);
    const dx=[];
    for(let i=per;i<tr.length;i++){
        sTR=sTR-sTR/per+tr[i];
        sPDM=sPDM-sPDM/per+plusDM[i];
        sMDM=sMDM-sMDM/per+minusDM[i];
        const pDI=sTR?100*sPDM/sTR:0;
        const mDI=sTR?100*sMDM/sTR:0;
        const sum=pDI+mDI;
        dx.push(sum?100*Math.abs(pDI-mDI)/sum:0);
    }
    const adxVal=dx.length>=per?dx.slice(-per).reduce((a,b)=>a+b)/per:dx.length?dx.reduce((a,b)=>a+b)/dx.length:0;
    const lastPDI=sTR?100*sPDM/sTR:0;
    const lastMDI=sTR?100*sMDM/sTR:0;
    return {adx:adxVal,plusDI:lastPDI,minusDI:lastMDI};
}

// Stochastic RSI
function stochRSI(p,rsiPer=14,stochPer=14,kPer=3){
    const rsiVals=rsi(p,rsiPer);
    if(rsiVals.length<stochPer)return {k:50,d:50};
    const k=[];
    for(let i=stochPer-1;i<rsiVals.length;i++){
        const window=rsiVals.slice(i-stochPer+1,i+1);
        const hi=Math.max(...window),lo=Math.min(...window);
        k.push(hi-lo?100*(rsiVals[i]-lo)/(hi-lo):50);
    }
    const kVal=k.length>=kPer?k.slice(-kPer).reduce((a,b)=>a+b)/kPer:k[k.length-1]||50;
    // D is SMA of K (simplified)
    const dVal=k.length>=kPer*2?k.slice(-kPer).reduce((a,b)=>a+b)/kPer:kVal;
    return {k:kVal,d:dVal};
}

// ---- K线形态识别 ----
function detectCandlePatterns(candles){
    if(!candles||candles.length<5)return [];
    const patterns=[];
    const c=candles;
    const n=c.length;

    // 最近3根K线
    const c0=c[n-1], c1=c[n-2], c2=c[n-3];
    if(!c0||!c1)return patterns;

    const body0=Math.abs(c0.c-c0.o);
    const body1=Math.abs(c1.c-c1.o);
    const range0=c0.h-c0.l;
    const range1=c1.h-c1.l;
    const upper0=c0.h-Math.max(c0.o,c0.c);
    const lower0=Math.min(c0.o,c0.c)-c0.l;
    const upper1=c1.h-Math.max(c1.o,c1.c);
    const lower1=Math.min(c1.o,c1.c)-c1.l;

    const isUp0=c0.c>c0.o, isUp1=c1.c>c1.o;

    // 1) 锤子线 (Hammer) - 下影线长，实体小，在下跌后出现
    if(range0>0 && lower0/body0>2 && upper0<body0*0.3 && range0>body0*2.5){
        const prev3Down=n>=4&&c[n-4]&&c[n-4].c>c[n-3].c&&c[n-3].c>c[n-2].c;
        if(prev3Down) patterns.push({name:'锤子线',dir:'bull',strength:2,desc:'下影线极长，卖压被完全吸收，反转信号'});
    }

    // 2) 倒锤子 (Inverted Hammer)
    if(range0>0 && upper0/body0>2 && lower0<body0*0.3 && range0>body0*2.5){
        patterns.push({name:'倒锤子',dir:'bull',strength:1.5,desc:'上影线长，试探上方压力，可能反转'});
    }

    // 3) 吞没形态 (Engulfing)
    if(body1>0 && body0>body1*1.2){
        if(!isUp1&&isUp0&&c0.c>c1.o&&c0.o<c1.c){
            patterns.push({name:'看涨吞没',dir:'bull',strength:2.5,desc:'阳线完全吞没前一根阴线，强烈反转'});
        }
        if(isUp1&&!isUp0&&c0.o>c1.c&&c0.c<c1.o){
            patterns.push({name:'看跌吞没',dir:'bear',strength:2.5,desc:'阴线完全吞没前一根阳线，强烈反转'});
        }
    }

    // 4) 十字星 (Doji)
    if(range0>0 && body0/range0<0.1 && range0>0){
        if(c2&&c2.c>c1.c&&c1.c>c0.c) patterns.push({name:'十字星(底部)',dir:'bull',strength:1.5,desc:'下跌后出现十字星，多空平衡，可能反转'});
        if(c2&&c2.c<c1.c&&c1.c<c0.c) patterns.push({name:'十字星(顶部)',dir:'bear',strength:1.5,desc:'上涨后出现十字星，多空平衡，可能反转'});
    }

    // 5) 早晨之星 (Morning Star)
    if(c2&&c2.c<c2.o&&body1/range1<0.3&&isUp0&&c0.c>(c2.o+c2.c)/2){
        patterns.push({name:'早晨之星',dir:'bull',strength:3,desc:'三根K线经典反转形态，强烈看多'});
    }

    // 6) 黄昏之星 (Evening Star)
    if(c2&&c2.c>c2.o&&body1/range1<0.3&&!isUp0&&c0.c<(c2.o+c2.c)/2){
        patterns.push({name:'黄昏之星',dir:'bear',strength:3,desc:'三根K线经典反转形态，强烈看空'});
    }

    // 7) 三连阳/三连阴
    if(n>=4){
        const c3=c[n-4];
        if(c3&&c3.c>c3.o&&isUp1&&isUp0&&c1.c>c3.c&&c0.c>c1.c)
            patterns.push({name:'三连阳',dir:'bull',strength:2,desc:'连续三根阳线，多头强势'});
        if(c3&&c3.c<c3.o&&!isUp1&&!isUp0&&c1.c<c3.c&&c0.c<c1.c)
            patterns.push({name:'三连阴',dir:'bear',strength:2,desc:'连续三根阴线，空头强势'});
    }

    // 8) 长上影线 (射击之星)
    if(range0>0&&upper0/body0>2.5&&lower0<body0*0.5&&!isUp0){
        patterns.push({name:'射击之星',dir:'bear',strength:2,desc:'上方压力极重，冲高回落'});
    }

    // 9) 孕线 (Harami)
    if(body1>body0*2){
        if(!isUp1&&isUp0&&c0.o>c1.c&&c0.c<c1.o)
            patterns.push({name:'看涨孕线',dir:'bull',strength:1.5,desc:'阴线内孕育小阳线，下跌动能减弱'});
        if(isUp1&&!isUp0&&c0.o<c1.c&&c0.c>c1.o)
            patterns.push({name:'看跌孕线',dir:'bear',strength:1.5,desc:'阳线内孕育小阴线，上涨动能减弱'});
    }

    return patterns;
}

// ---- 图表形态识别 ----
function detectChartPatterns(p, period=30){
    if(p.length<period)return [];
    const patterns=[];
    const recent=p.slice(-period);
    const hi=Math.max(...recent), lo=Math.min(...recent);
    const range=hi-lo;
    if(range===0)return patterns;

    // 找局部高低点
    const swingHighs=[], swingLows=[];
    for(let i=2;i<recent.length-2;i++){
        if(recent[i]>recent[i-1]&&recent[i]>recent[i-2]&&recent[i]>recent[i+1]&&recent[i]>recent[i+2])
            swingHighs.push({idx:i,val:recent[i]});
        if(recent[i]<recent[i-1]&&recent[i]<recent[i-2]&&recent[i]<recent[i+1]&&recent[i]<recent[i+2])
            swingLows.push({idx:i,val:recent[i]});
    }

    const cur=recent[recent.length-1];

    // 1) 双底 (W底)
    if(swingLows.length>=2){
        const l1=swingLows[swingLows.length-2], l2=swingLows[swingLows.length-1];
        if(Math.abs(l1.val-l2.val)/range<0.05 && l2.idx>l1.idx+3){
            const neckline=Math.max(...recent.slice(l1.idx,l2.idx+1));
            if(cur>neckline*0.99)
                patterns.push({name:'双底(W底)',dir:'bull',strength:3,desc:`颈线${FU(neckline)}，已突破确认`});
            else
                patterns.push({name:'双底形成中',dir:'bull',strength:1.5,desc:`等待突破颈线${FU(neckline)}`});
        }
    }

    // 2) 双顶 (M顶)
    if(swingHighs.length>=2){
        const h1=swingHighs[swingHighs.length-2], h2=swingHighs[swingHighs.length-1];
        if(Math.abs(h1.val-h2.val)/range<0.05 && h2.idx>h1.idx+3){
            const neckline=Math.min(...recent.slice(h1.idx,h2.idx+1));
            if(cur<neckline*1.01)
                patterns.push({name:'双顶(M顶)',dir:'bear',strength:3,desc:`颈线${FU(neckline)}，已跌破确认`});
            else
                patterns.push({name:'双顶形成中',dir:'bear',strength:1.5,desc:`等待跌破颈线${FU(neckline)}`});
        }
    }

    // 3) 上升三角形
    if(swingHighs.length>=2&&swingLows.length>=2){
        const h1=swingHighs[swingHighs.length-2], h2=swingHighs[swingHighs.length-1];
        const l1=swingLows[swingLows.length-2], l2=swingLows[swingLows.length-1];
        if(Math.abs(h1.val-h2.val)/range<0.03&&l2.val>l1.val){
            patterns.push({name:'上升三角形',dir:'bull',strength:2,desc:`高点持平${FU(h2.val)}，低点抬升，突破概率大`});
        }
        // 下降三角形
        if(Math.abs(l1.val-l2.val)/range<0.03&&h2.val<h1.val){
            patterns.push({name:'下降三角形',dir:'bear',strength:2,desc:`低点持平${FU(l2.val)}，高点下移，跌破概率大`});
        }
    }

    // 4) 通道
    if(swingHighs.length>=2&&swingLows.length>=2){
        const hSlope=(swingHighs[swingHighs.length-1].val-swingHighs[swingHighs.length-2].val);
        const lSlope=(swingLows[swingLows.length-1].val-swingLows[swingLows.length-2].val);
        if(hSlope>0&&lSlope>0&&Math.abs(hSlope-lSlope)/range<0.05)
            patterns.push({name:'上升通道',dir:'bull',strength:2,desc:'高低点同步上升，趋势健康'});
        if(hSlope<0&&lSlope<0&&Math.abs(hSlope-lSlope)/range<0.05)
            patterns.push({name:'下降通道',dir:'bear',strength:2,desc:'高低点同步下降，趋势下行'});
    }

    // 5) 支撑/阻力突破
    if(swingLows.length>=2){
        const support=Math.min(swingLows[swingLows.length-1].val,swingLows[swingLows.length-2].val);
        if(cur<support*0.99)
            patterns.push({name:'支撑跌破',dir:'bear',strength:2.5,desc:`关键支撑${FU(support)}已被跌破`});
    }
    if(swingHighs.length>=2){
        const resist=Math.max(swingHighs[swingHighs.length-1].val,swingHighs[swingHighs.length-2].val);
        if(cur>resist*1.01)
            patterns.push({name:'阻力突破',dir:'bull',strength:2.5,desc:`关键阻力${FU(resist)}已被突破`});
    }

    return patterns;
}

// ==== 专业级分析引擎 ====
// 核心思路：先判市场状态，再在正确方向上找入场机会
// 绝对不逆势给信号，除非有极强反转证据

function strictFilter(signals,candlePats,chartPats,adxData,rsiNow,hNow,hPrev,e7n,e25n,cur){
    const adx = adxData.adx;
    const pDI = adxData.plusDI;
    const mDI = adxData.minusDI;

    // ============ 第一步：判断市场状态 ============
    // 趋势行情 vs 震荡行情，策略完全不同
    const isTrending = adx > 20;
    const isStrongTrend = adx > 35;
    const trendDir = pDI > mDI ? 'bull' : 'bear';

    // EMA排列确认趋势
    const emaAlign = e7n > e25n ? 'bull' : 'bear';

    // ============ 第二步：各指标独立判断 ============
    const ind = {
        rsi: {dir:'neutral', weight:0, reason:''},
        macd: {dir:'neutral', weight:0, reason:''},
        ema: {dir:'neutral', weight:0, reason:''},
        candle: {dir:'neutral', weight:0, reason:''},
        chart: {dir:'neutral', weight:0, reason:''},
        adx: {dir:'neutral', weight:0, reason:''}
    };

    // --- RSI ---
    // RSI在趋势行情和震荡行情含义不同
    if(rsiNow !== null){
        if(isTrending){
            // 趋势行情：RSI超卖/超买可以被趋势消化，权重降低
            if(rsiNow < 25){ind.rsi={dir:'bull', weight:1.5, reason:'RSI深度超卖('+rsiNow.toFixed(0)+')，趋势中反弹机会'};}
            else if(rsiNow > 75){ind.rsi={dir:'bear', weight:1.5, reason:'RSI深度超买('+rsiNow.toFixed(0)+')，趋势中回调风险'};}
            else if(rsiNow < 35 && trendDir==='bull'){ind.rsi={dir:'bull', weight:1, reason:'RSI回调到低位('+rsiNow.toFixed(0)+')，上升趋势中逢低买'};}
            else if(rsiNow > 65 && trendDir==='bear'){ind.rsi={dir:'bear', weight:1, reason:'RSI反弹到高位('+rsiNow.toFixed(0)+')，下降趋势中逢高卖'};}
        } else {
            // 震荡行情：RSI超买超卖是核心信号
            if(rsiNow < 25){ind.rsi={dir:'bull', weight:2.5, reason:'RSI极度超卖('+rsiNow.toFixed(0)+')，震荡底部强反弹信号'};}
            else if(rsiNow < 30){ind.rsi={dir:'bull', weight:2, reason:'RSI超卖('+rsiNow.toFixed(0)+')，接近支撑区'};}
            else if(rsiNow > 75){ind.rsi={dir:'bear', weight:2.5, reason:'RSI极度超买('+rsiNow.toFixed(0)+')，震荡顶部强回调信号'};}
            else if(rsiNow > 70){ind.rsi={dir:'bear', weight:2, reason:'RSI超买('+rsiNow.toFixed(0)+')，接近阻力区'};}
        }
    }

    // --- MACD ---
    // 金叉死叉必须在零轴附近或零轴同侧才有意义
    if(hNow > 0 && hPrev <= 0){
        // 金叉
        const nearZero = Math.abs(hNow) < Math.abs(hPrev) * 2;
        ind.macd = {dir:'bull', weight: nearZero ? 2.5 : 1.5, reason: nearZero ? 'MACD零轴附近金叉，有效买入信号' : 'MACD金叉，但远离零轴需确认'};
    } else if(hNow < 0 && hPrev >= 0){
        // 死叉
        const nearZero = Math.abs(hNow) < Math.abs(hPrev) * 2;
        ind.macd = {dir:'bear', weight: nearZero ? 2.5 : 1.5, reason: nearZero ? 'MACD零轴附近死叉，有效卖出信号' : 'MACD死叉，但远离零轴需确认'};
    } else if(hNow > 0){
        // MACD在零轴上方
        if(hNow > hPrev){ind.macd={dir:'bull', weight:1, reason:'MACD多头加速，柱状图增长'};}
        else{ind.macd={dir:'bull', weight:0.5, reason:'MACD多头减速，注意顶背离'};}
    } else if(hNow < 0){
        // MACD在零轴下方
        if(hNow < hPrev){ind.macd={dir:'bear', weight:1, reason:'MACD空头加速，柱状图缩短'};}
        else{ind.macd={dir:'bear', weight:0.5, reason:'MACD空头减速，注意底背离'};}
    }

    // --- EMA ---
    // EMA排列是趋势的核心判断
    ind.ema = {dir: emaAlign, weight: isStrongTrend ? 2 : 1.5,
        reason: emaAlign==='bull' ? 'EMA多头排列(7>25)' : 'EMA空头排列(7<25)'};

    // --- ADX趋势确认 ---
    if(isStrongTrend){
        ind.adx = {dir: trendDir, weight: 2,
            reason: 'ADX='+adx.toFixed(0)+'强趋势，'+(trendDir==='bull'?'多头主导':'空头主导')};
    } else if(isTrending){
        ind.adx = {dir: trendDir, weight: 1,
            reason: 'ADX='+adx.toFixed(0)+'有趋势，方向'+(trendDir==='bull'?'偏多':'偏空')};
    }

    // --- K线形态 ---
    // 只取最强的形态，且必须和趋势方向一致才有高权重
    const bullCP = candlePats.filter(p=>p.dir==='bull').sort((a,b)=>b.strength-a.strength);
    const bearCP = candlePats.filter(p=>p.dir==='bear').sort((a,b)=>b.strength-a.strength);
    if(bullCP.length){
        const p = bullCP[0];
        const aligned = isTrending && trendDir==='bull';
        ind.candle = {dir:'bull', weight: aligned ? p.strength*0.8 : p.strength*0.4,
            reason: 'K线形态: '+p.name+(aligned?' (与趋势共振)':' (逆势需确认)')};
    }
    if(bearCP.length && (!bullCP.length || bearCP[0].strength > bullCP[0].strength)){
        const p = bearCP[0];
        const aligned = isTrending && trendDir==='bear';
        ind.candle = {dir:'bear', weight: aligned ? p.strength*0.8 : p.strength*0.4,
            reason: 'K线形态: '+p.name+(aligned?' (与趋势共振)':' (逆势需确认)')};
    }

    // --- 图表形态 ---
    const bullCH = chartPats.filter(p=>p.dir==='bull').sort((a,b)=>b.strength-a.strength);
    const bearCH = chartPats.filter(p=>p.dir==='bear').sort((a,b)=>b.strength-a.strength);
    if(bullCH.length){
        const p = bullCH[0];
        ind.chart = {dir:'bull', weight: p.strength*0.7, reason: '图表形态: '+p.name};
    }
    if(bearCH.length && (!bullCH.length || bearCH[0].strength > bullCH[0].strength)){
        const p = bearCH[0];
        ind.chart = {dir:'bear', weight: p.strength*0.7, reason: '图表形态: '+p.name};
    }

    // ============ 第三步：综合研判 ============
    let bullTotal=0, bearTotal=0;
    const bullReasons=[], bearReasons=[];

    Object.values(ind).forEach(v=>{
        if(v.dir==='bull'){bullTotal+=v.weight;if(v.reason)bullReasons.push(v.reason);}
        else if(v.dir==='bear'){bearTotal+=v.weight;if(v.reason)bearReasons.push(v.reason);}
    });

    // ============ 第四步：严格出结论 ============
    const diff = Math.abs(bullTotal - bearTotal);
    const total = bullTotal + bearTotal;

    let dir, label, confidence, reasons;

    // 信号太弱 → 观望
    if(total < 3){
        dir='neutral'; label='观望'; confidence='--';
        reasons=['信号强度不足，等待更多确认'];
    }
    // 多空严重矛盾 → 观望
    else if(diff < 1.5 && !isStrongTrend){
        dir='neutral'; label='观望'; confidence='--';
        reasons=['多空分歧明显，方向不明，等待突破'];
    }
    // 明确方向
    else if(bullTotal > bearTotal){
        // 趋势行情中顺势做多
        if(isStrongTrend && trendDir==='bull'){
            dir='bull';
            label = diff >= 5 ? '强烈看多' : '看多';
            confidence = diff >= 5 ? '高' : '中';
            reasons = bullReasons;
        }
        // 震荡行情中超卖反弹
        else if(!isTrending && rsiNow && rsiNow < 35){
            dir='bull'; label='看多(反弹)';
            confidence = diff >= 4 ? '高' : '中';
            reasons = bullReasons;
        }
        // 弱势多头
        else if(diff >= 3){
            dir='bull'; label='看多';
            confidence='中';
            reasons = bullReasons;
        } else {
            dir='neutral'; label='观望'; confidence='--';
            reasons=['多头略占优但不明显，等待确认'];
        }
    } else {
        // 趋势行情中顺势做空
        if(isStrongTrend && trendDir==='bear'){
            dir='bear';
            label = diff >= 5 ? '强烈看空' : '看空';
            confidence = diff >= 5 ? '高' : '中';
            reasons = bearReasons;
        }
        // 震荡行情中超买回调
        else if(!isTrending && rsiNow && rsiNow > 65){
            dir='bear'; label='看空(回调)';
            confidence = diff >= 4 ? '高' : '中';
            reasons = bearReasons;
        }
        // 弱势空头
        else if(diff >= 3){
            dir='bear'; label='看空';
            confidence='中';
            reasons = bearReasons;
        } else {
            dir='neutral'; label='观望'; confidence='--';
            reasons=['空头略占优但不明显，等待确认'];
        }
    }

    return {dir, label, confidence, reasons, bullScore:bullTotal, bearScore:bearTotal, marketState: isStrongTrend?(trendDir==='bull'?'强势上涨':'强势下跌') : isTrending?(trendDir==='bull'?'温和上涨':'温和下跌'):'震荡'};
}

// ---- API ----
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

// 全局限流闸门：一旦收到 429，接下来的请求先等它过去。
// 这能防止并发批量请求（比如几十枚币的K线）把一次限流放大成持续风暴。
let _rateLimitUntil=0;

// 静默重试 + 指数退避：429 与网络波动都尽量在内部消化掉，
// 最多尝试 3 次；全部失败才抛错，交由调用方的 catch 决定降级方式。
async function okx(path){
    const url=OKX+path;
    const wait=_rateLimitUntil-Date.now();
    if(wait>0)await sleep(wait);

    let lastErr=null;
    for(let i=0;i<3;i++){
        try{
            const r=await fetch(url);
            if(r.status===429){
                lastErr=new Error('API 429 (rate limit)');
                _rateLimitUntil=Date.now()+4000;
                if(i<2){await sleep(1500*(2**i));continue;}
                throw lastErr;
            }
            if(!r.ok)throw new Error('API '+r.status);
            const d=await r.json();
            if(d.code!=='0')throw new Error('OKX: '+d.msg);
            return d.data;
        }catch(e){
            lastErr=e;
            if(i<2)await sleep(800*(2**i));
        }
    }
    throw lastErr;
}

function getCache(sym,bar){const k=sym+'_'+bar;const e=CACHE[k];if(e&&Date.now()-e.t<CACHE_TTL)return e.d;return null;}
function setCache(sym,bar,data){const k=sym+'_'+bar;CACHE[k]={d:data,t:Date.now()};}

async function pfetch(items,fn,conc=8){const res=new Array(items.length);let idx=0;async function w(){while(idx<items.length){const i=idx++;try{res[i]=await fn(items[i],i);}catch{res[i]=null;}}}await Promise.all(Array.from({length:Math.min(conc,items.length)},()=>w()));return res;}

// ---- 价格定时刷新(10秒间隔，不重渲染DOM) ----
async function refreshPrices(){
    try{
        const tickers=await okx('/market/tickers?instType=SPOT');
        const map={};tickers.forEach(t=>{map[t.instId.replace('-USDT','')]=t;});
        const updates=[];
        for(const c of allData){
            const t=map[c.sym];if(!t)continue;
            const price=parseFloat(t.last);
            const chg=parseFloat(t.sodUtc8)?((price-parseFloat(t.sodUtc8))/parseFloat(t.sodUtc8))*100:c.chg24;
            const vol=parseFloat(t.volCcy24h)||parseFloat(t.vol24h)||c.vol24h;
            if(price<=0)continue;
            const old=c.cur;
            c.cur=price;c.chg24=chg;c.vol24h=vol;
            if(domReady&&old&&price!==old)updates.push({sym:c.sym,price,chg,vol,up:price>old});
        }
        if(domReady&&updates.length){
            requestAnimationFrame(()=>{
                for(const u of updates){
                    const pe=document.getElementById(`p_${u.sym}`),ce=document.getElementById(`c_${u.sym}`),ve=document.getElementById(`v_${u.sym}`);
                    if(pe){pe.textContent=FU(u.price);pe.style.color=u.up?'var(--g)':'var(--r)';}
                    if(ce){ce.textContent=FP(u.chg);ce.className=`card-chg ${u.chg>=0?'up':'dn'}`;}
                    if(ve)ve.textContent=FK(u.vol);
                }
                setTimeout(()=>{
                    for(const u of updates){const pe=document.getElementById(`p_${u.sym}`);if(pe)pe.style.color='';}
                },300);
            });
        }
        document.getElementById('vTime').textContent=new Date().toLocaleTimeString('zh-CN');
    }catch{}
}

// ---- 拉K线+分析 (分批加载，先显示热门币) ----
let tmapGlobal = {};

async function fetchCandles(){
    const btn=document.getElementById('btnRefresh');
    btn.disabled=true;btn.textContent='加载中...';
    showProgress('连接OKX...',5);

    try{
        const tf=TF_CONFIG[curTF];
        showProgress('获取行情...',10);
        const tickers=await okx('/market/tickers?instType=SPOT');
        tmapGlobal={};tickers.forEach(t=>{tmapGlobal[t.instId.replace('-USDT','')]=t;});

        // 按24h成交额排序，优先加载热门币
        const valid=COINS.filter(s=>tmapGlobal[s])
            .sort((a,b)=>{
                const va=parseFloat(tmapGlobal[a].volCcy24h)||0;
                const vb=parseFloat(tmapGlobal[b].volCcy24h)||0;
                return vb-va;
            });

        const FIRST_BATCH = 60;
        const first = valid.slice(0, FIRST_BATCH);
        const rest = valid.slice(FIRST_BATCH);

        showProgress(`获取${tf.indLabel}K线(前${FIRST_BATCH})...`,20);
        const results1 = await pfetch(first, async(sym,i)=>{
            const cached=getCache(sym,tf.bar);
            if(cached)return{sym,...cached};
            const data=await okx(`/market/candles?instId=${sym}-USDT&bar=${tf.bar}&limit=${tf.limit}`);
            const sorted=data.reverse();
            const r={candles:sorted.map(k=>({t:parseInt(k[0]),o:parseFloat(k[1]),h:parseFloat(k[2]),l:parseFloat(k[3]),c:parseFloat(k[4]),v:parseFloat(k[5])})),prices:sorted.map(k=>parseFloat(k[4])),highs:sorted.map(k=>parseFloat(k[2])),lows:sorted.map(k=>parseFloat(k[3])),volumes:sorted.map(k=>parseFloat(k[5]))};
            setCache(sym,tf.bar,r);
            showProgress(`加载 ${sym} (${i+1}/${first.length})...`,20+(i/first.length)*60);
            return{sym,...r};
        }, 10);

        // 构建第一批数据并渲染
        showProgress('渲染...',85);
        allData=[];
        buildData(results1, tmapGlobal);
        sortData();
        render();
        showProgress(`已加载 ${allData.length} 个币种`,100);
        setTimeout(hideProgress,1000);
        document.getElementById('vTime').textContent=new Date().toLocaleTimeString('zh-CN');

        // ---- 第二批：后台静默加载 ----
        if(rest.length>0){
            pfetch(rest, async(sym)=>{
                const cached=getCache(sym,tf.bar);
                if(cached)return{sym,...cached};
                try{
                    const data=await okx(`/market/candles?instId=${sym}-USDT&bar=${tf.bar}&limit=${tf.limit}`);
                    const sorted=data.reverse();
                    const r={candles:sorted.map(k=>({t:parseInt(k[0]),o:parseFloat(k[1]),h:parseFloat(k[2]),l:parseFloat(k[3]),c:parseFloat(k[4]),v:parseFloat(k[5])})),prices:sorted.map(k=>parseFloat(k[4])),highs:sorted.map(k=>parseFloat(k[2])),lows:sorted.map(k=>parseFloat(k[3])),volumes:sorted.map(k=>parseFloat(k[5]))};
                    setCache(sym,tf.bar,r);
                    return{sym,...r};
                }catch{return null;}
            }, 8).then(results2=>{
                buildData(results2, tmapGlobal);
                sortData();
                render();
            });
        }

    }catch(e){
        console.error('Fetch error:', e);
        if(allData.length){
            // 已有数据：保留当前看板不闪红、不清空，等一会儿自动重试
            showProgress('刷新失败，'+(RETRY_DELAY_MS/1000)+'秒后自动重试...',100);
            setTimeout(hideProgress,2500);
            setTimeout(()=>{domReady=false;fetchCandles();},RETRY_DELAY_MS);
        }else{
            // 首次加载失败：没有数据可留，明确提示并交由用户手动重试
            showProgress('加载失败: '+e.message+'（检查网络后点击刷新）',0);
        }
    }
    finally{btn.disabled=false;btn.textContent='刷新';}
}

function buildData(results, tmap){
    for(const cr of results){
        if(!cr||!cr.prices||cr.prices.length<30)continue;
        const t=tmap[cr.sym];if(!t)continue;
        // 去重
        if(allData.find(x=>x.sym===cr.sym))continue;
        const price=parseFloat(t.last);
        const vol=parseFloat(t.volCcy24h)||parseFloat(t.vol24h)||0;
        const chg=parseFloat(t.sodUtc8)?((price-parseFloat(t.sodUtc8))/parseFloat(t.sodUtc8))*100:0;
        const h24=parseFloat(t.high24h)||0,l24=parseFloat(t.low24h)||0;
        const a=analyze(cr.sym,cr.prices,cr.candles||[],price,vol,chg,h24,l24);
        if(a)allData.push(a);
    }
}

// ==== 精准进场引擎 ====
// 根据市场状态和判定方向，给出最合理的进场方案
function calcEntries({cur,rsiNow,hNow,hPrev,e7n,e25n,e99n,bbU,bbM,bbL,score,p,verdict,adxData}){
    const entries = [];
    if(!p||p.length<20)return entries;

    // ATR(14) - 动态止损止盈的核心
    let atr = 0;
    const trs = [];
    for(let i=1;i<p.length;i++) trs.push(Math.abs(p[i]-p[i-1]));
    atr = trs.slice(-14).reduce((a,b)=>a+b)/14;
    if(atr===0) atr = cur*0.02;

    // 关键价位
    const recent = p.slice(-30);
    const swingHi = Math.max(...recent);
    const swingLo = Math.min(...recent);
    const pp = (swingHi + swingLo + cur) / 3;

    // 支撑阻力
    const supports = [2*pp-swingHi, bbL, Math.min(e7n,e25n), e99n, swingLo].filter(x=>x&&x<cur*0.995).sort((a,b)=>b-a);
    const resists = [2*pp-swingLo, bbU, Math.max(e7n,e25n), e99n, swingHi].filter(x=>x&&x>cur*1.005).sort((a,b)=>a-b);

    const s1 = supports[0] || cur*0.97;
    const s2 = supports[1] || cur*0.94;
    const r1 = resists[0] || cur*1.03;
    const r2 = resists[1] || cur*1.06;

    const adx = adxData ? adxData.adx : 0;
    const isTrending = adx > 20;
    const isStrongTrend = adx > 35;
    const marketState = verdict.marketState || '';

    // ==== 根据方向出方案 ====
    const dir = verdict.dir;
    const conf = verdict.confidence;

    if(dir === 'bull'){
        // 方案1：当前价直接入场（趋势明确时）
        if(isTrending || conf==='高'){
            entries.push({
                type:'做多 · 当前价入场',
                dir:'bull',
                entry:FU(cur),
                sl:FU(cur - atr*1.5),
                tp1:FU(cur + atr*2),
                tp2:FU(cur + atr*3.5),
                rr:'1.3:1',
                reason:`${marketState}，趋势明确直接入场`,
                confidence: isStrongTrend?'高':'中'
            });
        }

        // 方案2：回调到支撑入场（更优价格）
        entries.push({
            type:'做多 · 回调接多',
            dir:'bull',
            entry:FU(s1),
            sl:FU(s2 * 0.99),
            tp1:FU(cur),
            tp2:FU(r1),
            rr:((cur-s1)/(s1-s2*0.99)).toFixed(1)+':1',
            reason:`等回调到支撑${FU(s1)}入场，更低风险更高回报`,
            confidence:'中'
        });

        // 方案3：RSI超卖反弹
        if(rsiNow!==null && rsiNow < 30){
            entries.push({
                type:'做多 · 超卖反弹',
                dir:'bull',
                entry:FU(cur),
                sl:FU(cur - atr),
                tp1:FU(cur + atr*1.5),
                tp2:FU(cur + atr*3),
                rr:'1.5:1',
                reason:`RSI超卖${rsiNow.toFixed(0)}，反弹概率大，轻仓试多`,
                confidence:'高'
            });
        }
    }

    if(dir === 'bear'){
        // 方案1：当前价直接入场
        if(isTrending || conf==='高'){
            entries.push({
                type:'做空 · 当前价入场',
                dir:'bear',
                entry:FU(cur),
                sl:FU(cur + atr*1.5),
                tp1:FU(cur - atr*2),
                tp2:FU(cur - atr*3.5),
                rr:'1.3:1',
                reason:`${marketState}，趋势明确直接入场`,
                confidence: isStrongTrend?'高':'中'
            });
        }

        // 方案2：反弹到阻力入场
        entries.push({
            type:'做空 · 反弹做空',
            dir:'bear',
            entry:FU(r1),
            sl:FU(r2 * 1.01),
            tp1:FU(cur),
            tp2:FU(s1),
            rr:((r1-cur)/(r2*1.01-r1)).toFixed(1)+':1',
            reason:`等反弹到阻力${FU(r1)}入场，更好风险回报`,
            confidence:'中'
        });

        // 方案3：RSI超买回调
        if(rsiNow!==null && rsiNow > 70){
            entries.push({
                type:'做空 · 超买回调',
                dir:'bear',
                entry:FU(cur),
                sl:FU(cur + atr),
                tp1:FU(cur - atr*1.5),
                tp2:FU(cur - atr*3),
                rr:'1.5:1',
                reason:`RSI超买${rsiNow.toFixed(0)}，回调概率大，轻仓试空`,
                confidence:'高'
            });
        }
    }

    if(dir === 'neutral'){
        // 观望时给出关注的突破位
        entries.push({
            type:'观望 · 关注突破',
            dir:'neutral',
            entry:FU(r1)+' 或 '+FU(s1),
            sl:'--',
            tp1:'--',
            tp2:'--',
            rr:'--',
            reason:`等待价格突破${FU(r1)}做多 或 跌破${FU(s1)}做空`,
            confidence:'--'
        });
    }

    return entries;
}

function analyze(sym,prices,candles,livePrice,vol24h,chg24,h24,l24){
    const p=[...prices];
    if(livePrice&&livePrice!==p[p.length-1])p.push(livePrice);
    const cur=p[p.length-1];
    const e7=ema(p,7),e25=ema(p,25),e99=p.length>=99?ema(p,99):null;
    const e7n=e7[e7.length-1],e25n=e25[e25.length-1],e99n=e99?e99[e99.length-1]:null;
    const rsiA=rsi(p),rsiNow=rsiA.length?rsiA[rsiA.length-1]:null;
    const{ml,sl,hist}=macd(p);
    const macdNow=ml[ml.length-1],sigNow=sl[sl.length-1],hNow=hist[hist.length-1],hPrev=hist.length>1?hist[hist.length-2]:0;
    const bb=boll(p);const bbU=bb.u.length?bb.u[bb.u.length-1]:null,bbM=bb.m.length?bb.m[bb.m.length-1]:null,bbL=bb.lo.length?bb.lo[bb.lo.length-1]:null;
    const p7=p.slice(-7),p30=p.slice(-30);
    const h7=Math.max(...p7),l7=Math.min(...p7),h30=Math.max(...p30),l30=Math.min(...p30);
    const c7=p.length>=8?((cur-p[p.length-8])/p[p.length-8])*100:0;
    if(chg24===0&&p.length>=2)chg24=((cur-p[p.length-2])/p[p.length-2])*100;

    const tfLabel=TF_CONFIG[curTF].indLabel;
    const sigs=[];
    if(rsiNow!==null){
        if(rsiNow<20)sigs.push({t:`${tfLabel}RSI极度超卖`,d:'up',c:'buy',w:2.5});
        else if(rsiNow<30)sigs.push({t:`${tfLabel}RSI超卖`,d:'up',c:'buy',w:1.5});
        else if(rsiNow<40)sigs.push({t:`${tfLabel}RSI偏低`,d:'up',c:'info',w:.5});
        else if(rsiNow>80)sigs.push({t:`${tfLabel}RSI极度超买`,d:'dn',c:'sell',w:2.5});
        else if(rsiNow>70)sigs.push({t:`${tfLabel}RSI超买`,d:'dn',c:'sell',w:1.5});
        else if(rsiNow>60)sigs.push({t:`${tfLabel}RSI偏高`,d:'dn',c:'warn',w:.5});
        else sigs.push({t:`${tfLabel}RSI中性`,d:'flat',c:'info',w:0});
    }
    if(hNow>0&&hPrev<=0)sigs.push({t:`${tfLabel}MACD金叉`,d:'up',c:'buy',w:2});
    else if(hNow<0&&hPrev>=0)sigs.push({t:`${tfLabel}MACD死叉`,d:'dn',c:'sell',w:2});
    else if(hNow>0&&hNow>hPrev)sigs.push({t:`${tfLabel}MACD多头增强`,d:'up',c:'buy',w:1});
    else if(hNow<0&&hNow<hPrev)sigs.push({t:`${tfLabel}MACD空头增强`,d:'dn',c:'sell',w:1});
    else if(hNow>hPrev)sigs.push({t:`${tfLabel}MACD空转多`,d:'up',c:'info',w:.5});
    else sigs.push({t:`${tfLabel}MACD多转空`,d:'dn',c:'warn',w:.5});
    if(e7n>e25n)sigs.push({t:`${tfLabel}EMA多头排列`,d:'up',c:'buy',w:1});
    else sigs.push({t:`${tfLabel}EMA空头排列`,d:'dn',c:'sell',w:1});
    if(e99n){if(cur>e99n&&e7n>e99n)sigs.push({t:`${tfLabel}站上EMA99`,d:'up',c:'buy',w:1});else if(cur<e99n)sigs.push({t:`${tfLabel}跌破EMA99`,d:'dn',c:'sell',w:1});}
    if(bbL&&cur<bbL)sigs.push({t:`${tfLabel}破布林下轨`,d:'up',c:'buy',w:1.5});
    else if(bbU&&cur>bbU)sigs.push({t:`${tfLabel}破布林上轨`,d:'dn',c:'sell',w:1.5});
    else if(bbM&&cur>bbM)sigs.push({t:`${tfLabel}布林上半区`,d:'up',c:'info',w:.2});
    else sigs.push({t:`${tfLabel}布林下半区`,d:'dn',c:'info',w:.2});

    let score=50;sigs.forEach(s=>{if(s.c==='buy')score+=s.w*6;else if(s.c==='sell')score-=s.w*6;});
    score=Math.max(0,Math.min(100,score));

    // ---- ADX趋势强度 ----
    const adxData = adx(candles.map(k=>k.h), candles.map(k=>k.l), candles.map(k=>k.c));

    // ---- K线形态 ----
    const candlePats = detectCandlePatterns(candles);

    // ---- 图表形态 ----
    const chartPats = detectChartPatterns(p);

    // ---- 严格信号过滤：只给一个方向 ----
    const verdict = strictFilter(sigs, candlePats, chartPats, adxData, rsiNow, hNow, hPrev, e7n, e25n, cur);

    let dir, cls;
    if(verdict.dir==='bull'){dir=verdict.label;cls='bull';}
    else if(verdict.dir==='bear'){dir=verdict.label;cls='bear';}
    else{dir='观望';cls='neut';}

    // 评分
    score = verdict.dir==='neutral'?50:(verdict.dir==='bull'?50+verdict.bullScore*5:50-verdict.bearScore*5);
    score=Math.max(0,Math.min(100,score));

    // ---- 精准进场点位 ----
    const entries = calcEntries({cur,rsiNow,hNow,hPrev,e7n,e25n,e99n,bbU,bbM,bbL,score,p,verdict,adxData});

    return{sym,cur,chg24,c7,e7n,e25n,e99n,rsiNow,macdNow,sigNow,hNow,hPrev,bbU,bbM,bbL,vol24h,h24,l24,h7,l7,h30,l30,sigs,score,dir,cls,candles,entries,adxData,candlePats,chartPats,verdict};
}

// ---- 渲染(虚拟滚动优化) ----
let renderRAF = null;
function render(){
    if(renderRAF)cancelAnimationFrame(renderRAF);
    renderRAF=requestAnimationFrame(fullRender);
}
function fullRender(){
    const grid=document.getElementById('grid');
    let list=allData;
    if(curFilter==='bull')list=list.filter(c=>c.cls==='bull');
    else if(curFilter==='bear')list=list.filter(c=>c.cls==='bear');
    else if(curFilter==='oversold')list=list.filter(c=>c.rsiNow!==null&&c.rsiNow<30);
    else if(curFilter==='overbought')list=list.filter(c=>c.rsiNow!==null&&c.rsiNow>70);
    else if(curFilter==='golden')list=list.filter(c=>c.hNow>0&&c.hPrev<=0);
    else if(curFilter==='dead')list=list.filter(c=>c.hNow<0&&c.hPrev>=0);
    if(searchQuery){const q=searchQuery.toUpperCase();list=list.filter(c=>c.sym.includes(q));}
    if(!list.length){grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--txt2)">暂无数据</div>';domReady=false;return;}

    const tfLabel=TF_CONFIG[curTF].indLabel;
    const frag=document.createDocumentFragment();
    const div=document.createElement('div');
    div.innerHTML=list.map((c,i)=>{
        const cc=c.chg24>=0?'up':'dn';
        let rsiDir='→',rsiColor='var(--txt)';
        if(c.rsiNow!==null){if(c.rsiNow<30){rsiDir='↑超卖';rsiColor='var(--g)';}else if(c.rsiNow>70){rsiDir='↓超买';rsiColor='var(--r)';}else if(c.rsiNow>50){rsiDir='↓偏高';rsiColor='var(--y)';}else{rsiDir='↑偏低';rsiColor='var(--g)';}}
        let macdDir,macdColor;
        if(c.hNow>0&&c.hPrev<=0){macdDir='金叉↑';macdColor='var(--g)';}
        else if(c.hNow<0&&c.hPrev>=0){macdDir='死叉↓';macdColor='var(--r)';}
        else if(c.hNow>0){macdDir=c.hNow>c.hPrev?'多头增强↑':'多头减弱→';macdColor=c.hNow>c.hPrev?'var(--g)':'var(--y)';}
        else{macdDir=c.hNow<c.hPrev?'空头增强↓':'空头减弱→';macdColor=c.hNow<c.hPrev?'var(--r)':'var(--y)';}
        let bbDir,bbColor;
        if(c.bbL&&c.cur<c.bbL){bbDir='超卖↑';bbColor='var(--g)';}
        else if(c.bbU&&c.cur>c.bbU){bbDir='超买↓';bbColor='var(--r)';}
        else if(c.bbM&&c.cur>c.bbM){bbDir='上半区→';bbColor='var(--y)';}
        else{bbDir='下半区↑';bbColor='var(--g)';}
        const sc=c.score>=65?'var(--g)':c.score>=45?'var(--y)':'var(--r)';
        const adxV=c.adxData?c.adxData.adx:0;
        const adxColor=adxV>40?'var(--g)':adxV>20?'var(--y)':'var(--txt3)';
        const adxTrend=c.adxData&&c.adxData.plusDI>c.adxData.minusDI?'↑':'↓';
        const ms=c.verdict?c.verdict.marketState:'震荡';
        const vConf=c.verdict?c.verdict.confidence:'--';
        const confColor=vConf==='高'?'var(--g)':vConf==='中'?'var(--y)':'var(--txt3)';
        const topPat=c.candlePats&&c.candlePats.length?c.candlePats[0]:null;
        const patName=topPat?topPat.name.slice(0,4):'无';
        const patColor=topPat?(topPat.dir==='bull'?'var(--g)':'var(--r)'):'var(--txt3)';

        return`<div class="card ${c.cls}" onclick="showDetail('${c.sym}')">
            <div class="card-top">
                <div class="card-left"><div class="card-name">${c.sym}</div><span class="badge ${c.cls}">${c.dir}</span></div>
                <div class="card-price">
                    <div class="card-cur" id="p_${c.sym}">${FU(c.cur)}</div>
                    <div class="card-chg ${cc}" id="c_${c.sym}">${FP(c.chg24)}</div>
                </div>
            </div>
            <div class="ind-row">
                <div class="ind"><div class="ind-l">${tfLabel}RSI</div><div class="ind-v" style="color:${rsiColor}">${c.rsiNow!==null?F(c.rsiNow,1):'--'}</div><div class="ind-s" style="color:${rsiColor}">${rsiDir}</div></div>
                <div class="ind"><div class="ind-l">${tfLabel}MACD</div><div class="ind-v" style="color:${macdColor}">${macdDir}</div><div class="ind-s">${c.hNow>0?'+':''}${F(c.hNow,3)}</div></div>
                <div class="ind"><div class="ind-l">趋势</div><div class="ind-v" style="color:${adxColor}">${ms}</div><div class="ind-s">ADX:${F(adxV,0)}${adxTrend}</div></div>
                <div class="ind"><div class="ind-l">形态</div><div class="ind-v" style="color:${patColor}">${patName}</div><div class="ind-s">置信<b style="color:${confColor}">${vConf}</b></div></div>
            </div>
            <div class="sigs">${c.verdict.reasons.slice(0,3).map(r=>`<span class="sig ${c.verdict.dir==='bull'?'buy':c.verdict.dir==='bear'?'sell':'info'}">${r}</span>`).join('')}</div>
            <div class="score-row"><span class="score-lbl">评分</span><div class="score-track"><div class="score-fill" style="width:${c.score}%;background:${sc}"></div></div><span class="score-val" style="color:${sc}">${c.score.toFixed(0)}</span></div>
            <div class="card-bot"><span>24h:${FU(c.l24)}~${FU(c.h24)}</span><span>7d:${FP(c.c7)}</span><span id="v_${c.sym}">${FK(c.vol24h)}</span></div>
        </div>`;
    }).join('');
    while(grid.firstChild)grid.removeChild(grid.firstChild);
    while(div.firstChild)frag.appendChild(div.firstChild);
    grid.appendChild(frag);
    domReady=true;
}

// ---- 时间段切换 ----
function switchTF(tf){
    if(tf===curTF)return;
    curTF=tf;
    document.getElementById('tfShort').classList.toggle('active',tf==='short');
    document.getElementById('tfLong').classList.toggle('active',tf==='long');
    document.getElementById('tfInfo').textContent='当前: '+TF_CONFIG[tf].label;
    domReady=false;
    fetchCandles();
}

// ---- K线图渲染(双Canvas: 底层K线 + 顶层十字线) ----
let klineLayout = null; // 保存布局参数供overlay使用

function drawKline(canvas, candles){
    if(!candles||candles.length<5)return;
    const ctx=canvas.getContext('2d');
    const dpr=window.devicePixelRatio||1;
    const W=canvas.clientWidth, H=canvas.clientHeight;
    canvas.width=W*dpr; canvas.height=H*dpr;
    ctx.scale(dpr,dpr);

    const pad={t:10,r:60,b:24,l:8};
    const cw=W-pad.l-pad.r, ch=H-pad.t-pad.b;
    const maxBars=Math.min(candles.length, Math.floor(cw/8));
    const data=candles.slice(-maxBars);
    const barW=Math.max(2, (cw/data.length)*0.7);
    const gap=cw/data.length;

    let hi=-Infinity,lo=Infinity;
    data.forEach(k=>{if(k.h>hi)hi=k.h;if(k.l<lo)lo=k.l;});
    const range=hi-lo||1;const padP=range*0.05;hi+=padP;lo-=padP;
    const yScale=ch/(hi-lo);
    const toY=p=>pad.t+(hi-p)*yScale;

    // 保存布局给overlay用
    klineLayout={W,H,pad,cw,ch,data,barW,gap,hi,lo,yScale,toY};

    // 网格
    ctx.strokeStyle='#1a2235';ctx.lineWidth=0.5;
    for(let i=0;i<=4;i++){
        const y=pad.t+ch*i/4;
        ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke();
        ctx.fillStyle='#556677';ctx.font='10px sans-serif';ctx.textAlign='left';
        ctx.fillText(FU(hi-(hi-lo)*i/4),W-pad.r+4,y+3);
    }

    // 时间标签
    ctx.fillStyle='#556677';ctx.font='10px sans-serif';ctx.textAlign='center';
    const step=Math.max(1,Math.floor(data.length/6));
    for(let i=0;i<data.length;i+=step){
        const x=pad.l+i*gap+gap/2;
        const d=new Date(data[i].t);
        const label=TF_CONFIG[curTF].bar==='1D'?`${d.getMonth()+1}/${d.getDate()}`:`${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:00`;
        ctx.fillText(label,x,H-4);
    }

    // K线
    data.forEach((k,i)=>{
        const x=pad.l+i*gap+gap/2;
        const isUp=k.c>=k.o;
        const color=isUp?'#00d26a':'#ff4757';
        ctx.strokeStyle=color;ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(x,toY(k.h));ctx.lineTo(x,toY(k.l));ctx.stroke();
        const bodyTop=toY(Math.max(k.o,k.c));
        const bodyBot=toY(Math.min(k.o,k.c));
        const bodyH=Math.max(1,bodyBot-bodyTop);
        if(isUp){ctx.fillStyle='#0a0e14';ctx.fillRect(x-barW/2,bodyTop,barW,bodyH);ctx.strokeStyle=color;ctx.strokeRect(x-barW/2,bodyTop,barW,bodyH);}
        else{ctx.fillStyle=color;ctx.fillRect(x-barW/2,bodyTop,barW,bodyH);}
    });
}

function setupCrosshair(overlay, candles, sym){
    const ctx=overlay.getContext('2d');
    const dpr=window.devicePixelRatio||1;
    const tooltip=document.getElementById('klineTooltip');

    function clearOverlay(){
        const W=overlay.clientWidth, H=overlay.clientHeight;
        overlay.width=W*dpr; overlay.height=H*dpr;
        ctx.setTransform(dpr,0,0,dpr,0,0);
        ctx.clearRect(0,0,W,H);
    }

    overlay.onmousemove=e=>{
        if(!klineLayout)return;
        const{pad,gap,data,ch}=klineLayout;
        const rect=overlay.getBoundingClientRect();
        const mx=e.clientX-rect.left;
        const my=e.clientY-rect.top;
        const idx=Math.floor((mx-pad.l)/gap);

        clearOverlay();

        if(idx>=0&&idx<data.length){
            const k=data[idx];
            const isUp=k.c>=k.o;
            const kx=pad.l+idx*gap+gap/2;

            // 竖线
            ctx.strokeStyle='rgba(255,255,255,0.5)';ctx.lineWidth=1;ctx.setLineDash([4,3]);
            ctx.beginPath();ctx.moveTo(kx,pad.t);ctx.lineTo(kx,pad.t+ch);ctx.stroke();

            // 横线
            ctx.beginPath();ctx.moveTo(pad.l,my);ctx.lineTo(klineLayout.W-klineLayout.pad.r,my);ctx.stroke();
            ctx.setLineDash([]);

            // tooltip
            tooltip.style.display='block';
            tooltip.style.left=Math.min(mx+10,klineLayout.W-180)+'px';
            tooltip.style.top='36px';
            tooltip.innerHTML=`<span style="color:var(--txt2)">时间:</span> ${new Date(k.t).toLocaleString('zh-CN')}<br><span style="color:var(--txt2)">开:</span> ${FU(k.o)} <span style="color:var(--txt2)">高:</span> ${FU(k.h)}<br><span style="color:var(--txt2)">低:</span> ${FU(k.l)} <span style="color:${isUp?'var(--g)':'var(--r)'}">收:</span> ${FU(k.c)}<br><span style="color:var(--txt2)">量:</span> ${FK(k.v)}`;
        }
    };

    overlay.onmouseleave=()=>{
        clearOverlay();
        if(tooltip)tooltip.style.display='none';
    };
}

// ---- K线图周期切换 ----
let klineTF = '1H';
let klineData = {};

async function loadKlineChart(sym, bar){
    const canvas=document.getElementById('klineCanvas');
    const overlay=document.getElementById('klineOverlay');
    const status=document.getElementById('klineStatus');
    if(!canvas)return;

    status.textContent='加载K线...';
    try{
        const key=sym+'_'+bar;
        let data=klineData[key];
        if(!data){
            const raw=await okx(`/market/candles?instId=${sym}-USDT&bar=${bar}&limit=200`);
            data=raw.reverse().map(k=>({t:parseInt(k[0]),o:parseFloat(k[1]),h:parseFloat(k[2]),l:parseFloat(k[3]),c:parseFloat(k[4]),v:parseFloat(k[5])}));
            klineData[key]=data;
        }
        status.textContent=`${bar} · ${data.length}根K线`;
        drawKline(canvas, data);
        if(overlay) setupCrosshair(overlay, data, sym);
    }catch(e){
        status.textContent='加载失败: '+e.message;
    }
}

function switchKlineTF(sym, bar, btn){
    klineTF=bar;
    document.querySelectorAll('.kline-tf').forEach(b=>b.classList.remove('active'));
    if(btn)btn.classList.add('active');
    loadKlineChart(sym, bar);
}

// ---- 详情弹窗(含K线) ----
function showDetail(sym){
    const c=allData.find(x=>x.sym===sym);if(!c)return;
    const m=document.getElementById('modalBg'),b=document.getElementById('modalBody');

    let advice='';
    if(c.score>=65){advice=`<span style="color:var(--g)">【看多】</span> `;if(c.rsiNow<40)advice+=`RSI=${F(c.rsiNow,1)}低位。`;if(c.hNow>c.hPrev)advice+=`MACD增强。`;advice+=`<br>建议：轻仓试多，止损${FU(c.l7)}，目标EMA25 ${FU(c.e25n)}。`;}
    else if(c.score<=40){advice=`<span style="color:var(--r)">【看空】</span> `;if(c.rsiNow>60)advice+=`RSI=${F(c.rsiNow,1)}偏高。`;advice+=`<br>建议：不追多，等超卖。`;}
    else{advice=`<span style="color:var(--y)">【中性】</span> 多空分歧，观望。`;}

    const tfLabel=TF_CONFIG[curTF].indLabel;
    const rsiD=c.rsiNow!==null?(c.rsiNow<30?'超卖↑':c.rsiNow>70?'超买↓':c.rsiNow>50?'偏高↓':'偏低↑'):'--';
    const macdD=c.hNow>0&&c.hPrev<=0?'金叉↑':c.hNow<0&&c.hPrev>=0?'死叉↓':c.hNow>0?(c.hNow>c.hPrev?'多头增强↑':'减弱→'):(c.hNow<c.hPrev?'空头增强↓':'减弱→');
    const emaD=c.e7n>c.e25n?(c.e99n&&c.cur>c.e99n?'多头+站上EMA99↑':'多头排列↑'):(c.e99n&&c.cur<c.e99n?'空头+跌破EMA99↓':'空头排列↓');
    const bbD=c.bbL&&c.cur<c.bbL?'破下轨↑':c.bbU&&c.cur>c.bbU?'破上轨↓':c.bbM&&c.cur>c.bbM?'上半→':'下半↑';

    b.innerHTML=`
        <div class="m-title">${c.sym}/USDT <span class="badge ${c.cls}">${c.dir}</span> <span style="font-size:12px;color:var(--txt2);margin-left:8px;">市场: ${c.verdict.marketState}</span></div>

        <div class="kline-wrap">
            <div class="kline-header">
                <span class="sym">${c.sym}</span>
                <span class="price-now" style="color:${c.chg24>=0?'var(--g)':'var(--r)'}">${FU(c.cur)} ${FP(c.chg24)}</span>
                <div class="kline-tf-pills">
                    <button class="kline-tf" onclick="switchKlineTF('${c.sym}','1m',this)">1分</button>
                    <button class="kline-tf" onclick="switchKlineTF('${c.sym}','5m',this)">5分</button>
                    <button class="kline-tf" onclick="switchKlineTF('${c.sym}','15m',this)">15分</button>
                    <button class="kline-tf" onclick="switchKlineTF('${c.sym}','1H',this)">1时</button>
                    <button class="kline-tf" onclick="switchKlineTF('${c.sym}','4H',this)">4时</button>
                    <button class="kline-tf" onclick="switchKlineTF('${c.sym}','1D',this)">日线</button>
                    <button class="kline-tf" onclick="switchKlineTF('${c.sym}','1W',this)">周线</button>
                </div>
            </div>
            <div style="position:relative">
                <canvas id="klineCanvas" class="kline" width="860" height="320"></canvas>
                <canvas id="klineOverlay" class="kline" width="860" height="320" style="position:absolute;top:0;left:0;pointer-events:auto;cursor:crosshair;"></canvas>
                <div id="klineTooltip" style="display:none;position:absolute;top:36px;left:10px;background:rgba(17,23,32,.92);border:1px solid var(--brd);border-radius:6px;padding:8px 10px;font-size:11px;line-height:1.6;pointer-events:none;z-index:5;white-space:nowrap;"></div>
            </div>
            <div class="kline-ohlc" id="klineStatus">点击周期按钮加载K线</div>
        </div>

        <div class="m-sec"><h3>价格</h3><div class="m-grid">
            <div class="m-item"><div class="ml">当前</div><div class="mv">${FU(c.cur)}</div></div>
            <div class="m-item"><div class="ml">24h</div><div class="mv" style="color:${c.chg24>=0?'var(--g)':'var(--r)'}">${FP(c.chg24)}</div></div>
            <div class="m-item"><div class="ml">7d</div><div class="mv" style="color:${c.c7>=0?'var(--g)':'var(--r)'}">${FP(c.c7)}</div></div>
            <div class="m-item"><div class="ml">评分</div><div class="mv" style="color:${c.score>=65?'var(--g)':c.score>=45?'var(--y)':'var(--r)'}">${c.score.toFixed(0)} ${c.dir}</div></div>
        </div></div>

        <div class="m-sec"><h3>${tfLabel}指标</h3><div class="m-grid">
            <div class="m-item"><div class="ml">RSI(14)</div><div class="mv">${c.rsiNow!==null?F(c.rsiNow,1):'--'}</div><div class="ind-s" style="margin-top:4px">${rsiD}</div></div>
            <div class="m-item"><div class="ml">MACD</div><div class="mv">${F(c.macdNow,2)}</div><div class="ind-s" style="margin-top:4px">${macdD}</div></div>
            <div class="m-item"><div class="ml">MACD柱</div><div class="mv" style="color:${c.hNow>0?'var(--g)':'var(--r)'}">${c.hNow>0?'+':''}${F(c.hNow,4)}</div></div>
            <div class="m-item"><div class="ml">Signal</div><div class="mv">${F(c.sigNow,2)}</div></div>
            <div class="m-item"><div class="ml">EMA7/25/99</div><div class="mv">${FU(c.e7n)} / ${FU(c.e25n)} / ${c.e99n?FU(c.e99n):'N/A'}</div></div>
            <div class="m-item"><div class="ml">EMA趋势</div><div class="mv">${emaD}</div></div>
            <div class="m-item"><div class="ml">BOLL</div><div class="mv">${FU(c.bbL)} | ${FU(c.bbM)} | ${FU(c.bbU)}</div></div>
            <div class="m-item"><div class="ml">BOLL方向</div><div class="mv">${bbD}</div></div>
        </div></div>

        <div class="m-sec"><h3>区间</h3><div class="m-grid">
            <div class="m-item"><div class="ml">24h</div><div class="mv">${FU(c.l24)}~${FU(c.h24)}</div></div>
            <div class="m-item"><div class="ml">7d</div><div class="mv">${FU(c.l7)}~${FU(c.h7)}</div></div>
            <div class="m-item"><div class="ml">30d</div><div class="mv">${FU(c.l30)}~${FU(c.h30)}</div></div>
            <div class="m-item"><div class="ml">成交量</div><div class="mv">${FK(c.vol24h)}</div></div>
        </div></div>

        <div class="m-sec"><h3>信号</h3><div class="sigs" style="margin-top:0">${c.sigs.map(s=>`<span class="sig ${s.c}">${s.t} ${s.d==='up'?'↑':s.d==='dn'?'↓':'→'}</span>`).join('')}</div></div>
        <div class="m-sec"><h3>趋势强度(ADX)</h3><div class="m-grid">
            <div class="m-item"><div class="ml">ADX值</div><div class="mv" style="color:${c.adxData.adx>40?'var(--g)':c.adxData.adx>25?'var(--y)':'var(--txt3)'}">${F(c.adxData.adx,1)}</div></div>
            <div class="m-item"><div class="ml">趋势判断</div><div class="mv">${c.adxData.adx>40?'强趋势':c.adxData.adx>25?'有趋势':'震荡/无趋势'}</div></div>
            <div class="m-item"><div class="ml">+DI(多)</div><div class="mv" style="color:var(--g)">${F(c.adxData.plusDI,1)}</div></div>
            <div class="m-item"><div class="ml">-DI(空)</div><div class="mv" style="color:var(--r)">${F(c.adxData.minusDI,1)}</div></div>
        </div></div>

        ${c.candlePats&&c.candlePats.length?`<div class="m-sec"><h3>K线形态</h3>${c.candlePats.map(p=>`<div style="background:var(--bg2);border-left:3px solid ${p.dir==='bull'?'var(--g)':'var(--r)'};padding:8px 12px;margin-bottom:6px;border-radius:4px;"><b style="color:${p.dir==='bull'?'var(--g)':'var(--r)'}">${p.name}</b> <span style="color:var(--txt2);font-size:12px">(${p.dir==='bull'?'看多':'看空'} 强度${p.strength})</span><br><span style="font-size:12px;color:var(--txt2)">${p.desc}</span></div>`).join('')}</div>`:''}

        ${c.chartPats&&c.chartPats.length?`<div class="m-sec"><h3>图表形态</h3>${c.chartPats.map(p=>`<div style="background:var(--bg2);border-left:3px solid ${p.dir==='bull'?'var(--g)':'var(--r)'};padding:8px 12px;margin-bottom:6px;border-radius:4px;"><b style="color:${p.dir==='bull'?'var(--g)':'var(--r)'}">${p.name}</b> <span style="color:var(--txt2);font-size:12px">(${p.dir==='bull'?'看多':'看空'} 强度${p.strength})</span><br><span style="font-size:12px;color:var(--txt2)">${p.desc}</span></div>`).join('')}</div>`:''}

        <div class="m-sec"><h3>严格判定</h3>
            <div style="background:var(--bg2);border:1px solid ${c.verdict.dir==='bull'?'var(--g)':c.verdict.dir==='bear'?'var(--r)':'var(--y)'};border-radius:8px;padding:14px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <b style="color:${c.verdict.dir==='bull'?'var(--g)':c.verdict.dir==='bear'?'var(--r)':'var(--y)'};font-size:16px">${c.verdict.label}</b>
                    <span style="font-size:12px;padding:3px 8px;border-radius:4px;background:${c.verdict.dir==='bull'?'var(--g-bg)':c.verdict.dir==='bear'?'var(--r-bg)':'var(--y-bg)'};color:${c.verdict.dir==='bull'?'var(--g)':c.verdict.dir==='bear'?'var(--r)':'var(--y)'}">置信: ${c.verdict.confidence}</span>
                </div>
                <div style="font-size:13px;color:var(--txt2);">信号依据: ${c.verdict.reasons.join(' · ')}</div>
            </div>
        </div>

        <div class="m-sec"><h3>精准进场点位</h3>
            ${c.entries&&c.entries.length?c.entries.map(e=>{
                const bg=e.dir==='bull'?'var(--g-bg)':'var(--r-bg)';
                const bd=e.dir==='bull'?'var(--g)':'var(--r)';
                const conf=e.confidence==='高'?'var(--g)':e.confidence==='中'?'var(--y)':'var(--txt2)';
                return`<div style="background:var(--bg2);border:1px solid ${bd};border-radius:8px;padding:12px;margin-bottom:8px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                        <span style="font-weight:700;font-size:14px;color:${bd}">${e.type}</span>
                        <span style="font-size:11px;padding:2px 6px;border-radius:4px;background:${bg};color:${bd}">置信度: ${e.confidence}</span>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;margin-bottom:8px;">
                        <div style="background:var(--card);padding:6px 8px;border-radius:4px;text-align:center;">
                            <div style="font-size:10px;color:var(--txt3)">入场价</div>
                            <div style="font-size:14px;font-weight:700;color:var(--b)">${e.entry}</div>
                        </div>
                        <div style="background:var(--card);padding:6px 8px;border-radius:4px;text-align:center;">
                            <div style="font-size:10px;color:var(--txt3)">止损</div>
                            <div style="font-size:14px;font-weight:700;color:var(--r)">${e.sl}</div>
                        </div>
                        <div style="background:var(--card);padding:6px 8px;border-radius:4px;text-align:center;">
                            <div style="font-size:10px;color:var(--txt3)">止盈1</div>
                            <div style="font-size:14px;font-weight:700;color:var(--g)">${e.tp1}</div>
                        </div>
                        <div style="background:var(--card);padding:6px 8px;border-radius:4px;text-align:center;">
                            <div style="font-size:10px;color:var(--txt3)">止盈2</div>
                            <div style="font-size:14px;font-weight:700;color:var(--g)">${e.tp2}</div>
                        </div>
                    </div>
                    <div style="display:flex;justify-content:space-between;font-size:12px;">
                        <span style="color:var(--txt2)">盈亏比: <b style="color:var(--txt)">${e.rr}</b></span>
                        <span style="color:var(--txt2)">${e.reason}</span>
                    </div>
                </div>`;
            }).join(''):'<div style="color:var(--txt3);padding:12px;">暂无明确进场信号，建议观望</div>'}
        </div>

        <div class="m-sec"><h3>建议</h3><div class="m-advice">${advice}</div></div>
    `;
    m.classList.add('on');

    // 默认加载1小时K线
    setTimeout(()=>loadKlineChart(sym,'1H'),100);
}
function closeModal(){document.getElementById('modalBg').classList.remove('on');klineData={};}

// ---- UI ----
function showProgress(t,p){const w=document.getElementById('progressWrap');w.classList.remove('hidden');document.getElementById('pFill').style.width=p+'%';document.getElementById('pText').textContent=t;}
function hideProgress(){document.getElementById('progressWrap').classList.add('hidden');}
function filterBy(f){curFilter=f;document.querySelectorAll('.pill').forEach(b=>b.classList.toggle('active',b.dataset.f===f));render();}
function doSearch(q){searchQuery=q.trim().toUpperCase();render();}
function doRefresh(){
    clearInterval(priceTimer);clearInterval(candleTimer);clearInterval(cdTimer);
    document.getElementById('vCountdown').textContent='';
    Object.keys(CACHE).forEach(k=>delete CACHE[k]);klineData={};domReady=false;
    fetchCandles().then(()=>{
        priceTimer=setInterval(refreshPrices,PRICE_POLL_MS);
        candleTimer=setInterval(()=>{domReady=false;fetchCandles();},300000);
        startCD(300);
    });
}
function setAutoInterval(sec){
    clearInterval(priceTimer);clearInterval(candleTimer);clearInterval(cdTimer);
    priceTimer=setInterval(refreshPrices,PRICE_POLL_MS);
    candleTimer=setInterval(()=>{domReady=false;fetchCandles();},parseInt(sec)*1000);
    startCD(parseInt(sec));
}
function startCD(sec){cdSec=sec;clearInterval(cdTimer);const el=document.getElementById('vCountdown');cdTimer=setInterval(()=>{cdSec--;if(cdSec<=0){el.textContent='刷新中...';clearInterval(cdTimer);}else{const m=Math.floor(cdSec/60),s=cdSec%60;el.textContent=`${m?m+'分':''}${s}秒后刷新`;}},1000);}

document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});

// ---- 获取市场概览 ----
async function loadMarketOverview(){
    try{
        const tickers=await okx('/market/tickers?instType=SPOT');
        let totalVol=0, btcVol=0;
        tickers.forEach(t=>{
            const v=parseFloat(t.volCcy24h)||0;
            totalVol+=v;
            if(t.instId.startsWith('BTC-'))btcVol+=v;
        });
        // 用成交额估算市值占比
        document.getElementById('vVol').textContent=FK(totalVol);
        document.getElementById('vBtc').textContent=totalVol>0?(btcVol/totalVol*100).toFixed(1)+'%':'--';
        // 从ticker里取BTC价格做参考
        const btcTicker=tickers.find(t=>t.instId==='BTC-USDT');
        if(btcTicker){
            document.getElementById('vMcap').textContent=FU(parseFloat(btcTicker.last));
        }
    }catch(e){console.log('Market overview failed:',e);}
}

// ---- 启动 ----
document.addEventListener('DOMContentLoaded',()=>{
    document.getElementById('grid').innerHTML=Array(8).fill('<div class="skel"></div>').join('');
    // 获取市场情绪
    okx('/market/tickers?instType=SPOT').then(tickers=>{
        // 先用tickers数据填充头部
        let totalVol=0, btcVol=0;
        tickers.forEach(t=>{
            const v=parseFloat(t.volCcy24h)||0;
            totalVol+=v;
            if(t.instId.startsWith('BTC-'))btcVol+=v;
        });
        document.getElementById('vVol').textContent=FK(totalVol);
        document.getElementById('vBtc').textContent=totalVol>0?(btcVol/totalVol*100).toFixed(1)+'%':'--';
        const btcTicker=tickers.find(t=>t.instId==='BTC-USDT');
        if(btcTicker)document.getElementById('vMcap').textContent=FU(parseFloat(btcTicker.last));
    }).catch(()=>{});
    // 恐惧贪婪指数
    fetch('https://api.alternative.me/fng/?limit=1').then(r=>r.json()).then(d=>{
        if(d.data&&d.data[0]){const v=d.data[0].value,cls=d.data[0].value_classification;const el=document.getElementById('vFng');el.textContent=v+' '+cls;el.style.color=v<=25?'var(--r)':v<=45?'var(--y)':v<=55?'var(--txt)':'var(--g)';}
    }).catch(()=>{});
    fetchCandles().then(()=>{
        priceTimer=setInterval(refreshPrices,PRICE_POLL_MS);
        candleTimer=setInterval(()=>{domReady=false;fetchCandles();},300000);
        startCD(300);
    });
});
