(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.Business = api;
})(globalThis, function () {
  "use strict";
  function num(value, label, min = -Infinity, max = Infinity) {
    if (value === null || value === undefined || String(value).trim() === "")
      throw Error("请填写" + label);
    const n = Number(String(value).replace(/,/g, ""));
    if (!Number.isFinite(n) || n < min || n > max)
      throw Error(label + "不是有效数字");
    return n;
  }
  const round = (n) => {
    if (!Number.isFinite(n) || Math.abs(n) > Number.MAX_SAFE_INTEGER / 100)
      throw Error("数值超出可计算范围");
    return Math.round((n + Number.EPSILON) * 100) / 100;
  };
  function profit(row) {
    const price = num(row.price, "售价", 0),
      quantity = num(row.quantity, "数量", 0.000001),
      purchase = num(row.purchase, "采购成本", 0),
      exchange = num(row.exchange, "汇率", 0.000001),
      shipping = num(row.shipping, "物流成本", 0),
      other = num(row.other, "其他单件成本", 0),
      feeRate = num(row.feeRate, "平台费率", 0, 100),
      ads = num(row.ads, "广告费用", 0),
      fixed = num(row.fixed, "固定费用", 0);
    const revenue = price * quantity,
      cost = (purchase * exchange + shipping + other) * quantity,
      fees = (revenue * feeRate) / 100;
    const result = revenue - cost - fees - ads - fixed;
    const margin = revenue ? (result / revenue) * 100 : null;
    const unitContribution =
      price * (1 - feeRate / 100) - purchase * exchange - shipping - other;
    return {
      revenue: round(revenue),
      cost: round(cost),
      fees: round(fees),
      ads: round(ads),
      fixed: round(fixed),
      profit: round(result),
      margin: margin === null ? null : round(margin),
      unitProfit: round(result / quantity),
      breakEvenQuantity:
        unitContribution > 0
          ? Math.ceil((ads + fixed) / unitContribution)
          : null,
    };
  }
  function quote(items, discount, tax) {
    if (!items.length) throw Error("请添加报价项目");
    discount = num(discount, "折扣", 0, 100);
    tax = num(tax, "税率", 0, 100);
    const lines = items.map((i) => {
      const name = String(i.name || "").trim();
      if (!name) throw Error("请填写项目名称");
      const qty = num(i.quantity, "数量", 0.000001),
        price = num(i.price, "单价", 0);
      return { ...i, name, quantity: qty, price, amount: round(qty * price) };
    });
    const subtotal = round(lines.reduce((s, i) => s + i.amount, 0)),
      deduction = round((subtotal * discount) / 100),
      net = round(subtotal - deduction),
      taxAmount = round((net * tax) / 100);
    return {
      lines,
      subtotal,
      discount: deduction,
      net,
      tax: taxAmount,
      total: round(net + taxAmount),
    };
  }
  function inventory(row) {
    const sku = String(row.sku || "").trim();
    if (!sku) throw Error("请填写商品编号");
    const daily = num(row.daily, "日均销量", 0),
      stock = num(row.stock, "现有库存", 0),
      inbound = num(row.inbound, "在途库存", 0),
      committed = num(row.committed, "已占用库存", 0),
      lead = num(row.lead, "采购周期", 0),
      safety = num(row.safety, "安全库存天数", 0),
      review = num(row.review, "补货间隔", 0),
      pack = num(row.pack, "包装数量", 0.000001),
      moq = num(row.moq, "起订量", 0);
    const position = stock + inbound - committed,
      reorder = daily * (lead + safety),
      target = daily * (lead + safety + review),
      gap = Math.max(target - position, 0),
      suggestion = gap > 0 ? Math.ceil(Math.max(gap, moq) / pack) * pack : 0;
    return {
      sku,
      position: round(position),
      reorder: round(reorder),
      target: round(target),
      suggestion: round(suggestion),
      coverage:
        daily > 0 ? round(Math.max(stock - committed, 0) / daily) : null,
      status:
        daily === 0
          ? "无销量参考"
          : position <= reorder
            ? "需要补货"
            : "库存充足",
    };
  }
  function normalize(value, fold = true) {
    const s = String(value ?? "")
      .normalize("NFKC")
      .trim();
    return fold ? s.toLocaleLowerCase() : s;
  }
  function reconcile(left, right, config) {
    if (!config.keys || !config.keys.length)
      throw Error("请选择至少一个匹配列");
    const tolerance = num(config.tolerance, "允许差额", 0);
    const folds = config.ignoreCase !== false;
    const maps = [new Map(), new Map()],
      invalid = [];
    [left, right].forEach((rows, side) =>
      rows.forEach((r, index) => {
        const parts = config.keys.map((k) => normalize(r[k[side]], folds));
        if (parts.some((v) => !v)) {
          invalid.push({
            key: "第" + (index + 2) + "行",
            status: "缺少匹配值",
            leftCount: side === 0 ? 1 : 0,
            rightCount: side === 1 ? 1 : 0,
            leftAmount: side === 0 ? r[config.leftAmount] : "",
            rightAmount: side === 1 ? r[config.rightAmount] : "",
            difference: "",
            left: side === 0 ? r : null,
            right: side === 1 ? r : null,
          });
          return;
        }
        const key = JSON.stringify(parts);
        if (!maps[side].has(key)) maps[side].set(key, []);
        maps[side].get(key).push(r);
      }),
    );
    const results = [...invalid];
    for (const key of new Set([...maps[0].keys(), ...maps[1].keys()])) {
      const a = maps[0].get(key) || [],
        b = maps[1].get(key) || [];
      let status,
        difference = "",
        la = "",
        ra = "";
      if (a.length > 1 || b.length > 1) status = "匹配值重复";
      else if (!a.length) status = "仅右表存在";
      else if (!b.length) status = "仅左表存在";
      else if (config.leftAmount && config.rightAmount) {
        try {
          la = num(a[0][config.leftAmount], "左表金额");
          ra = num(b[0][config.rightAmount], "右表金额");
          difference = round(la - ra);
          status = Math.abs(la - ra) <= tolerance + 1e-9 ? "一致" : "金额不同";
        } catch (e) {
          status = "金额无效";
          la = a[0][config.leftAmount];
          ra = b[0][config.rightAmount];
        }
      } else status = "匹配成功";
      results.push({
        key: JSON.parse(key).join(" / "),
        status,
        leftCount: a.length,
        rightCount: b.length,
        leftAmount: la,
        rightAmount: ra,
        difference,
        left: a.length === 1 ? a[0] : null,
        right: b.length === 1 ? b[0] : null,
      });
    }
    return results;
  }
  function cleanRows(rows) {
    const seen = new Set(),
      result = [];
    let duplicates = 0;
    for (const row of rows) {
      const clean = Object.fromEntries(
        Object.entries(row).map(([k, v]) => [
          k,
          typeof v === "string" ? v.normalize("NFKC").trim() : v,
        ]),
      );
      const signature = JSON.stringify(clean);
      if (seen.has(signature)) {
        duplicates++;
        continue;
      }
      seen.add(signature);
      result.push(clean);
    }
    return { rows: result, duplicates };
  }
  function dateString(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
  }
  function dateIn(text, base) {
    const valid = (s) => {
      const d = new Date(s + "T12:00:00");
      return Number.isNaN(d.getTime()) || dateString(d) !== s ? "" : s;
    };
    let m = text.match(/(20\d{2})[年\/.\-](\d{1,2})[月\/.\-](\d{1,2})日?/);
    if (m)
      return valid(`${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`);
    const d = new Date(base + "T12:00:00");
    if (Number.isNaN(d.getTime())) throw Error("请选择有效会议日期");
    m = text.match(/(\d{1,2})月(\d{1,2})日/);
    if (m)
      return valid(
        `${d.getFullYear()}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`,
      );
    if (/后天|明天|今天/.test(text)) {
      d.setDate(
        d.getDate() + (/后天/.test(text) ? 2 : /明天/.test(text) ? 1 : 0),
      );
      return dateString(d);
    }
    m = text.match(/(本周|这周|下周|周|星期)([一二三四五六日天])/);
    if (m) {
      const target = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0 }[
          m[2]
        ],
        current = d.getDay(),
        monday = (current + 6) % 7,
        targetMonday = (target + 6) % 7;
      let delta = targetMonday - monday;
      if (m[1] === "下周") delta += 7;
      else if ((m[1] === "周" || m[1] === "星期") && delta < 0) delta += 7;
      d.setDate(d.getDate() + delta);
      return dateString(d);
    }
    return "";
  }
  function tasks(text, base) {
    if (!String(text).trim()) throw Error("请粘贴会议内容");
    const out = [];
    const lines = String(text)
      .replace(/\r/g, "")
      .split(/\n|[；;]/)
      .map((x) => x.trim())
      .filter(Boolean);
    for (const [index, line] of lines.entries()) {
      if (
        /^(?:(?:本次|此次|这次)?讨论|(?:会议|话题|主题|议题)(?:内容|主题)?)/.test(
          line,
        ) &&
        !/负责|待办|需要|请|安排|TODO|行动项/i.test(line)
      )
        continue;
      if (
        !/负责|待办|需要|请|安排|跟进|提交|完成|确认|处理|制作|检查|整理|采购|联系|更新|TODO|行动项/i.test(
          line,
        )
      )
        continue;
      if (/^(已经|已)(完成|处理)|^(没有|无需|不需要)(任务|处理)/.test(line))
        continue;
      const ownerMatch =
        line.match(/负责人[：:]\s*([^，,。；;\s]+)/) ||
        line.match(/(?:^|[，,。\s])@([\p{L}\p{N}_-]+)/u) ||
        line.match(/(?:^|[：:，,\s])(?:由|请)?([\p{L}]{2,12})负责/u);
      let owner = ownerMatch ? ownerMatch[1] : "";
      if (/^(需要|请|我们|大家|本周|下周|今天|明天)$/.test(owner)) owner = "";
      const deadlineText = (line.match(
        /20\d{2}[年\/.\-]\d{1,2}[月\/.\-]\d{1,2}日?|\d{1,2}月\d{1,2}日|(?:本周|这周|下周|周|星期)[一二三四五六日天]|后天|明天|今天/,
      ) || [""])[0];
      out.push({
        id: out.length + 1,
        task: line.replace(/^[-*\d、.)\s]+/, ""),
        owner,
        due: dateIn(line, base),
        deadlineText,
        status: "待处理",
        source: line,
        line: index + 1,
      });
    }
    return out;
  }
  function tokenize(text) {
    const norm = String(text).normalize("NFKC").toLocaleLowerCase();
    const words =
      norm.match(/[a-z0-9]+|[\uac00-\ud7af]{2,}|[\u4e00-\u9fff]+/g) || [];
    const tokens = [];
    for (const word of words) {
      if (/^[\u4e00-\u9fff]+$/.test(word)) {
        if (word.length === 1) tokens.push(word);
        else
          for (let i = 0; i < word.length - 1; i++)
            tokens.push(word.slice(i, i + 2));
      } else tokens.push(word);
    }
    return tokens;
  }
  function chunks(documents) {
    const result = [];
    for (const doc of documents) {
      const lines = String(doc.text).replace(/\r/g, "").split("\n");
      let text = "",
        start = 1,
        endLine = 1;
      const flush = () => {
        if (text.trim())
          result.push({
            name: doc.name,
            start,
            end: Math.max(start, endLine),
            text: text.trim(),
            tokens: tokenize(text),
          });
        text = "";
      };
      for (let i = 0; i < lines.length; i++) {
        const fragments = lines[i].match(/[\s\S]{1,1000}/g) || [""];
        for (const fragment of fragments) {
          if (text.length + fragment.length > 1100 && text) flush();
          if (!text) start = i + 1;
          endLine = i + 1;
          text += fragment + "\n";
        }
        if (!lines[i].trim() && text.length > 180) flush();
      }
      flush();
    }
    return result;
  }
  function search(documents, query, limit = 10) {
    const terms = [...new Set(tokenize(query))];
    if (!terms.length) throw Error("请输入至少一个文字或数字关键词");
    const corpus = chunks(documents);
    if (!corpus.length) return [];
    const average =
      corpus.reduce((s, c) => s + c.tokens.length, 0) / corpus.length || 1;
    const frequency = new Map(
      terms.map((t) => [t, corpus.filter((c) => c.tokens.includes(t)).length]),
    );
    const phrase = normalize(query);
    return corpus
      .map((c) => {
        let score = 0,
          matched = 0;
        const counts = new Map();
        for (const t of c.tokens) counts.set(t, (counts.get(t) || 0) + 1);
        for (const t of terms) {
          const count = counts.get(t) || 0;
          if (count) {
            matched++;
            const df = frequency.get(t);
            const idf = Math.log(1 + (corpus.length - df + 0.5) / (df + 0.5));
            score +=
              (idf * count * 2.2) /
              (count + 1.2 * (0.25 + (0.75 * c.tokens.length) / average));
          }
        }
        if (phrase && normalize(c.text).includes(phrase)) score += 2;
        return { ...c, score, matched };
      })
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, limit);
  }
  return {
    num,
    round,
    profit,
    quote,
    inventory,
    normalize,
    reconcile,
    cleanRows,
    dateIn,
    tasks,
    tokenize,
    chunks,
    search,
  };
});
