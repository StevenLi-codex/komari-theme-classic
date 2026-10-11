from pathlib import Path
p=Path(__file__).resolve().parent.parent/'src'/'main.ts'
s=p.read_text(encoding='utf-8')
def replace(old,new):
 global s
 assert old in s, f'missing {old[:100]!r}'
 s=s.replace(old,new)
def block(start,end,new):
 global s
 a=s.index(start);b=s.index(end,a)
 s=s[:a]+new+s[b:]
replace("let connection='Connecting'","let connection='连接中'")
replace("let modal:{type:'node'|'network'|'performance'|'alerts'|'settings',id?:number}|null=null;", "let modal:{type:'network'|'performance'|'alerts'|'settings'}|null=null;\nlet detailTab:'overview'|'performance'|'network'|'hardware'='overview';\nlet previousRoute='';")
insert="""
// Self-contained flag SVGs prevent Windows from rendering regional flags as letter pairs.
const bundledFlags=new Set('jp de fr it ie be nl ru at pl ua id sg vn ch cn hk tw kr us gb ca se fi no dk ae th es in tr'.split(' '));
function flagImage(code?:string,klass='node-flag'):string {
  const c=typeof code==='string' ? code.toLowerCase() : '';
  if(bundledFlags.has(c))return `<img class="${klass}" src="/flags/${c}.svg" alt="${html(locationName(c))}国旗" loading="lazy" decoding="async" />`;
  return `<span class="${klass} flag-fallback" title="${html(locationName(code))}">${html(c.toUpperCase()||'??')}</span>`;
}
const stateZh=(status:string)=>status==='online'?'在线':status==='warning'?'告警':status==='pending'?'等待上报':'离线';
function detailId():number|null {
  const m=location.hash.match(/^#\/node\/(\d+)$/);
  return m&&Number.isSafeInteger(Number(m[1]))?Number(m[1]):null;
}
function openDetail(id:number){detailTab='overview';location.hash=`#/node/${id}`;if(detailId()===id)render();}
function closeDetail(){location.hash='#/nodes';render();}
"""
idx=s.index('const groups=')
s=s[:idx]+insert+s[idx:]
block('function scopeText(){','function navRow(',"""function scopeText(){
  if(scope==='online')return '在线节点';
  if(scope==='offline')return '离线节点';
  if(scope==='warning')return '告警节点';
  if(scope==='pending')return '等待数据';
  if(scope.startsWith('country:'))return locationName(scope.slice(8));
  if(scope.startsWith('group:'))return scope.slice(6);
  if(scope==='ungrouped')return '未分组';
  return '全部节点';
}
""")
# Sidebar semantics
for a,b in [('Node navigation','节点导航'),("'Node Manager'","'节点管理器'"),('Collapse navigation','折叠导航'),('<span>Nodes</span>','<span>节点</span>'),("navRow('All Nodes'","navRow('全部节点'"),( "navRow('Online'","navRow('在线'"),( "navRow('Offline'","navRow('离线'"),( "navRow('Warning'","navRow('告警'"),( "navRow('Pending'","navRow('等待上报'"),('<span>By Location</span>','<span>按地区</span>'),('<span>Groups</span>','<span>分组</span>'),("navRow('Ungrouped'","navRow('未分组'"),('<span>Network Map</span>','<span>网络概览</span>'),('<span>Performance Reports</span>','<span>性能概览</span>'),('<span>Alert Logs</span>','<span>告警状态</span>'),('<span>System Settings</span>','<span>显示设置</span>')]:
 s=s.replace(a,b)
replace("${countryFlag(c)} ${locationName(c)}", "${locationName(c)}") # sidebar loc name only, SVG attached via icon below
replace("`country:${c}`,'',a.filter", "`country:${c}`,flagImage(c,'tree-flag'),a.filter")
block('function nodeChart(','function renderMain()',"""function nodeChart(n:NodeInfo):string {
  if(!config.show_chart)return '';
  const cached=history.get(n.id);
  if(!n.online)return chartSvg([],'CPU（24小时）');
  if(isDemo)return chartSvg(demoChart(n.id),'CPU（24小时）');
  return chartSvg(cached?.data??[],'CPU（24小时）');
}
function nodeCard(n:NodeInfo){
  const status=nodeState(n), cp=cpuValue(n), rm=ramValue(n), dk=diskValue(n);
  const isMin=minimized.has(n.id);
  const note=status==='offline'?'最后上报：'+age(n):status==='pending'?'等待首次指标上报':'';
  return `<article class="node-window ${status==='offline'?'card-offline':''} ${view==='compact'?'card-compact':''}" data-node="${n.id}" tabindex="0" aria-label="查看 ${html(n.name)} 的节点详情">
    <div class="node-title classic-title"><span class="tiny-pc">${flagImage(n.country,'title-flag')}</span><span class="truncate" title="${html(n.name)}">${html(n.name)}</span><div class="window-actions">
      <button class="title-btn" data-action="min" data-id="${n.id}" title="${isMin?'还原':'最小化'}" aria-label="${isMin?'还原':'最小化'} ${html(n.name)}">${isMin?'□':'−'}</button>
      <button class="title-btn" data-action="detail" data-id="${n.id}" title="查看节点详情" aria-label="查看 ${html(n.name)} 详情">□</button>
      <button class="title-btn" data-action="hide" data-id="${n.id}" title="隐藏卡片" aria-label="隐藏 ${html(n.name)}">×</button>
    </div></div>
    ${isMin?'':`<div class="node-body">
      <div class="node-identity"><div class="pc-picture">${flagImage(n.country,'hero-flag')}</div><div class="identity-text"><strong title="${html(n.name)}">${html(n.name)}</strong><div class="online-label"><span class="status-dot ${status}"></span>${stateZh(status)}</div><div class="country-label">${html(locationName(n.country))}</div></div></div>
      ${note?`<div class="node-note" title="${html(note)}">${html(note)}</div>`:''}
      <div class="bevel-line"></div>
      <div class="meters">${meter('处理器',cp)}${meter('内存',rm,valid(n.metrics?.mem_used)?bytes(n.metrics!.mem_used):undefined)}${meter('硬盘',dk)}</div>
      ${nodeChart(n)}
      <div class="card-facts"><div class="fact"><span>延迟</span><span class="bars">▂▄▆█</span><strong>${pingText(n)}</strong></div><div class="fact"><span>运行</span><strong>${duration(n.metrics?.uptime)}</strong></div>
      ${config.show_traffic?`<div class="fact net-fact"><span>网络</span><strong class="net-down">↓ ${speed(n.metrics?.net_rx)}</strong><strong class="net-up">↑ ${speed(n.metrics?.net_tx)}</strong></div>`:''}</div>
    </div>`}</article>`;
}
""")
block('function renderMain(){','function renderModal(){',"""function detailField(label:string,value:unknown){return `<div><dt>${html(label)}</dt><dd>${html(value)}</dd></div>`;}
function detailPanel(title:string,content:string){return `<fieldset class="win-panel"><legend>${html(title)}</legend>${content}</fieldset>`;}
function detailGraph(label:string,points:Array<number|null>){return `<div class="detail-graph"><strong>${html(label)}</strong>${chartSvg(points,label)}</div>`;}
function detailHistory(node:NodeInfo){
  if(!node.online)return '<div class="detail-muted">节点离线，暂时无法获取新的监控指标。</div>';
  const cached=history.get(node.id);
  if(isDemo)return detailGraph('CPU（24小时）',demoChart(node.id));
  if(!cached)return '<div class="detail-muted">正在获取历史数据……</div>';
  return detailGraph('CPU（24小时）',cached.data);
}
function renderNodePage(node:NodeInfo|undefined,id:number):string {
  if(!node)return `<main class="content node-page"><div class="detail-toolbar classic-title">节点详情</div><div class="detail-inner"><p>未找到编号为 ${id} 的节点，可能已被删除或无权查看。</p><button class="classic-button" data-action="back">← 返回节点列表</button></div></main>`;
  const m=node.metrics,st=nodeState(node),validMonth=valid(node.month_used)?node.month_used:valid(node.month_rx)&&valid(node.month_tx)?node.month_rx+node.month_tx:null;
  const sections={overview:'概览',performance:'性能监视器',network:'网络流量',hardware:'硬件信息'} as const;
  const grouped=(...items:[string,unknown][])=>`<dl class="properties">${items.map(([a,b])=>detailField(a,b)).join('')}</dl>`;
  const meterGrid=`<div class="detail-meter-grid">${[['CPU 使用率',cpuValue(node)],['内存使用率',ramValue(node)],['硬盘使用率',diskValue(node)]].map(([name,val])=>`<div class="detail-meter">${meter(String(name),val as number|null)}</div>`).join('')}</div>`;
  let content='';
  if(detailTab==='overview'){
    content=`<div class="detail-columns">${detailPanel('当前状态',`<div class="detail-banner"><span class="status-dot ${st}"></span><strong>${stateZh(st)}</strong> · ${html(locationName(node.country))}</div>${meterGrid}${detailHistory(node)}`)}
    ${detailPanel('节点摘要',grouped(['名称',node.name],['节点编号',node.id],['国家/地区',locationName(node.country)],['分组',node.group||'未分组'],['在线时间',duration(m?.uptime)],['延迟',pingText(node)],['最近上报',age(node)],['备注',node.public_remark||'—']))}</div>`;
  } else if(detailTab==='performance'){
    const c=history.get(node.id);
    const memData=c?.raw?.metrics?.map(pt=>valid(pt.mem_used)&&valid(m?.mem_total)&&m!.mem_total!>0 ? Math.min(100,pt.mem_used!/m!.mem_total!*100):null)??[];
    const diskData=c?.raw?.metrics?.map(pt=>valid(pt.disk_used)&&valid(m?.disk_total)&&m!.disk_total!>0?Math.min(100,pt.disk_used!/m!.disk_total!*100):null)??[];
    content=`${detailPanel('实时资源',meterGrid)}<div class="detail-chart-grid">${detailPanel('CPU 历史',detailHistory(node))}${detailPanel('内存历史',detailGraph('内存使用率',isDemo?demoChart(node.id+3):memData))}${detailPanel('硬盘历史',detailGraph('硬盘使用率',isDemo?demoChart(node.id+6):diskData))}</div>`;
  }else if(detailTab==='network'){
    const c=history.get(node.id),points=c?.raw?.metrics??[];
    const peaks=Math.max(1,...points.flatMap(p=>[valid(p.net_rx)?p.net_rx:0,valid(p.net_tx)?p.net_tx:0]));
    const series=(key:'net_rx'|'net_tx')=>isDemo?demoChart(node.id+(key==='net_rx'?1:5)):points.map(p=>valid(p[key])?Math.min(100,p[key]!/peaks*100):null);
    content=`${detailPanel('实时网络',grouped(['下载速度',speed(m?.net_rx)],['上传速度',speed(m?.net_tx)],['延迟',pingText(node)],['本月已用流量（Hub）',bytes(validMonth)],['本月接收',bytes(node.month_rx??m?.month_rx)],['本月发送',bytes(node.month_tx??m?.month_tx)],['累计接收',bytes(node.total_rx??m?.total_rx)],['累计发送',bytes(node.total_tx??m?.total_tx)],['流量限制',node.traffic_limit?bytes(node.traffic_limit):'未设置']))}
      <div class="detail-chart-grid">${detailPanel('下载趋势',detailGraph('下载速率（相对峰值）',series('net_rx')))}${detailPanel('上传趋势',detailGraph('上传速率（相对峰值）',series('net_tx')))}</div><p class="detail-muted">趋势图纵轴按当前查询范围内的峰值归一化；实时速率与累计流量以 Hub 数据为准。</p>`;
  }else{
    content=`${detailPanel('系统和硬件',grouped(['操作系统',node.os||'未提供'],['主机名',node.hostname||'未提供'],['内核',node.kernel||'未提供'],['系统架构',node.arch||'未提供'],['虚拟化',node.virt||'未提供'],['CPU 型号',node.cpu_name||'未提供'],['CPU 核心',node.cpu_cores??'未提供'],['内存总量',bytes(m?.mem_total??node.mem_total)],['硬盘总量',bytes(m?.disk_total??node.disk_total)],['网络地址',node.ip||'未公开'],['到期剩余天数',expDays(node)===null?'未设置':`${expDays(node)} 天`],['公开备注',node.public_remark||'—']))}`;
  }
  return `<main class="content node-page" id="main-content"><div class="detail-toolbar classic-title">${flagImage(node.country,'title-flag')}<span>${html(node.name)} · 属性</span><button class="title-btn" data-action="back" title="返回节点列表" aria-label="返回节点列表">×</button></div>
    <div class="detail-inner"><div class="detail-navigation"><button class="classic-button" data-action="back">← 返回节点列表</button><span>节点属性 / ${html(node.name)}</span></div>
    <div class="detail-header">${flagImage(node.country,'detail-flag')}<div><h1>${html(node.name)}</h1><p><span class="status-dot ${st}"></span> ${stateZh(st)} · ${html(locationName(node.country))} · #${node.id}</p></div></div>
    <nav class="detail-tabs" aria-label="节点详情分类">${(Object.entries(sections) as [typeof detailTab,string][]).map(([key,val])=>`<button class="detail-tab ${detailTab===key?'active':''}" data-tab="${key}" aria-current="${detailTab===key?'page':'false'}">${val}</button>`).join('')}</nav>
    <div class="detail-sections">${content}</div><div class="detail-footer"><button class="classic-button" data-action="refresh">刷新数据</button><button class="classic-button" data-action="back">关闭</button></div></div></main>`;
}
function renderMain(){
  const id=detailId(); if(id!==null)return renderNodePage(nodes?.find(n=>n.id===id),id);
  const result=visible(),a=nodes||[];
  return `<main class="content" id="main-content"><div class="content-toolbar classic-title"><div class="toolbar-name">${buttonIcon('computer')} <span>${html(scopeText())}（${result.length} 台）</span></div>
    <div class="toolbar-right"><label class="toolbar-search" title="搜索节点"><span aria-hidden="true">⌕</span><input id="search-box" aria-label="搜索节点" placeholder="搜索" value="${html(search)}" /></label><label for="view-select">视图：</label><select id="view-select" aria-label="卡片视图"><option value="cards" ${view==='cards'?'selected':''}>卡片视图</option><option value="compact" ${view==='compact'?'selected':''}>紧凑卡片</option></select>
    <button class="classic-button view-square" data-action="toggle-sidebar" title="切换导航" aria-label="切换导航">▦</button><button class="classic-button mobile-menu" data-action="toggle-sidebar" aria-label="菜单">☰</button></div></div>
    ${config.notice?`<div class="notice" role="note">${html(config.notice)}</div>`:''}
    ${error?`<div class="error-banner" role="alert">${html(error)} <button data-action="refresh">重试</button></div>`:''}
    ${hidden.size?`<div class="restore-row">已隐藏 ${hidden.size} 张卡片 <button data-action="restore-all">恢复全部</button></div>`:''}
    ${!nodes?`<div class="empty-state">${buttonIcon('computer')}<p>正在连接 Monitor Hub……</p><small>正在读取节点列表</small></div>`:
      !result.length?`<div class="empty-state">${buttonIcon('folder')}<p>${a.length?'没有匹配的节点':'暂无节点'}</p><small>可以尝试切换分组、清空搜索，或恢复隐藏的卡片。</small><button class="classic-button" data-action="reset">显示全部节点</button></div>`:
      `<div class="node-grid ${view==='compact'?'compact-grid':''}" style="--cols:${config.columns}">${result.map(nodeCard).join('')}</div>`}
  </main>`;
}
function renderStatus(){const n=counts();return `<footer class="statusbar"><span class="status-cell status-ready">${isDemo?'演示模式':connection==='Live'?'实时连接':connection==='Polling'?'轮询中':connection==='Offline'?'连接中断':connection==='Reconnecting'?'重新连接中':connection}</span><span class="status-cell spacer"></span><span class="status-cell">节点总数：${n.all}</span><span class="status-cell">在线：${n.online}</span><span class="status-cell">离线：${n.offline}</span><span class="status-cell">告警：${n.warning}</span><span class="status-cell status-refresh"><span class="status-dot ${connection==='Live'||isDemo?'online':'offline'}"></span> 最近刷新：${refreshed?new Date(refreshed).toLocaleTimeString('zh-CN'):'—'}</span></footer>`;}
""")
# Retain secondary dialogs, fully translated.
block('function renderModal(){','function render(){',"""function renderModal(){if(!modal)return '';
  let title='',content='';
  if(modal.type==='network'){
    title='网络概览';const list=nodes||[];
    content=`<p>按 Monitor Hub 提供的国家或地区信息汇总</p><div class="modal-list">${countries(list).map(c=>`<div>${flagImage(c,'tree-flag')} <strong>${html(locationName(c))}</strong><span>在线 ${list.filter(n=>n.country===c&&n.online).length} / 总计 ${list.filter(n=>n.country===c).length}</span></div>`).join('')||'暂无地区数据'}</div>`;
  }else if(modal.type==='performance'){
    title='性能概览';const list=(nodes||[]).filter(n=>n.online&&cpuValue(n)!==null), total=list.length;
    const avg=total?list.reduce((sum,n)=>sum+(cpuValue(n)||0),0)/total:null;
    content=`<p>实时性能汇总（仅统计具有有效指标的在线节点）</p><dl class="properties">${detailField('可用节点',total)}${detailField('平均 CPU 使用率',fmtPercent(avg))}${detailField('总下载速度',speed(list.reduce((sum,n)=>sum+(n.metrics?.net_rx||0),0)))}${detailField('总上传速度',speed(list.reduce((sum,n)=>sum+(n.metrics?.net_tx||0),0)))}</dl>`;
  }else if(modal.type==='alerts'){
    title='告警状态';const alert=(nodes||[]).filter(n=>nodeState(n)==='warning'||nodeState(n)==='offline');
    content=`<p>当前离线、高负载（大于 90%）以及三天内到期的节点</p><div class="modal-list">${alert.map(n=>`<div><span class="status-dot ${nodeState(n)}"></span> ${html(n.name)}<span>${stateZh(nodeState(n))}</span></div>`).join('')||'<p>当前没有告警或离线节点。</p>'}</div>`;
  }else if(modal.type==='settings'){
    title='显示设置';content=`<p>以下是本次浏览器访问的显示设置。站点配置请在 Monitor Hub → 主题管理 → x86 Monitor 中修改。</p><div class="setting-row"><label><input id="pref-sidebar" type="checkbox" ${config.show_sidebar?'checked':''} /> 显示导航树</label></div><div class="setting-row"><label><input id="pref-compact" type="checkbox" ${view==='compact'?'checked':''} /> 紧凑卡片视图</label></div><button class="classic-button" data-action="open-admin">打开 Hub 管理后台 ↗</button>`;
  }
  return `<div class="modal-backdrop" data-action="close-modal"><section class="dialog-window" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1"><div class="classic-title dialog-title"><span id="modal-title">${html(title)}</span><button class="title-btn" data-action="close-modal" aria-label="关闭弹窗">×</button></div><div class="dialog-body">${content}<div class="dialog-footer"><button class="classic-button" data-action="close-modal">确定</button></div></div></section></div>`;
}
""")
# Keep the main list scroll only if route same
replace("  const bodyTop=root.querySelector('.content')?.scrollTop||0;", "  const routeKey=detailId()===null?'list':`node:${detailId()}`;\n  const bodyTop=routeKey===previousRoute?root.querySelector('.content')?.scrollTop||0:0;\n  previousRoute=routeKey;")
replace("history.set(id,{data:points,ping,time:Date.now()});render();", "history.set(id,{data:points,ping,time:Date.now(),raw:hist.status==='fulfilled'?hist.value:undefined});render();")
replace("history.set(id,{data:[],ping:null,time:Date.now()});", "history.set(id,{data:[],ping:null,time:Date.now()});")
replace("const history=new Map<number,{data:Array<number|null>;ping:number|null;time:number}>();", "const history=new Map<number,{data:Array<number|null>;ping:number|null;time:number;raw?:NodeHistory}>();")
# History fetch must still run on details even when chart disabled, and not be gated by filter
replace("if(isDemo||!nodes||!config.show_chart)return;\n  const ids=visible().filter(n=>n.online).map(n=>n.id);", "if(isDemo||!nodes)return;\n  const detail=detailId();\n  const ids=detail!==null?[detail]:config.show_chart?visible().filter(n=>n.online).map(n=>n.id):[];")
replace("if(conf.status==='fulfilled')config=conf.value", "if(conf.status==='fulfilled')config=conf.value")
replace("if(config.show_chart) void loadVisibleHistories();", "if(config.show_chart||detailId()!==null) void loadVisibleHistories();")
# Handler setup to navigate from any card
replace("  if(!action)return;", "  if(!action){const card=target.closest<HTMLElement>('[data-node]');if(card){openDetail(Number(card.dataset.node));void loadVisibleHistories();}return;}")
replace("case 'detail':modal={type:'node',id};break;", "case 'detail':openDetail(id);void loadVisibleHistories();return;\n    case 'back':closeDetail();return;\n    case 'tab':detailTab=action.dataset.tab as typeof detailTab;break;")
replace("  if(!action){const card=target.closest<HTMLElement>('[data-node]');", "  if(!action){const tab=target.closest<HTMLElement>('[data-tab]');if(tab){detailTab=(tab.dataset.tab||'overview') as typeof detailTab;render();return;}const card=target.closest<HTMLElement>('[data-node]');")
replace("document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal){modal=null;render();}});", "document.addEventListener('keydown',e=>{\n  if(e.key==='Escape'){if(modal){modal=null;render();}else if(detailId()!==null)closeDetail();return;}\n  if(e.key==='Enter'||e.key===' '){const t=e.target as HTMLElement;if(t.matches('.node-window')){e.preventDefault();openDetail(Number(t.dataset.node));void loadVisibleHistories();}}\n});\nwindow.addEventListener('hashchange',()=>{render();if(detailId()!==null)void loadVisibleHistories();});")
# Don't allow unknown id in getHistory if nodes not ready
replace("const ids=detail!==null?[detail]:config.show_chart?visible().filter(n=>n.online).map(n=>n.id):[];", "const ids=detail!==null?nodes.filter(n=>n.id===detail&&n.online).map(n=>n.id):config.show_chart?visible().filter(n=>n.online).map(n=>n.id):[];")
# Check detail tab render type
p.write_text(s,encoding='utf8')
print('Patched',p)
