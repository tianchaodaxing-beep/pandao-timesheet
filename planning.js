(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Planning = api;
})(globalThis, function () {
  "use strict";
  const DAY = 86400000, MAX = Number.MAX_SAFE_INTEGER;
  function number(value, label, min = 0, max = MAX) {
    if (value === null || value === undefined || String(value).trim() === "") throw Error("请填写" + label);
    const text=String(value).trim();
    if(!/^[+-]?(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text))throw Error(label+"须为有效数字");
    const n = Number(text.replace(/,/g, ""));
    if (!Number.isFinite(n) || n < min || n > max) throw Error(label + "超出允许范围");
    return n;
  }
  function integer(value, label, min = 0, max = MAX) {
    const n = number(value, label, min, max);
    if (!Number.isSafeInteger(n)) throw Error(label + "须为整数");
    return n;
  }
  function checked(n) {
    if (!Number.isSafeInteger(n)) throw Error("合计数值超出可计算范围");
    return n;
  }
  function cents(value, label, min = 0) {
    const n=number(value,label,min,MAX/100),[mantissa,exponent="0"]=String(Math.abs(n)).split("e");
    return checked(Math.sign(n)*Math.round(Number(mantissa+"e"+(Number(exponent)+2))));
  }
  const money = n => n / 100;
  const round = n => Math.round((n + Number.EPSILON) * 100) / 100;
  function date(value, label = "日期") {
    const s = String(value ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw Error(label + "请填写为 YYYY-MM-DD");
    const n = Date.parse(s + "T00:00:00Z");
    if (!Number.isFinite(n) || new Date(n).toISOString().slice(0, 10) !== s || s < "1900-01-01" || s > "2100-12-31") throw Error(label + "须为1900至2100年内的有效日期");
    return n;
  }
  const iso = n => new Date(n).toISOString().slice(0, 10);
  function rows(input, max = 20000) {
    if (!Array.isArray(input) || !input.length) throw Error("请至少填写一行资料");
    if (input.length > max) throw Error("单次最多处理" + max + "行，请拆分资料");
  }
  function name(value, label) {
    const s = String(value ?? "").trim();
    if (!s) throw Error("请填写" + label);
    if (s.length > 200) throw Error(label + "最多200个字符");
    return s;
  }
  function unique(seen, key, label) {
    if (seen.has(key)) throw Error(label + "重复：" + key);
    seen.add(key);
  }
  function aging(input, asOf) {
    rows(input);
    const today = date(asOf, "统计日期"), seen = new Set(), customers = new Map();
    const labels = ["未逾期", "逾期1至30天", "逾期31至60天", "逾期61至90天", "逾期91至180天", "逾期超过180天"];
    const buckets = labels.map(label => ({ label, cents: 0, count: 0 }));
    let billed = 0, paid = 0, outstanding = 0, overdue = 0;
    const details = input.map((r, index) => {
      const invoice = name(r.invoice, "第" + (index + 1) + "行账单编号"), customer = name(r.customer, "客户");
      unique(seen, invoice, "账单编号");
      const due = date(r.due, invoice + "到期日期"), amount = cents(r.amount, invoice + "账单金额"), received = cents(r.paid, invoice + "已收金额");
      if (received > amount) throw Error(invoice + "已收金额不能大于账单金额");
      const balance = amount - received, days = Math.max(0, (today - due) / DAY);
      const bucket = days === 0 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : days <= 90 ? 3 : days <= 180 ? 4 : 5;
      billed = checked(billed + amount); paid = checked(paid + received); outstanding = checked(outstanding + balance);
      if (balance) { buckets[bucket].cents = checked(buckets[bucket].cents + balance); buckets[bucket].count++; }
      if (balance && days > 0) overdue = checked(overdue + balance);
      const group = customers.get(customer) || { customer, cents: 0, overdue: 0, count: 0 };
      group.cents = checked(group.cents + balance); group.overdue = checked(group.overdue + (days > 0 ? balance : 0)); group.count++;
      customers.set(customer, group);
      return { invoice, customer, due: iso(due), amount: money(amount), paid: money(received), balance: money(balance), days: balance ? days : 0, bucket: balance ? labels[bucket] : "已结清", status: balance === 0 ? "已结清" : due > today ? "未到期" : due === today ? "今天到期" : "已逾期" };
    });
    return { details, billed: money(billed), paid: money(paid), outstanding: money(outstanding), overdue: money(overdue), buckets: buckets.map(b => ({ label: b.label, amount: money(b.cents), count: b.count })), customers: [...customers.values()].sort((a,b) => b.cents-a.cents || a.customer.localeCompare(b.customer)).map(g => ({ customer: g.customer, balance: money(g.cents), overdue: money(g.overdue), count: g.count })) };
  }
  function month(value) {
    const s = String(value ?? "").trim();
    if (!/^\d{4}-\d{2}$/.test(s)) throw Error("月份请填写为 YYYY-MM");
    date(s + "-01", "月份");
    return Number(s.slice(0,4)) * 12 + Number(s.slice(5)) - 1;
  }
  const monthString = n => Math.floor(n / 12) + "-" + String(n % 12 + 1).padStart(2, "0");
  function cashflow(input, opening, reserve = 0) {
    rows(input);
    let balance = cents(opening, "期初余额", -MAX/100), totalIn = 0, totalOut = 0;
    const limit = cents(reserve, "最低预留金额"), groups = new Map();
    for (const r of input) {
      const key = month(r.month), inc = cents(r.income, "预计收入"), out = cents(r.expense, "预计支出");
      const group = groups.get(key) || { income: 0, expense: 0 };
      group.income = checked(group.income + inc); group.expense = checked(group.expense + out); groups.set(key, group);
    }
    const keys = [...groups.keys()], first = Math.min(...keys), last = Math.max(...keys);
    if (last - first >= 36) throw Error("预算跨度最多36个月，请缩小月份范围");
    const details = [];
    for (let n = first; n <= last; n++) {
      const g = groups.get(n) || { income: 0, expense: 0 }, start = balance;
      balance = checked(checked(balance + g.income) - g.expense); totalIn = checked(totalIn + g.income); totalOut = checked(totalOut + g.expense);
      details.push({ month: monthString(n), opening: money(start), income: money(g.income), expense: money(g.expense), net: money(g.income-g.expense), closing: money(balance), status: balance < 0 ? "资金缺口" : balance < limit ? "低于预留" : "充足" });
    }
    return { details, income: money(totalIn), expense: money(totalOut), closing: money(balance), lowest: Math.min(...details.map(r => r.closing)), firstShortfall: details.find(r => r.closing < money(limit))?.month || "", reserve: money(limit) };
  }
  const criteria = ["price", "quality", "delivery", "service"];
  function suppliers(input, weights) {
    rows(input);
    const values = criteria.map(k => number(weights[k], "评分权重", 0, 100));
    if (Math.abs(values.reduce((a,b)=>a+b,0) - 100) > 0.000001) throw Error("四项评分权重合计须为100%");
    const seen = new Set();
    const details = input.map(r => {
      const supplier = name(r.supplier, "供应商名称"); unique(seen, supplier, "供应商名称");
      const score = Object.fromEntries(criteria.map(k => [k,number(r[k], supplier + "评分", 0, 100)]));
      return { supplier, ...score, score: round(criteria.reduce((total,k,i)=>total+score[k]*values[i]/100,0)) };
    }).sort((a,b)=>b.score-a.score || a.supplier.localeCompare(b.supplier));
    let rank = 0;
    details.forEach((r,i)=>{if(i===0 || r.score!==details[i-1].score)rank=i+1;r.rank=rank;});
    return { details, best: details.filter(r=>r.rank===1).map(r=>r.supplier), average: round(details.reduce((a,r)=>a+r.score,0)/details.length) };
  }
  function schedule(input, start, excludeWeekends = true, holidays = []) {
    rows(input, 200);
    const startDate = date(start, "项目开始日期");
    if (!Array.isArray(holidays)) throw Error("休息日期请逐项填写");
    const off = new Set(holidays.filter(v=>String(v).trim()).map(v=>iso(date(v,"休息日期"))));
    const lookup = new Map();
    const tasks = input.map((r,index)=>{
      const id = name(r.id, "任务编号"), title = name(r.title, "任务名称"), duration = integer(r.duration,"工作天数",1,365);
      if (lookup.has(id)) throw Error("任务编号重复：" + id);
      const dependencies = String(r.dependencies ?? "").split(/[,，]/).map(v=>v.trim()).filter(Boolean);
      if (new Set(dependencies).size!==dependencies.length) throw Error(id + "的前置任务重复");
      const task = { id, title, duration, dependencies, index, children: [], remaining: dependencies.length };
      lookup.set(id,task); return task;
    });
    for (const task of tasks) for (const id of task.dependencies) {
      const parent=lookup.get(id); if(!parent)throw Error(task.id+"引用了不存在的前置任务："+id);
      parent.children.push(task.id);
    }
    const queue=tasks.filter(t=>!t.remaining), ordered=[];
    while(queue.length) {
      const task=queue.shift();
      task.begin=task.dependencies.length ? Math.max(...task.dependencies.map(id=>lookup.get(id).end+1)) : 0;
      task.end=task.begin+task.duration-1; ordered.push(task);
      for(const id of task.children){const child=lookup.get(id);child.remaining--;if(!child.remaining)queue.push(child);}
    }
    if(ordered.length!==tasks.length)throw Error("前置任务存在循环，请修改任务依赖");
    const duration=Math.max(...tasks.map(t=>t.end))+1;
    for(const task of [...ordered].reverse()) {
      task.latestEnd=task.children.length ? Math.min(...task.children.map(id=>lookup.get(id).latestStart))-1 : duration-1;
      task.latestStart=task.latestEnd-task.duration+1; task.slack=task.latestStart-task.begin;
    }
    const workdays=[];let cursor=startDate;
    while(workdays.length<duration) {
      if(cursor>date("2100-12-31"))throw Error("排程超出2100年，请缩短项目工期");
      const d=new Date(cursor), weekend=d.getUTCDay()===0||d.getUTCDay()===6;
      if((!excludeWeekends||!weekend)&&!off.has(iso(cursor)))workdays.push(iso(cursor));
      cursor+=DAY;
    }
    return { duration, start: workdays[0], finish: workdays.at(-1), details: tasks.map(t=>({id:t.id,title:t.title,duration:t.duration,dependencies:t.dependencies.join(","),start:workdays[t.begin],finish:workdays[t.end],offset:t.begin,slack:t.slack,critical:t.slack===0})) };
  }
  function timesheets(input) {
    rows(input);
    const daily=new Map(), people=new Map(), projects=new Map();let hours=0,billableHours=0,total=0;
    const details=input.map(r=>{
      const day=iso(date(r.date,"工时日期")),person=name(r.person,"人员"),project=name(r.project,"项目");
      const h=number(r.hours,"工时",0.000001,24),rate=cents(r.rate,"小时单价"),type=String(r.billable??"").trim();
      if(!["是","否"].includes(type))throw Error("是否计费请填写“是”或“否”");
      const key=JSON.stringify([day,person]),dayHours=(daily.get(key)||0)+h;
      if(dayHours>24+0.000000001)throw Error(person+"在"+day+"的合计工时超过24小时");daily.set(key,dayHours);
      const charge=type==="是"?checked(Math.round(h*rate)):0;
      hours+=h;if(type==="是")billableHours+=h;total=checked(total+charge);
      for(const [map,label] of [[people,person],[projects,project]]){const group=map.get(label)||{name:label,hours:0,amount:0};group.hours+=h;group.amount=checked(group.amount+charge);map.set(label,group);}
      return {date:day,person,project,hours:h,rate:money(rate),billable:type,amount:money(charge)};
    });
    const group=map=>[...map.values()].sort((a,b)=>b.amount-a.amount||a.name.localeCompare(b.name)).map(r=>({...r,hours:round(r.hours),amount:money(r.amount)}));
    return { details, hours:round(hours),billableHours:round(billableHours),amount:money(total),people:group(people),projects:group(projects) };
  }
  function funnel(input) {
    rows(input);const seen=new Set(),totals={leads:0,contacted:0,quoted:0,won:0,cents:0};
    const rate=(a,b)=>b===0?null:round(a/b*100);
    const details=input.map(r=>{
      const segment=name(r.segment,"统计分组");unique(seen,segment,"统计分组");
      const v=Object.fromEntries(["leads","contacted","quoted","won"].map(k=>[k,integer(r[k],"阶段人数",0,1000000000)]));
      if(v.contacted>v.leads||v.quoted>v.contacted||v.won>v.quoted)throw Error(segment+"的阶段人数须逐级不增");
      const amount=cents(r.amount,"成交金额");if(v.won===0&&amount!==0)throw Error(segment+"没有成交人数时，成交金额须为0");
      for(const key of ["leads","contacted","quoted","won"])totals[key]=checked(totals[key]+v[key]);totals.cents=checked(totals.cents+amount);
      return {segment,...v,amount:money(amount),contactRate:rate(v.contacted,v.leads),quoteRate:rate(v.quoted,v.contacted),winRate:rate(v.won,v.quoted),overallRate:rate(v.won,v.leads)};
    });
    return {details,totals:{leads:totals.leads,contacted:totals.contacted,quoted:totals.quoted,won:totals.won,amount:money(totals.cents),overallRate:rate(totals.won,totals.leads),averageOrder:totals.won===0?null:round(money(totals.cents)/totals.won)}};
  }
  return {aging,cashflow,suppliers,schedule,timesheets,funnel,date,month};
});
