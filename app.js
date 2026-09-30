(function(){
  "use strict";
  const U=Pandao,E=ToolEditor,P=Planning;
  E.workbench({key:"timesheet",title:"工时与服务费用计算器",icon:"◴",category:"服务业务",description:"记录人员与项目工时，汇总可计费工时和服务费用。",repo:"https://github.com/tianchaodaxing-beep/pandao-timesheet",inputTitle:"工时记录",outputTitle:"工时与费用",columns:[{label:"日期",key:"date",type:"date"},{label:"人员",key:"person"},{label:"项目",key:"project"},{label:"工时",key:"hours",type:"number",default:1},{label:"小时单价",key:"rate",type:"number",default:0},{label:"是否计费",key:"billable",default:"是",choices:["是","否"]}],examples:[{date:"2026-09-28",person:"演示人员甲",project:"演示服务项目",hours:3.5,rate:200,billable:"是"},{date:"2026-09-28",person:"演示人员乙",project:"演示服务项目",hours:4,rate:180,billable:"是"},{date:"2026-09-29",person:"演示人员甲",project:"内部培训",hours:2,rate:200,billable:"否"}],parameters:[["币种","currency","人民币"]],calculateLabel:"汇总工时费用",exportLabel:"导出工时费用",compute:rows=>P.timesheets(rows),export:(v,p)=>v.details.map(r=>({币种:p.currency,日期:r.date,人员:r.person,项目:r.project,工时:r.hours,小时单价:r.rate,是否计费:r.billable,服务费用:r.amount})),view:(v,p)=>[
    U.metrics([["全部工时",v.hours,"小时"],["可计费工时",v.billableHours,"小时"],["服务费用",U.money(v.amount),p.currency]]),
    E.heading("人员工时"),E.bars(v.people.map(r=>({label:r.name,value:r.hours})),n=>n+"小时"),
    E.heading("项目汇总"),E.table([{label:"项目",key:"name"},{label:"工时",key:"hours",number:true},{label:"服务费用",value:r=>U.money(r.amount),number:true}],v.projects),
    E.heading("人员汇总"),E.table([{label:"人员",key:"name"},{label:"工时",key:"hours",number:true},{label:"服务费用",value:r=>U.money(r.amount),number:true}],v.people)
  ]});
})();
