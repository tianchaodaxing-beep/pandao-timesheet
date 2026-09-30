(function(root){
  "use strict";
  const U=root.Pandao;
  function workbench(config){
    const app=U.mount(config),input=U.panel(config.inputTitle),output=U.panel("结果"),form=U.h("form"),grid=U.h("div",{class:"grid"});
    document.body.classList.add("planning-tool");
    if(config.key==="schedule")document.body.classList.add("schedule-tool");
    for(const [label,key,value,type,choices] of config.parameters||[])grid.append(U.field(label,key,value,type||"text",choices).wrap);
    form.append(grid);input.append(form);
    let records=config.examples.map(r=>({...r})),page=0,fresh=false;const size=10;
    const edit=U.h("div"),pages=U.h("div",{class:"actions"});
    function invalidate(){fresh=false;U.source("手动资料");U.clear(output).append(U.h("h2",{text:"结果"}),U.h("p",{class:"empty",text:"资料已更改，请重新计算。"}));}
    form.addEventListener("input",invalidate);form.addEventListener("change",invalidate);
    function params(){const p=U.values(form);if('currency' in p&&!p.currency.trim())throw Error("请填写币种");return p;}
    function mapped(data){
      const missing=config.columns.filter(c=>!data.headers.includes(c.label));
      if(missing.length)throw Error("表格缺少列："+missing.map(c=>c.label).join("、")+"。请使用输入模板。");
      return data.rows.map(row=>Object.fromEntries(config.columns.map(c=>[c.key,row[c.label]])));
    }
    function render(){
      page=Math.min(page,Math.max(0,Math.ceil(records.length/size)-1));
      const head=U.h("thead",{},U.h("tr",{},[...config.columns.map(c=>U.h("th",{text:c.label})),U.h("th",{text:"操作"})]));
      const body=U.h("tbody",{},records.slice(page*size,(page+1)*size).map((r,i)=>{
        const index=page*size+i;
        return U.h("tr",{},[...config.columns.map(c=>{
          const f=U.field(c.label,"row-"+index+"-"+c.key,r[c.key]??"",c.type||"text",c.choices);
          f.input.setAttribute("aria-label","第"+(index+1)+"行"+c.label);
          f.input.addEventListener("input",()=>{r[c.key]=f.input.value;invalidate();});
          f.input.addEventListener("change",()=>{r[c.key]=f.input.value;invalidate();});
          return U.h("td",{},f.input);
        }),U.h("td",{},U.button("移除",()=>{records.splice(index,1);render();invalidate();}))]);
      }));
      U.clear(edit).append(U.h("div",{class:"table-wrap editor-table"},U.h("table",{},[head,body])));
      U.clear(pages).append(U.button("上一页",()=>{if(page>0){page--;render();}}),U.h("span",{class:"page-state",text:"第"+(page+1)+" / "+Math.max(1,Math.ceil(records.length/size))+"页 · 共"+records.length+"行"}),U.button("下一页",()=>{if((page+1)*size<records.length){page++;render();}}));
    }
    function display(value){fresh=true;U.clear(output).append(U.h("h2",{text:config.outputTitle}),...config.view(value,params()),U.actions(U.button(config.exportLabel,()=>{if(!fresh)throw Error("请先重新计算");const v=config.compute(records,params());U.exportRows(config.title+".xlsx",config.export(v,params()));})) );}
    function calculate(){const value=config.compute(records,params());display(value);}
    input.append(edit,pages,U.actions(U.button("添加一行",()=>{if(records.length>=20000)throw Error("单次最多20,000行");records.push(Object.fromEntries(config.columns.map(c=>[c.key,c.default??""])));page=Math.floor((records.length-1)/size);render();invalidate();}),U.button("恢复演示",()=>{records=config.examples.map(r=>({...r}));page=0;render();calculate();U.source("演示数据");}),U.button(config.calculateLabel,calculate,true)));
    const files=U.panel("导入与模板");
    files.append(U.fileInput("选择表格",async file=>{
      const data=await U.readRows(file,config.columns.filter(c=>c.type==="date").map(c=>c.label));
      const candidate=mapped(data),value=config.compute(candidate,params());
      records=candidate;page=0;render();display(value);U.source("文件："+file.name);U.notice("已读取 "+records.length+" 行");
    }),U.actions(U.button("下载输入模板",()=>U.exportRows("输入模板.xlsx",config.examples.map(r=>Object.fromEntries(config.columns.map(c=>[c.label,r[c.key]??""])))))));
    app.input.append(input,files);app.output.append(output);render();calculate();U.source("演示数据");
    return {app,output};
  }
  function bars(items,format=U.money){
    const max=Math.max(0,...items.map(r=>Math.max(0,r.value)));
    const chart=U.h("div",{class:"business-bars"},items.slice(0,500).map(r=>U.h("div",{class:"business-bar"},[U.h("div",{class:"bar-label"},[U.h("span",{text:r.label}),U.h("strong",{text:format(r.value)})]),U.h("div",{class:"bar-track"},U.h("div",{class:"bar-fill"+(r.alert?" alert":""),style:"width:"+(max?r.value/max*100:0)+"%"}))])));
    if(items.length>500)chart.prepend(U.h("p",{text:"图表预览前500项；导出包含全部结果。"}));return chart;
  }
  function table(columns,rows){const t=U.table(columns,rows.slice(0,500));if(rows.length>500)return U.h("div",{},[U.h("p",{text:"表格预览前500行；导出包含全部结果。"}),t]);return t;}
  function heading(text){return U.h("h3",{text});}
  root.ToolEditor={workbench,bars,table,heading};
})(globalThis);
