(function (root) {
  "use strict";
  const h = (tag, attrs = {}, children = []) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "text") node.textContent = v;
      else if (k === "class") node.className = v;
      else if (k.startsWith("on") && typeof v === "function")
        node.addEventListener(k.slice(2), v);
      else if (v !== false && v !== null && v !== undefined)
        node.setAttribute(k, String(v));
    }
    for (const child of [].concat(children)) {
      if (child !== null && child !== undefined)
        node.append(
          child instanceof Node
            ? child
            : document.createTextNode(String(child)),
        );
    }
    return node;
  };
  function clear(node) {
    node.replaceChildren();
    return node;
  }
  function panel(title) {
    const el = h("section", { class: "panel" }, h("h2", { text: title }));
    return el;
  }
  function field(label, name, value = "", type = "text", options = null) {
    const input = options
      ? h(
          "select",
          { name, id: name },
          options.map((o) =>
            h("option", {
              value: typeof o === "string" ? o : o[0],
              text: typeof o === "string" ? o : o[1],
            }),
          ),
        )
      : h(type === "textarea" ? "textarea" : "input", {
          name,
          id: name,
          type: type === "textarea" ? null : type,
          value: type === "textarea" ? null : value,
          step: type === "number" ? "any" : null,
        });
    input.value = value;
    const wrap = h("label", { class: "field" }, [
      h("span", { text: label }),
      input,
    ]);
    return { wrap, input };
  }
  function button(text, fn, primary = false) {
    return h("button", {
      type: "button",
      class: "btn" + (primary ? " primary" : ""),
      text,
      onclick: run(fn),
    });
  }
  function actions(...buttons) {
    return h("div", { class: "actions" }, buttons);
  }
  function notice(message, error = false) {
    const n = document.querySelector("#notice");
    n.textContent = message;
    n.className = "notice show" + (error ? " error" : "");
    if (error) n.scrollIntoView({ block: "nearest" });
  }
  function run(fn) {
    return (...args) => {
      try {
        const n = document.querySelector("#notice");
        if (n) n.className = "notice";
        const r = fn(...args);
        if (r && typeof r.then === "function")
          r.catch((e) => notice(e.message, true));
      } catch (e) {
        notice(e.message, true);
      }
    };
  }
  function source(text) {
    document.querySelector("#source").textContent = text;
  }
  function mount(meta) {
    document.title = meta.title + " · PANDAO";
    clear(document.body);
    document.body.append(
      h("header", { class: "topbar" }, [
        h("div", { class: "brand", text: "PANDAO 工具" }),
        h("a", {
          href: "https://github.com/tianchaodaxing-beep/pandao-open-tools",
          target: "_blank",
          rel: "noopener",
          text: "全部工具 ↗",
        }),
      ]),
    );
    const input = h("div", { class: "input-col" }),
      output = h("div", { class: "output-col" });
    const main = h("main", { class: "layout" }, [
      h("div", { class: "intro" }, [
        h("div", { class: "mark", "aria-hidden": true, text: meta.icon }),
        h("div", {}, [
          h("p", { class: "eyebrow", text: meta.category }),
          h("h1", { text: meta.title }),
          h("p", { class: "subtitle", text: meta.description }),
        ]),
      ]),
      h("div", { class: "source" }, [
        h("span", { id: "source", text: "演示数据" }),
        h("span", { class: "tag", text: "数据在本机处理" }),
      ]),
      h("div", {
        id: "notice",
        role: "status",
        "aria-live": "polite",
        class: "notice",
      }),
      h("div", { class: "workspace" }, [input, output]),
    ]);
    document.body.append(
      main,
      h("footer", {}, [
        h("span", { text: "PANDAO · 开源业务工具" }),
        h("a", {
          href: meta.repo + "/issues",
          target: "_blank",
          rel: "noopener",
          text: "使用反馈与定制需求 ↗",
        }),
      ]),
    );
    return { input, output };
  }
  function table(columns, rows) {
    const head = h(
      "thead",
      {},
      h(
        "tr",
        {},
        columns.map((c) => h("th", { text: c.label || c })),
      ),
    );
    const body = h(
      "tbody",
      {},
      rows.map((row) =>
        h(
          "tr",
          {},
          columns.map((c) =>
            h("td", {
              class: c.wrap ? "wrap" : c.number ? "numeric" : "",
              text:
                typeof c === "string"
                  ? (row[c] ?? "")
                  : typeof c.value === "function"
                    ? c.value(row)
                    : (row[c.key] ?? ""),
            }),
          ),
        ),
      ),
    );
    return h("div", { class: "table-wrap" }, h("table", {}, [head, body]));
  }
  function metrics(items) {
    return h(
      "div",
      { class: "metrics" },
      items.map((i) =>
        h("div", { class: "metric" }, [
          h("div", { class: "label", text: i[0] }),
          h("div", { class: "value", text: i[1] }),
          h("div", { class: "unit", text: i[2] || "" }),
        ]),
      ),
    );
  }
  function number(value, label, min = -Infinity, max = Infinity) {
    if (value === null || value === undefined || String(value).trim() === "")
      throw Error("请填写" + label);
    const n = Number(String(value).replace(/,/g, ""));
    if (!Number.isFinite(n) || n < min || n > max)
      throw Error(
        label +
          "须为" +
          (min === -Infinity
            ? "有效数字"
            : min + "至" + (max === Infinity ? "更大" : max) + "之间的数字"),
      );
    return n;
  }
  function money(n) {
    return new Intl.NumberFormat("zh-CN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  }
  function values(form) {
    return Object.fromEntries(new FormData(form));
  }
  function download(name, data, type = "text/plain;charset=utf-8") {
    const url = URL.createObjectURL(new Blob([data], { type }));
    const a = h("a", { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  function safeCell(value) {
    return typeof value === "string" && /^[\s]*[=+@-]/.test(value)
      ? "'" + value
      : value;
  }
  function exportRows(name, rows) {
    if (!rows.length) throw Error("没有可导出的结果");
    const safe = rows.map((r) =>
      Object.fromEntries(Object.entries(r).map(([k, v]) => [k, safeCell(v)])),
    );
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(safe), "结果");
    XLSX.writeFile(book, name.endsWith(".xlsx") ? name : name + ".xlsx");
  }
  async function readRows(file, dateHeaders = []) {
    if (!file) throw Error("请选择表格");
    if (file.size > 10 * 1024 * 1024) throw Error("请选择小于10 MB的表格");
    if (!/\.(xlsx|xls|csv|tsv)$/i.test(file.name))
      throw Error("请选择 Excel 或 CSV 表格");
    let book;
    if (/\.(csv|tsv)$/i.test(file.name)) {
      const bytes = await file.arrayBuffer();
      let txt = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      if (txt.includes("\uFFFD"))
        txt = new TextDecoder("gb18030").decode(bytes);
      book = XLSX.read(txt, { type: "string", raw: true });
    } else
      book = XLSX.read(await file.arrayBuffer(), {
        type: "array",
        cellDates: dateHeaders.length > 0,
      });
    const sheet = book.Sheets[book.SheetNames[0]];
    if (!sheet) throw Error("表格没有工作表");
    const data = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      blankrows: false,
    });
    if (!data.length) throw Error("表格没有数据");
    if (data.length > 20001) throw Error("单次最多读取20,000行，请拆分文件");
    const headers = data.shift().map((x) =>
      String(x)
        .replace(/^\uFEFF/, "")
        .trim(),
    );
    if (headers.some((x) => !x) || new Set(headers).size !== headers.length)
      throw Error("第一行须为非空且不重复的列名");
    const rows = data
      .filter((r) => r.some((x) => String(x).trim()))
      .map((r) => Object.fromEntries(headers.map((k, i) => {
        const v = r[i];
        const value = dateHeaders.includes(k) && v instanceof Date
          ? [v.getFullYear(), String(v.getMonth() + 1).padStart(2, "0"), String(v.getDate()).padStart(2, "0")].join("-")
          : v ?? "";
        return [k, value];
      })));
    if (!rows.length) throw Error("表格没有数据行，请填写模板后重新选择");
    return { headers, rows, name: file.name };
  }
  function fileInput(
    label,
    onRead,
    multiple = false,
    accept = ".xlsx,.xls,.csv,.tsv",
  ) {
    const input = h("input", { type: "file", accept, multiple });
    input.addEventListener(
      "change",
      run(async () => {
        const fs = Array.from(input.files);
        if (!fs.length) return;
        await onRead(multiple ? fs : fs[0]);
      }),
    );
    return h("label", { class: "field filedrop" }, [
      h("span", { text: label }),
      input,
    ]);
  }
  function dataPanel(title, template, onRead) {
    const p = panel(title);
    p.append(
      fileInput("选择表格", async (f) => {
        const data = await readRows(f);
        await onRead(data);
        source("文件：" + f.name);
        notice("已读取 " + data.rows.length + " 行");
      }),
      actions(
        button(
          "下载输入模板",
          run(() => exportRows("输入模板.xlsx", template)),
        ),
      ),
    );
    return p;
  }
  root.Pandao = {
    h,
    clear,
    panel,
    field,
    button,
    actions,
    notice,
    run,
    source,
    mount,
    table,
    metrics,
    number,
    money,
    values,
    download,
    safeCell,
    exportRows,
    readRows,
    fileInput,
    dataPanel,
  };
})(globalThis);
