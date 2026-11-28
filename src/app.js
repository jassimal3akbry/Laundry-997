/* حماية التخزين: إن مُنع localStorage/sessionStorage (نوافذ مدمجة أو وضع خصوصية) يعمل النظام بتخزين مؤقت في الذاكرة */
(function(){
  ["localStorage","sessionStorage"].forEach(function(n){
    var ok=false;
    try{var s=window[n];s.setItem("__t","1");s.removeItem("__t");ok=true;}catch(e){}
    if(ok)return;
    var m={};
    var fake={getItem:function(k){return Object.prototype.hasOwnProperty.call(m,k)?m[k]:null},setItem:function(k,v){m[k]=String(v)},removeItem:function(k){delete m[k]},clear:function(){m={}},key:function(i){return Object.keys(m)[i]||null},get length(){return Object.keys(m).length}};
    try{Object.defineProperty(window,n,{value:fake,configurable:true});}catch(e){try{window[n]=fake}catch(e2){}}
    if(n==="localStorage")window.__l997MemStorage=true; // تحذير «لن يُحفظ شيء» فقط إن مُنع التخزين الدائم
  });
})();
(function(){
 const EXT_KEYS={expenses:'l997_expenses',inventory:'l997_inventory',purchases:'l997_purchases',suppliers:'l997_suppliers',employees:'l997_employees',attendance:'l997_attendance',payroll:'l997_payroll',closures:'l997_closures',audit:'l997_audit',recurringExpenses:'l997_recurring_expenses',stockMoves:'l997_stock_moves'};
 const load=(k,d)=>{try{return JSON.parse(localStorage.getItem(k)||'null')??d}catch{return d}}; const save=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){if(window.__l997StorageFail)window.__l997StorageFail(e);return false}}; const uid=()=>crypto.randomUUID?crypto.randomUUID():'id-'+Date.now()+'-'+Math.random();
 let expenses=load(EXT_KEYS.expenses,[]),inventory=load(EXT_KEYS.inventory,[]); // تبدأ فارغة: لا كميات أو تكاليف مخترعة — المالك يضيف مواده الحقيقية
 let purchases=load(EXT_KEYS.purchases,[]),suppliers=load(EXT_KEYS.suppliers,[]),employees=load(EXT_KEYS.employees,[]);
 let stockMoves=load(EXT_KEYS.stockMoves,[]);
 let attendance=load(EXT_KEYS.attendance,[]),payroll=load(EXT_KEYS.payroll,[]),closures=load(EXT_KEYS.closures,[]),audit=load(EXT_KEYS.audit,[]),recurringExpenses=load(EXT_KEYS.recurringExpenses,[]);
 const lsStr=(k,d='')=>{try{const v=localStorage.getItem(k);if(v===null)return d;try{const p=JSON.parse(v);return typeof p==='string'?p:String(p)}catch(e){return v}}catch(e){return d}};
 const AUDIT_MAX=4000;
 const SECRET_KEYS=/pass|pwd|secret|token/i;
 const scrubMeta=(m,d=0)=>{if(m===null||typeof m!=='object')return typeof m==='string'&&m.length>200?m.slice(0,200)+'…':m;if(d>2)return '…';if(Array.isArray(m))return m.slice(0,10).map(x=>scrubMeta(x,d+1));const o={};Object.keys(m).slice(0,25).forEach(k=>{o[k]=SECRET_KEYS.test(k)?'***':scrubMeta(m[k],d+1)});return o};
 const classifyAction=(s)=>{s=String(s||'');
  if(/دخول|صلاحي|كلمة|نسخة احتياطية|استعادة|ملف المنشأة|تعديل أسعار|حساب المدير|تبديل الدور|فرع|login|permission|password|backup|restore|price/i.test(s))return 'system';
  if(/موظف|حضور|مستخدم|راتب|employee|payroll|attendance|user/i.test(s))return 'staff';
  if(/مخزون|مادة|مورد|جرد|مشترى|stock|supplier|material/i.test(s))return 'inventory';
  if(/مصروف|إغلاق|expense|closing/i.test(s))return 'money';
  if(/عميل|رصيد|إيداع|استرداد نقدي|عكس|تسوية|باقة|customer|balance|deposit|package/i.test(s))return 'customers';
  if(/طلب|تسليم|تجهيز|دفع|إرجاع|تعليق|قطعة|order|deliver|ready|payment/i.test(s))return 'orders';
  return 'other'};
 const isSensitiveAction=(s)=>/حذف|إلغاء|ألغي|عكس|استرداد|تسوية|صلاحي|استعادة|كلمة|أسعار|إرجاع|تعطيل|دخول|نسخة احتياطية|إغلاق|خصم رصيد|فاشلة|delete|cancel|revers|refund|adjust|permission|restore|password|price|login|disable|closing|failed/i.test(String(s||''));
 // سلسلة تحقق لكل جهاز: كل قيد يحمل بصمة (SHA-256) تشمل بصمة القيد السابق من نفس الجهاز ورقمه التسلسلي —
 // أي تعديل لقيد أو حذف قيد من وسط السجل يظهر في «فحص سلامة السجل» (والسحابة ترفض تعديل أو حذف القيود أصلاً)
 const auditDev=()=>{try{let d=localStorage.getItem('l997_device_id');if(!d){d=Math.random().toString(16).slice(2,10)+Date.now().toString(16).slice(-4);localStorage.setItem('l997_device_id',d)}return d}catch(e){return 'nodev'}};
 const auditCanon=(e)=>[e.id,e.action,e.value,e.at,e.who,e.user,e.dev,e.n,e.prev].join('|');
 const log=(action,value=0,meta={})=>{let m;try{m=scrubMeta(meta);if(JSON.stringify(m).length>1500)m={_truncated:true}}catch(e){m={}}
  const entry={id:uid(),action,value:Number(value)||0,meta:m,at:new Date().toISOString(),user:lsStr('l997_role','مدير')||'مدير',who:lsStr('l997_user',''),cat:m&&m.sec?'system':classifyAction(action),sens:(m&&m.sec)||isSensitiveAction(action)?1:0};
  try{if(typeof window.sha256Hex997==='function'){const dev=auditDev();let tip={};try{tip=JSON.parse(localStorage.getItem('l997_audit_tip')||'{}')||{}}catch(e){tip={}}
   entry.dev=dev;entry.n=(Number(tip.n)||0)+1;entry.prev=tip.h||'';entry.h=window.sha256Hex997(auditCanon(entry));localStorage.setItem('l997_audit_tip',JSON.stringify({n:entry.n,h:entry.h}))}}catch(e){}
  audit.unshift(entry);
  if(audit.length>AUDIT_MAX)audit.length=AUDIT_MAX;save(EXT_KEYS.audit,audit)};
 try{if(!localStorage.getItem('l997_audit_scrubbed')){audit=audit.map(e=>({...e,meta:scrubMeta(e.meta||{})}));if(audit.length>AUDIT_MAX)audit.length=AUDIT_MAX;save(EXT_KEYS.audit,audit);localStorage.setItem('l997_audit_scrubbed','1')}}catch(e){}
 const r3=n=>+(Number(n||0)).toFixed(3);
 const stockMove=(it,type,qty,extra={})=>{const m={id:uid(),at:new Date().toISOString(),itemId:it.id,itemName:it.name,unit:it.unit,type,qty:r3(qty),balanceAfter:r3(it.qty),user:lsStr('l997_role',''),...extra};stockMoves.unshift(m);if(stockMoves.length>3000)stockMoves.length=3000;save(EXT_KEYS.stockMoves,stockMoves);return m};
 window.L997Enterprise={
  // بعد تطبيق تحديثات السحابة بدون إعادة تحميل الصفحة
  reloadData(){expenses=load(EXT_KEYS.expenses,[]);inventory=load(EXT_KEYS.inventory,[]);purchases=load(EXT_KEYS.purchases,[]);suppliers=load(EXT_KEYS.suppliers,[]);employees=load(EXT_KEYS.employees,[]);stockMoves=load(EXT_KEYS.stockMoves,[]);attendance=load(EXT_KEYS.attendance,[]);payroll=load(EXT_KEYS.payroll,[]);closures=load(EXT_KEYS.closures,[]);audit=load(EXT_KEYS.audit,[]);recurringExpenses=load(EXT_KEYS.recurringExpenses,[])},
  data:{get expenses(){return expenses},get inventory(){return inventory},get purchases(){return purchases},get suppliers(){return suppliers},get employees(){return employees},get attendance(){return attendance},get payroll(){return payroll},get closures(){return closures},get audit(){return audit},get recurringExpenses(){return recurringExpenses},get stockMoves(){return stockMoves}},
  addExpense(x){const u=window.L997Auth&&window.L997Auth.user?window.L997Auth.user():null;x={id:uid(),date:new Date().toISOString(),byId:u?u.id:'',by:u?u.name:'',...x};expenses.unshift(x);save(EXT_KEYS.expenses,expenses);log('إضافة مصروف',x.amount,x);return x},
  deleteExpense(id){expenses=expenses.filter(x=>x.id!==id);save(EXT_KEYS.expenses,expenses)},
  // إلغاء مصروف خاطئ: يبقى ظاهراً (مشطوباً) للتدقيق ويُستبعد من كل الحسابات
  voidExpense(id,reason,by){const x=expenses.find(e=>e.id===id);if(!x||x.voided||x.purchaseId)return false;x.voided=true;x.voidedAt=new Date().toISOString();x.voidReason=reason;x.voidedBy=by||'';save(EXT_KEYS.expenses,expenses);log('إلغاء مصروف: '+(x.category||'')+' — السبب: '+reason,x.amount,{id,category:x.category});return true},
  addPurchase(x){
    const item=inventory.find(i=>i.id===x.inventoryId);if(!item)return null;
    const qty=r3(x.qty),unit=r3(x.unitCost);if(!(qty>0)||!(unit>=0))return null;
    const p={id:uid(),date:new Date().toISOString(),inventoryId:item.id,itemName:item.name,unit:item.unit,qty,unitCost:unit,total:r3(qty*unit),supplierId:x.supplierId||'',supplier:x.supplier||'',invoiceNo:x.invoiceNo||'',paid:x.paid!==false,method:x.method||'cash',voided:false};
    const oldVal=item.qty*(item.avgCost||0),newQty=r3(item.qty+qty);
    item.avgCost=newQty>0?+((oldVal+p.total)/newQty).toFixed(4):unit;item.lastCost=unit;item.qty=newQty;
    if(p.paid){const e=this.addExpense({category:'مشتريات مخزون',catId:'inventory',amount:p.total,method:p.method,note:item.name+(p.supplier?' — '+p.supplier:''),purchaseId:p.id});p.expenseId=e.id;p.paidAt=p.date}
    purchases.unshift(p);save(EXT_KEYS.purchases,purchases);save(EXT_KEYS.inventory,inventory);
    stockMove(item,'purchase',qty,{ref:p.id,note:p.supplier});log('شراء مخزون',p.total,p);return p},
  payPurchase(id,method){const p=purchases.find(x=>x.id===id);if(!p||p.voided||p.paid!==false)return false;
    const e=this.addExpense({category:'مشتريات مخزون',catId:'inventory',amount:p.total,method:method||'cash',note:p.itemName+(p.supplier?' — '+p.supplier:''),purchaseId:p.id});
    p.paid=true;p.method=method||'cash';p.expenseId=e.id;p.paidAt=new Date().toISOString();save(EXT_KEYS.purchases,purchases);log('تسديد مشترى آجل',p.total,{id});return true},
  voidPurchase(id){const p=purchases.find(x=>x.id===id);if(!p||p.voided)return {ok:false,reason:'none'};
    const item=inventory.find(i=>i.id===p.inventoryId);
    if(item){if(item.qty<p.qty)return {ok:false,reason:'stock'};
      const newQty=r3(item.qty-p.qty);if(newQty>0)item.avgCost=Math.max(0,+((item.qty*(item.avgCost||0)-p.total)/newQty).toFixed(4));
      item.qty=newQty;save(EXT_KEYS.inventory,inventory);stockMove(item,'void',-p.qty,{ref:p.id,note:p.supplier})}
    if(p.expenseId)this.deleteExpense(p.expenseId);
    p.voided=true;p.voidedAt=new Date().toISOString();save(EXT_KEYS.purchases,purchases);log('إلغاء شراء مخزون',p.total,{id});return {ok:true}},
  // تعديل شراء مسجّل بالخطأ (الكمية / سعر الوحدة): يُعدَّل المخزون ومتوسط التكلفة والمصروف المرتبط، ويُحفظ ما قبل التعديل
  editPurchase(id,x){const p=purchases.find(z=>z.id===id);if(!p||p.voided)return {ok:false,reason:'none'};
    const qty=r3(x.qty),unit=r3(x.unitCost);if(!(qty>0)||!(unit>0))return {ok:false,reason:'input'};
    const item=inventory.find(i=>i.id===p.inventoryId),dq=r3(qty-p.qty),newTotal=r3(qty*unit),dTotal=r3(newTotal-p.total);
    if(item){const newQ=r3(item.qty+dq);if(newQ<0)return {ok:false,reason:'stock',max:r3(p.qty-item.qty)};
      // قيمة المخزون: الكمية المضافة/المسحوبة بالسعر الجديد + فرق السعر على ما بقي من هذا الشراء فقط (المستهلك سابقاً لا يُعاد تقييمه)
      const oldVal=item.qty*(item.avgCost||0),dVal=dq*unit+(unit-r3(p.unitCost))*Math.min(r3(p.qty),item.qty);
      if(newQ>0)item.avgCost=Math.max(0,+((oldVal+dVal)/newQ).toFixed(4));
      item.qty=newQ;item.lastCost=unit;save(EXT_KEYS.inventory,inventory);if(dq)stockMove(item,'count',dq,{ref:p.id,note:'تعديل شراء'+(x.reason?' — '+x.reason:'')})}
    const u=window.L997Auth&&window.L997Auth.user?window.L997Auth.user():null;
    (p.edits=p.edits||[]).push({at:new Date().toISOString(),by:u?u.name:'',reason:x.reason||'',before:{qty:p.qty,unitCost:p.unitCost,total:p.total},after:{qty,unitCost:unit,total:newTotal}});
    const beforeTxt=`${p.qty} × ${p.unitCost} = ${p.total}`;
    p.qty=qty;p.unitCost=unit;p.total=newTotal;
    if(p.expenseId){const ex=expenses.find(e=>e.id===p.expenseId);if(ex){ex.amount=newTotal;save(EXT_KEYS.expenses,expenses)}}
    save(EXT_KEYS.purchases,purchases);log(`تعديل شراء مخزون «${p.itemName}»: ${beforeTxt} → ${qty} × ${unit} = ${newTotal}${x.reason?' — '+x.reason:''}`,dTotal,{id});return {ok:true}},
  consumeStock(id,qty,reason='usage',note=''){const i=inventory.find(x=>x.id===id);qty=r3(qty);if(!i||!(qty>0)||qty>i.qty)return false;
    i.qty=r3(i.qty-qty);save(EXT_KEYS.inventory,inventory);stockMove(i,'out',-qty,{reason,note});log('صرف مخزون',qty*(i.avgCost||0),{inventoryId:id,qty,reason});return true},
  adjustStock(id,newQty,note=''){const i=inventory.find(x=>x.id===id);if(!i)return null;newQty=r3(newQty);if(!(newQty>=0))return null;const diff=r3(newQty-i.qty);if(diff===0)return null;
    i.qty=newQty;save(EXT_KEYS.inventory,inventory);stockMove(i,'count',diff,{note});log('تسوية جرد',Math.abs(diff)*(i.avgCost||0),{inventoryId:id,diff});return diff},
  addMaterial(x){const qty=r3(x.qty);const it={id:uid(),name:x.name,unit:x.unit||'—',category:x.category||'other',qty,minQty:Number(x.minQty)||0,targetQty:Number(x.targetQty)||0,avgCost:Number(x.avgCost)||0,lastCost:Number(x.avgCost)||0,supplierId:x.supplierId||''};
    inventory.unshift(it);save(EXT_KEYS.inventory,inventory);if(qty>0)stockMove(it,'opening',qty,{});log('إضافة مادة جديدة',0,it);return it},
  updateMaterial(id,patch){const i=inventory.find(x=>x.id===id);if(!i)return;patch={...patch};delete patch.qty;Object.assign(i,patch);save(EXT_KEYS.inventory,inventory);log('تعديل مادة',0,{id,patch})},
  addSupplier(x){x={id:uid(),name:'',phone:'',notes:'',...x};suppliers.unshift(x);save(EXT_KEYS.suppliers,suppliers);log('إضافة مورد',0,x);return x},
  updateSupplier(id,patch){const s=suppliers.find(x=>x.id===id);if(!s)return;Object.assign(s,patch);save(EXT_KEYS.suppliers,suppliers);log('تعديل مورد',0,{id})},
  deleteSupplier(id){suppliers=suppliers.filter(x=>x.id!==id);inventory.forEach(i=>{if(i.supplierId===id)i.supplierId=''});save(EXT_KEYS.suppliers,suppliers);save(EXT_KEYS.inventory,inventory);log('حذف مورد',0,{id})},
  deleteMaterial(id){inventory=inventory.filter(x=>x.id!==id);save(EXT_KEYS.inventory,inventory);log('حذف مادة',0,{id})},
  closeDay(snapshot){const c={id:uid(),type:'daily',date:new Date().toISOString(),...snapshot};closures.unshift(c);save(EXT_KEYS.closures,closures);log('إغلاق يومي',snapshot.revenue||0,c);return c},
  closeMonth(snapshot){const c={id:uid(),type:'monthly',date:new Date().toISOString(),...snapshot};closures.unshift(c);save(EXT_KEYS.closures,closures);log('إغلاق شهري',snapshot.revenue||0,c);return c},
  addEmployee(x){x={id:uid(),active:true,salary:0,commission:0,...x};employees.unshift(x);save(EXT_KEYS.employees,employees);log('إضافة موظف',0,x);return x},
  addAttendance(x){x={id:uid(),date:new Date().toISOString(),status:'present',...x};attendance.unshift(x);save(EXT_KEYS.attendance,attendance);log('تسجيل حضور',0,x);return x},
  addPayrollTx(x){const sign=(x.type==='deduction'||x.type==='advance')?-1:1;x={id:uid(),date:new Date().toISOString(),net:sign*Math.abs(Number(x.amount||0)),...x};payroll.unshift(x);save(EXT_KEYS.payroll,payroll);log('حركة راتب: '+(x.type||''),x.net,x);return x},
  addRecurringExpense(x){x={id:uid(),active:true,lastAppliedPeriod:null,...x};recurringExpenses.unshift(x);save(EXT_KEYS.recurringExpenses,recurringExpenses);log('إضافة مصروف متكرر',x.amount,x);return x},
  deleteRecurringExpense(id){recurringExpenses=recurringExpenses.filter(x=>x.id!==id);save(EXT_KEYS.recurringExpenses,recurringExpenses)},
  updateRecurringExpense(id,patch){const r=recurringExpenses.find(x=>x.id===id);if(!r)return;Object.assign(r,patch);save(EXT_KEYS.recurringExpenses,recurringExpenses)},
  applyRecurringExpenses(){
    const now=new Date(); const dayKey=window.L997Finance.todayStr(); const monthKey=dayKey.slice(0,7); // يوم العمل بتوقيت البحرين
    let appliedCount=0;
    recurringExpenses.forEach(r=>{
      if(!r.active) return;
      const key = r.frequency==='monthly' ? monthKey : dayKey;
      // يُقبل المفتاح القديم المبني على UTC حتى لا يتكرر المصروف مرة عند التحويل للتوقيت المحلي
      if(r.lastAppliedPeriod===key||(r.frequency!=='monthly'&&r.lastAppliedPeriod===now.toISOString().slice(0,10))) return;
      this.addExpense({category:r.name,catId:r.catId||undefined,amount:r.amount,method:'cash',note:'مصروف متكرر ('+(r.frequency==='monthly'?'شهري':'يومي')+')'});
      r.lastAppliedPeriod=key; appliedCount++;
    });
    save(EXT_KEYS.recurringExpenses,recurringExpenses);
    return appliedCount;
  },
  log, classify:classifyAction, isSensitive:isSensitiveAction, auditCanon, deviceId:auditDev
 };
})();

/* ===== next module ===== */

/* ==========================================================================
   997 Laundry — app.js (نسخة ثنائية اللغة: عربي / إنجليزي)
   ========================================================================== */
(function () {
  "use strict";

  /* --------------------------- تخزين المفاتيح --------------------------- */
  const KEYS = {
    settings: "l997_settings",
    customers: "l997_customers",
    orders: "l997_orders",
    ledger: "l997_ledger",
    activity: "l997_activity",
    lang: "l997_lang",
    customerPackages: "l997_customer_packages",
  };

  /* ------------------------------ الترجمة ------------------------------ */
  const I18N = {
    ar: {
      brandTagline: "نظام إدارة المغسلة",
      nav_dashboard: "الرئيسية", nav_neworder: "طلب جديد", nav_orders: "الطلبات",
      nav_customers: "العملاء", nav_balances: "الأرصدة", nav_reports: "التقارير", nav_settings: "الإعدادات",
      search_orders_ph: "ابحث برقم الطلب أو العميل أو الجوال",
      viewAll: "عرض الكل",
      dash_attention_title: "طلبات تحتاج الانتباه", dash_attention_sub: "المتأخر، المستعجل، والجاهز منذ فترة",
      dash_activity_title: "حركة اليوم", dash_activity_sub: "آخر العمليات المسجلة",
      page_dashboard_title: "الرئيسية", page_dashboard_sub: "نظرة سريعة على حالة العمل اليوم",
      page_neworder_title: "طلب جديد", page_neworder_sub: "سجّل طلب عميل جديد خطوة بخطوة",
      page_orders_title: "الطلبات", page_orders_sub: "تحديث الحالة والوصول السريع لجميع الطلبات",
      page_customers_title: "العملاء", page_customers_sub: "بيانات العملاء والأرصدة",
      page_balances_title: "الأرصدة", page_balances_sub: "إدارة أرصدة العملاء وسجل الحركات",
      page_reports_title: "التقارير", page_reports_sub: "أداء المبيعات والخدمات",
      page_settings_title: "الإعدادات", page_settings_sub: "الرسوم والمدة الافتراضية وقائمة الأسعار",
      step1_title: "1. بيانات العميل", step1_sub: "ابحث برقم الجوال أو أضف عميلاً جديداً",
      ph_phone: "رقم الجوال", btn_search: "بحث", btn_new_customer: "عميل جديد",
      no_customer_selected: "لم يتم اختيار عميل بعد",
      step2_title: "2. إضافة الملابس والخدمات", step2_sub: "اختر نوع القطعة ثم الخدمة والكمية",
      ph_item_note: "ملاحظة للقطعة - اختياري", btn_add_item: "إضافة للطلب",
      th_cloth: "القطعة", th_service: "الخدمة", th_qty: "العدد", th_unit: "سعر الوحدة",
      th_total: "الإجمالي", th_note: "ملاحظة", th_price: "السعر",
      step3_title: "3. تفاصيل الطلب", step3_sub: "الأولوية، الموعد، والملاحظات",
      lbl_order_type: "نوع الطلب", opt_normal: "عادي", opt_urgent: "⚡ مستعجل", opt_urgent_plain: "مستعجل",
      lbl_expected_delivery: "موعد التسليم المتوقع", lbl_internal_notes: "ملاحظات داخلية",
      ph_internal_notes: "بقعة، قطعة تالفة، تعليمات خاصة...",
      step4_title: "4. الدفع", step4_sub: "يمكن الدفع نقداً أو من الرصيد أو بشكل جزئي",
      lbl_payment_method: "طريقة الدفع", opt_cash: "نقداً", opt_benefitpay: "BenefitPay", opt_card: "بطاقة",
      opt_balance: "من رصيد العميل", opt_unpaid: "آجل / غير مدفوع", opt_bank_transfer: "تحويل بنكي",
      lbl_paid_amount: "المبلغ المدفوع", lbl_balance_use: "استخدام من الرصيد",
      summary_title: "ملخص الطلب", summary_sub: "يتم احتساب السعر تلقائياً",
      sum_pieces: "عدد القطع", sum_subtotal: "المجموع الأساسي", sum_urgent: "رسوم الاستعجال",
      sum_discount: "الخصم", sum_total: "الإجمالي", sum_balance: "رصيد العميل", sum_outstanding: "المتبقي على الطلب",
      btn_save_order: "حفظ الطلب", btn_save_print: "حفظ وطباعة", btn_whatsapp: "واتساب",
      orders_title: "إدارة الطلبات", orders_sub: "تحديث الحالة والوصول السريع لجميع الطلبات",
      opt_all_statuses: "كل الحالات", opt_all_priorities: "كل الأولويات",
      th_order: "الطلب", th_customer: "العميل", th_pieces: "القطع", th_value: "القيمة",
      th_priority: "الأولوية", th_status: "الحالة", th_expected: "موعد التسليم", th_actions: "الإجراءات",
      customers_sub: "بيانات العملاء، الطلبات السابقة، والأرصدة", btn_add_customer: "إضافة عميل",
      th_phone: "الجوال", th_area: "المنطقة", th_balance: "الرصيد", th_order_count: "عدد الطلبات", th_last_visit: "آخر زيارة",
      balance_title: "إدارة الرصيد", balance_sub: "إضافة أو خصم رصيد مع حفظ سجل العملية",
      lbl_customer: "العميل", lbl_tx_type: "نوع العملية", opt_credit: "إضافة رصيد", opt_debit: "خصم رصيد", opt_adjustment: "تسوية",
      lbl_amount: "المبلغ", lbl_note: "ملاحظة", btn_record_tx: "تسجيل العملية",
      ledger_title: "سجل العمليات المالية", ledger_sub: "آخر الحركات على أرصدة العملاء",
      report_by_payment: "المبيعات حسب طريقة الدفع", report_by_payment_sub: "إجمالي العمليات المسجلة",
      report_by_service: "الخدمات الأكثر استخداماً", report_by_service_sub: "حسب عدد القطع",
      settings_ops_title: "إعدادات التشغيل", settings_ops_sub: "الرسوم والمدة الافتراضية",
      lbl_urgent_percent: "نسبة رسوم الاستعجال %", lbl_normal_hours: "مدة الطلب العادي بالساعات",
      lbl_urgent_hours: "مدة الطلب المستعجل بالساعات", btn_save_settings: "حفظ الإعدادات",
      prices_title: "قائمة الأسعار", prices_sub: "يمكن تعديل السعر لكل نوع قطعة وخدمة",
      cust_dialog_title: "إضافة عميل جديد", cust_dialog_sub: "أدخل بيانات العميل الأساسية",
      lbl_customer_name: "اسم العميل", lbl_phone: "رقم الجوال", lbl_area: "المنطقة", lbl_address: "العنوان", lbl_notes: "ملاحظات",
      btn_cancel: "إلغاء", btn_save_customer: "حفظ العميل",
      role_admin: "مدير", role_worker: "عامل", role_owner: "مالك", role_manager: "مدير", role_accountant: "محاسب",
      switch_to_worker: "تبديل إلى عامل", switch_to_admin: "تبديل إلى مدير",
      lang_toggle_label: "English",
      empty_orders: "لا توجد طلبات هنا", empty_orders_filtered: "لا توجد طلبات مطابقة",
      empty_attention: "لا توجد طلبات تحتاج انتباهاً الآن 🎉", empty_activity: "لا توجد حركة مسجلة بعد",
      empty_customers: "لا يوجد عملاء بعد", empty_ledger: "لا توجد عمليات مسجلة بعد", empty_no_data: "لا توجد بيانات بعد",
      empty_no_orders_for_customer: "لا توجد طلبات لهذا العميل بعد", empty_no_items: "لم تتم إضافة أي قطع بعد",
      currency: "د.ب",
      toast_customer_selected: (name) => `تم اختيار العميل: ${name}`,
      toast_customer_not_found: "لم يتم العثور على عميل بهذا الرقم — جرّب إضافة عميل جديد",
      toast_pick_customer: "الرجاء اختيار العميل أولاً", toast_add_one_item: "أضف قطعة واحدة على الأقل",
      toast_order_saved: (n) => `تم حفظ الطلب #${n}`, toast_customer_saved: "تم حفظ العميل",
      toast_name_phone_required: "الاسم ورقم الجوال مطلوبان", toast_pick_customer_first: "اختر عميلاً أولاً",
      toast_valid_amount: "أدخل مبلغاً صحيحاً", toast_tx_recorded: "تم تسجيل العملية",
      toast_status_updated: "تم تحديث الحالة", toast_order_cancelled: "تم إلغاء الطلب",
      toast_settings_saved: "تم حفظ الإعدادات", toast_role: (r) => `تم الدخول كـ ${r}`,
      cust_search_ph: "ابحث بالاسم أو رقم الجوال", pos_search_ph: "ابحث عن صنف...", dlg_order_title: (n) => `طلب \u2066#${n}\u2069`, dlg_items: "القطع", dlg_payment: "الدفع", dlg_status: "الحالة", dlg_notes: "ملاحظات",
      dlg_payment_method: "طريقة الدفع", dlg_total: "الإجمالي", dlg_paid: "المدفوع", dlg_remaining: "المتبقي",
      dlg_advance_to: (s) => `الانتقال إلى «${s}»`, dlg_cancel_order: "إلغاء الطلب",
      dlg_send_whatsapp: "إرسال واتساب", dlg_print: "طباعة الإيصال", dlg_close: "إغلاق",
      status_change_direct: "تغيير مباشر للحالة...",
      customer_debtor: "عميل مدين",
      status_new: "طلب جديد", status_received: "تم الاستلام", status_sorting: "قيد الفرز",
      status_washing: "قيد الغسيل", status_ironing: "قيد الكي", status_ready: "جاهز للتسليم",
      status_delivered: "تم التسليم", status_cancelled: "ملغي",
      cloth_thob_cotton: "ثوب", cloth_thob_wool: "ثوب صوف", cloth_ghatra: "غترة", cloth_agal: "عقال",
      cloth_abaya_plain: "عباية", cloth_abaya_emb: "عباية مطرزة", cloth_shirt: "قميص", cloth_tshirt: "تيشيرت",
      cloth_pants_long: "بنطلون", cloth_pants_short: "بنطلون قصير", cloth_jacket: "جاكيت", cloth_overcoat: "كوت",
      cloth_suit2pcs: "بدلة", cloth_dress: "فستان", cloth_dress_long: "فستان طويل / سهرة", cloth_blouse: "بلوزة",
      cloth_miniskirt: "تنورة قصيرة", cloth_skirtlong: "تنورة", cloth_pullover: "فانلة / سويتر", cloth_necktie: "ربطة عنق",
      cloth_kurta_pyjama: "كورتا", cloth_undershirt2pcs: "بدلة داخلية (طقم)", cloth_underwear: "ملابس داخلية", cloth_socks: "جوارب",
      cloth_cap: "طاقية", cloth_bedsheet_single: "شرشف", cloth_bedsheet_double: "شرشف دبل", cloth_bedcover: "غطاء (كفر)",
      cloth_bedspread: "غطاء سرير كبير (مفرش)", cloth_blanket_single: "بطانية", cloth_blanket_double: "بطانية دبل", cloth_duvet: "لحاف",
      cloth_pillowcase: "كيس مخدة", cloth_bathtowel: "منشفة كبيرة", cloth_bathrobe: "روب حمام", cloth_curtain_per_m: "ستارة (لكل متر)",
      cloth_tablecloth: "مفرش طاولة", cloth_tablecloth_large: "غطاء طاولة كبير",
      cloth_bisht: "بشت", cloth_carpet_m2: "سجاد (للمتر)", cloth_dupatta: "دوباتا", cloth_gahfiya: "قحفية", cloth_tshirt_half: "تي شيرت نص كم",
      cloth_shaila: "شيلة", cloth_jalabiya: "جلابية", cloth_bdf_uniform: "بدلة قوة الدفاع", cloth_hoodie_jacket: "جاكيت هودي", cloth_shoes: "حذاء", cloth_small_towel: "منشفة صغيرة", cloth_overcoat_long: "معطف",
      service_wash: "غسيل", service_iron: "كي", service_washiron: "غسيل وكي",
      service_drycleaning: "غسيل جاف", service_perfume: "تعطير", service_wrap: "تغليف",
      wa_greeting: (name) => `مرحباً ${name} 👋`,
      wa_order_received: "تم استلام طلبكم بنجاح في 997 Laundry ✅",
      wa_order_number: "رقم الطلب", wa_pieces_count: "عدد القطع", wa_order_value: "قيمة الطلب",
      wa_order_status: "حالة الطلب", wa_urgent_flag: "⚡ طلب مستعجل",
      wa_thanks: "شكراً لثقتكم بنا 🌟\n997 Laundry",
      wa_ready_title: (n) => `طلبكم رقم #${n} جاهز للاستلام ✅`, wa_due_amount: "المبلغ المستحق",
      wa_waiting: "بانتظار زيارتكم 🙏\n997 Laundry",
      wa_balance_updated: "تم تحديث رصيدكم لدى 997 Laundry.",
      wa_amount: "المبلغ", wa_added: "إضافة", wa_deducted: "خصم", wa_current_balance: "الرصيد الحالي",
      wa_contact: "للاستفسار، تواصلوا معنا في أي وقت.\n997 Laundry",
      receipt_title: "997 Laundry", receipt_order: (n) => `إيصال طلب #${n}`,
      receipt_total: "الإجمالي", receipt_remaining: "المتبقي", receipt_thanks: "شكراً لتعاملكم مع 997 Laundry",
      receipt_balance_summary: "ملخص الرصيد", receipt_previous_balance: "الرصيد السابق",
      receipt_this_transaction: "حركة هذا الطلب", receipt_new_balance: "الرصيد الحالي",
      metric_active: "الطلبات النشطة", metric_active_note: "كل الطلبات غير المسلّمة",
      metric_inprogress: "قيد التنفيذ", metric_inprogress_note: "فرز، غسيل، أو كي",
      metric_ready: "جاهزة للتسليم", metric_ready_note: "بانتظار استلام العميل",
      metric_delivered_today: "تم التسليم اليوم",
      reason_urgent: "مستعجل", reason_late: "متأخر عن الموعد", reason_ready: "جاهز — بانتظار الاستلام",
      report_revenue: "إجمالي الإيرادات", report_orders_count: "عدد الطلبات",
      report_avg_order: "متوسط قيمة الطلب", report_outstanding: "مبالغ مستحقة",
      nav_finance: "المالية", nav_inventory: "المخزون والمشتريات", nav_employees: "الموظفون والرواتب",
      nav_closures: "الإغلاقات", nav_security: "مركز الأمان", nav_whatsapp: "واتساب", page_wa_title: "💬 محادثات واتساب", page_wa_sub: "المساعد الذكي يرد على العملاء · تحويل للموظف · الرد من رقم المحل", nav_loyalty: "الولاء والحملات", page_loyalty_title: "⭐ الولاء والحملات", page_loyalty_sub: "شرائح العملاء · رسائل واتساب جماعية · بطاقات الولاء والنقاط · خصومات خاصة", nav_delivery: "التوصيل", page_delivery_title: "🚚 الاستلام والتوصيل", page_delivery_sub: "مواعيد الاستلام من البيوت · الطلبات الجاهزة للتوصيل · المندوب في الطريق", nav_audit: "سجل النشاط", nav_ai: "الذكاء الاصطناعي",
      nav_profile: "ملف المنشأة", nav_access: "المستخدمون والصلاحيات",
      page_finance_title: "المالية", page_finance_sub: "التقارير المالية والمصروفات والأرباح",
      page_inventory_title: "المخزون والمشتريات", page_inventory_sub: "الجرد والمواد والموردون وتنبيهات النقص",
      page_employees_title: "الموظفون والرواتب", page_employees_sub: "الرواتب والحضور والإنتاجية والعمولات",
      page_closures_title: "الإغلاقات", page_closures_sub: "الإغلاق اليومي والشهري ومراجعة الفروقات",
      page_audit_title: "سجل النشاط", page_audit_sub: "سجل كامل للعمليات والتعديلات داخل النظام",
      page_profile_title: "ملف المنشأة", page_profile_sub: "بيانات المنشأة، الفروع، والهوية الضريبية",
      page_access_title: "المستخدمون والصلاحيات", page_access_sub: "الأدوار والأمان ومصفوفة الصلاحيات",
      role_owner_ar: "مالك", role_manager_ar: "مدير", role_accountant_ar: "محاسب", role_worker_ar: "عامل",
      fin_revenue: "الإيرادات", fin_expenses: "المصروفات", fin_uncollected: "المبالغ غير المحصلة", fin_net_profit: "صافي الربح التقريبي",
      fin_orders_total: "إجمالي قيمة الطلبات", fin_discounts: "الخصومات", fin_payroll_dues: "الرواتب/الاستحقاقات",
      fin_performance_title: "الأداء المالي للفترة", fin_pnl_title: "الأرباح والخسائر", fin_expenses_by_type: "المصروفات حسب النوع",
      fin_recurring_title: "المصروفات المتكررة", fin_recurring_sub: "إيجار، رواتب، اشتراكات — يومية أو شهرية",
      fin_add_recurring: "+ إضافة متكرر", fin_apply_recurring: "تطبيق المستحق منها الآن",
      fin_expenses_title: "المصروفات", fin_add_expense: "+ إضافة مصروف",
      th_recurring_name: "الاسم", th_recurring_amount: "المبلغ", th_recurring_freq: "التكرار", th_recurring_last: "آخر تطبيق",
      freq_daily: "يومي", freq_monthly: "شهري", no_expenses: "لا توجد مصروفات", no_recurring: "لا توجد مصروفات متكررة معرّفة",
      inv_material_count: "عدد المواد", inv_low_material: "مواد منخفضة", inv_value_approx: "قيمة المخزون التقريبية", inv_purchases_registered: "مشتريات مسجلة",
      inv_title: "المخزون", inv_sub: "المواد والكميات والتنبيهات", inv_add_material: "+ مادة جديدة",
      th_material: "المادة", th_available: "المتوفر", th_alert_threshold: "حد التنبيه", th_approx_cost: "تكلفة تقريبية", 
      status_good: "جيد", status_low: "منخفض", btn_edit: "تعديل", btn_delete: "حذف",
      inv_purchases_title: "المشتريات", inv_purchases_sub: "الكميات المشتراة والموردون", inv_add_purchase: "+ تسجيل شراء", no_purchases: "لا توجد مشتريات",
      inv_low_stock_title: "الأصناف منخفضة المخزون", inv_low_stock_sub: "تحتاج إعادة طلب", inv_low_stock_ok: "لا توجد أصناف منخفضة حالياً 🎉", inv_reorder: "أعد الطلب",
      inv_value_chart_title: "قيمة المخزون حسب المادة",
      emp_count: "عدد الموظفين", emp_base_salaries: "إجمالي الرواتب الأساسية", emp_today_attendance: "حضور اليوم", emp_commissions: "إجمالي العمولات",
      emp_title: "الموظفون", emp_sub: "الرواتب والحضور والإنتاجية", emp_add: "+ موظف",
      th_employee: "الموظف", th_role: "الدور", th_salary: "الراتب", th_commission: "العمولة", th_completed_orders: "طلبات منجزة", th_linked_sales: "مبيعات مرتبطة",
      no_employees: "لا يوجد موظفون بعد", emp_payroll_title: "الرواتب والحضور والاستحقاقات", emp_payroll_sub: "خصومات، سلف، مكافآت وعمولات",
      emp_add_attendance: "تسجيل حضور", emp_add_payroll_tx: "+ حركة راتب", no_payroll_data: "لا توجد بيانات رواتب بعد", attendance_days_30: "حضور {0} يوم هذا الشهر",
      cls_daily_title: "الإغلاق اليومي", cls_daily_sub: "مطابقة المبيعات والصندوق والمصروفات والفروقات", cls_approve_day: "اعتماد إغلاق اليوم",
      cls_date_label: "التاريخ", cls_open_orders: "طلبات مفتوحة", cls_remaining_cash: "الصندوق المتبقي المتوقع",
      cls_monthly_title: "الإغلاق الشهري", cls_monthly_sub: "تجميع المبيعات والمصروفات والرواتب والجرد والربحية", cls_approve_month: "اعتماد إغلاق الشهر",
      cls_month_revenue: "إيرادات الشهر", cls_month_expenses: "مصروفات الشهر", cls_month_payroll: "الرواتب", cls_month_profit: "صافي الربح",
      cls_register_title: "تفاصيل الصندوق", cls_register_sub: "البيع والمصروف لكل طريقة دفع، والصندوق المتبقي المتوقع لليوم المحدد",
      th_payment_method: "طريقة الدفع", th_sell: "بيع (Sell)", th_expense_col: "مصروف (Expense)", th_total_row: "الإجمالي", th_deposit_col: "إيداع أرصدة", th_refund_col: "استرداد نقدي", cls_deposits: "إيداعات الأرصدة",
      cls_history_title: "سجل الإغلاقات", cls_history_sub: "جميع الإغلاقات المعتمدة", no_closures: "لا توجد إغلاقات معتمدة",
      cls_daily_label: "إغلاق يومي", cls_monthly_label: "إغلاق شهري", cls_for_date: "ليوم",
      audit_title: "سجل النشاط والتدقيق", audit_sub: "من قام بماذا، ومتى، وقيمة العملية", no_audit: "لا توجد عمليات تدقيق بعد",
      profile_title2: "ملف المغسلة والإعدادات العامة", profile_sub2: "بيانات المنشأة، الهوية، الضرائب، والتواصل", profile_save: "حفظ البيانات",
      profile_name_en: "اسم المنشأة (إنجليزي)", profile_name_ar: "الاسم بالعربي", profile_cr: "السجل التجاري", profile_vat_id: "الرقم الضريبي",
      profile_phone: "رقم الهاتف", profile_whatsapp: "واتساب", profile_email: "البريد الإلكتروني", profile_region: "المنطقة", profile_address: "العنوان",
      profile_branches_title: "الفروع ونقاط التشغيل", profile_branches_sub: "تعريف الفرع وساعات العمل", profile_add_branch: "+ إضافة فرع",
      th_branch: "الفرع", th_branch_status: "الحالة", th_branch_hours: "ساعات العمل",
      profile_vat_title: "ضريبة القيمة المضافة", profile_vat_sub: "تُستخدم عند احتساب فواتير خاضعة للضريبة",
      profile_vat_percent: "نسبة VAT %", profile_retention: "مدة الاحتفاظ بالسجلات", profile_settings_note: "إعدادات الاستعجال ومدد التنفيذ موجودة في صفحة الإعدادات.",
      access_users_title: "المستخدمون", access_users_sub: "بيانات الدخول والتفاصيل الشخصية لكل موظف", access_add_user: "＋ مستخدم",
      th_emp_number: "الرقم الوظيفي", th_username: "اسم الدخول", th_expiry: "تاريخ الانتهاء", th_user_status: "الحالة",
      user_active: "نشط", user_disabled: "معطّل", user_expired: "منتهي", no_users: "لا يوجد مستخدمون بعد",
      access_security_title: "سياسات الأمان", access_security_sub: "مرجعية — النظام الحالي بدون تسجيل دخول فعلي بكلمة مرور",
      access_perm_title: "مصفوفة الصلاحيات", access_perm_sub: "فعّل أو عطّل كل صلاحية لكل دور — تُحفظ تلقائياً", access_perm_reset: "استعادة الافتراضي",
      perm_create_order: "إنشاء طلب", perm_balance_tx: "استلام دفعة / تحديث رصيد", perm_edit_pricing: "تعديل الأسعار والإعدادات",
      perm_view_reports: "عرض التقارير المالية", perm_add_expense: "إضافة مصروف / شراء مخزون", perm_approve_closing: "اعتماد الإغلاق اليومي/الشهري",
      perm_payroll: "الرواتب والموظفون", perm_audit_log: "سجل التدقيق", perm_admin_settings: "ملف المنشأة والمستخدمون",
      dlg_edit_user: "تعديل مستخدم", dlg_new_user: "إضافة مستخدم جديد", dlg_full_name: "الاسم الكامل", dlg_role: "الدور",
      dlg_username: "اسم الدخول (username)", dlg_password: "كلمة المرور", dlg_phone: "رقم الهاتف", dlg_country: "الدولة",
      dlg_personal_id: "الرقم الشخصي", dlg_birth_date: "تاريخ الميلاد", dlg_expiry_date: "تاريخ انتهاء الحساب (اختياري)", dlg_base_salary: "الراتب الأساسي (د.ب)",
      metric_net: "الصافي (شامل المصروفات)", metric_net_note: "الإيرادات - المصروفات - الرواتب",
      metric_due: "مستحقات غير محصّلة", metric_due_note: "من طلبات لم تُسلَّم بعد",
    },
    en: {
      brandTagline: "Laundry Management System",
      nav_dashboard: "Home", nav_neworder: "New Order", nav_orders: "Orders",
      nav_customers: "Customers", nav_balances: "Balances", nav_reports: "Reports", nav_settings: "Settings",
      search_orders_ph: "Search by order #, customer, or phone",
      viewAll: "View all",
      dash_attention_title: "Needs Attention", dash_attention_sub: "Late, urgent, and long-waiting ready orders",
      dash_activity_title: "Today's Activity", dash_activity_sub: "Latest recorded actions",
      page_dashboard_title: "Home", page_dashboard_sub: "A quick look at today's operations",
      page_neworder_title: "New Order", page_neworder_sub: "Register a customer order step by step",
      page_orders_title: "Orders", page_orders_sub: "Update status and access every order quickly",
      page_customers_title: "Customers", page_customers_sub: "Customer info and balances",
      page_balances_title: "Balances", page_balances_sub: "Manage customer balances and transaction history",
      page_reports_title: "Reports", page_reports_sub: "Sales and service performance",
      page_settings_title: "Settings", page_settings_sub: "Fees, default durations, and the price list",
      step1_title: "1. Customer Info", step1_sub: "Search by phone number or add a new customer",
      ph_phone: "Phone number", btn_search: "Search", btn_new_customer: "New customer",
      no_customer_selected: "No customer selected yet",
      step2_title: "2. Add Garments & Services", step2_sub: "Choose the garment, then the service and quantity",
      ph_item_note: "Note for this item — optional", btn_add_item: "Add to order",
      th_cloth: "Garment", th_service: "Service", th_qty: "Qty", th_unit: "Unit price",
      th_total: "Total", th_note: "Note", th_price: "Price",
      step3_title: "3. Order Details", step3_sub: "Priority, expected delivery, and notes",
      lbl_order_type: "Order type", opt_normal: "Normal", opt_urgent: "⚡ Urgent", opt_urgent_plain: "Urgent",
      lbl_expected_delivery: "Expected delivery", lbl_internal_notes: "Internal notes",
      ph_internal_notes: "Stain, damaged item, special instructions...",
      step4_title: "4. Payment", step4_sub: "Cash, balance, or partial payment are all supported",
      lbl_payment_method: "Payment method", opt_cash: "Cash", opt_benefitpay: "BenefitPay", opt_card: "Card",
      opt_balance: "From customer balance", opt_unpaid: "Deferred / unpaid", opt_bank_transfer: "Bank transfer",
      lbl_paid_amount: "Amount paid", lbl_balance_use: "Use from balance",
      summary_title: "Order Summary", summary_sub: "Price is calculated automatically",
      sum_pieces: "Pieces", sum_subtotal: "Subtotal", sum_urgent: "Urgent fee",
      sum_discount: "Discount", sum_total: "Total", sum_balance: "Customer balance", sum_outstanding: "Outstanding",
      btn_save_order: "Save order", btn_save_print: "Save & print", btn_whatsapp: "WhatsApp",
      orders_title: "Orders", orders_sub: "Update status and access every order quickly",
      opt_all_statuses: "All statuses", opt_all_priorities: "All priorities",
      th_order: "Order", th_customer: "Customer", th_pieces: "Pieces", th_value: "Value",
      th_priority: "Priority", th_status: "Status", th_expected: "Expected delivery", th_actions: "Actions",
      customers_sub: "Customer info, order history, and balances", btn_add_customer: "Add customer",
      th_phone: "Phone", th_area: "Area", th_balance: "Balance", th_order_count: "Orders", th_last_visit: "Last visit",
      balance_title: "Balance Management", balance_sub: "Add or deduct balance with a saved transaction record",
      lbl_customer: "Customer", lbl_tx_type: "Transaction type", opt_credit: "Add balance", opt_debit: "Deduct balance", opt_adjustment: "Adjustment",
      lbl_amount: "Amount", lbl_note: "Note", btn_record_tx: "Record transaction",
      ledger_title: "Transaction Ledger", ledger_sub: "Latest activity on customer balances",
      report_by_payment: "Sales by Payment Method", report_by_payment_sub: "Total recorded transactions",
      report_by_service: "Most Used Services", report_by_service_sub: "By piece count",
      settings_ops_title: "Operating Settings", settings_ops_sub: "Fees and default durations",
      lbl_urgent_percent: "Urgent fee percentage %", lbl_normal_hours: "Normal order duration (hours)",
      lbl_urgent_hours: "Urgent order duration (hours)", btn_save_settings: "Save settings",
      prices_title: "Price List", prices_sub: "Edit the price for each garment and service combination",
      cust_dialog_title: "Add New Customer", cust_dialog_sub: "Enter the customer's basic information",
      lbl_customer_name: "Customer name", lbl_phone: "Phone number", lbl_area: "Area", lbl_address: "Address", lbl_notes: "Notes",
      btn_cancel: "Cancel", btn_save_customer: "Save customer",
      role_admin: "Manager", role_worker: "Worker", role_owner: "Owner", role_manager: "Manager", role_accountant: "Accountant",
      switch_to_worker: "Switch to worker", switch_to_admin: "Switch to manager",
      lang_toggle_label: "العربية",
      empty_orders: "No orders here", empty_orders_filtered: "No matching orders",
      empty_attention: "Nothing needs attention right now 🎉", empty_activity: "No activity recorded yet",
      empty_customers: "No customers yet", empty_ledger: "No transactions recorded yet", empty_no_data: "No data yet",
      empty_no_orders_for_customer: "This customer has no orders yet", empty_no_items: "No items added yet",
      currency: "BD",
      toast_customer_selected: (name) => `Customer selected: ${name}`,
      toast_customer_not_found: "No customer found with this number — try adding a new customer",
      toast_pick_customer: "Please select a customer first", toast_add_one_item: "Add at least one item",
      toast_order_saved: (n) => `Order #${n} saved`, toast_customer_saved: "Customer saved",
      toast_name_phone_required: "Name and phone number are required", toast_pick_customer_first: "Select a customer first",
      toast_valid_amount: "Enter a valid amount", toast_tx_recorded: "Transaction recorded",
      toast_status_updated: "Status updated", toast_order_cancelled: "Order cancelled",
      toast_settings_saved: "Settings saved", toast_role: (r) => `Signed in as ${r}`,
      cust_search_ph: "Search by name or phone", pos_search_ph: "Search items...", dlg_order_title: (n) => `Order #${n}`, dlg_items: "Items", dlg_payment: "Payment", dlg_status: "Status", dlg_notes: "Notes",
      dlg_payment_method: "Payment method", dlg_total: "Total", dlg_paid: "Paid", dlg_remaining: "Remaining",
      dlg_advance_to: (s) => `Move to "${s}"`, dlg_cancel_order: "Cancel order",
      dlg_send_whatsapp: "Send WhatsApp", dlg_print: "Print receipt", dlg_close: "Close",
      status_change_direct: "Change status directly...",
      customer_debtor: "In debt",
      status_new: "New", status_received: "Received", status_sorting: "Sorting",
      status_washing: "Washing", status_ironing: "Ironing", status_ready: "Ready for pickup",
      status_delivered: "Delivered", status_cancelled: "Cancelled",
      cloth_thob_cotton: "Thobe", cloth_thob_wool: "Thobe Wool", cloth_ghatra: "Ghutra", cloth_agal: "Agal",
      cloth_abaya_plain: "Abaya", cloth_abaya_emb: "Abaya Embroidered", cloth_shirt: "Shirt", cloth_tshirt: "T-Shirt",
      cloth_pants_long: "Pant", cloth_pants_short: "Half Pant", cloth_jacket: "Jacket", cloth_overcoat: "Coat",
      cloth_suit2pcs: "Suit", cloth_dress: "Dress", cloth_dress_long: "Dress Long / Evening", cloth_blouse: "Blouse",
      cloth_miniskirt: "Mini Skirt", cloth_skirtlong: "Skirt (Flat / Pleated)", cloth_pullover: "Pullover / Sweater", cloth_necktie: "Necktie",
      cloth_kurta_pyjama: "Kurta", cloth_undershirt2pcs: "Under Shirt 2Pcs", cloth_underwear: "Underwear", cloth_socks: "Socks",
      cloth_cap: "Cap", cloth_bedsheet_single: "Bedsheet", cloth_bedsheet_double: "Double Bedsheet", cloth_bedcover: "Cover",
      cloth_bedspread: "Bed Spread", cloth_blanket_single: "Blanket", cloth_blanket_double: "Double Blanket", cloth_duvet: "Comforter",
      cloth_pillowcase: "Pillow Cover", cloth_bathtowel: "Bath Towel", cloth_bathrobe: "Bath Robe", cloth_curtain_per_m: "Curtain (per m)",
      cloth_tablecloth: "Table Cloth", cloth_tablecloth_large: "Table Cloth Large",
      cloth_bisht: "Bisht", cloth_carpet_m2: "Carpet (per m²)", cloth_dupatta: "Dupatta", cloth_gahfiya: "Gahfiya", cloth_tshirt_half: "Half T-Shirt",
      cloth_shaila: "Shaila", cloth_jalabiya: "Jalabiya", cloth_bdf_uniform: "BDF Uniform", cloth_hoodie_jacket: "Hoodie Jacket", cloth_shoes: "Shoes", cloth_small_towel: "Small Towel", cloth_overcoat_long: "Overcoat",
      service_wash: "Wash", service_iron: "Iron", service_washiron: "Wash & Iron",
      service_drycleaning: "Dry Clean", service_perfume: "Perfume", service_wrap: "Wrap",
      wa_greeting: (name) => `Hello ${name} 👋`,
      wa_order_received: "Your order has been received at 997 Laundry ✅",
      wa_order_number: "Order #", wa_pieces_count: "Pieces", wa_order_value: "Order value",
      wa_order_status: "Status", wa_urgent_flag: "⚡ Urgent order",
      wa_thanks: "Thank you for choosing us 🌟\n997 Laundry",
      wa_ready_title: (n) => `Order #${n} is ready for pickup ✅`, wa_due_amount: "Amount due",
      wa_waiting: "We look forward to seeing you 🙏\n997 Laundry",
      wa_balance_updated: "Your balance at 997 Laundry has been updated.",
      wa_amount: "Amount", wa_added: "Added", wa_deducted: "Deducted", wa_current_balance: "Current balance",
      wa_contact: "Feel free to reach out anytime.\n997 Laundry",
      receipt_title: "997 Laundry", receipt_order: (n) => `Receipt — Order #${n}`,
      receipt_total: "Total", receipt_remaining: "Remaining", receipt_thanks: "Thank you for choosing 997 Laundry",
      receipt_balance_summary: "Balance Summary", receipt_previous_balance: "Previous balance",
      receipt_this_transaction: "This transaction", receipt_new_balance: "New balance",
      metric_active: "Active orders", metric_active_note: "All undelivered orders",
      metric_inprogress: "In progress", metric_inprogress_note: "Sorting, washing, or ironing",
      metric_ready: "Ready for pickup", metric_ready_note: "Waiting on the customer",
      metric_delivered_today: "Delivered today",
      reason_urgent: "Urgent", reason_late: "Overdue", reason_ready: "Ready — awaiting pickup",
      report_revenue: "Total revenue", report_orders_count: "Order count",
      report_avg_order: "Average order value", report_outstanding: "Outstanding balances",
      nav_finance: "Finance", nav_inventory: "Inventory & Purchases", nav_employees: "Employees & Payroll",
      nav_closures: "Closures", nav_security: "Security Center", nav_whatsapp: "WhatsApp", page_wa_title: "💬 WhatsApp chats", page_wa_sub: "AI assistant answers customers · hand-off to staff · reply from the shop number", nav_loyalty: "Loyalty & campaigns", page_loyalty_title: "⭐ Loyalty & campaigns", page_loyalty_sub: "Customer groups · WhatsApp campaigns · loyalty cards & points · special discounts", nav_delivery: "Delivery", page_delivery_title: "🚚 Pickup & Delivery", page_delivery_sub: "Home pickups · orders to deliver · driver on the way", nav_audit: "Activity Log", nav_ai: "AI Center",
      nav_profile: "Company Profile", nav_access: "Users & Permissions",
      page_finance_title: "Finance", page_finance_sub: "Financial reports, expenses, and profits",
      page_inventory_title: "Inventory & Purchases", page_inventory_sub: "Stock, materials, suppliers, and low-stock alerts",
      page_employees_title: "Employees & Payroll", page_employees_sub: "Salaries, attendance, productivity, and commissions",
      page_closures_title: "Closures", page_closures_sub: "Daily and monthly closing and variance review",
      page_audit_title: "Activity Log", page_audit_sub: "A full log of actions and changes in the system",
      page_profile_title: "Company Profile", page_profile_sub: "Company info, branches, and tax identity",
      page_access_title: "Users & Permissions", page_access_sub: "Roles, security, and the permission matrix",
      role_owner_ar: "Owner", role_manager_ar: "Manager", role_accountant_ar: "Accountant", role_worker_ar: "Worker",
      fin_revenue: "Revenue", fin_expenses: "Expenses", fin_uncollected: "Uncollected amounts", fin_net_profit: "Approx. net profit",
      fin_orders_total: "Total order value", fin_discounts: "Discounts", fin_payroll_dues: "Payroll / dues",
      fin_performance_title: "Financial performance for the period", fin_pnl_title: "Profit & Loss", fin_expenses_by_type: "Expenses by type",
      fin_recurring_title: "Recurring Expenses", fin_recurring_sub: "Rent, salaries, subscriptions — daily or monthly",
      fin_add_recurring: "+ Add recurring", fin_apply_recurring: "Apply due ones now",
      fin_expenses_title: "Expenses", fin_add_expense: "+ Add expense",
      th_recurring_name: "Name", th_recurring_amount: "Amount", th_recurring_freq: "Frequency", th_recurring_last: "Last applied",
      freq_daily: "Daily", freq_monthly: "Monthly", no_expenses: "No expenses yet", no_recurring: "No recurring expenses defined",
      inv_material_count: "Materials", inv_low_material: "Low materials", inv_value_approx: "Approx. inventory value", inv_purchases_registered: "Registered purchases",
      inv_title: "Inventory", inv_sub: "Materials, quantities, and alerts", inv_add_material: "+ New material",
      th_material: "Material", th_available: "Available", th_alert_threshold: "Alert level", th_approx_cost: "Approx. cost", 
      status_good: "Good", status_low: "Low", btn_edit: "Edit", btn_delete: "Delete",
      inv_purchases_title: "Purchases", inv_purchases_sub: "Quantities purchased and suppliers", inv_add_purchase: "+ Record purchase", no_purchases: "No purchases yet",
      inv_low_stock_title: "Low Stock Items", inv_low_stock_sub: "Need reordering", inv_low_stock_ok: "No low-stock items right now 🎉", inv_reorder: "Reorder",
      inv_value_chart_title: "Inventory value by material",
      emp_count: "Employees", emp_base_salaries: "Total base salaries", emp_today_attendance: "Today's attendance", emp_commissions: "Total commissions",
      emp_title: "Employees", emp_sub: "Salaries, attendance, and productivity", emp_add: "+ Employee",
      th_employee: "Employee", th_role: "Role", th_salary: "Salary", th_commission: "Commission", th_completed_orders: "Completed orders", th_linked_sales: "Linked sales",
      no_employees: "No employees yet", emp_payroll_title: "Payroll, Attendance & Dues", emp_payroll_sub: "Deductions, advances, bonuses, and commissions",
      emp_add_attendance: "Log attendance", emp_add_payroll_tx: "+ Payroll transaction", no_payroll_data: "No payroll data yet", attendance_days_30: "{0} days present this month",
      cls_daily_title: "Daily Closing", cls_daily_sub: "Reconcile sales, register, expenses, and variance", cls_approve_day: "Approve today's closing",
      cls_date_label: "Date", cls_open_orders: "Open orders", cls_remaining_cash: "Expected remaining cash",
      cls_monthly_title: "Monthly Closing", cls_monthly_sub: "Aggregate sales, expenses, payroll, stock, and profitability", cls_approve_month: "Approve month closing",
      cls_month_revenue: "Month revenue", cls_month_expenses: "Month expenses", cls_month_payroll: "Payroll", cls_month_profit: "Net profit",
      cls_register_title: "Register Details", cls_register_sub: "Sell and expense per payment method, and expected remaining cash for the selected date",
      th_payment_method: "Payment method", th_sell: "Sell", th_expense_col: "Expense", th_total_row: "Total", th_deposit_col: "Balance deposits", th_refund_col: "Cash refunds", cls_deposits: "Balance deposits",
      cls_history_title: "Closing History", cls_history_sub: "All approved closings", no_closures: "No approved closings yet",
      cls_daily_label: "Daily closing", cls_monthly_label: "Monthly closing", cls_for_date: "for",
      audit_title: "Activity & Audit Log", audit_sub: "Who did what, when, and the transaction value", no_audit: "No audit entries yet",
      profile_title2: "Laundry Profile & General Settings", profile_sub2: "Company info, identity, tax, and contact details", profile_save: "Save info",
      profile_name_en: "Company name (English)", profile_name_ar: "Name (Arabic)", profile_cr: "Commercial registration", profile_vat_id: "Tax ID",
      profile_phone: "Phone number", profile_whatsapp: "WhatsApp", profile_email: "Email", profile_region: "Region", profile_address: "Address",
      profile_branches_title: "Branches & Locations", profile_branches_sub: "Branch definition and working hours", profile_add_branch: "+ Add branch",
      th_branch: "Branch", th_branch_status: "Status", th_branch_hours: "Working hours",
      profile_vat_title: "VAT", profile_vat_sub: "Used when calculating tax-inclusive invoices",
      profile_vat_percent: "VAT %", profile_retention: "Record retention period", profile_settings_note: "Urgent fee and duration settings are on the Settings page.",
      access_users_title: "Users", access_users_sub: "Login info and personal details for each employee", access_add_user: "＋ User",
      th_emp_number: "Employee #", th_username: "Username", th_expiry: "Expiry date", th_user_status: "Status",
      user_active: "Active", user_disabled: "Disabled", user_expired: "Expired", no_users: "No users yet",
      access_security_title: "Security Policies", access_security_sub: "Reference only — this system does not have real password login yet",
      access_perm_title: "Permission Matrix", access_perm_sub: "Toggle each permission per role — saved automatically", access_perm_reset: "Restore default",
      perm_create_order: "Create order", perm_balance_tx: "Receive payment / update balance", perm_edit_pricing: "Edit pricing and settings",
      perm_view_reports: "View financial reports", perm_add_expense: "Add expense / stock purchase", perm_approve_closing: "Approve daily/monthly closing",
      perm_payroll: "Payroll and employees", perm_audit_log: "Audit log", perm_admin_settings: "Company profile and users",
      dlg_edit_user: "Edit user", dlg_new_user: "Add new user", dlg_full_name: "Full name", dlg_role: "Role",
      dlg_username: "Username", dlg_password: "Password", dlg_phone: "Phone number", dlg_country: "Country",
      dlg_personal_id: "Personal ID", dlg_birth_date: "Birth date", dlg_expiry_date: "Account expiry date (optional)", dlg_base_salary: "Base salary (BD)",
      metric_net: "Net (after expenses)", metric_net_note: "Revenue - expenses - payroll",
      metric_due: "Invoice due", metric_due_note: "From undelivered orders",
    },
    ur: {
      brandTagline: "لانڈری مینجمنٹ سسٹم",
      nav_dashboard: "ہوم", nav_neworder: "نیا آرڈر", nav_orders: "آرڈرز",
      nav_customers: "کسٹمرز", nav_balances: "بیلنس", nav_reports: "رپورٹس", nav_settings: "ترتیبات",
      search_orders_ph: "آرڈر نمبر، کسٹمر یا فون سے تلاش کریں",
      viewAll: "سب دیکھیں",
      dash_attention_title: "توجہ درکار", dash_attention_sub: "تاخیر شدہ، فوری، اور دیر سے تیار آرڈرز",
      dash_activity_title: "آج کی سرگرمی", dash_activity_sub: "حالیہ ریکارڈ شدہ کارروائیاں",
      page_dashboard_title: "ہوم", page_dashboard_sub: "آج کے کام پر ایک نظر",
      page_neworder_title: "نیا آرڈر", page_neworder_sub: "کسٹمر کا آرڈر مرحلہ وار درج کریں",
      page_orders_title: "آرڈرز", page_orders_sub: "حالت اپ ڈیٹ کریں اور تمام آرڈرز تک رسائی حاصل کریں",
      page_customers_title: "کسٹمرز", page_customers_sub: "کسٹمر کی معلومات اور بیلنس",
      page_balances_title: "بیلنس", page_balances_sub: "کسٹمر بیلنس اور لین دین کی تاریخ کا انتظام",
      page_reports_title: "رپورٹس", page_reports_sub: "سیلز اور سروس کی کارکردگی",
      page_settings_title: "ترتیبات", page_settings_sub: "فیس، ڈیفالٹ مدت، اور قیمتوں کی فہرست",
      step1_title: "1. کسٹمر کی معلومات", step1_sub: "فون نمبر سے تلاش کریں یا نیا کسٹمر شامل کریں",
      ph_phone: "فون نمبر", btn_search: "تلاش کریں", btn_new_customer: "نیا کسٹمر",
      no_customer_selected: "ابھی تک کوئی کسٹمر منتخب نہیں کیا گیا",
      step2_title: "2. کپڑے اور سروسز شامل کریں", step2_sub: "پہلے لباس، پھر سروس اور مقدار منتخب کریں",
      ph_item_note: "اس آئٹم کے لیے نوٹ — اختیاری", btn_add_item: "آرڈر میں شامل کریں",
      th_cloth: "لباس", th_service: "سروس", th_qty: "تعداد", th_unit: "یونٹ قیمت",
      th_total: "کل", th_note: "نوٹ", th_price: "قیمت",
      step3_title: "3. آرڈر کی تفصیلات", step3_sub: "ترجیح، متوقع ڈیلیوری، اور نوٹس",
      lbl_order_type: "آرڈر کی قسم", opt_normal: "عام", opt_urgent: "⚡ فوری", opt_urgent_plain: "فوری",
      lbl_expected_delivery: "متوقع ڈیلیوری", lbl_internal_notes: "اندرونی نوٹس",
      ph_internal_notes: "داغ، خراب آئٹم، خصوصی ہدایات...",
      step4_title: "4. ادائیگی", step4_sub: "نقد، بیلنس، یا جزوی ادائیگی سب دستیاب ہیں",
      lbl_payment_method: "ادائیگی کا طریقہ", opt_cash: "نقد", opt_benefitpay: "BenefitPay", opt_card: "کارڈ",
      opt_balance: "کسٹمر بیلنس سے", opt_unpaid: "موخر / ادا نہیں ہوا", opt_bank_transfer: "بینک ٹرانسفر",
      lbl_paid_amount: "ادا شدہ رقم", lbl_balance_use: "بیلنس سے استعمال کریں",
      summary_title: "آرڈر کا خلاصہ", summary_sub: "قیمت خودکار طور پر شمار ہوتی ہے",
      sum_pieces: "قطعات", sum_subtotal: "ذیلی کل", sum_urgent: "فوری فیس",
      sum_discount: "رعایت", sum_total: "کل رقم", sum_balance: "کسٹمر بیلنس", sum_outstanding: "باقی رقم",
      btn_save_order: "آرڈر محفوظ کریں", btn_save_print: "محفوظ کریں اور پرنٹ کریں", btn_whatsapp: "واٹس ایپ",
      orders_title: "آرڈرز", orders_sub: "حالت اپ ڈیٹ کریں اور تمام آرڈرز تک رسائی حاصل کریں",
      opt_all_statuses: "تمام حالتیں", opt_all_priorities: "تمام ترجیحات",
      th_order: "آرڈر", th_customer: "کسٹمر", th_pieces: "قطعات", th_value: "قیمت",
      th_priority: "ترجیح", th_status: "حالت", th_expected: "متوقع ڈیلیوری", th_actions: "اقدامات",
      customers_sub: "کسٹمر کی معلومات، آرڈر کی تاریخ، اور بیلنس", btn_add_customer: "کسٹمر شامل کریں",
      th_phone: "فون", th_area: "علاقہ", th_balance: "بیلنس", th_order_count: "آرڈرز", th_last_visit: "آخری وزٹ",
      balance_title: "بیلنس کا انتظام", balance_sub: "لین دین کا ریکارڈ رکھتے ہوئے بیلنس شامل یا منہا کریں",
      lbl_customer: "کسٹمر", lbl_tx_type: "لین دین کی قسم", opt_credit: "بیلنس شامل کریں", opt_debit: "بیلنس منہا کریں", opt_adjustment: "ایڈجسٹمنٹ",
      lbl_amount: "رقم", lbl_note: "نوٹ", btn_record_tx: "لین دین ریکارڈ کریں",
      ledger_title: "لین دین کا کھاتہ", ledger_sub: "کسٹمر بیلنس پر حالیہ سرگرمی",
      report_by_payment: "ادائیگی کے طریقہ کے مطابق فروخت", report_by_payment_sub: "کل ریکارڈ شدہ لین دین",
      report_by_service: "سب سے زیادہ استعمال ہونے والی سروسز", report_by_service_sub: "قطعات کی تعداد کے مطابق",
      settings_ops_title: "آپریٹنگ ترتیبات", settings_ops_sub: "فیس اور ڈیفالٹ مدت",
      lbl_urgent_percent: "فوری فیس فیصد %", lbl_normal_hours: "عام آرڈر کی مدت (گھنٹے)",
      lbl_urgent_hours: "فوری آرڈر کی مدت (گھنٹے)", btn_save_settings: "ترتیبات محفوظ کریں",
      prices_title: "قیمتوں کی فہرست", prices_sub: "ہر لباس اور سروس کے امتزاج کی قیمت میں ترمیم کریں",
      cust_dialog_title: "نیا کسٹمر شامل کریں", cust_dialog_sub: "کسٹمر کی بنیادی معلومات درج کریں",
      lbl_customer_name: "کسٹمر کا نام", lbl_phone: "فون نمبر", lbl_area: "علاقہ", lbl_address: "پتہ", lbl_notes: "نوٹس",
      btn_cancel: "منسوخ کریں", btn_save_customer: "کسٹمر محفوظ کریں",
      role_admin: "منیجر", role_worker: "ورکر", role_owner: "مالک", role_manager: "منیجر", role_accountant: "اکاؤنٹنٹ",
      switch_to_worker: "ورکر میں تبدیل کریں", switch_to_admin: "منیجر میں تبدیل کریں",
      lang_toggle_label: "اردو",
      empty_orders: "یہاں کوئی آرڈر نہیں", empty_orders_filtered: "کوئی مماثل آرڈر نہیں",
      empty_attention: "ابھی کسی چیز پر توجہ کی ضرورت نہیں 🎉", empty_activity: "ابھی تک کوئی سرگرمی ریکارڈ نہیں ہوئی",
      empty_customers: "ابھی تک کوئی کسٹمر نہیں", empty_ledger: "ابھی تک کوئی لین دین ریکارڈ نہیں ہوا", empty_no_data: "ابھی تک کوئی ڈیٹا نہیں",
      empty_no_orders_for_customer: "اس کسٹمر کا ابھی تک کوئی آرڈر نہیں", empty_no_items: "ابھی تک کوئی آئٹم شامل نہیں کیا گیا",
      currency: "BD",
      toast_customer_selected: (name) => `کسٹمر منتخب کیا گیا: ${name}`,
      toast_customer_not_found: "اس نمبر سے کوئی کسٹمر نہیں ملا — نیا کسٹمر شامل کرنے کی کوشش کریں",
      toast_pick_customer: "براہ کرم پہلے کسٹمر منتخب کریں", toast_add_one_item: "کم از کم ایک آئٹم شامل کریں",
      toast_order_saved: (n) => `آرڈر #${n} محفوظ ہو گیا`, toast_customer_saved: "کسٹمر محفوظ ہو گیا",
      toast_name_phone_required: "نام اور فون نمبر ضروری ہیں", toast_pick_customer_first: "پہلے کسٹمر منتخب کریں",
      toast_valid_amount: "درست رقم درج کریں", toast_tx_recorded: "لین دین ریکارڈ ہو گیا",
      toast_status_updated: "حالت اپ ڈیٹ ہو گئی", toast_order_cancelled: "آرڈر منسوخ ہو گیا",
      toast_settings_saved: "ترتیبات محفوظ ہو گئیں", toast_role: (r) => `${r} کے طور پر داخل ہوئے`,
      cust_search_ph: "نام یا فون نمبر سے تلاش کریں", pos_search_ph: "آئٹم تلاش کریں...", dlg_order_title: (n) => `آرڈر \u2066#${n}\u2069`, dlg_items: "آئٹمز", dlg_payment: "ادائیگی", dlg_status: "حالت", dlg_notes: "نوٹس",
      dlg_payment_method: "ادائیگی کا طریقہ", dlg_total: "کل", dlg_paid: "ادا شدہ", dlg_remaining: "باقی",
      dlg_advance_to: (s) => `"${s}" پر منتقل کریں`, dlg_cancel_order: "آرڈر منسوخ کریں",
      dlg_send_whatsapp: "واٹس ایپ بھیجیں", dlg_print: "رسید پرنٹ کریں", dlg_close: "بند کریں",
      status_change_direct: "براہ راست حالت تبدیل کریں...",
      customer_debtor: "مقروض کسٹمر",
      status_new: "نیا", status_received: "موصول ہوا", status_sorting: "ترتیب دیا جا رہا ہے",
      status_washing: "دھلائی جاری", status_ironing: "استری جاری", status_ready: "وصولی کے لیے تیار",
      status_delivered: "ڈیلیور ہو گیا", status_cancelled: "منسوخ",
      cloth_thob_cotton: "تھوب", cloth_thob_wool: "تھوب اون", cloth_ghatra: "غترہ", cloth_agal: "عقال",
      cloth_abaya_plain: "عبایہ", cloth_abaya_emb: "کڑھائی والا عبایہ", cloth_shirt: "قمیض", cloth_tshirt: "ٹی شرٹ",
      cloth_pants_long: "پتلون", cloth_pants_short: "ہاف پینٹ", cloth_jacket: "جیکٹ", cloth_overcoat: "کوٹ",
      cloth_suit2pcs: "سوٹ", cloth_dress: "عام لباس", cloth_dress_long: "لمبا / شام کا لباس", cloth_blouse: "بلاؤز",
      cloth_miniskirt: "چھوٹی اسکرٹ", cloth_skirtlong: "اسکرٹ", cloth_pullover: "سویٹر", cloth_necktie: "ٹائی",
      cloth_kurta_pyjama: "کرتا", cloth_undershirt2pcs: "انڈر شرٹ سیٹ", cloth_underwear: "انڈرویئر", cloth_socks: "جرابیں (جوڑا)",
      cloth_cap: "ٹوپی", cloth_bedsheet_single: "بیڈ شیٹ", cloth_bedsheet_double: "ڈبل بیڈ شیٹ", cloth_bedcover: "کور",
      cloth_bedspread: "بڑی بیڈ شیٹ", cloth_blanket_single: "کمبل", cloth_blanket_double: "ڈبل کمبل", cloth_duvet: "رضائی",
      cloth_pillowcase: "تکیہ کور", cloth_bathtowel: "باتھ تولیہ", cloth_bathrobe: "باتھ روب", cloth_curtain_per_m: "پردہ (فی میٹر)",
      cloth_tablecloth: "میز پوش", cloth_tablecloth_large: "بڑا میز پوش",
      cloth_bisht: "بشت", cloth_carpet_m2: "قالین (فی مربع میٹر)", cloth_dupatta: "دوپٹہ", cloth_gahfiya: "قحفیہ", cloth_tshirt_half: "ہاف ٹی شرٹ",
      cloth_shaila: "شیلہ", cloth_jalabiya: "جلابیہ", cloth_bdf_uniform: "بی ڈی ایف یونیفارم", cloth_hoodie_jacket: "ہوڈی جیکٹ", cloth_shoes: "جوتے", cloth_small_towel: "چھوٹا تولیہ", cloth_overcoat_long: "اوور کوٹ",
      service_wash: "دھلائی", service_iron: "استری", service_washiron: "دھلائی اور استری",
      service_drycleaning: "ڈرائی کلین", service_perfume: "خوشبو", service_wrap: "پیکنگ",
      wa_greeting: (name) => `السلام علیکم ${name} 👋`,
      wa_order_received: "آپ کا آرڈر 997 Laundry میں کامیابی سے موصول ہو گیا ✅",
      wa_order_number: "آرڈر نمبر", wa_pieces_count: "قطعات کی تعداد", wa_order_value: "آرڈر کی قیمت",
      wa_order_status: "حالت", wa_urgent_flag: "⚡ فوری آرڈر",
      wa_thanks: "آپ کے اعتماد کا شکریہ 🌟\n997 Laundry",
      wa_ready_title: (n) => `آپ کا آرڈر نمبر #${n} وصولی کے لیے تیار ہے ✅`, wa_due_amount: "واجب الادا رقم",
      wa_waiting: "آپ کے تشریف لانے کا انتظار رہے گا 🙏\n997 Laundry",
      wa_balance_updated: "997 Laundry پر آپ کا بیلنس اپ ڈیٹ ہو گیا ہے۔",
      wa_amount: "رقم", wa_added: "شامل", wa_deducted: "منہا", wa_current_balance: "موجودہ بیلنس",
      wa_contact: "کسی بھی وقت رابطہ کریں۔\n997 Laundry",
      receipt_title: "997 Laundry", receipt_order: (n) => `رسید — آرڈر #${n}`,
      receipt_total: "کل", receipt_remaining: "باقی", receipt_thanks: "997 Laundry کو منتخب کرنے کا شکریہ",
      receipt_balance_summary: "بیلنس کا خلاصہ", receipt_previous_balance: "پچھلا بیلنس",
      receipt_this_transaction: "اس آرڈر کا لین دین", receipt_new_balance: "موجودہ بیلنس",
      metric_active: "فعال آرڈرز", metric_active_note: "تمام غیر ڈیلیورڈ آرڈرز",
      metric_inprogress: "جاری", metric_inprogress_note: "ترتیب، دھلائی، یا استری",
      metric_ready: "وصولی کے لیے تیار", metric_ready_note: "کسٹمر کے انتظار میں",
      metric_delivered_today: "آج ڈیلیور ہوا",
      reason_urgent: "فوری", reason_late: "تاخیر شدہ", reason_ready: "تیار — وصولی کا انتظار",
      report_revenue: "کل آمدنی", report_orders_count: "آرڈرز کی تعداد",
      report_avg_order: "اوسط آرڈر ویلیو", report_outstanding: "باقی بیلنس",
      nav_finance: "مالیات", nav_inventory: "انوینٹری اور خریداری", nav_employees: "ملازمین اور تنخواہیں",
      nav_closures: "اختتامیہ", nav_security: "سیکیورٹی سینٹر", nav_whatsapp: "WhatsApp", page_wa_title: "💬 WhatsApp chats", page_wa_sub: "AI assistant answers customers · hand-off to staff · reply from the shop number", nav_loyalty: "لائلٹی اور مہمات", page_loyalty_title: "⭐ Loyalty & campaigns", page_loyalty_sub: "Customer groups · WhatsApp campaigns · loyalty cards & points · special discounts", nav_delivery: "ڈیلیوری", page_delivery_title: "🚚 Pickup & Delivery", page_delivery_sub: "Home pickups · orders to deliver · driver on the way", nav_audit: "سرگرمی لاگ", nav_ai: "اے آئی سینٹر",
      nav_profile: "کمپنی پروفائل", nav_access: "صارفین اور اجازتیں",
      page_finance_title: "مالیات", page_finance_sub: "مالی رپورٹس، اخراجات، اور منافع",
      page_inventory_title: "انوینٹری اور خریداری", page_inventory_sub: "اسٹاک، مواد، سپلائرز، اور کم اسٹاک الرٹس",
      page_employees_title: "ملازمین اور تنخواہیں", page_employees_sub: "تنخواہیں، حاضری، پیداواریت، اور کمیشن",
      page_closures_title: "اختتامیہ", page_closures_sub: "روزانہ اور ماہانہ اختتام اور فرق کا جائزہ",
      page_audit_title: "سرگرمی لاگ", page_audit_sub: "سسٹم میں تمام کارروائیوں اور تبدیلیوں کا مکمل ریکارڈ",
      page_profile_title: "کمپنی پروفائل", page_profile_sub: "کمپنی کی معلومات، شاخیں، اور ٹیکس شناخت",
      page_access_title: "صارفین اور اجازتیں", page_access_sub: "کردار، سیکیورٹی، اور اجازت میٹرکس",
      role_owner_ar: "مالک", role_manager_ar: "منیجر", role_accountant_ar: "اکاؤنٹنٹ", role_worker_ar: "ورکر",
      fin_revenue: "آمدنی", fin_expenses: "اخراجات", fin_uncollected: "غیر وصول شدہ رقوم", fin_net_profit: "تخمینی خالص منافع",
      fin_orders_total: "کل آرڈر ویلیو", fin_discounts: "رعایتیں", fin_payroll_dues: "تنخواہیں/واجبات",
      fin_performance_title: "مدت کی مالی کارکردگی", fin_pnl_title: "منافع اور نقصان", fin_expenses_by_type: "قسم کے مطابق اخراجات",
      fin_recurring_title: "بار بار ہونے والے اخراجات", fin_recurring_sub: "کرایہ، تنخواہیں، سبسکرپشنز — روزانہ یا ماہانہ",
      fin_add_recurring: "+ بار بار والا اخراجہ شامل کریں", fin_apply_recurring: "اب واجب الادا لاگو کریں",
      fin_expenses_title: "اخراجات", fin_add_expense: "+ اخراجہ شامل کریں",
      th_recurring_name: "نام", th_recurring_amount: "رقم", th_recurring_freq: "تکرار", th_recurring_last: "آخری اطلاق",
      freq_daily: "روزانہ", freq_monthly: "ماہانہ", no_expenses: "ابھی تک کوئی اخراجات نہیں", no_recurring: "کوئی بار بار والا اخراجہ متعین نہیں",
      inv_material_count: "مواد کی تعداد", inv_low_material: "کم مواد", inv_value_approx: "تخمینی انوینٹری ویلیو", inv_purchases_registered: "درج شدہ خریداری",
      inv_title: "انوینٹری", inv_sub: "مواد، مقدار، اور الرٹس", inv_add_material: "+ نیا مواد",
      th_material: "مواد", th_available: "دستیاب", th_alert_threshold: "الرٹ کی حد", th_approx_cost: "تخمینی لاگت", 
      status_good: "اچھا", status_low: "کم", btn_edit: "ترمیم", btn_delete: "حذف کریں",
      inv_purchases_title: "خریداری", inv_purchases_sub: "خریدی گئی مقدار اور سپلائرز", inv_add_purchase: "+ خریداری درج کریں", no_purchases: "ابھی تک کوئی خریداری نہیں",
      inv_low_stock_title: "کم اسٹاک والے آئٹمز", inv_low_stock_sub: "دوبارہ آرڈر کی ضرورت ہے", inv_low_stock_ok: "ابھی کوئی کم اسٹاک آئٹم نہیں 🎉", inv_reorder: "دوبارہ آرڈر کریں",
      inv_value_chart_title: "مواد کے مطابق انوینٹری ویلیو",
      emp_count: "ملازمین کی تعداد", emp_base_salaries: "کل بنیادی تنخواہیں", emp_today_attendance: "آج کی حاضری", emp_commissions: "کل کمیشن",
      emp_title: "ملازمین", emp_sub: "تنخواہیں، حاضری، اور پیداواریت", emp_add: "+ ملازم",
      th_employee: "ملازم", th_role: "کردار", th_salary: "تنخواہ", th_commission: "کمیشن", th_completed_orders: "مکمل آرڈرز", th_linked_sales: "منسلک فروخت",
      no_employees: "ابھی تک کوئی ملازم نہیں", emp_payroll_title: "تنخواہیں، حاضری اور واجبات", emp_payroll_sub: "کٹوتیاں، پیشگی، بونس، اور کمیشن",
      emp_add_attendance: "حاضری درج کریں", emp_add_payroll_tx: "+ تنخواہ لین دین", no_payroll_data: "ابھی تک تنخواہ کا ڈیٹا نہیں", attendance_days_30: "اس مہینے {0} دن حاضر",
      cls_daily_title: "روزانہ اختتام", cls_daily_sub: "فروخت، رجسٹر، اخراجات، اور فرق کی تصدیق", cls_approve_day: "آج کا اختتام منظور کریں",
      cls_date_label: "تاریخ", cls_open_orders: "کھلے آرڈرز", cls_remaining_cash: "متوقع باقی نقدی",
      cls_monthly_title: "ماہانہ اختتام", cls_monthly_sub: "فروخت، اخراجات، تنخواہیں، اسٹاک، اور منافع کا مجموعہ", cls_approve_month: "ماہانہ اختتام منظور کریں",
      cls_month_revenue: "ماہ کی آمدنی", cls_month_expenses: "ماہ کے اخراجات", cls_month_payroll: "تنخواہیں", cls_month_profit: "خالص منافع",
      cls_register_title: "رجسٹر کی تفصیلات", cls_register_sub: "منتخب تاریخ کے لیے ہر ادائیگی کے طریقے کے مطابق فروخت اور اخراجات، اور متوقع باقی نقدی",
      th_payment_method: "ادائیگی کا طریقہ", th_sell: "فروخت", th_expense_col: "اخراجہ", th_total_row: "کل", th_deposit_col: "بیلنس ڈپازٹ", th_refund_col: "نقد واپسی", cls_deposits: "بیلنس ڈپازٹ",
      cls_history_title: "اختتام کی تاریخ", cls_history_sub: "تمام منظور شدہ اختتامیے", no_closures: "ابھی تک کوئی منظور شدہ اختتامیہ نہیں",
      cls_daily_label: "روزانہ اختتام", cls_monthly_label: "ماہانہ اختتام", cls_for_date: "بتاریخ",
      audit_title: "سرگرمی اور آڈٹ لاگ", audit_sub: "کس نے کیا کیا، کب، اور لین دین کی مالیت", no_audit: "ابھی تک کوئی آڈٹ اندراج نہیں",
      profile_title2: "لانڈری پروفائل اور عمومی ترتیبات", profile_sub2: "کمپنی کی معلومات، شناخت، ٹیکس، اور رابطہ", profile_save: "معلومات محفوظ کریں",
      profile_name_en: "کمپنی کا نام (انگریزی)", profile_name_ar: "نام (عربی)", profile_cr: "کمرشل رجسٹریشن", profile_vat_id: "ٹیکس آئی ڈی",
      profile_phone: "فون نمبر", profile_whatsapp: "واٹس ایپ", profile_email: "ای میل", profile_region: "علاقہ", profile_address: "پتہ",
      profile_branches_title: "شاخیں اور مقامات", profile_branches_sub: "شاخ کی تعریف اور اوقات کار", profile_add_branch: "+ شاخ شامل کریں",
      th_branch: "شاخ", th_branch_status: "حالت", th_branch_hours: "اوقات کار",
      profile_vat_title: "ویلیو ایڈڈ ٹیکس", profile_vat_sub: "ٹیکس شامل رسیدوں کے حساب کے لیے استعمال ہوتا ہے",
      profile_vat_percent: "VAT فیصد", profile_retention: "ریکارڈ رکھنے کی مدت", profile_settings_note: "فوری فیس اور مدت کی ترتیبات ترتیبات کے صفحہ پر ہیں۔",
      access_users_title: "صارفین", access_users_sub: "ہر ملازم کے لاگ ان اور ذاتی تفصیلات", access_add_user: "＋ صارف",
      th_emp_number: "ملازم نمبر", th_username: "یوزر نیم", th_expiry: "میعاد ختم ہونے کی تاریخ", th_user_status: "حالت",
      user_active: "فعال", user_disabled: "غیر فعال", user_expired: "میعاد ختم", no_users: "ابھی تک کوئی صارف نہیں",
      access_security_title: "سیکیورٹی پالیسیاں", access_security_sub: "صرف حوالہ — اس سسٹم میں ابھی تک اصل پاس ورڈ لاگ ان نہیں ہے",
      access_perm_title: "اجازت میٹرکس", access_perm_sub: "ہر کردار کے لیے ہر اجازت کو آن/آف کریں — خودکار محفوظ", access_perm_reset: "ڈیفالٹ بحال کریں",
      perm_create_order: "آرڈر بنائیں", perm_balance_tx: "ادائیگی وصول کریں / بیلنس اپ ڈیٹ کریں", perm_edit_pricing: "قیمتیں اور ترتیبات میں ترمیم کریں",
      perm_view_reports: "مالی رپورٹس دیکھیں", perm_add_expense: "اخراجہ / اسٹاک خریداری شامل کریں", perm_approve_closing: "روزانہ/ماہانہ اختتام منظور کریں",
      perm_payroll: "تنخواہیں اور ملازمین", perm_audit_log: "آڈٹ لاگ", perm_admin_settings: "کمپنی پروفائل اور صارفین",
      dlg_edit_user: "صارف میں ترمیم", dlg_new_user: "نیا صارف شامل کریں", dlg_full_name: "پورا نام", dlg_role: "کردار",
      dlg_username: "یوزر نیم", dlg_password: "پاس ورڈ", dlg_phone: "فون نمبر", dlg_country: "ملک",
      dlg_personal_id: "ذاتی شناختی نمبر", dlg_birth_date: "تاریخ پیدائش", dlg_expiry_date: "اکاؤنٹ ختم ہونے کی تاریخ (اختیاری)", dlg_base_salary: "بنیادی تنخواہ (BD)",
      metric_net: "خالص آمدنی (اخراجات کے بعد)", metric_net_note: "آمدنی - اخراجات - تنخواہیں",
      metric_due: "غیر وصول شدہ رقم", metric_due_note: "ابھی ڈیلیور نہ ہونے والے آرڈرز سے",
    },
  };

  // اللغة تُحفظ بصيغة JSON عبر save() — نقرأها بنفس الصيغة (مع دعم القيم القديمة غير المرمّزة)
  let lang = (() => {
    const raw = localStorage.getItem(KEYS.lang);
    let v = raw;
    try { v = JSON.parse(raw); } catch (e) { /* قيمة قديمة نصية */ }
    return I18N[v] ? v : "ar";
  })();
  function t(key, ...args) {
    const val = (I18N[lang] && I18N[lang][key] !== undefined) ? I18N[lang][key] : (I18N.ar[key] ?? key);
    return typeof val === "function" ? val(...args) : val;
  }

  const CATALOG_VERSION = 4; // إصدار 4: قائمة أسعار مغسلة 997 (35 صنف — كي / غسيل وكي / تنظيف جاف / مستعجل)

  const CLOTHING_DEFAULT = [
    { id: "thob_cotton", key: "cloth_thob_cotton", cat: "men" }, { id: "thob_wool", key: "cloth_thob_wool", cat: "men" },
    { id: "ghatra", key: "cloth_ghatra", cat: "men" }, { id: "agal", key: "cloth_agal", cat: "men" },
    { id: "abaya_plain", key: "cloth_abaya_plain", cat: "women" }, { id: "abaya_emb", key: "cloth_abaya_emb", cat: "women" },
    { id: "shirt", key: "cloth_shirt", cat: "men" }, { id: "tshirt", key: "cloth_tshirt", cat: "men" },
    { id: "pants_long", key: "cloth_pants_long", cat: "men" }, { id: "pants_short", key: "cloth_pants_short", cat: "men" },
    { id: "jacket", key: "cloth_jacket", cat: "men" }, { id: "overcoat", key: "cloth_overcoat", cat: "men" },
    { id: "suit2pcs", key: "cloth_suit2pcs", cat: "men" }, { id: "dress", key: "cloth_dress", cat: "women" },
    { id: "dress_long", key: "cloth_dress_long", cat: "women" }, { id: "blouse", key: "cloth_blouse", cat: "women" },
    { id: "miniskirt", key: "cloth_miniskirt", cat: "women" }, { id: "skirtlong", key: "cloth_skirtlong", cat: "women" },
    { id: "pullover", key: "cloth_pullover", cat: "women" }, { id: "necktie", key: "cloth_necktie", cat: "men" },
    { id: "kurta_pyjama", key: "cloth_kurta_pyjama", cat: "men" }, { id: "undershirt2pcs", key: "cloth_undershirt2pcs", cat: "men" },
    { id: "underwear", key: "cloth_underwear", cat: "men" }, { id: "socks", key: "cloth_socks", cat: "men" },
    { id: "cap", key: "cloth_cap", cat: "men" }, { id: "bedsheet_single", key: "cloth_bedsheet_single", cat: "home" },
    { id: "bedsheet_double", key: "cloth_bedsheet_double", cat: "home" }, { id: "bedcover", key: "cloth_bedcover", cat: "home" },
    { id: "bedspread", key: "cloth_bedspread", cat: "home" }, { id: "blanket_single", key: "cloth_blanket_single", cat: "home" },
    { id: "blanket_double", key: "cloth_blanket_double", cat: "home" }, { id: "duvet", key: "cloth_duvet", cat: "home" },
    { id: "pillowcase", key: "cloth_pillowcase", cat: "home" }, { id: "bathtowel", key: "cloth_bathtowel", cat: "home" },
    { id: "bathrobe", key: "cloth_bathrobe", cat: "home" }, { id: "curtain_per_m", key: "cloth_curtain_per_m", cat: "home" },
    { id: "tablecloth", key: "cloth_tablecloth", cat: "home" }, { id: "tablecloth_large", key: "cloth_tablecloth_large", cat: "home" },
    { id: "bisht", key: "cloth_bisht", cat: "men" }, { id: "dupatta", key: "cloth_dupatta", cat: "women" },
    { id: "gahfiya", key: "cloth_gahfiya", cat: "men" }, { id: "tshirt_half", key: "cloth_tshirt_half", cat: "men" },
    { id: "carpet_m2", key: "cloth_carpet_m2", cat: "home" },
    { id: "shaila", key: "cloth_shaila", cat: "women" }, { id: "jalabiya", key: "cloth_jalabiya", cat: "women" },
    { id: "bdf_uniform", key: "cloth_bdf_uniform", cat: "men" }, { id: "hoodie_jacket", key: "cloth_hoodie_jacket", cat: "men" },
    { id: "overcoat_long", key: "cloth_overcoat_long", cat: "men" }, { id: "shoes", key: "cloth_shoes", cat: "men" },
    { id: "small_towel", key: "cloth_small_towel", cat: "home" },
  ];

  const SERVICES_DEFAULT = [
    { id: "iron", key: "service_iron" }, { id: "wash", key: "service_wash" }, { id: "washiron", key: "service_washiron" },
    // الغسيل الجاف: يظهر للصنف فقط بعد إدخال سعره في الإعدادات (لا أسعار افتراضية مخترعة)
    { id: "dryclean", key: "service_drycleaning" },
  ];
  function allGarments() { return CLOTHING_DEFAULT.concat(customGarments); }
  function activeGarments() { return allGarments().filter((g) => settings.garmentActive[g.id] !== false); }
  function clothingName(id) { const g = allGarments().find((c) => c.id === id); if (!g) return id; return g.key ? t(g.key) : g.name; }
  function serviceName(id) { const s = SERVICES_DEFAULT.find((c) => c.id === id); return s ? t(s.key) : id; }

  // جدول الأسعار الرسمي كما ورد في مغسلة 997 (كوي/غسيل/غسيل+كوي) — بالدينار البحريني
  // قائمة أسعار مغسلة 997 (كي / غسيل وكي / تنظيف جاف) — نفس القائمة المطبوعة. الغسيل فقط غير مقدَّم.
  const OFFICIAL_PRICES_997 = {
    abaya_plain: { iron: 0.5, washiron: 1.0 }, bisht: { iron: 1.0, washiron: 2.5 }, thob_cotton: { iron: 0.2, washiron: 0.5 },
    ghatra: { iron: 0.3, washiron: 0.6 }, gahfiya: { washiron: 0.2 }, shaila: { washiron: 0.2 }, dupatta: { iron: 0.2, washiron: 0.3 },
    kurta_pyjama: { iron: 0.2, washiron: 0.5 }, jalabiya: { washiron: 1.0 }, dress: { washiron: 1.0 }, bdf_uniform: { iron: 0.4, washiron: 0.8 },
    skirtlong: { iron: 0.2, washiron: 0.3 }, shirt: { iron: 0.2, washiron: 0.4 }, tshirt: { iron: 0.2, washiron: 0.4 }, pants_long: { iron: 0.2, washiron: 0.4 },
    suit2pcs: { iron: 1.0, washiron: 1.5 }, overcoat: { iron: 0.8, washiron: 1.2, dryclean: 1.5 }, overcoat_long: { washiron: 1.5, dryclean: 2.0 },
    jacket: { washiron: 1.0, dryclean: 2.0 }, hoodie_jacket: { washiron: 0.5 }, cap: { washiron: 0.5 }, socks: { washiron: 0.2 },
    underwear: { iron: 0.1, washiron: 0.2 }, shoes: { washiron: 1.5 }, small_towel: { washiron: 0.3 }, bathtowel: { washiron: 0.5 },
    bedsheet_single: { iron: 0.3, washiron: 0.5 }, bedsheet_double: { iron: 0.5, washiron: 1.0 }, pillowcase: { iron: 0.4, washiron: 0.8 },
    tablecloth: { iron: 0.3, washiron: 0.5 }, blanket_single: { washiron: 1.5 }, blanket_double: { washiron: 2.0 }, duvet: { washiron: 1.5 },
    carpet_m2: { washiron: 1.5 },
  };
  // سعر الاستعجال للقطعة حيث يختلف عن ضعف السعر (تعديلات القائمة بخط اليد)؛ 0 = لا خدمة مستعجلة
  const URGENT_PRICES_997 = { abaya_plain: 1.5, ghatra: 1.0, overcoat: 2.0, overcoat_long: 2.0, shoes: 0, blanket_double: 0, carpet_m2: 0 };

  function round3(n) { return Math.round((n + Number.EPSILON) * 1000) / 1000; }
  function money(n) { return round3(n || 0).toFixed(3) + " " + t("currency"); }
  function uid() { return (crypto.randomUUID ? crypto.randomUUID() : "id-" + Date.now() + "-" + Math.random().toString(16).slice(2)); }

  function buildDefaultPrices() {
    const p = {};
    Object.entries(OFFICIAL_PRICES_997).forEach(([clothId, services]) => {
      Object.entries(services).forEach(([svcId, price]) => { p[`${clothId}_${svcId}`] = price; });
    });
    return p;
  }

  const STATUS_IDS = ["received", "ready", "delivered", "cancelled"];
  const STATUS_CLASS = {
    received: "status-received", ready: "status-ready", delivered: "status-delivered", cancelled: "status-cancelled",
  };
  const FLOW = ["received", "ready", "delivered"];
  function statusLabel(id) { return t("status_" + id); }
  function statusClass(id) { return STATUS_CLASS[id] || "status-new"; }

  function paymentLabel(method) {
    const map = { cash: "opt_cash", benefitpay: "opt_benefitpay", card: "opt_card", balance: "opt_balance", unpaid: "opt_unpaid", bank_transfer: "opt_bank_transfer" };
    return t(map[method] || "opt_cash");
  }

  // شعار المحل (يُدمج في الملف عند البناء) — للواجهة والإيصالات (صورة / PDF)
  const LOGO_997 = "__LOGO_997__";
  const LOGO_IMG = (() => { const i = new window.Image(); i.src = LOGO_997; return i; })();
  document.querySelectorAll("img[data-logo]").forEach((i) => { i.src = LOGO_997; });
  /* ------------------------------- الحالة -------------------------------- */
  let settings = load(KEYS.settings, null);
  let customers = load(KEYS.customers, []);
  let orders = load(KEYS.orders, []);
  let ledger = load(KEYS.ledger, []);
  let activity = load(KEYS.activity, []);
  let customerPackages = load(KEYS.customerPackages, []);
  let customGarments = load("l997_custom_garments", []);

  if (!settings) {
    settings = { urgentPercent: 100, normalHours: 24, urgentHours: 6, prices: buildDefaultPrices(), orderSeq: 1, catalogVersion: CATALOG_VERSION, packageDefs: [], urgentPrices: { ...URGENT_PRICES_997 },
      garmentActive: Object.fromEntries(CLOTHING_DEFAULT.map((g) => [g.id, !!OFFICIAL_PRICES_997[g.id]])) };
    save(KEYS.settings, settings);
  }
  // نسخة أقدم من النظام (مخزّنة في المتصفح) لا تُرجع قائمة الأسعار لإصدار أقدم — وإلا تتسابق الأجهزة وتعيد تحميل بعضها
  const staleCode = Number(settings.catalogVersion) > CATALOG_VERSION;
  if (staleCode) {
    let tried = false; try { tried = sessionStorage.getItem("l997_stale_reload") === "1"; sessionStorage.setItem("l997_stale_reload", "1"); } catch (e) { tried = true; }
    if (!tried && navigator.onLine !== false) window.fetch(location.href, { cache: "reload" }).then(() => location.reload(), () => {});
  } else { try { sessionStorage.removeItem("l997_stale_reload"); } catch (e) { /* ignore */ } }
  if (!staleCode && (!settings.prices || settings.catalogVersion !== CATALOG_VERSION)) {
    const old = settings.prices || {};
    const fresh = buildDefaultPrices();
    // تُحفظ أسعار الغسيل الجاف وأسعار المنتجات التي أضافها المحل بنفسه
    // تُحفظ أسعار المنتجات التي أضافها المحل بنفسه (الأصناف الرسمية بالضبط كما في القائمة، ومنها التنظيف الجاف)
    Object.keys(old).forEach((k) => { if (/^custom_/.test(k) && Number(old[k]) > 0) fresh[k] = old[k]; });
    settings.urgentPrices = { ...URGENT_PRICES_997 };
    settings.prices = fresh;
    // فقط أصناف القائمة مفعّلة؛ غيرها يُطفأ (لا يُحذف — الطلبات القديمة تحتفظ بأسمائها)
    const active = { ...(settings.garmentActive || {}) };
    CLOTHING_DEFAULT.forEach((g) => { active[g.id] = !!OFFICIAL_PRICES_997[g.id]; });
    settings.garmentActive = active;
    if (settings.urgentPercent === undefined) settings.urgentPercent = 100;
    settings.catalogVersion = CATALOG_VERSION;
    save(KEYS.settings, settings);
  }
  if (!settings.packageDefs) { settings.packageDefs = []; save(KEYS.settings, settings); }
  // وزن القطعة في الباقات: كم قطعة تُخصم من رصيد الباقة لكل قطعة من هذا الصنف (0 = خارج نظام الباقات)
  const PACKAGE_WEIGHTS_997 = {
    abaya_plain: { washiron: 2, iron: 2 }, abaya_emb: { washiron: 2, iron: 2 },
    duvet: { washiron: 5, iron: 2 }, bedsheet_double: { washiron: 4, iron: 2 },
    jalabiya: { washiron: 2, iron: 2 }, curtain_per_m: { washiron: 0, iron: 0 }, shoes: { washiron: 0, iron: 0 },
  };
  // أكواد خصم خاصة بعملاء محددين — تُنشأ مرة واحدة؛ لا تعمل لأي أحد حتى يحدد المالك عملاءها (الإعدادات ← الباقات ← أكواد الخصم)
  if (!settings.codesSeed997) {
    const seed = [["NAWAF", 45, "العميل نواف"], ["BMJ11", 35, "العميلة بدور"], ["FAMILY", 35, "الأهل"], ["MYHOME", 75, "أهل بيتي"],
      ["997CLS", 20, "الربع المقربون"], ["997FAR", 15, "الربع وزملاء العمل"], ["DDOSERI", 35, "العميلة دانة الدوسري"], ["YADATI", 100, "بيت يدتي — الطلب مجاني"]];
    settings.discountCodes = settings.discountCodes || [];
    seed.forEach(([code, percent, note]) => { if (!settings.discountCodes.some((x) => x.code === code)) settings.discountCodes.push({ code, type: "percent", percent, scope: "customers", customerIds: [], note, active: true, createdAt: new Date().toISOString(), createdBy: "system" }); });
    settings.codesSeed997 = 1; save(KEYS.settings, settings);
  }
  if (!settings.packageWeights) { settings.packageWeights = JSON.parse(JSON.stringify(PACKAGE_WEIGHTS_997)); save(KEYS.settings, settings); }
  if (!settings.garmentActive) { settings.garmentActive = {}; save(KEYS.settings, settings); }
  // خدمات إضافية على مستوى الطلب (تعطير، تغليف): السعر صفر = غير مفعّلة ولا تظهر في شاشة الطلب
  const EXTRAS_DEFAULT = [{ id: "perfume", key: "service_perfume", icon: "🌸" }, { id: "wrap", key: "service_wrap", icon: "🎁" }];
  if (!settings.extras) { settings.extras = { perfume: { price: 0, per: "order" }, wrap: { price: 0, per: "order" } }; save(KEYS.settings, settings); }
  function extraCfg(id) { const c = settings.extras && settings.extras[id]; return { price: Number(c && c.price) || 0, per: c && c.per === "piece" ? "piece" : "order" }; }
  function activeExtras() { return EXTRAS_DEFAULT.filter((x) => extraCfg(x.id).price > 0); }
  function extraName(id) {
    if (id === "dlv_pickup") return lang !== "ar" ? "🚚 Home pickup" : "🚚 استلام من البيت";
    if (id === "dlv_drop") return lang !== "ar" ? "🚚 Home delivery" : "🚚 توصيل للبيت";
    const x = EXTRAS_DEFAULT.find((e) => e.id === id); return x ? t(x.key) : id;
  }
  // سطر إضافة للعرض: التوصيل المجاني يظهر «مجاني» بدل 0.000
  const extraLabel = (l) => extraName(l.id) + (l.free === "package" ? (lang !== "ar" ? " (package — free)" : " (ضمن الباقة)") : l.free === "threshold" ? (lang !== "ar" ? " (free over limit)" : " (مجاني فوق الحد)") : "");
  const extraVal = (l) => (l.free && !(Number(l.total) > 0) ? (lang !== "ar" ? "Free" : "مجاني") : money(l.total));
  /* ============ الاستلام والتوصيل ============
     كل مشوار (استلام من البيت أو توصيل للبيت) = رحلة. عميل الباقة: عدد رحلات مجانية بالشهر ثم رسوم مخفّضة.
     عميل بدون باقة: رسوم رمزية لكل رحلة، ومجاناً إن تجاوز الطلب حداً يحدده المالك (0 = لا يوجد). */
  if (!settings.delivery) { settings.delivery = { on: true, fee: 0.5, pkgFree: 4, pkgFee: 0.5, freeOver: 0 }; save(KEYS.settings, settings); }
  function dlvCfg() {
    const d = settings.delivery || {}, n = (v, def) => (v === undefined || v === null || v === "" || !Number.isFinite(Number(v)) ? def : Math.max(0, Number(v)));
    return { on: d.on !== false, fee: round3(n(d.fee, 0.5)), pkgFree: Math.floor(n(d.pkgFree, 4)), pkgFee: round3(n(d.pkgFee, 0.5)), freeOver: round3(n(d.freeOver, 0)) };
  }
  // سطور الإضافات بالسعر الحالي: «لكل قطعة» = الكمية بعدد قطع الطلب، وإلا مرة واحدة للطلب
  function extrasLines(ids, pieces) {
    return ids.map((id) => {
      const c = extraCfg(id), qty = c.per === "piece" ? pieces : 1;
      return { id, per: c.per, qty, unit: round3(c.price), total: round3(c.price * qty) };
    }).filter((l) => l.unit > 0 && l.qty > 0);
  }
  // بعد تعديل كميات الطلب: الإضافة «لكل قطعة» تتبع عدد القطع الجديد (بسعرها المسجّل وقت الطلب)
  function refreshOrderExtras(order) {
    const pcs = order.items.reduce((n, it) => n + it.qty, 0);
    (order.extras || []).forEach((l) => { if (l.per === "piece") { l.qty = pcs; l.total = round3(l.unit * pcs); } });
  }
  const extrasTotalOf = (list) => round3((list || []).reduce((a, l) => a + (Number(l.total) || 0), 0));

  let role = "worker"; // owner | manager | accountant | worker — البدء بأقل صلاحية دائماً؛ الترقية لمالك/مدير تتطلب كلمة المرور
  let draftItems = [];
  let draftExtras = new Set();
  const blankDelivery = () => ({ pickup: false, drop: false, address: "", date: "", slot: "", reqId: null });
  let draftDelivery = blankDelivery();
  let draftCustomerId = null;
  let currentQty = 1;
  let activeClothingId = CLOTHING_DEFAULT[0].id;
  let pendingCustomerContext = "standalone";
  let currentOrderDialogId = null;

  function load(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch (e) { return fallback; }
  }
  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      showStorageFailureBanner(e);
      return false;
    }
  }
  // حاوية مشتركة تكدّس كل بانرات التنبيه العلوية عمودياً بدل ما تتراكب فوق بعضها بنفس النقطة
  function getBannerStack() {
    let stack = document.getElementById("l997BannerStack");
    if (!stack) {
      stack = document.createElement("div");
      stack.id = "l997BannerStack";
      // جزء من الصفحة (وليس فوقها): التنبيهات لا تغطي زر القائمة ☰ وعنوان الصفحة على الجوال
      stack.style.cssText = "position:relative;z-index:60;display:flex;flex-direction:column";
      document.body.prepend(stack);
    }
    return stack;
  }
  let storageFailureShown = false;
  function showStorageFailureBanner(err) {
    if (storageFailureShown) return; // لا نكرر نفس التحذير عشرات المرات لو استمر الفشل
    storageFailureShown = true;
    const banner = document.createElement("div");
    banner.id = "storageFailureBanner";
    banner.style.cssText = "background:#c0392b;color:#fff;padding:14px 18px;text-align:center;font-weight:800;box-shadow:0 2px 10px rgba(0,0,0,.3)";
    banner.innerHTML = `⚠ فشل حفظ آخر عملية! مساحة تخزين الجهاز ممتلئة أو الحفظ مرفوض بالمتصفح. <u style="cursor:pointer" id="storageFailureBackupLink">صدّر نسخة احتياطية فوراً</u> واحذف بيانات قديمة، ثم أعد المحاولة. <span style="cursor:pointer;margin-inline-start:10px" id="storageFailureCloseBtn">✕</span>`;
    getBannerStack().appendChild(banner);
    document.getElementById("storageFailureCloseBtn").addEventListener("click", () => banner.remove());
    document.getElementById("storageFailureBackupLink").addEventListener("click", () => {
      openPage("profile");
      document.getElementById("exportBackupBtn")?.click();
    });
  }
  window.__l997StorageFail = showStorageFailureBanner;
  // التخزين محجوب (متصفح داخل تطبيق، وضع خصوصية...): النظام يعمل مؤقتاً بالذاكرة ولن يحفظ شيئاً —
  // تحذير ثابت وواضح بدل شاشة «إعداد أول» توحي بأن البيانات اختفت
  const MEM_STORAGE_WARN = `⚠ <b>الحفظ غير متاح في هذا المتصفح</b> — أي بيانات تُدخلها الآن ستضيع عند إغلاق الصفحة، وبياناتك السابقة لا تظهر هنا. افتح الرابط مباشرة في Safari أو Chrome (ليس من داخل واتساب أو انستغرام) وبدون وضع التصفح الخاص.<br><span dir="ltr">Storage is blocked in this browser — nothing will be saved and earlier data is not shown. Open the link directly in Safari or Chrome (not inside WhatsApp/Instagram), not in private mode.</span>`;
  // الرابط القديم: تنبيه بالانتقال إلى رابط المحل الجديد (البيانات المحلية هنا لا تتزامن)
  const OLD_HOST = /^jassimal3akbry\.github\.io$/i.test(location.hostname);
  const MOVED_NOTE = `🔗 <b>انتقل النظام إلى رابط جديد:</b> <a href="https://997-laundry.github.io" style="color:#fff;text-decoration:underline" dir="ltr">997-laundry.github.io</a> — هذا الرابط القديم لا يتزامن مع السحابة. صدّر نسخة احتياطية إن كانت هنا بيانات لم تُنقل، ثم استخدم الرابط الجديد.`;
  if (OLD_HOST) {
    const mv = document.createElement("div");
    mv.style.cssText = "background:#1f7ea8;color:#fff;padding:12px 16px;text-align:center;font-weight:700;line-height:1.7";
    mv.innerHTML = MOVED_NOTE;
    getBannerStack().appendChild(mv);
  }
  if (window.__l997MemStorage) {
    const memBanner = document.createElement("div");
    memBanner.id = "memStorageBanner";
    memBanner.style.cssText = "background:#c0392b;color:#fff;padding:14px 18px;text-align:center;font-weight:700;line-height:1.7";
    memBanner.innerHTML = MEM_STORAGE_WARN;
    getBannerStack().appendChild(memBanner);
  }
  // ساعة الجهاز: إن اختلفت عن ساعة السحابة 5 دقائق أو أكثر تُسجَّل الطلبات والدفعات بوقت خاطئ — تنبيه واضح للموظف
  function checkDeviceClock() {
    const c = window.L997Cloud && window.L997Cloud.status ? window.L997Cloud.status() : null;
    const off = c && c.clockSkewMin !== null && c.clockSkewMin !== undefined ? c.clockSkewMin : null;
    let el = document.getElementById("clockWarnBanner");
    if (off === null || Math.abs(off) < 5) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement("div"); el.id = "clockWarnBanner";
      el.style.cssText = "background:#b42318;color:#fff;padding:10px 16px;text-align:center;font-weight:700;font-size:13px";
      getBannerStack().appendChild(el);
    }
    const mins = Math.abs(off), dir = off > 0 ? (lang === "en" ? "ahead" : "متقدمة") : (lang === "en" ? "behind" : "متأخرة");
    el.textContent = lang === "en"
      ? `⚠ This device's clock is ${mins} min ${dir}. Orders and payments will be recorded at the wrong time — set the date & time to automatic (Bahrain).`
      : `⚠ ساعة هذا الجهاز ${dir} ${mins} دقيقة. ستُسجَّل الطلبات والدفعات بوقت خاطئ — اضبط التاريخ والوقت على «تلقائي» (توقيت البحرين).`;
  }
  setInterval(checkDeviceClock, 20000); setTimeout(checkDeviceClock, 4000);
  // فحص استباقي لمساحة التخزين عند فتح النظام — تنبيه مبكر قبل الوصول لحد الامتلاء الفعلي
  function checkStorageUsage() {
    try {
      let totalBytes = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        totalBytes += (k.length + (localStorage.getItem(k) || "").length) * 2; // تقدير UTF-16
      }
      const mb = totalBytes / (1024 * 1024);
      if (mb > 4) {
        const banner = document.createElement("div");
        banner.id = "storageWarningBanner";
        banner.style.cssText = "background:#b8860b;color:#fff;padding:10px 16px;text-align:center;font-weight:700;font-size:13px";
        banner.innerHTML = `⚠ مساحة تخزين النظام اقتربت من الامتلاء (${mb.toFixed(1)} ميجا). يُنصح بتصدير نسخة احتياطية من صفحة "ملف المنشأة" قريباً. <span style="cursor:pointer;margin-inline-start:10px" id="storageWarnCloseBtn">✕</span>`;
        getBannerStack().appendChild(banner);
        document.getElementById("storageWarnCloseBtn").addEventListener("click", () => banner.remove());
      }
    } catch (e) { /* تجاهل — هذا فحص وقائي غير حرج */ }
  }
  // تذكير النسخ الاحتياطي — يعمل على جدول زمني وعدد طلبات ثابتين، بغض النظر عن حجم التخزين
  // يطلب من المتصفح عدم حذف بيانات النظام تلقائياً (عند امتلاء الجهاز أو طول عدم الاستخدام — مهم على iPhone)
  function requestPersistentStorage() {
    try {
      if (!navigator.storage || !navigator.storage.persist) return;
      navigator.storage.persisted().then((ok) => ok || navigator.storage.persist()).catch(() => {});
    } catch (e) { /* متصفح قديم — لا شيء */ }
  }
  requestPersistentStorage();
  function checkBackupReminder() {
    try {
      // التاريخ محفوظ كنص JSON (بين علامتي تنصيص) — قراءته بدون تحليل كانت تعطي «تاريخ غير صالح» فيتوقف تذكير الأيام السبعة
      const lastAt = load("l997_last_backup_at", null);
      const lastCount = Number(load("l997_last_backup_order_count", 0)) || 0;
      const daysSince = lastAt ? (Date.now() - new Date(lastAt).getTime()) / (1000 * 60 * 60 * 24) : Infinity;
      const ordersSince = orders.length - lastCount;
      const neverBackedUp = !lastAt;
      const dueByTime = daysSince >= 7;
      const dueByVolume = ordersSince >= 20;
      // لا نزعج مستخدماً جديداً جداً بعدد طلبات قليل جداً لسا
      if (neverBackedUp && orders.length < 5) return;
      if (!neverBackedUp && !dueByTime && !dueByVolume) return;

      const reason = neverBackedUp
        ? "ما أخذت نسخة احتياطية أبداً بعد"
        : dueByTime && dueByVolume
        ? `آخر نسخة احتياطية من ${Math.floor(daysSince)} يوم، و${ordersSince} طلب جديد منذ ذلك الوقت`
        : dueByTime
        ? `آخر نسخة احتياطية من ${Math.floor(daysSince)} يوم`
        : `${ordersSince} طلب جديد منذ آخر نسخة احتياطية`;

      const banner = document.createElement("div");
      banner.id = "backupReminderBanner";
      banner.style.cssText = "background:#0f766e;color:#fff;padding:10px 16px;text-align:center;font-weight:700;font-size:13px";
      banner.innerHTML = `📦 وقت النسخة الاحتياطية — ${reason}. <u style="cursor:pointer" id="backupReminderLink">صدّرها الآن (دقيقة وحدة)</u> <span style="cursor:pointer;margin-inline-start:10px" id="backupReminderCloseBtn">✕</span>`;
      getBannerStack().appendChild(banner);
      document.getElementById("backupReminderCloseBtn").addEventListener("click", () => banner.remove());
      document.getElementById("backupReminderLink").addEventListener("click", () => {
        openPage("profile");
        document.getElementById("exportBackupBtn")?.click();
      });
    } catch (e) { /* تجاهل — هذا فحص وقائي غير حرج */ }
  }
  // شبكة أمان عامة: أي خطأ برمجي غير متوقع بأي مكان بالنظام يُعرَض للمستخدم بدل ما يفشل بصمت
  window.addEventListener("error", (e) => {
    if (e.message && (e.message.includes("Quota") || e.message.includes("quota") || e.message.includes("storage"))) {
      showStorageFailureBanner(e);
    }
  });
  // دمج آمن عند الحفظ: يعيد قراءة المخزّن الفعلي قبل الكتابة، ويحافظ على أي سجل أضافه تبويب/جهاز آخر
  // في نفس اللحظة تقريباً (بدل الكتابة الكاملة اللي كانت تمحو سجلات الآخرين بصمت)
  function mergeSaveById(key, inMemoryArray) {
    try {
      const stored = JSON.parse(localStorage.getItem(key) || "[]");
      if (!Array.isArray(stored)) { save(key, inMemoryArray); return inMemoryArray; }
      const inMemoryIds = new Set(inMemoryArray.map((r) => r.id));
      const foreignRecords = stored.filter((r) => r && r.id && !inMemoryIds.has(r.id));
      const merged = foreignRecords.length ? [...inMemoryArray, ...foreignRecords] : inMemoryArray;
      localStorage.setItem(key, JSON.stringify(merged));
      return merged;
    } catch (e) {
      save(key, inMemoryArray);
      return inMemoryArray;
    }
  }
  /* مصدر الحقيقة الواحد للأرقام المشتقة:
     - رصيد العميل = مجموع حركاته في سجل الأرصدة + رصيد افتتاحي معتمد (openingBalance)
     - قطع الباقة المتبقية = إجمالي القطع − المستهلك في الطلبات غير الملغاة
     الحركات سجلات مستقلة لا تتعارض بين الأجهزة، أما الرقم المخزّن فقد يتعارض (دفعتان من جهازين في نفس الوقت)
     — لذلك يُعاد حسابه دائماً من الحركات. العملاء/الباقات القديمة التي لا يطابق رقمها السجل لا تُغيَّر تلقائياً:
     تظهر للمراجعة في صفحة الأرصدة. */
  function reconcileDerived() {
    let changed = false;
    const sums = new Map();
    ledger.forEach((tx) => sums.set(tx.customerId, round3((sums.get(tx.customerId) || 0) + (Number(tx.amount) || 0))));
    customers.forEach((c) => {
      const fromLedger = round3((sums.get(c.id) || 0) + (Number(c.openingBalance) || 0));
      const same = Math.abs(round3(Number(c.balance) || 0) - fromLedger) < 0.0005;
      if (typeof c.openingBalance !== "number") { if (same) { c.openingBalance = 0; changed = true; } return; }
      if (!same) { c.balance = fromLedger; changed = true; }
    });
    FIN.packageUsage(customerPackages, orders).forEach((u) => {
      if (u.pkg.derivedPieces !== true) { if (u.consistent) { u.pkg.derivedPieces = true; changed = true; } return; }
      if (!u.consistent) { u.pkg.remainingPieces = u.remaining; changed = true; }
    });
    return changed;
  }
  // عملاء رصيدهم القديم لا يطابق سجل حركاتهم — بانتظار قرار المالك/المدير
  function balanceMismatches() {
    const sums = new Map();
    ledger.forEach((tx) => sums.set(tx.customerId, round3((sums.get(tx.customerId) || 0) + (Number(tx.amount) || 0))));
    return customers.filter((c) => typeof c.openingBalance !== "number").map((c) => ({ c, ledgerSum: round3(sums.get(c.id) || 0), diff: round3((Number(c.balance) || 0) - (sums.get(c.id) || 0)) }));
  }
  function persistAll() {
    reconcileDerived();
    save(KEYS.settings, settings);
    customers = mergeSaveById(KEYS.customers, customers);
    orders = mergeSaveById(KEYS.orders, orders);
    ledger = mergeSaveById(KEYS.ledger, ledger);
    customerPackages = mergeSaveById(KEYS.customerPackages, customerPackages);
    save(KEYS.activity, activity.slice(0, 60));
  }
  /* ============================= الأمان: الجهاز، أحداث الأمان، الجلسات، التنبيهات ============================= */
  function deviceId() { return window.L997Enterprise && window.L997Enterprise.deviceId ? window.L997Enterprise.deviceId() : "nodev"; }
  function deviceLabel() {
    const ua = navigator.userAgent || "";
    const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? "iPad" : /Android/.test(ua) ? (/Mobile/.test(ua) ? "Android" : "Android tablet") : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "Device";
    const br = /EdgA?\//.test(ua) ? "Edge" : /SamsungBrowser/.test(ua) ? "Samsung" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /FxiOS|Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
    return `${os} · ${br}`;
  }
  // حدث أمني: يُسجَّل في سجل التدقيق مع اسم المستخدم والجهاز ونوعه ودرجته (info / warn / risk)
  function secLog(type, text, extra) {
    const x = extra || {};
    const meta = { sec: type, u: x.u || (me && me.username) || "", dev: deviceId(), label: deviceLabel(), sev: x.sev || "info" };
    if (x.target) meta.target = x.target;
    activity.unshift({ text, at: new Date().toISOString() }); activity = activity.slice(0, 60); save(KEYS.activity, activity);
    if (window.L997Enterprise) window.L997Enterprise.log(text, 0, meta);
  }
  const auditList = () => { try { return JSON.parse(localStorage.getItem("l997_audit") || "[]") || []; } catch (e) { return []; } };
  const secEvents = (type, sinceMs) => auditList().filter((a) => a.meta && a.meta.sec === type && (!sinceMs || Date.now() - new Date(a.at).getTime() <= sinceMs));
  // تنبيهات الدخول المشبوه — تُسجَّل كحدث «risk» فتصل لأجهزة المالك والمدير وتظهر في صفحة الأمان
  function checkFailedBurst(username) {
    if (!username) return;
    const fails = secEvents("login_fail", 15 * 60000).filter((a) => (a.meta.u || "").toLowerCase() === username.toLowerCase());
    const alerted = secEvents("alert", 15 * 60000).some((a) => a.meta.target === "fail:" + username.toLowerCase());
    if (fails.length >= 3 && !alerted) secLog("alert", `🚨 محاولات دخول فاشلة متكررة لحساب «${username}» (${fails.length} خلال 15 دقيقة) — ${deviceLabel()}`, { u: username, sev: "risk", target: "fail:" + username.toLowerCase() });
  }
  function checkNewAdminDevice(emp) {
    if (!emp || !["owner", "manager"].includes(validRole(emp.role))) return;
    const dev = deviceId();
    const seen = secEvents("login_ok").some((a) => a.meta.dev === dev && (a.meta.u || "") === (emp.username || ""));
    if (!seen && secEvents("login_ok").some((a) => (a.meta.u || "") === (emp.username || ""))) secLog("alert", `⚠ دخول حساب إداري «${emp.name}» من جهاز جديد: ${deviceLabel()}`, { u: emp.username, sev: "warn", target: "newdev:" + dev });
  }
  // ---- الجلسات: سجل لكل دخول (الجهاز، البداية، آخر نشاط، النهاية) — يُزامن، ويمكن للمدير إبطاله عن بُعد ----
  const SESS_KEY = "l997_sessions";
  const loadSessions = () => { try { const a = JSON.parse(localStorage.getItem(SESS_KEY) || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
  function saveSessions(list) { save(SESS_KEY, list.slice(0, 300)); }
  let mySessionId = null, lastTouch = 0;
  function startSessionRecord(emp) {
    const now = new Date().toISOString();
    mySessionId = uid(); lastTouch = Date.now();
    const list = loadSessions();
    list.unshift({ id: mySessionId, uid: emp.cloudUserId || "", empId: emp.id, name: emp.name, username: emp.username || "", role: validRole(emp.role), dev: deviceId(), label: deviceLabel(), at: now, seen: now, end: null, why: "", revokedAt: null, revokedBy: "", mfa: !!emp._mfaPassed });
    saveSessions(list);
    return mySessionId;
  }
  function touchSession(force) {
    if (!mySessionId || (!force && Date.now() - lastTouch < 60000)) return;
    lastTouch = Date.now();
    const list = loadSessions(), s0 = list.find((x) => x.id === mySessionId);
    if (!s0 || s0.end || s0.revokedAt) return;
    s0.seen = new Date(Math.max(lastAct || 0, Date.now() - 1000)).toISOString();
    saveSessions(list);
  }
  function endSessionRecord(why) {
    if (!mySessionId) return;
    const list = loadSessions(), s0 = list.find((x) => x.id === mySessionId);
    if (s0 && !s0.end) { s0.end = new Date().toISOString(); s0.why = why || "logout"; s0.seen = s0.end; saveSessions(list); }
    mySessionId = null;
  }
  // أُبطلت جلستي من المالك/المدير على جهاز آخر؟
  function remoteRevoked() {
    if (!mySessionId) return false;
    const s0 = loadSessions().find((x) => x.id === mySessionId);
    return !!(s0 && s0.revokedAt);
  }
  // آخر دخول/آخر نشاط/آخر خروج لكل موظف — من سجل الجلسات المتزامن (يكتبه كل الأدوار)، مع lastLogin القديم كاحتياط
  function loginInfo(e) {
    const mine = loadSessions().filter((x) => (x.empId && x.empId === e.id) || (e.cloudUserId && x.uid === e.cloudUserId) || (!x.empId && e.username && x.username === e.username));
    const at = mine.reduce((m, x) => (x.at && x.at > m ? x.at : m), String(e.lastLogin || ""));
    const last = mine.slice().sort((a, b) => String(b.at).localeCompare(String(a.at)))[0] || null;
    return { at: at || null, last, state: last ? sessionState(last) : null, out: last ? last.end || null : null, seen: last ? last.seen || null : null };
  }
  function lastLoginCell(e) {
    const i = loginInfo(e);
    if (!i.at) return "—";
    const tag = i.state === "active" ? ' <span class="status-badge status-ready">متصل الآن</span>' : i.out ? `<div class="inv-muted" style="font-size:11.5px">خروج: ${fmtDT(i.out)}</div>` : i.seen ? `<div class="inv-muted" style="font-size:11.5px">آخر نشاط: ${fmtDT(i.seen)}</div>` : "";
    return fmtDT(i.at) + tag;
  }
  function sessionState(x) {
    if (x.revokedAt) return "revoked";
    if (x.end) return x.why === "idle" ? "idle" : "ended";
    return Date.now() - new Date(x.seen || x.at).getTime() > (sec.idleMin * 60000 + 5 * 60000) ? "stale" : "active";
  }
  // شارة تنبيهات الأمان في القائمة + رسالة عند وصول تنبيه جديد (للمالك والمدير)
  let lastAlertCheck = 0;
  function checkSecurityBadge() {
    if (!me || !["owner", "manager"].includes(role) || Date.now() - lastAlertCheck < 5000) return;
    lastAlertCheck = Date.now();
    let seenAt = ""; try { seenAt = localStorage.getItem("l997_sec_seen_" + me.id) || ""; } catch (e) { seenAt = ""; }
    const risks = auditList().filter((a) => a.meta && (a.meta.sev === "risk" || a.meta.sev === "warn") && (!seenAt || a.at > seenAt));
    const nav = document.querySelector('.nav-item[data-page="security"]');
    if (nav) { let b = nav.querySelector(".sec-badge"); if (risks.length) { if (!b) { b = document.createElement("span"); b.className = "sec-badge"; nav.appendChild(b); } b.textContent = String(risks.length); } else if (b) b.remove(); }
    const newest = risks[0];
    let toasted = ""; try { toasted = localStorage.getItem("l997_sec_toasted") || ""; } catch (e) { toasted = ""; }
    if (newest && newest.id !== toasted && newest.meta.dev !== deviceId()) { try { localStorage.setItem("l997_sec_toasted", newest.id); } catch (e) { /* ignore */ } toast(`🛡 تنبيه أمني: ${newest.action}`); }
  }
  function logActivity(text, value) {
    activity.unshift({ text, at: new Date().toISOString() });
    activity = activity.slice(0, 60);
    save(KEYS.activity, activity);
    if (window.L997Enterprise) window.L997Enterprise.log(text, value || 0);
  }

  const DATE_LOCALES = { ar: "ar-BH", en: "en-GB", ur: "ur-PK" };
  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  }
  function fmtDT(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString(DATE_LOCALES[lang] || "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bahrain" });
  }
  /* أرقام الجوال: البحرين افتراضياً (8 أرقام)، دول الخليج برمزها (يُتحقق من الطول)، وأي رقم دولي يبدأ بـ + أو 00.
     يُحفظ الرقم دائماً بصيغة دولية كاملة بدون + (مثل 97333445566 / 966501234567) — وهي نفسها صيغة واتساب. */
  const PHONE_LEN = { "973": [8], "966": [9], "971": [8, 9], "965": [8], "974": [8], "968": [8] };
  // دول يُكتب فيها صفر محلي بعد رمز الدولة (+966 05… ← 9665…) فيُحذف تلقائياً
  const TRUNK0 = ["966", "971", "20", "44", "91", "92", "63", "62", "880", "94", "977", "90", "33", "49", "962", "961", "964", "212", "216", "213", "249"];
  function normPhone(p) {
    const raw = toLatinDigits(p || "").trim(), intl = /^\s*(\+|00)/.test(raw);
    let d = raw.replace(/\D/g, "");
    if (intl && d.startsWith("00")) d = d.slice(2);
    if (!d) return { digits: "", ok: false, cc: "" };
    if (intl) {
      for (const c of TRUNK0) if (d.startsWith(c + "0")) { d = c + d.slice(c.length + 1); break; }
      const cc = Object.keys(PHONE_LEN).find((c) => d.startsWith(c));
      if (cc) return { digits: d, ok: PHONE_LEN[cc].includes(d.length - cc.length), cc };
      return { digits: d, ok: d.length >= 8 && d.length <= 15 && !d.startsWith("0"), cc: "" };
    }
    if (d.length === 8) return { digits: "973" + d, ok: true, cc: "973" }; // رقم بحريني محلي
    const cc = Object.keys(PHONE_LEN).find((c) => d.startsWith(c));
    if (cc) return { digits: d, ok: PHONE_LEN[cc].includes(d.length - cc.length), cc };
    // بدون + : رقم دولي كامل من 10 إلى 15 رقماً (لا يبدأ بصفر — 05… بدون رمز الدولة غير واضح)
    return { digits: d, ok: d.length >= 10 && d.length <= 15 && !d.startsWith("0"), cc: "" };
  }
  function phoneKey(p) { const n = normPhone(p); return n.digits; }
  function samePhone(a, b) { const x = phoneKey(a), y = phoneKey(b); return !!x && x === y; }
  function validPhone(p) { return normPhone(p).ok; }
  const validLocalPhone = validPhone; // الاسم القديم
  function cleanPhone(phone) { return normPhone(phone).digits; }
  function fmtPhone(p) {
    const n = normPhone(p), d = n.digits;
    if (!n.ok) return String(p || "");
    if (n.cc === "973" || (n.cc && d.length - n.cc.length === 8)) { const r = d.slice(n.cc.length); return `+${n.cc} ${r.slice(0, 4)} ${r.slice(4)}`; }
    if (n.cc) return `+${n.cc} ${d.slice(n.cc.length)}`;
    return "+" + d;
  }
  const PHONE_HINT = () => (lang === "en" ? "Enter an 8-digit Bahrain number, or an international number starting with + and the country code (e.g. +966 5XXXXXXXX)" : "اكتب رقماً بحرينياً من 8 أرقام، أو رقماً دولياً يبدأ بـ + ورمز الدولة (مثال: ‎+966 5XXXXXXXX)");
  window.normPhone997 = normPhone; window.fmtPhone997 = fmtPhone;
  function openWhatsApp(phone, text) {
    if (!validPhone(phone)) { toast(lang === "en" ? "This customer has no valid phone number — add it in the customer file first" : "لا يوجد رقم هاتف صحيح لهذا العميل — أضفه في ملف العميل أولاً"); return; }
    // api.whatsapp.com/send (وليس wa.me): رابط wa.me يحوّل الرموز التعبيرية إلى «�» على بعض أجهزة أندرويد
    const url = `https://api.whatsapp.com/send?phone=${cleanPhone(phone)}&text=${encodeURIComponent(text)}`;
    let newWin = null;
    try { newWin = window.open(url, "_blank"); } catch (e) { newWin = null; }
    // إن حُظرت النافذة الجديدة (حظر منبثقات شائع بمتصفحات الجوال)، ننتقل بنفس الصفحة — طريقة لا يمكن حظرها إطلاقاً
    if (!newWin || newWin.closed || typeof newWin.closed === "undefined") {
      window.location.href = url;
    }
  }

  /* -------------------------------- Toast -------------------------------- */
  const toastEl = document.getElementById("toast");
  let toastTimer = null;
  // الرسالة تظهر فوق أي نافذة مفتوحة (طبقة popover العليا)، وتُكتب أيضاً داخل النموذج المفتوح
  // حتى لا تختفي رسائل الخطأ خلف النوافذ (كان سبب «زر التسليم لا يعمل» على الجوال)
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    if (typeof toastEl.showPopover === "function") {
      try {
        if (!toastEl.hasAttribute("popover")) toastEl.setAttribute("popover", "manual");
        if (toastEl.matches(":popover-open")) toastEl.hidePopover();
        toastEl.showPopover();
      } catch (e) { /* متصفح قديم — يبقى العرض العادي */ }
    }
    const qfErr = document.getElementById("quickFormError");
    if (qfErr && document.getElementById("quickFormDialog")?.open) qfErr.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove("show");
      setTimeout(() => { try { if (!toastEl.classList.contains("show") && toastEl.matches(":popover-open")) toastEl.hidePopover(); } catch (e) { /* تجاهل */ } }, 300);
    }, 3200);
  }

  /* ------------------------------ اللغة ------------------------------ */
  function applyStaticI18n() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "en" ? "ltr" : "rtl";
    const titles = { ar: "997 Laundry | نظام إدارة المغسلة", en: "997 Laundry | Management System", ur: "997 Laundry | مینجمنٹ سسٹم" };
    document.getElementById("docTitle").textContent = titles[lang];
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (I18N.ar[key] !== undefined) el.textContent = t(key);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (I18N.ar[key] !== undefined) el.placeholder = t(key);
    });
    document.getElementById("langSelect").value = lang;
    document.getElementById("langSelectTop").value = lang;
    // ترجمة تلقائية لكل نص عربي مكتوب مباشرة في الواجهة (النوافذ والرسائل) عند اختيار الإنجليزية/الأردو
    if (window.L997Translate) window.L997Translate.setLang(lang);
  }

  function setLanguage(newLang) {
    // الرجوع للعربية بعد الترجمة التلقائية: إعادة تحميل لاستعادة النصوص الأصلية (الجلسة تبقى)
    if (newLang === "ar" && lang !== "ar") { save(KEYS.lang, newLang); window.location.reload(); return; }
    lang = newLang;
    save(KEYS.lang, lang);
    applyStaticI18n();
    applyRole();
    activeClothingId = CLOTHING_DEFAULT[0].id;
    renderCurrentPage();
  }
  document.getElementById("langSelect").addEventListener("change", (e) => setLanguage(e.target.value));
  document.getElementById("langSelectTop").addEventListener("change", (e) => setLanguage(e.target.value));

  /* ------------------------------ التنقل ------------------------------ */
  const PAGE_META_KEYS = {
    dashboard: ["page_dashboard_title", "page_dashboard_sub"],
    "new-order": ["page_neworder_title", "page_neworder_sub"],
    orders: ["page_orders_title", "page_orders_sub"],
    customers: ["page_customers_title", "page_customers_sub"],
    balances: ["page_balances_title", "page_balances_sub"],
    reports: ["page_reports_title", "page_reports_sub"],
    finance: ["page_finance_title", "page_finance_sub"],
    inventory: ["page_inventory_title", "page_inventory_sub"],
    employees: ["page_employees_title", "page_employees_sub"],
    closures: ["page_closures_title", "page_closures_sub"],
    audit: ["page_audit_title", "page_audit_sub"],
    security: ["مركز الأمان", "محاولات الدخول · الجلسات · التنبيهات · سجل التدقيق"],
    delivery: ["page_delivery_title", "page_delivery_sub"],
    loyalty: ["page_loyalty_title", "page_loyalty_sub"],
    whatsapp: ["page_wa_title", "page_wa_sub"],
    profile: ["page_profile_title", "page_profile_sub"],
    access: ["page_access_title", "page_access_sub"],
    settings: ["page_settings_title", "page_settings_sub"],
  };
  let currentPage = "dashboard";

  function renderCurrentPage() { openPage(currentPage, true); }

  function openPage(pageId, skipNav) {
    if (me && PAGE_NEED[pageId] && !can(PAGE_NEED[pageId])) { if (pageId !== "dashboard") denied(); pageId = homePage(); }
    currentPage = pageId;
    document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
    document.getElementById("page-" + pageId)?.classList.add("active");
    document.querySelectorAll(".nav-item").forEach((n) => n.classList.toggle("active", n.dataset.page === pageId));
    const meta = PAGE_META_KEYS[pageId] || ["", ""];
    const resolveMeta = (value) => I18N.ar[value] !== undefined || I18N.en[value] !== undefined ? t(value) : value;
    document.getElementById("pageTitle").textContent = resolveMeta(meta[0]);
    document.getElementById("pageSubtitle").textContent = resolveMeta(meta[1]);
    document.getElementById("sidebar")?.classList.remove("open");

    if (pageId === "dashboard") renderDashboard();
    if (pageId === "new-order") renderNewOrderPage();
    if (pageId === "orders") renderOrdersPage();
    if (pageId === "customers") renderCustomersPage();
    if (pageId === "balances") renderBalancesPage();
    if (pageId === "reports") renderReportsPage();
    if (pageId === "finance" && typeof window.renderFinance997 === "function") window.renderFinance997();
    if (pageId === "inventory" && typeof window.renderInventory997 === "function") window.renderInventory997();
    if (pageId === "employees" && typeof window.renderEmployees997 === "function") window.renderEmployees997();
    if (pageId === "closures" && typeof window.renderClosures997 === "function") window.renderClosures997();
    if (pageId === "audit" && typeof window.renderAudit997 === "function") window.renderAudit997();
    if (pageId === "security") renderSecurityPage();
    if (pageId === "delivery") renderDeliveryPage();
    if (pageId === "loyalty") renderLoyaltyPage(true);
    if (pageId === "whatsapp") { renderWhatsAppPage(); waLoadThreads().then(() => { if (currentPage === "whatsapp") renderWhatsAppPage(); }); }
    try { updateDeliveryBadge(); } catch (e) { /* ignore */ }
    if (pageId === "settings") renderSettingsPage();
    if (pageId === "profile") renderProfilePage();
    if (pageId === "access") renderAccessPage();
  }

  /* جداول القوائم على الجوال: كل خلية تأخذ عنوان عمودها (data-label) لتُعرض كبطاقة مرتبة بدل التمرير الأفقي.
     تُستثنى جداول الإدخال (الأسعار، الصلاحيات) والإيصالات. */
  function labelTables() {
    document.querySelectorAll(".page table, dialog table").forEach((tb) => {
      if (tb.closest("#printReceipt, .receipt") || tb.classList.contains("permission-table") || tb.classList.contains("no-mcard")) return;
      const head = tb.tHead && tb.tHead.rows[0];
      if (!head || head.querySelector("input, select")) return;
      const labels = [];
      [...head.cells].forEach((th) => { const n = th.colSpan || 1; for (let i = 0; i < n; i++) labels.push(th.textContent.replace(/\s+/g, " ").trim()); });
      tb.classList.add("mcard");
      [...tb.tBodies].forEach((body) => [...body.rows].forEach((tr) => {
        let col = 0;
        [...tr.cells].forEach((td) => {
          const lb = labels[col] || ""; col += td.colSpan || 1;
          if (td.getAttribute("data-label") !== lb) td.setAttribute("data-label", lb);
          const txt = td.textContent.replace(/\s+/g, "").trim();
          const empty = !td.querySelector("button, a, input, select, img") && (txt === "" || txt === "—" || txt === "-" || txt === "–");
          td.toggleAttribute("data-empty", empty);
          td.toggleAttribute("data-full", (td.colSpan || 1) > 1);
          // خلية أزرار فقط (الإجراءات) — تُعرض صفاً كاملاً بدون عنوان
          const btns = td.querySelectorAll("button, a.primary-btn, a.ghost-btn");
          const btnText = [...btns].map((b) => b.textContent).join("").replace(/\s+/g, "");
          td.toggleAttribute("data-actions", btns.length > 0 && btnText.length >= txt.length && !td.matches(":first-child"));
        });
      }));
    });
  }
  // شاشة لمس (آيفون / تابلت): أزرار وحقول أكبر
  try { if ((window.matchMedia && window.matchMedia("(pointer:coarse)").matches) || (navigator.maxTouchPoints || 0) > 0) document.documentElement.classList.add("touch"); } catch (e) { /* ignore */ }
  let labelQueued = false;
  new MutationObserver(() => { if (labelQueued) return; labelQueued = true; requestAnimationFrame(() => { labelQueued = false; labelTables(); }); })
    .observe(document.body, { childList: true, subtree: true });

  /* ============================= مركز الأمان (للمالك والمدير) ============================= */
  const secView = { tab: "overview", user: "", from: "", to: "", type: "", q: "" };
  const LOGIN_TYPES = ["login_ok", "login_fail", "lockout", "mfa_fail", "logout", "idle_logout", "session_revoked"];
  const SEC_TYPE_LABEL = { login_ok: "دخول ناجح", login_fail: "دخول فاشل", lockout: "قفل الحساب", mfa_fail: "رمز تحقق خاطئ", logout: "تسجيل خروج", idle_logout: "خروج لعدم النشاط", session_revoked: "إنهاء جلسة", alert: "تنبيه أمني", mfa_on: "تفعيل التحقق بخطوتين", mfa_off: "إيقاف التحقق بخطوتين", mfa_trust: "جهاز موثوق", policy: "سياسة أمان", session_revoke: "إبطال جلسة" };
  const legacyLoginType = (a) => /محاولة دخول فاشلة/.test(a.action) ? "login_fail" : /^تسجيل دخول/.test(a.action) ? "login_ok" : /^تسجيل خروج/.test(a.action) ? "logout" : /خروج تلقائي/.test(a.action) ? "idle_logout" : "";
  const evType = (a) => (a.meta && a.meta.sec) || legacyLoginType(a);
  const evSev = (a) => (a.meta && a.meta.sev) || (evType(a) === "login_fail" ? "warn" : "info");
  function secFilter(list, timeOf) {
    const q = secView.q.trim().toLowerCase();
    return list.filter((x) => {
      const d = isoDay(timeOf(x));
      if (secView.from && d < secView.from) return false;
      if (secView.to && d > secView.to) return false;
      if (secView.user && (x.who || x.name || "") !== secView.user && (x.meta ? x.meta.u : x.username) !== secView.user) return false;
      if (q && !JSON.stringify(x).toLowerCase().includes(q)) return false;
      return true;
    });
  }
  // فحص سلامة سجل التدقيق: البصمات وتسلسل القيود لكل جهاز
  function verifyAuditChain() {
    const canon = window.L997Enterprise && window.L997Enterprise.auditCanon;
    const byDev = {}; let unsigned = 0;
    auditList().forEach((a) => { if (!a.h || !a.dev) { unsigned++; return; } (byDev[a.dev] = byDev[a.dev] || []).push(a); });
    const bad = [], gaps = [];
    Object.entries(byDev).forEach(([dev, list]) => {
      list.sort((x, y) => x.n - y.n);
      list.forEach((a, i) => {
        if (canon && sha256(canon(a)) !== a.h) bad.push(a);
        const prev = list[i - 1];
        if (prev && a.n === prev.n + 1 && a.prev !== prev.h) bad.push(a);
        if (prev && a.n > prev.n + 1) gaps.push({ dev, from: prev.n + 1, to: a.n - 1, after: prev.at });
      });
    });
    return { devices: Object.keys(byDev).length, checked: Object.values(byDev).reduce((n, l) => n + l.length, 0), unsigned, bad, gaps };
  }
  function secCsv(rows, name) {
    const csv = "\ufeff" + rows.map((r) => r.map((c) => `"${String(c == null ? "" : c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })), a = document.createElement("a");
    a.href = url; a.download = `997-security-${name}-${todayStr()}.csv`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  function renderSecurityPage() {
    const root = document.getElementById("securityRoot"); if (!root) return;
    if (!can("security_center")) { root.innerHTML = `<div class="panel"><p class="section-note">${AX("e_noperm")}</p></div>`; return; }
    const all = auditList(), sessions = loadSessions();
    const DAY = 86400000, t = Date.now();
    const logins = all.filter((a) => LOGIN_TYPES.includes(evType(a)));
    const alerts = all.filter((a) => evType(a) === "alert" || evSev(a) === "risk");
    const sensitive = all.filter((a) => a.sens && !LOGIN_TYPES.includes(evType(a)));
    const users = [...new Set([...all.map((a) => a.who).filter(Boolean), ...sessions.map((x) => x.name).filter(Boolean)])].sort();
    const admins = emps().filter((e) => e.active !== false && isAdminRole(e.role) && hasLoginAccount(e));
    const active = sessions.filter((x) => sessionState(x) === "active");
    let seenAt = ""; try { seenAt = localStorage.getItem("l997_sec_seen_" + (me ? me.id : "")) || ""; } catch (e) { seenAt = ""; }
    const unseen = alerts.filter((a) => !seenAt || a.at > seenAt).length;
    const fails24 = logins.filter((a) => ["login_fail", "lockout"].includes(evType(a)) && t - new Date(a.at).getTime() < DAY).length;
    const tabs = [["overview", "نظرة عامة"], ["logins", `محاولات الدخول`], ["sessions", `الجلسات (${active.length})`], ["sensitive", "التغييرات الحساسة"], ["alerts", `التنبيهات${unseen ? ` (${unseen})` : ""}`], ["audit", "سجل التدقيق"]];
    const typeOpts = secView.tab === "logins" ? [["", "كل الأنواع"], ...LOGIN_TYPES.map((k) => [k, SEC_TYPE_LABEL[k]])]
      : secView.tab === "audit" ? [["", "كل العمليات"], ["system", "النظام والأمان"], ["orders", "الطلبات"], ["customers", "العملاء والأرصدة"], ["money", "المالية"], ["inventory", "المخزون"], ["staff", "الموظفون"], ["other", "أخرى"]]
      : secView.tab === "sessions" ? [["", "كل الحالات"], ["active", "نشطة"], ["stale", "متوقفة (بدون نشاط)"], ["ended", "منتهية"], ["idle", "انتهت بالخمول"], ["revoked", "أُبطلت"]]
      : secView.tab === "alerts" ? [["", "كل الدرجات"], ["risk", "خطر"], ["warn", "تحذير"]] : null;
    const filters = secView.tab === "overview" ? "" : `<div class="cust-tools" style="margin-bottom:10px">
        <input type="search" id="secQ" class="inv-search" placeholder="بحث…" value="${esc(secView.q)}">
        <select id="secUser"><option value="">كل المستخدمين</option>${users.map((u) => `<option ${u === secView.user ? "selected" : ""}>${esc(u)}</option>`).join("")}</select>
        ${typeOpts ? `<select id="secType">${typeOpts.map(([v, l]) => `<option value="${v}" ${v === secView.type ? "selected" : ""}>${l}</option>`).join("")}</select>` : ""}
        <label style="display:flex;gap:6px;align-items:center">من<input type="date" id="secFrom" value="${esc(secView.from)}"></label>
        <label style="display:flex;gap:6px;align-items:center">إلى<input type="date" id="secTo" value="${esc(secView.to)}"></label>
        <button class="ghost-btn" type="button" id="secClear">مسح الفلاتر</button><button class="secondary-btn" type="button" id="secCsv">تصدير CSV</button></div>`;
    const sevPill = (sv) => sv === "risk" ? '<span class="status-badge status-cancelled">خطر</span>' : sv === "warn" ? '<span class="status-badge" style="background:#fff3e4;color:#a15b12">تحذير</span>' : '<span class="status-badge status-ready">عادي</span>';
    const evRows = (list) => list.length ? list.slice(0, 400).map((a) => `<tr><td>${fmtDT(a.at)}</td><td>${esc(a.who || (a.meta && a.meta.u) || "—")}</td><td>${esc((a.meta && a.meta.u) || "")}</td><td>${esc(SEC_TYPE_LABEL[evType(a)] || a.cat || "")}</td><td>${esc(a.action)}</td><td>${esc((a.meta && a.meta.label) || "")}</td><td>${sevPill(evSev(a))}</td></tr>`).join("") : `<tr><td colspan="7" class="empty-state compact">لا توجد سجلات</td></tr>`;
    const evTable = (list) => `<div class="table-wrap"><table><thead><tr><th>التاريخ والوقت</th><th>المستخدم</th><th>اسم الدخول</th><th>النوع</th><th>العملية</th><th>الجهاز</th><th>الدرجة</th></tr></thead><tbody>${evRows(list)}</tbody></table></div>`;
    let body = "", current = [];
    if (secView.tab === "overview") {
      const chain = secView.chain;
      body = `<div class="metrics-grid">
          <div class="metric-card"><div class="metric-top"><span>محاولات فاشلة (24 ساعة)</span><span class="metric-icon">⛔</span></div><div class="metric-value" style="${fails24 ? "color:var(--danger)" : ""}">${fails24}</div><div class="metric-note">القفل بعد ${sec.maxAttempts} محاولات لمدة ${sec.lockMin} دقيقة</div></div>
          <div class="metric-card"><div class="metric-top"><span>جلسات نشطة الآن</span><span class="metric-icon">🟢</span></div><div class="metric-value">${active.length}</div><div class="metric-note">خروج تلقائي بعد ${sec.idleMin} دقيقة خمول</div></div>
          <div class="metric-card"><div class="metric-top"><span>تنبيهات أمنية جديدة</span><span class="metric-icon">🚨</span></div><div class="metric-value" style="${unseen ? "color:var(--danger)" : ""}">${unseen}</div><div class="metric-note">${alerts.length} تنبيه إجمالاً</div></div>
          <div class="metric-card"><div class="metric-top"><span>التحقق بخطوتين للإدارة</span><span class="metric-icon">🔐</span></div><div class="metric-value">${admins.filter((e) => e.mfaOn).length} / ${admins.length}</div><div class="metric-note">${sec.mfaRequired ? "إلزامي لحسابات الإدارة" : "اختياري — فعّل الإلزام من سياسات الأمان"}</div></div>
        </div>
        <div class="panel" style="margin-top:14px"><div class="panel-header"><div><h3>🔏 سلامة سجل التدقيق</h3><p>كل قيد يحمل بصمة SHA-256 مرتبطة بالقيد السابق من نفس الجهاز، والسحابة ترفض تعديل القيود أو حذفها.</p></div><button class="secondary-btn" type="button" id="secVerify">فحص سلامة السجل</button></div>
          ${chain ? (chain.bad.length || chain.gaps.length ? `<div class="cloud-warn">⚠ <b>${chain.bad.length}</b> قيد معدّل و<b>${chain.gaps.length}</b> فجوة (قيود محذوفة) — ${chain.bad.slice(0, 5).map((a) => `${fmtDT(a.at)}: ${esc(a.action.slice(0, 60))}`).join(" · ")}</div>` : `<p style="color:var(--success);font-weight:700">✓ السجل سليم — ${chain.checked} قيد من ${chain.devices} جهاز، بلا تعديل أو حذف.${chain.unsigned ? ` (${chain.unsigned} قيد قديم قبل تفعيل البصمات)` : ""}</p>`) : `<p class="section-note">اضغط «فحص سلامة السجل».</p>`}
        </div>
        <div class="panel" style="margin-top:14px"><div class="panel-header"><div><h3>🔐 حسابات الإدارة</h3></div></div>
          <div class="table-wrap"><table><thead><tr><th>الحساب</th><th>الدور</th><th>التحقق بخطوتين</th><th>أجهزة موثوقة</th><th>آخر دخول</th></tr></thead><tbody>${admins.map((e) => { const tr = (e.mfaTrust || []).filter((x) => x.until > Date.now() && Date.parse(x.at || 0) > (Number(e.mfaTrustResetAt) || 0)); return `<tr><td>${esc(e.name)}</td><td>${esc(ACCESS_ROLE_AR[validRole(e.role)] || e.role)}</td><td>${e.mfaOn ? '<span class="status-badge status-ready">مفعّل</span>' : '<span class="status-badge status-cancelled">غير مفعّل</span>'}</td><td>${e.mfaOn ? `${tr.length ? tr.map((x) => esc(x.label || "جهاز")).join("، ") : "—"} ${role === "owner" ? `<button class="mini-btn danger-mini" type="button" data-forget-trust="${e.id}">إلغاء الثقة</button>` : ""}` : "—"}</td><td>${lastLoginCell(e)}</td></tr>`; }).join("")}</tbody></table></div>
          <p class="section-note">التفعيل لكل حساب: المستخدمون والصلاحيات ← سياسات الأمان ← «تفعيل التحقق بخطوتين».</p></div>
        <div class="panel" style="margin-top:14px"><div class="panel-header"><div><h3>آخر التنبيهات</h3></div></div>${evTable(alerts.slice(0, 8))}</div>`;
    } else if (secView.tab === "logins") {
      current = secFilter(logins, (a) => a.at).filter((a) => !secView.type || evType(a) === secView.type);
      body = evTable(current);
    } else if (secView.tab === "alerts") {
      current = secFilter(alerts, (a) => a.at).filter((a) => !secView.type || evSev(a) === secView.type);
      body = evTable(current);
      try { if (me) localStorage.setItem("l997_sec_seen_" + me.id, new Date().toISOString()); } catch (e) { /* ignore */ }
    } else if (secView.tab === "sensitive") {
      current = secFilter(sensitive, (a) => a.at);
      body = evTable(current);
    } else if (secView.tab === "audit") {
      current = secFilter(all, (a) => a.at).filter((a) => !secView.type || a.cat === secView.type);
      body = evTable(current);
    } else if (secView.tab === "sessions") {
      const stLabel = { active: '<span class="status-badge status-ready">نشطة</span>', stale: '<span class="status-badge" style="background:#fff3e4;color:#a15b12">بدون نشاط</span>', ended: '<span class="status-badge">منتهية</span>', idle: '<span class="status-badge">انتهت بالخمول</span>', revoked: '<span class="status-badge status-cancelled">أُبطلت</span>' };
      current = secFilter(sessions, (x) => x.at).filter((x) => !secView.type || sessionState(x) === secView.type);
      body = `<div class="table-wrap"><table><thead><tr><th>المستخدم</th><th>الدور</th><th>الجهاز</th><th>بداية الجلسة</th><th>آخر نشاط</th><th>النهاية</th><th>الحالة</th><th></th></tr></thead><tbody>${current.length ? current.slice(0, 300).map((x) => {
        const stt = sessionState(x), mine = x.id === mySessionId;
        return `<tr><td>${esc(x.name)}${mine ? ' <span class="status-badge status-ready">هذه الجلسة</span>' : ""}${x.mfa ? " 🔐" : ""}</td><td>${esc(ACCESS_ROLE_AR[x.role] || x.role || "")}</td><td>${esc(x.label || "")}</td><td>${fmtDT(x.at)}</td><td>${x.seen ? fmtDT(x.seen) : "—"}</td><td>${x.revokedAt ? `${fmtDT(x.revokedAt)} — أنهاها ${esc(x.revokedBy || "")}` : x.end ? fmtDT(x.end) : "—"}</td><td>${stLabel[stt]}</td><td>${(stt === "active" || stt === "stale") && !mine ? `<button class="mini-btn danger-mini" type="button" data-sess-revoke="${x.id}">إنهاء الجلسة</button>` : ""}</td></tr>`;
      }).join("") : `<tr><td colspan="8" class="empty-state compact">لا توجد جلسات</td></tr>`}</tbody></table></div>
        ${(CLOUD && CLOUD.status && CLOUD.status().sessionsSync === false) ? `<div class="cloud-warn">⚠ الجلسات تظهر من هذا الجهاز فقط. لعرض جلسات كل الأجهزة وإنهائها عن بُعد: شغّل ملف <b>supabase/security.sql</b> في Supabase ← SQL Editor (مرة واحدة).</div>` : ""}`;
    }
    root.innerHTML = `<div class="panel"><div class="panel-header"><div><h3>🛡 مركز الأمان</h3><p>محاولات الدخول، الجلسات النشطة، التغييرات الحساسة، التنبيهات وسجل التدقيق — مع اسم المستخدم والتاريخ والوقت والجهاز.</p></div></div>
      <div class="tabs-row">${tabs.map(([k, l]) => `<button type="button" class="cloth-chip ${secView.tab === k ? "active" : ""}" data-sec-tab="${k}">${l}</button>`).join("")}</div>
      ${filters}${body}</div>`;
    root.querySelectorAll("[data-sec-tab]").forEach((b) => b.addEventListener("click", () => { secView.tab = b.dataset.secTab; secView.type = ""; renderSecurityPage(); }));
    root.querySelectorAll("[data-forget-trust]").forEach((b) => b.addEventListener("click", () => {
      const e = emps().find((x) => x.id === b.dataset.forgetTrust); if (!e) return;
      confirmAction(`إلغاء الأجهزة الموثوقة لـ ${e.name}؟ سيُطلب منه الرمز عند الدخول القادم من أي جهاز.`, () => { forgetTrustedDevices(e, `بواسطة ${me ? me.name : ""}`); toast("تم إلغاء الأجهزة الموثوقة"); renderSecurityPage(); });
    }));
    const rer = () => renderSecurityPage();
    const bind = (id, k) => { const el = document.getElementById(id); if (el) el.addEventListener(el.tagName === "INPUT" && el.type === "search" ? "input" : "change", () => { secView[k] = el.value; rer(); if (id === "secQ") { const n = document.getElementById("secQ"); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } } }); };
    bind("secQ", "q"); bind("secUser", "user"); bind("secType", "type"); bind("secFrom", "from"); bind("secTo", "to");
    document.getElementById("secClear")?.addEventListener("click", () => { Object.assign(secView, { user: "", from: "", to: "", type: "", q: "" }); rer(); });
    document.getElementById("secVerify")?.addEventListener("click", () => {
      secView.chain = verifyAuditChain();
      if (secView.chain.bad.length || secView.chain.gaps.length) secLog("alert", `🚨 فحص سلامة السجل: ${secView.chain.bad.length} قيد معدّل و${secView.chain.gaps.length} فجوة`, { sev: "risk", target: "chain" });
      rer();
    });
    document.getElementById("secCsv")?.addEventListener("click", () => {
      if (secView.tab === "sessions") secCsv([["user", "role", "device", "start", "last_seen", "end", "state"], ...current.map((x) => [x.name, x.role, x.label, x.at, x.seen, x.end || x.revokedAt || "", sessionState(x)])], "sessions");
      else secCsv([["date_time", "user", "username", "type", "action", "device", "severity"], ...current.map((a) => [a.at, a.who, a.meta && a.meta.u, SEC_TYPE_LABEL[evType(a)] || a.cat, a.action, a.meta && a.meta.label, evSev(a)])], secView.tab);
    });
    root.querySelectorAll("[data-sess-revoke]").forEach((b) => b.addEventListener("click", () => {
      const list = loadSessions(), x = list.find((y) => y.id === b.dataset.sessRevoke); if (!x) return;
      confirmAction(`إنهاء جلسة «${x.name}» على ${x.label || "الجهاز"}؟ سيُسجَّل خروجه فوراً من ذلك الجهاز.`, () => {
        x.revokedAt = new Date().toISOString(); x.revokedBy = me ? me.name : ""; saveSessions(list);
        secLog("session_revoke", `إنهاء جلسة «${x.name}» (${x.label || ""}) عن بُعد بواسطة ${me ? me.name : ""}`, { u: x.username, sev: "warn", target: x.id });
        rer(); toast("تم إنهاء الجلسة");
      });
    }));
  }

  /* ============================= ملف المنشأة ============================= */
  function loadProfile() {
    try { return JSON.parse(localStorage.getItem("l997_profile") || "null") || {}; } catch (e) { return {}; }
  }
  function saveProfile(p) { localStorage.setItem("l997_profile", JSON.stringify(p)); }
  function loadBranches() {
    try { return JSON.parse(localStorage.getItem("l997_branches") || "null") || [{ name: "الفرع الرئيسي", status: "نشط", hours: "08:00 - 22:00" }]; }
    catch (e) { return [{ name: "الفرع الرئيسي", status: "نشط", hours: "08:00 - 22:00" }]; }
  }
  function saveBranches(b) { localStorage.setItem("l997_branches", JSON.stringify(b)); }

  function renderProfilePage() {
    renderCloudPanel();
    const p = loadProfile();
    document.getElementById("profileNameEn").value = p.nameEn ?? "997 Laundry";
    document.getElementById("profileNameAr").value = p.nameAr ?? "مغسلة 997";
    document.getElementById("profileCr").value = p.cr ?? "";
    document.getElementById("profileVat").value = p.vatId ?? "";
    document.getElementById("profilePhone").value = p.phone ?? "";
    document.getElementById("profileWhatsapp").value = p.whatsapp ?? "";
    document.getElementById("profileEmail").value = p.email ?? "";
    document.getElementById("profileRegion").value = p.region ?? "البحرين";
    document.getElementById("profileAddress").value = p.address ?? "";
    document.getElementById("profileVatPercent").value = p.vatPercent ?? 0;
    document.getElementById("profileRetention").value = p.retention ?? "7 سنوات";
    const branches = loadBranches();
    document.getElementById("branchesBody").innerHTML = branches.map((b) => `<tr><td>${esc(b.name)}</td><td>${esc(b.status)}</td><td>${esc(b.hours)}</td></tr>`).join("");
    const lastBackup = load("l997_last_backup_at", null);
    document.getElementById("lastBackupNote").textContent = lastBackup
      ? `آخر نسخة احتياطية: ${fmtDT(lastBackup)}`
      : "⚠ لا توجد نسخة احتياطية مسجّلة بعد بهذا الجهاز — كل بياناتك محفوظة هنا فقط";
  }

  /* -------------------------- النسخ الاحتياطي -------------------------- */
  const BACKUP_KEYS = [
    "l997_settings", "l997_customers", "l997_orders", "l997_ledger", "l997_activity",
    "l997_customer_packages", "l997_custom_garments", "l997_profile", "l997_branches",
    "l997_perm_matrix", "l997_expenses", "l997_inventory", "l997_purchases", "l997_suppliers",
    "l997_employees", "l997_attendance", "l997_payroll", "l997_closures", "l997_audit",
    "l997_recurring_expenses", "l997_suspended_orders", "l997_stock_moves", "l997_security", "l997_shifts",
  ];
  document.getElementById("exportBackupBtn").addEventListener("click", () => {
    if (!can("export_data")) { denied(); return; }
    const backup = { exportedAt: new Date().toISOString(), version: 1, data: {} };
    BACKUP_KEYS.forEach((k) => { const v = localStorage.getItem(k); if (v !== null) backup.data[k] = v; });
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = todayStr();
    a.href = url;
    a.download = `997-laundry-backup-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    save("l997_last_backup_at", new Date().toISOString());
    save("l997_last_backup_order_count", orders.length);
    document.getElementById("backupReminderBanner")?.remove();
    logActivity(`تصدير نسخة احتياطية بواسطة ${roleLabel()}`);
    renderProfilePage();
    toast("تم تنزيل النسخة الاحتياطية");
  });
  document.getElementById("importBackupInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!can("restore_backup")) { e.target.value = ""; denied(); return; }
    if (cloudOn()) { e.target.value = ""; toast("لا يمكن استعادة نسخة احتياطية والجهاز مربوط بالسحابة — البيانات محفوظة في السحابة"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || typeof parsed.data !== "object") { toast("ملف النسخة الاحتياطية غير صالح"); return; }
        openQuickForm({
          title: "استعادة نسخة احتياطية", sub: "⚠ سيتم استبدال كل البيانات الحالية بهذا الجهاز بالكامل بمحتوى الملف — لا يمكن التراجع",
          fields: [{ id: "confirm", label: 'اكتب كلمة "تأكيد" للمتابعة', type: "text" }],
          submitLabel: "استعادة الآن",
          onSubmit: (v) => {
            if (v.confirm !== "تأكيد") { toast('يجب كتابة كلمة "تأكيد" بالضبط للمتابعة'); return false; }
            // نتحقق من كل الملف أولاً، ثم نكتب — حتى لا تُستبدل بعض البيانات ويفشل الباقي (بيانات مختلطة)
            let entries;
            try {
              entries = Object.entries(parsed.data).filter(([k, v2]) => BACKUP_KEYS.includes(k) && typeof v2 === "string").map(([k, v2]) => [k, JSON.parse(v2)]);
              if (!entries.length) throw new Error("empty");
            } catch (err2) { toast("ملف النسخة الاحتياطية تالف أو غير مكتمل — لم يتم تغيير أي بيانات"); return false; }
            entries.forEach(([k, val]) => save(k, val));
            try { const au = JSON.parse(localStorage.getItem("l997_audit") || "[]"); au.unshift({ id: uid(), action: `استعادة نسخة احتياطية بواسطة ${roleLabel()}`, value: 0, meta: {}, at: new Date().toISOString(), user: roleLabel(), who: (() => { try { return JSON.parse(localStorage.getItem("l997_user") || "\"\""); } catch (e) { return ""; } })(), cat: "system", sens: 1 }); localStorage.setItem("l997_audit", JSON.stringify(au.slice(0, 4000))); localStorage.removeItem("l997_audit_scrubbed"); } catch (err) { /* غير حرج */ }
            toast("تم استعادة النسخة الاحتياطية — يُعاد تحميل النظام الآن");
            setTimeout(() => window.location.reload(), 1200);
          },
        });
      } catch (err) {
        toast("تعذّرت قراءة ملف النسخة الاحتياطية");
      }
      e.target.value = "";
    };
    reader.readAsText(file);
  });
  document.getElementById("saveProfileBtn").addEventListener("click", () => {
    const p = {
      nameEn: document.getElementById("profileNameEn").value.trim(),
      nameAr: document.getElementById("profileNameAr").value.trim(),
      cr: document.getElementById("profileCr").value.trim(),
      vatId: document.getElementById("profileVat").value.trim(),
      phone: document.getElementById("profilePhone").value.trim(),
      whatsapp: document.getElementById("profileWhatsapp").value.trim(),
      email: document.getElementById("profileEmail").value.trim(),
      region: document.getElementById("profileRegion").value.trim(),
      address: document.getElementById("profileAddress").value.trim(),
      vatPercent: Number(document.getElementById("profileVatPercent").value) || 0,
      retention: document.getElementById("profileRetention").value.trim(),
    };
    saveProfile(p);
    logActivity("تحديث ملف المنشأة");
    toast("تم حفظ بيانات المنشأة");
  });
  document.getElementById("addBranchBtn").addEventListener("click", () => {
    openQuickForm({
      title: "إضافة فرع جديد", sub: "اسم الفرع وساعات العمل",
      fields: [
        { id: "name", label: "اسم الفرع", type: "text" },
        { id: "hours", label: "ساعات العمل", type: "text", value: "08:00 - 22:00" },
      ],
      onSubmit: (v) => {
        if (!v.name) { toast("أدخل اسم الفرع"); return false; }
        const branches = loadBranches();
        branches.push({ name: v.name, status: "نشط", hours: v.hours });
        saveBranches(branches);
        logActivity(`إضافة فرع: ${v.name}`);
        renderProfilePage();
        toast("تم إضافة الفرع");
      },
    });
  });

  /* ========================= المستخدمون والصلاحيات ========================= */
  const ACCESS_ROLE_AR = { owner: "مالك", manager: "مدير", accountant: "محاسب", worker: "عامل" };
  function nextEmployeeNumber() {
    const emps0 = window.L997Enterprise ? window.L997Enterprise.data.employees : [];
    const nums = emps0.map((e) => Number(e.employeeNumber) || 0);
    return String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, "0");
  }
  function todayStr() { return window.L997Finance.todayStr(); } // بتوقيت البحرين مهما كان ضبط الجهاز
  // الحساب صالح حتى نهاية يوم تاريخ الانتهاء
  function isExpired(e) { return !!(e && e.expiryDate && todayStr() > e.expiryDate); }
  function activeOwners() { return window.L997Enterprise.data.employees.filter((e) => e.role === "owner" && e.active !== false && e.passHash && !isExpired(e)); }
  // من يستطيع إدارة هذا الحساب؟ المالك الجميع، وغيره الأدنى رتبةً فقط (منع تصعيد الصلاحيات)
  function canManage(target) {
    if (!me || !target || !can("manage_users")) return false;
    if (target.id === me.id) return true;
    if (role === "owner") return true;
    return RANKS[validRole(target.role)] < RANKS[role];
  }
  function assignableRoles(target) {
    if (target && me && target.id === me.id) return [validRole(target.role)];
    return Object.keys(RANKS).filter((r) => role === "owner" || RANKS[r] < RANKS[role]);
  }
  function showCredentials(emp, pw, titleText) {
    setTimeout(() => openQuickForm({
      title: titleText || "بيانات الدخول المؤقتة", fields: [],
      sub: `اسم الدخول: ${emp.username || emp.email || emp.employeeNumber} — كلمة المرور المؤقتة: ${pw} — سيُطلب من المستخدم تغييرها عند أول دخول. هذه الكلمة لا تظهر مرة أخرى، سلّمها له الآن.`,
      submitLabel: "تم تسليمها", onSubmit: () => {},
    }), 80);
  }

  document.getElementById("accessJump")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-jump]");
    if (b) document.getElementById(b.dataset.jump)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  function renderAccessPage() {
    const body = document.getElementById("accessUsersBody");
    if (!window.L997Enterprise) { body.innerHTML = `<tr><td colspan="8" class="empty-state compact">وحدة الموظفين غير متوفرة</td></tr>`; return; }
    document.getElementById("accessAddUserBtn").style.display = can("manage_users") ? "" : "none";
    const list = window.L997Enterprise.data.employees;
    body.innerHTML = list.length === 0
      ? `<tr><td colspan="8" class="empty-state compact">لا يوجد مستخدمون بعد</td></tr>`
      : list.map((e) => {
        const expired = isExpired(e);
        const locked = lockLeftMs("u:" + e.id) > 0;
        const manage = canManage(e);
        const self = !!(me && e.id === me.id);
        const ovCount = e.permOverrides ? Object.keys(e.permOverrides).length : 0;
        return `<tr>
          <td>${esc(e.employeeNumber) || "—"}</td>
          <td>${esc(e.name)}${self ? ' <span class="status-badge status-ready">أنت</span>' : ""}${hasLoginAccount(e) ? "" : ' <span class="nopw-tag">بدون حساب دخول</span>'}${e.mustChange ? ' <span class="nopw-tag">كلمة مؤقتة</span>' : ""}</td>
          <td dir="ltr" style="text-align:start">${esc(e.username) || "—"}</td>
          <td>${ACCESS_ROLE_AR[e.role] || esc(e.role)}${ovCount ? ` <span class="inv-muted" title="صلاحيات خاصة">✱${ovCount}</span>` : ""}</td>
          <td>${lastLoginCell(e)}</td>
          <td>${e.expiryDate ? `<span style="${expired ? "color:var(--danger);font-weight:800" : ""}">${esc(e.expiryDate)}${expired ? " (منتهي)" : ""}</span>` : "—"}</td>
          <td><span class="status-badge ${e.active === false ? "status-cancelled" : "status-ready"}">${e.active === false ? "معطّل" : "نشط"}</span>${locked ? ' <span class="lock-tag">مقفل</span>' : ""}</td>
          <td class="row-actions">${manage ? `
            <button class="mini-btn" data-uact="edit" data-id="${e.id}">تعديل</button>
            ${!self && e.role !== "owner" && hasLoginAccount(e) ? `<button class="mini-btn" data-uact="perms" data-id="${e.id}">🔑 ${lang === "ar" ? "الصفحات والصلاحيات" : "Pages & permissions"}</button>` : ""}
            ${!self ? `<button class="mini-btn" data-uact="reset" data-id="${e.id}">${e.passHash ? "إعادة تعيين كلمة المرور" : "🔑 إنشاء حساب دخول"}</button>` : ""}
            ${locked ? `<button class="mini-btn" data-uact="unlock" data-id="${e.id}">فك القفل</button>` : ""}
            ${!self ? `<button class="mini-btn" data-uact="toggle" data-id="${e.id}">${e.active === false ? "تفعيل" : "تعطيل"}</button>` : ""}` : ""}
          </td>
        </tr>`;
      }).join("");
    body.onclick = (ev) => {
      const b = ev.target.closest("[data-uact]");
      if (!b) return;
      const emp = window.L997Enterprise.data.employees.find((x) => x.id === b.dataset.id);
      if (emp) userAction(b.dataset.uact, emp);
    };
    renderPermMatrix();
    renderSecurityPanel();
  }

  function userAction(act, e) {
    if (!canManage(e)) { denied(); return; }
    if (act === "edit") return openUserForm(e);
    if (act === "perms") return openPermOverrides(e);
    if (act === "reset") return openPwReset(e);
    if (act === "unlock") {
      attClear("u:" + e.id);
      logActivity(`فك قفل حساب المستخدم: ${e.name} بواسطة ${me.name}`);
      toast("تم فك القفل"); renderAccessPage(); return;
    }
    if (act === "toggle") {
      if (me && e.id === me.id) { toast("لا يمكنك تعطيل حسابك الحالي"); return; }
      const turningOff = e.active !== false;
      if (turningOff && e.role === "owner" && activeOwners().length <= 1 && activeOwners().some((o) => o.id === e.id)) { toast("لا يمكن تعطيل آخر حساب مالك فعّال"); return; }
      e.active = !turningOff;
      persistEmps();
      if (cloudOn() && e.cloudUserId) CLOUD.updateMember(e.cloudUserId, { active: e.active }).then((c) => { if (c.error) toast("تعذّر تحديث الحساب في السحابة: " + cloudErr(c.error)); });
      logActivity(`${e.active ? "تفعيل" : "تعطيل"} المستخدم: ${e.name} بواسطة ${me.name}`);
      renderAccessPage();
    }
  }

  // نموذج واحد للموظف/المستخدم — تستخدمه صفحة «الموظفون» وصفحة «المستخدمون والصلاحيات» معاً
  // الموظف إما «له حساب دخول للنظام» أو «بدون دخول» (للرواتب والحضور فقط)، وفي الحالتين لا يُمنح دور أعلى من دور المُنشئ
  function openUserForm(existing, opts) {
    opts = opts || {};
    if (!can("manage_users")) { denied(); return; }
    const isEdit = !!existing;
    const roles = assignableRoles(existing);
    if (!roles.length) { denied(); return; }
    const tempPw = genTempPassword();
    const hasLogin = isEdit && !!(existing.passHash || existing.username);
    const fields = [
      { id: "name", label: "الاسم الكامل", type: "text", value: existing?.name || "" },
      { id: "role", label: "الدور (يحدد صلاحياته إن كان له حساب دخول)", type: "select", value: existing?.role || (roles.includes("worker") ? "worker" : roles[0]), options: roles.map((r) => ({ value: r, label: ACCESS_ROLE_AR[r] })) },
    ];
    if (!isEdit) fields.push({ id: "login", label: "هل يستخدم النظام؟", type: "select", value: opts.noLogin ? "no" : "yes", options: [
      { value: "yes", label: "نعم — أنشئ له حساب دخول (اسم دخول + كلمة مرور)" },
      { value: "no", label: "لا — موظف للرواتب والحضور فقط (يمكن إنشاء حساب له لاحقاً)" },
    ] });
    if (!isEdit || hasLogin) fields.push({ id: "username", label: `اسم الدخول (username) — إنجليزي${isEdit ? "" : " — مطلوب فقط إن كان يستخدم النظام"}`, type: "text", value: existing?.username || "" });
    if (!isEdit) fields.push({ id: "password", label: "كلمة مرور مؤقتة (يغيّرها المستخدم عند أول دخول)", type: "text", value: tempPw });
    fields.push(
      { id: "email", label: "البريد الإلكتروني (اختياري)", type: "text", value: existing?.email || "" },
      { id: "phone", label: "رقم الهاتف", type: "text", value: existing?.phone || "" },
      { id: "country", label: "الدولة", type: "text", value: existing?.country || "البحرين" },
      { id: "personalId", label: "الرقم الشخصي", type: "text", value: existing?.personalId || "" },
      { id: "birthDate", label: "تاريخ الميلاد", type: "date", value: existing?.birthDate || "" },
      { id: "expiryDate", label: "تاريخ انتهاء الحساب (اختياري)", type: "date", value: existing?.expiryDate || "" },
      { id: "salary", label: "الراتب الأساسي الشهري (د.ب)", type: "number", step: "0.001", value: existing?.salary || 0, min: 0 },
      { id: "commission", label: "العمولة الشهرية الثابتة (د.ب)", type: "number", step: "0.001", value: existing?.commission || 0, min: 0 },
    );
    openQuickForm({
      title: isEdit ? `تعديل موظف — ${existing.name}` : "إضافة موظف جديد",
      sub: isEdit ? `الرقم الوظيفي: ${existing.employeeNumber || "—"}` : "سيُنشأ رقم وظيفي تلقائياً",
      fields,
      submitLabel: isEdit ? "حفظ التعديلات" : "إضافة المستخدم",
      onSubmit: (v) => {
        if (!v.name) { toast("أدخل الاسم"); return false; }
        if (!roles.includes(v.role)) { denied(); return false; }
        if (v.username && !USERNAME_RE.test(v.username)) { toast(AX("e_user_fmt")); return false; }
        const wantsLogin = !isEdit && v.login !== "no";
        if (!isEdit && !wantsLogin) { v.username = ""; v.password = ""; }
        if (wantsLogin && !v.username) { toast("أدخل اسم الدخول، أو اختر «موظف بدون دخول»"); return false; }
        if (v.salary < 0 || v.commission < 0) { toast("الراتب والعمولة لا يمكن أن يكونا سالبين"); return false; }
        if (String(v.phone || "").trim() && !validPhone(v.phone)) { toast(lang === "en" ? "Phone number is not valid — Bahraini 8 digits (e.g. 39100555) or international starting with +" : "رقم الهاتف غير صحيح — بحريني 8 أرقام (مثل 39100555) أو دولي يبدأ بـ +"); return false; }
        if (v.email && !EMAIL_RE.test(v.email)) { toast(AX("e_email_fmt")); return false; }
        const selfId = existing && existing.id;
        if ((v.username && identTaken(v.username, selfId)) || (v.email && identTaken(v.email, selfId))) { toast(AX("e_user_taken")); return false; }
        if (isEdit) {
          if (existing.role === "owner" && v.role !== "owner" && activeOwners().length <= 1) { toast("لا يمكن تغيير دور آخر مالك فعّال"); return false; }
          const oldRole = existing.role;
          const { password: _ignore, login: _l, ...rest } = v;
          if (!hasLogin) delete rest.username;
          Object.assign(existing, rest);
          persistEmps();
          if (cloudOn() && existing.cloudUserId && (oldRole !== v.role)) {
            CLOUD.updateMember(existing.cloudUserId, { role: v.role, display_name: v.name }).then((c) => { if (c.error) toast("تعذّر تحديث الدور في السحابة: " + cloudErr(c.error)); });
          }
          if (oldRole !== v.role) logActivity(`تغيير دور المستخدم ${v.name} من ${ACCESS_ROLE_AR[oldRole]} إلى ${ACCESS_ROLE_AR[v.role]} بواسطة ${me.name}`);
          logActivity(`تعديل بيانات المستخدم: ${v.name}`);
          toast("تم حفظ التعديلات");
          if (me && existing.id === me.id) { me = existing; applyRole(); }
        } else {
          if (wantsLogin) { const prob = pwProblem(v.password, { username: v.username }); if (prob) { toast(prob); return false; } }
          const { password, login: _l, ...rest } = v;
          // مع السحابة: يُنشأ حساب الدخول في السحابة أولاً (يحتاج إنترنت)، ثم الموظف محلياً
          if (wantsLogin && cloudOn()) {
            return cloudStep(() => CLOUD.createStaff(v.username, password, v.role, v.name, null), (c) => {
              const emp = window.L997Enterprise.addEmployee({ ...rest, cloudUserId: c.uid, employeeNumber: nextEmployeeNumber(), createdDate: todayStr() });
              CLOUD.updateMember(c.uid, { employee_id: emp.id });
              setPassword(emp, password, true);
              logActivity(`إضافة مستخدم: ${v.name} (${emp.employeeNumber}) بدور ${ACCESS_ROLE_AR[v.role]} بواسطة ${me.name} — حساب سحابي`);
              toast("تم إضافة الموظف مع حساب دخول (محلي + سحابي)");
              showCredentials(emp, password, "تم إنشاء الحساب");
              renderAccessPage();
              if (typeof window.renderEmployees997 === "function") window.renderEmployees997();
            });
          }
          const emp = window.L997Enterprise.addEmployee({ ...rest, employeeNumber: nextEmployeeNumber(), createdDate: todayStr() });
          if (wantsLogin) {
            setPassword(emp, password, true);
            logActivity(`إضافة مستخدم: ${v.name} (${emp.employeeNumber}) بدور ${ACCESS_ROLE_AR[v.role]} بواسطة ${me.name}`);
            toast("تم إضافة الموظف مع حساب دخول");
            showCredentials(emp, password, "تم إنشاء الحساب");
          } else {
            persistEmps();
            logActivity(`إضافة موظف بدون حساب دخول: ${v.name} (${emp.employeeNumber}) بواسطة ${me.name}`);
            toast("تم إضافة الموظف (بدون حساب دخول)");
          }
        }
        renderAccessPage();
        if (typeof window.renderEmployees997 === "function") window.renderEmployees997();
      },
    });
  }
  document.getElementById("accessAddUserBtn").addEventListener("click", () => openUserForm(null));
  // صفحة الموظفين تستخدم نفس النموذج ونفس قواعد الرتب
  window.L997People = {
    canManageUsers: () => can("manage_users"),
    add: () => openUserForm(null, { noLogin: true }),
    edit: (id) => {
      const e = emps().find((x) => x.id === id); if (!e) return;
      if (canManage(e)) { openUserForm(e); return; }
      if (!can("payroll")) { denied(); return; }
      // صلاحية الرواتب فقط: تعديل الراتب والعمولة بدون تغيير الدور أو الدخول
      openQuickForm({
        title: `الراتب والعمولة — ${e.name}`, sub: "تعديل الدور والدخول من صفحة المستخدمين والصلاحيات (للمخوّلين فقط)",
        fields: [
          { id: "salary", label: "الراتب الأساسي الشهري (د.ب)", type: "number", step: "0.001", value: e.salary || 0, min: 0 },
          { id: "commission", label: "العمولة الشهرية الثابتة (د.ب)", type: "number", step: "0.001", value: e.commission || 0, min: 0 },
        ],
        onSubmit: (v) => {
          if (v.salary < 0 || v.commission < 0) { toast("القيم لا يمكن أن تكون سالبة"); return false; }
          logActivity(`تعديل راتب ${e.name}: ${money(e.salary || 0)} → ${money(v.salary)}، العمولة ${money(e.commission || 0)} → ${money(v.commission)} بواسطة ${me ? me.name : ""}`);
          e.salary = round3(v.salary); e.commission = round3(v.commission);
          persistEmps();
          if (typeof window.renderEmployees997 === "function") window.renderEmployees997();
        },
      });
    },
    canEdit: (id) => { const e = emps().find((x) => x.id === id); return !!e && (canManage(e) || can("payroll")); },
  };

  function openPwReset(e) {
    const tempPw = genTempPassword();
    const fields = [];
    if (!e.username) fields.push({ id: "username", label: "اسم الدخول (username) — إنجليزي", type: "text", value: "" });
    fields.push({ id: "password", label: "كلمة مرور مؤقتة جديدة", type: "text", value: tempPw });
    openQuickForm({
      title: `${e.passHash ? "إعادة تعيين كلمة المرور" : "إنشاء حساب دخول"} — ${e.name}`,
      sub: "ستُطلب من المستخدم تغييرها عند أول دخول، ويُفكّ قفل حسابه إن كان مقفلاً",
      fields, submitLabel: "تعيين",
      onSubmit: (v) => {
        if (!canManage(e)) { denied(); return false; }
        if (!e.username) {
          if (!USERNAME_RE.test(v.username || "")) { toast(AX("e_user_fmt")); return false; }
          if (identTaken(v.username, e.id)) { toast(AX("e_user_taken")); return false; }
        }
        const prob = pwProblem(v.password, { username: e.username || v.username });
        if (prob) { toast(prob); return false; }
        // مع السحابة: كلمة المرور تُغيَّر في السحابة أولاً (وإن لم يكن له حساب سحابي بعد — يُنشأ الآن)
        if (cloudOn()) {
          const uname = e.username || v.username;
          return cloudStep(() => (e.cloudUserId ? CLOUD.resetPassword(e.cloudUserId, v.password) : CLOUD.createStaff(uname, v.password, e.role, e.name, e.id)), (c) => {
            if (c.uid) e.cloudUserId = c.uid;
            if (!e.username) e.username = uname;
            setPassword(e, v.password, true);
            attClear("u:" + e.id);
            logActivity(`إعادة تعيين كلمة مرور المستخدم: ${e.name} بواسطة ${me.name} (سحابي)`);
            toast("تم تعيين كلمة المرور المؤقتة");
            showCredentials(e, v.password);
            renderAccessPage();
          });
        }
        if (!e.username) e.username = v.username;
        setPassword(e, v.password, true);
        attClear("u:" + e.id);
        logActivity(`إعادة تعيين كلمة مرور المستخدم: ${e.name} بواسطة ${me.name}`);
        toast("تم تعيين كلمة المرور المؤقتة");
        showCredentials(e, v.password);
        renderAccessPage();
      },
    });
  }

  function openPermOverrides(e) {
    if (e.role === "owner") { toast("المالك يملك كل الصلاحيات دائماً"); return; }
    const ov = e.permOverrides || {};
    const fields = PERM_DEFS.map((p) => {
      const dflt = permAllows(p.id, validRole(e.role));
      const canGrant = can(p.id); // لا يمنح أحدٌ صلاحية لا يملكها هو نفسه
      const options = [{ value: "", label: `افتراضي الدور (${dflt ? "مسموح" : "ممنوع"})` }];
      if (canGrant) options.push({ value: "allow", label: "السماح" });
      options.push({ value: "deny", label: "المنع" });
      const cur = ov[p.id] === true ? "allow" : ov[p.id] === false ? "deny" : "";
      return { id: "p_" + p.id, label: `${p.grp === "page" ? "📄" : "⚙️"} ${permLabel(p)}`, type: "select", value: options.some((o) => o.value === cur) ? cur : "", options };
    });
    openQuickForm({
      title: `صلاحيات خاصة — ${e.name}`, sub: `الدور: ${ACCESS_ROLE_AR[e.role]} — اختر «افتراضي الدور» ليتبع المصفوفة، أو استثنِ هذا المستخدم بالسماح/المنع`,
      fields, submitLabel: "حفظ الصلاحيات",
      onSubmit: (v) => {
        if (!canManage(e)) { denied(); return false; }
        const next = {};
        PERM_DEFS.forEach((p) => {
          const val = v["p_" + p.id];
          if (val === "allow") { if (!can(p.id)) return; next[p.id] = true; }
          else if (val === "deny") next[p.id] = false;
        });
        if (Object.keys(next).length) e.permOverrides = next; else delete e.permOverrides;
        persistEmps();
        logActivity(`تعديل الصلاحيات الخاصة للمستخدم ${e.name} (${Object.keys(next).length} استثناء) بواسطة ${me.name}`);
        toast("تم حفظ الصلاحيات الخاصة");
        renderAccessPage();
      },
    });
  }

  /* -------------------------- مصفوفة الصلاحيات -------------------------- */
  // grp: page = صفحة في القائمة (تظهر/تختفي) · action = إجراء داخل الصفحات
  const PERM_DEFS = [
    { id: "view_dashboard", grp: "page", label: "الصفحة الرئيسية (لوحة القرار والأرقام)", en: "Home (decision dashboard)", worker: false, accountant: true, manager: true },
    { id: "create_order", grp: "page", label: "طلب جديد (إنشاء الطلبات)", en: "New order (create orders)", worker: true, accountant: false, manager: true },
    { id: "view_orders", grp: "page", label: "الطلبات", en: "Orders", worker: true, accountant: true, manager: true },
    { id: "view_customers", grp: "page", label: "العملاء", en: "Customers", worker: true, accountant: true, manager: true },
    { id: "campaigns", grp: "page", label: "الولاء والحملات (رسائل العملاء، النقاط، الخصومات الخاصة)", en: "Loyalty & campaigns (customer messages, points, special discounts)", worker: false, accountant: true, manager: true },
    { id: "delivery", grp: "page", label: "التوصيل والاستلام من البيوت", en: "Pickup & delivery", worker: true, accountant: true, manager: true },
    { id: "whatsapp_inbox", grp: "page", label: "محادثات واتساب (المساعد الذكي والرد على العملاء)", en: "WhatsApp chats (AI assistant, replying to customers)", worker: true, accountant: false, manager: true },
    { id: "view_balances", grp: "page", label: "الأرصدة وكشوف الحساب", en: "Balances & statements", worker: false, accountant: true, manager: true },
    { id: "view_reports", grp: "page", label: "التقارير والمالية", en: "Reports & finance", worker: false, accountant: true, manager: true },
    { id: "add_expense", grp: "page", label: "المخزون والمشتريات (عرض وإضافة)", en: "Inventory & purchases (view and add)", worker: false, accountant: true, manager: true },
    { id: "payroll", grp: "page", label: "الموظفون والرواتب", en: "Employees & payroll", worker: false, accountant: true, manager: true },
    { id: "view_closures", grp: "page", label: "الإغلاقات (العامل يرى ورديته فقط)", en: "Closures (a worker sees only their own shift)", worker: true, accountant: true, manager: true, rev: 2 },
    { id: "audit_log", grp: "page", label: "سجل النشاط", en: "Activity log", worker: false, accountant: true, manager: true },
    { id: "security_center", grp: "page", label: "مركز الأمان (محاولات الدخول، الجلسات، التنبيهات)", en: "Security center (logins, sessions, alerts)", worker: false, accountant: false, manager: true },
    { id: "admin_settings", grp: "page", label: "ملف المنشأة والإعدادات", en: "Company profile & settings", worker: false, accountant: false, manager: true },
    { id: "manage_users", grp: "page", label: "المستخدمون والصلاحيات (للأدنى رتبةً فقط)", en: "Users & permissions (lower roles only)", worker: false, accountant: false, manager: true },
    { id: "edit_order", grp: "action", label: "تعديل الطلب (تقليل أو حذف قطع، إلغاء الاستعجال) بدون موافقة مشرف — قبل تأكيد الدفع", en: "Edit an order (reduce or remove items, drop urgent) without supervisor approval — before payment", worker: true, accountant: false, manager: true },
    { id: "cancel_order", grp: "action", label: "إلغاء الطلب بدون موافقة مشرف / إرجاعه من التسليم", en: "Cancel an order without supervisor approval / undo a hand-over", worker: false, accountant: false, manager: true },
    { id: "give_discount", grp: "action", label: "منح خصم يدوي على الطلب بدون موافقة مشرف (ضمن الحد الأقصى)", en: "Give a manual discount without approval (within the limit)", worker: true, accountant: true, manager: true, rev: 2 },
    { id: "edit_customer", grp: "action", label: "تعديل بيانات العملاء (الاسم والجوال)", en: "Edit customer details (name, phone)", worker: false, accountant: true, manager: true },
    { id: "balance_tx", grp: "action", label: "استلام دفعة وإيداع رصيد للعميل / بيع باقة", en: "Take a payment, deposit balance / sell a package", worker: true, accountant: true, manager: true },
    { id: "balance_adjust", grp: "action", label: "ردّ نقدي / خصم / تسوية رصيد / عكس حركة", en: "Cash refund / deduct / adjust / reverse", worker: false, accountant: true, manager: true },
    { id: "edit_pricing", grp: "action", label: "تعديل الأسعار والخدمات والباقات والأكواد", en: "Edit prices, services, packages and codes", worker: false, accountant: false, manager: true },
    { id: "approve_closing", grp: "action", label: "اعتماد الإغلاق اليومي/الشهري", en: "Approve daily/monthly closing", worker: false, accountant: false, manager: true },
    { id: "delete_records", grp: "action", label: "حذف/إلغاء مشتريات ومواد وموردين", en: "Delete purchases, materials and suppliers", worker: false, accountant: false, manager: true },
    { id: "export_data", grp: "action", label: "تصدير نسخة احتياطية", en: "Export a backup", worker: false, accountant: true, manager: true },
    { id: "restore_backup", grp: "action", label: "استعادة نسخة احتياطية (يستبدل كل البيانات)", en: "Restore a backup (replaces all data)", worker: false, accountant: false, manager: false },
  ];
  const permLabel = (p) => (lang === "ar" ? p.label : p.en || p.label);
  const DEFAULT_PERM_MATRIX = PERM_DEFS.map((p) => ({ ...p, owner: true }));
  function loadPermMatrix() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem("l997_perm_matrix") || "null"); } catch (e) { saved = null; }
    const byId = {};
    (Array.isArray(saved) ? saved : []).forEach((r) => { if (r && r.id) byId[r.id] = r; });
    // دمج: نحافظ على اختيارات المالك السابقة، ونضيف الصلاحيات الجديدة بقيمها الافتراضية، والمالك دائماً مسموح
    return DEFAULT_PERM_MATRIX.map((d) => {
      const s = byId[d.id];
      // صلاحية عُدّلت قيمتها الافتراضية (rev): تُطبَّق مرة واحدة، ثم يبقى اختيار المالك كما هو
      if (s && d.rev && s.rev !== d.rev) return { ...d, owner: true };
      return s ? { ...d, worker: !!s.worker, accountant: !!s.accountant, manager: !!s.manager, owner: true } : { ...d };
    });
  }
  let permMatrix = loadPermMatrix();
  try { localStorage.setItem("l997_perm_matrix", JSON.stringify(permMatrix)); } catch (e) { /* تجاهل */ }
  function renderPermMatrix() {
    const body = document.getElementById("permMatrixBody");
    const isOwner = role === "owner";
    document.getElementById("resetPermMatrixBtn").style.display = isOwner ? "" : "none";
    const sec = (g) => `<tr class="perm-group"><td colspan="5">${g === "page" ? (lang === "ar" ? "📄 الصفحات — ما يظهر في القائمة لكل دور" : "📄 Pages — what each role sees in the menu") : (lang === "ar" ? "⚙️ الإجراءات — ما يُسمح بفعله داخل الصفحات" : "⚙️ Actions — what each role may do inside the pages")}</td></tr>`;
    const rowsOf = (g) => permMatrix.filter((r) => (r.grp || "action") === g);
    body.innerHTML = ["page", "action"].map((g) => sec(g) + rowsOf(g).map((row) => `
      <tr>
        <td>${esc(permLabel(row))}</td>
        ${["worker", "accountant", "manager"].map((r) => `<td style="text-align:center"><input type="checkbox" data-perm="${row.id}" data-role="${r}" ${row[r] ? "checked" : ""} ${isOwner ? "" : "disabled"} /></td>`).join("")}
        <td style="text-align:center"><input type="checkbox" checked disabled title="المالك يملك كل الصلاحيات دائماً" /></td>
      </tr>`).join("")).join("");
    body.querySelectorAll("[data-perm]").forEach((cb) => {
      cb.addEventListener("change", () => {
        if (role !== "owner") { cb.checked = !cb.checked; denied(); return; }
        const row = permMatrix.find((r) => r.id === cb.dataset.perm);
        if (row) row[cb.dataset.role] = cb.checked;
        save("l997_perm_matrix", permMatrix);
        logActivity(`تعديل صلاحية «${row ? row.label : cb.dataset.perm}» لدور ${ACCESS_ROLE_AR[cb.dataset.role] || cb.dataset.role} → ${cb.checked ? "مفعّلة" : "معطّلة"} بواسطة ${me ? me.name : roleLabel()}`);
        toast("تم حفظ التغيير على مصفوفة الصلاحيات");
        applyRole();
      });
    });
  }
  document.getElementById("resetPermMatrixBtn").addEventListener("click", () => {
    if (role !== "owner") { denied(); return; }
    permMatrix = DEFAULT_PERM_MATRIX.map((r) => ({ ...r }));
    save("l997_perm_matrix", permMatrix);
    logActivity(`استعادة مصفوفة الصلاحيات للإعدادات الافتراضية بواسطة ${me ? me.name : roleLabel()}`);
    renderPermMatrix();
    applyRole();
    toast("تم استعادة المصفوفة الافتراضية");
  });

  /* ------------------------ سياسات الأمان ------------------------ */
  function renderSecurityPanel() {
    const el = document.getElementById("securityPanel");
    if (!el) return;
    const isOwner = role === "owner";
    const dis = isOwner ? "" : "disabled";
    const optsFor = (arr, cur, fmt) => Array.from(new Set([...arr, cur])).sort((a, b) => a - b).map((v) => `<option value="${v}" ${v === cur ? "selected" : ""}>${fmt(v)}</option>`).join("");
    el.innerHTML = `
      <div class="panel-header"><div><h3>سياسات الأمان وتسجيل الدخول</h3><p>تُطبَّق فوراً على كل الحسابات</p></div></div>
      <div class="sec-grid">
        <label>الخروج التلقائي بعد خمول<select id="secIdle" ${dis}>${optsFor([5, 10, 15, 30, 60, 120, 240], sec.idleMin, (v) => v + " دقيقة")}</select></label>
        <label>مهلة التحذير قبل الخروج<select id="secWarn" ${dis}>${optsFor([15, 30, 60, 120], sec.warnSec, (v) => v + " ثانية")}</select></label>
        <label>محاولات خاطئة قبل القفل<select id="secAttempts" ${dis}>${optsFor([3, 5, 8, 10], sec.maxAttempts, (v) => v + " محاولات")}</select></label>
        <label>مدة القفل المؤقت<select id="secLock" ${dis}>${optsFor([5, 10, 30, 60], sec.lockMin, (v) => v + " دقيقة")}</select></label>
        <label>أقل طول لكلمة المرور<select id="secMinLen" ${dis}>${optsFor([6, 8, 10, 12], sec.minLen, (v) => v + " أحرف (مع حرف ورقم)")}</select></label>
        <label>أقصى خصم على الطلب لغير المالك<select id="secMaxDisc" ${dis}>${optsFor([5, 10, 15, 25, 50, 100], sec.maxDiscountPct, (v) => v + "% من قيمة الطلب")}</select></label>
      </div>
      <label class="check-line" style="margin:10px 0"><input type="checkbox" id="secMfaReq" ${sec.mfaRequired ? "checked" : ""} ${dis}> <span>🔐 إلزام التحقق بخطوتين (MFA) لحسابات الإدارة — المالك والمدير (يحتاج الربط بالسحابة)</span></label>
      ${me && isAdminRole(me.role) ? `<div class="wa-api-box" style="border:1px solid var(--border);border-radius:14px;padding:12px 14px;background:var(--panel-soft);margin:6px 0 12px">
        <strong>🔐 التحقق بخطوتين لحسابي (${esc(me.name)})</strong>
        <p class="section-note" style="margin:6px 0 8px">${me.mfaOn ? `مفعّل منذ ${me.mfaAt ? fmtDT(me.mfaAt) : "—"} — يُطلب الرمز عند الدخول من جهاز جديد، والأجهزة التي تختار فيها «تذكّر هذا الجهاز» لا يُطلب فيها لمدة ${MFA_TRUST_DAYS} يوماً.` : "غير مفعّل — بعد التفعيل يُطلب رمز من 6 أرقام من تطبيق Google Authenticator أو Microsoft Authenticator عند كل دخول."}</p>
        ${me.mfaOn ? `<div class="mfa-trust-list"><b>💻 الأجهزة الموثوقة:</b> ${isTrustedDevice(me, null) && !(me.mfaTrust || []).some((x) => x.dev === deviceId() && x.until > Date.now()) ? `<span class="status-badge status-ready">${esc(deviceLabel())} (هذا الجهاز)</span> ` : ""}${(me.mfaTrust || []).filter((x) => x.until > Date.now() && Date.parse(x.at || 0) > (Number(me.mfaTrustResetAt) || 0)).map((x) => `<span class="status-badge status-ready">${esc(x.label || "جهاز")}${x.dev === deviceId() ? " (هذا الجهاز)" : ""} — حتى ${fmtDT(new Date(x.until).toISOString())}</span>`).join(" ")} <button class="mini-btn danger-mini" type="button" id="secMfaForgetBtn">إلغاء الثقة بكل الأجهزة</button></div>` : ""}
        ${cloudOn() ? (me.mfaOn ? `<button class="ghost-btn danger-mini" type="button" id="secMfaOffBtn">إيقاف التحقق بخطوتين</button>` : `<button class="primary-btn" type="button" id="secMfaOnBtn">تفعيل التحقق بخطوتين</button>`) : `<p class="section-note">اربط النظام بالسحابة أولاً (ملف المنشأة ← المزامنة السحابية).</p>`}
      </div>` : ""}
      ${isOwner ? `<button class="primary-btn" id="secSaveBtn">حفظ السياسات</button>` : `<p class="section-note">تعديل السياسات للمالك فقط.</p>`}
      <hr style="border:0;border-top:1px solid var(--border);margin:16px 0">
      <h4 style="margin:0 0 6px">رمز الاسترداد (لنسيان كلمة المرور)</h4>
      <p class="section-note">${sec.recoveryAt ? `أُنشئ بتاريخ ${fmtDT(sec.recoveryAt)} — يُستعمل مرة واحدة ثم يُصدَر رمز جديد.` : "⚠ لم يُنشأ رمز استرداد بعد — أنشئه الآن واحفظه خارج هذا الجهاز."}</p>
      ${isOwner ? `<button class="secondary-btn" id="secNewRecBtn">إنشاء رمز استرداد جديد</button>` : ""}
      <p class="section-note" style="margin-top:14px">ℹ الدخول وكلمات المرور تحمي واجهة النظام من الاستعمال العادي. ولأن النظام يعمل داخل المتصفح بدون خادم، فمن يملك الجهاز نفسه وخبرة تقنية قد يصل للبيانات المخزّنة؛ للحماية الكاملة استخدم قفل الجهاز واستضافة https لاحقاً.</p>`;
    document.getElementById("secMfaOnBtn")?.addEventListener("click", () => {
      if (!me.cloudUserId) { toast("هذا الحساب ليس له حساب في السحابة بعد"); return; }
      pendingUser = me; showAuth("mfaSetup", "", { uid: me.cloudUserId, fromSettings: true });
    });
    document.getElementById("secMfaForgetBtn")?.addEventListener("click", () => confirmAction("إلغاء الثقة بكل الأجهزة؟ سيُطلب الرمز عند الدخول القادم من أي جهاز.", () => { forgetTrustedDevices(me, "يدوياً"); toast("تم — سيُطلب الرمز عند الدخول القادم"); renderAccessPage(); }));
    document.getElementById("secMfaOffBtn")?.addEventListener("click", () => {
      openQuickForm({
        title: "إيقاف التحقق بخطوتين", sub: "للتأكيد اكتب كلمة المرور الحالية والرمز من تطبيق المصادقة.",
        fields: [{ id: "pw", label: "كلمة المرور الحالية", type: "password" }, { id: "code", label: "الرمز (6 أرقام)", type: "text" }], submitLabel: "إيقاف",
        onSubmit: (v) => {
          if (!verifyPw(me, v.pw)) { toast(AX("e_cur")); return false; }
          return cloudStep(async () => {
            const f = await CLOUD.mfaFactors(me.cloudUserId);
            if (f.error) return f;
            for (const x of f.factors) { const ok = await CLOUD.mfaVerify(me.cloudUserId, x.id, v.code); if (ok.error) return { error: "bad-code" }; const del = await CLOUD.mfaRemove(me.cloudUserId, x.id); if (del.error) return del; }
            return { ok: true };
          }, () => {
            me.mfaOn = false; me.mfaAt = ""; me.mfaTrust = []; me.mfaTrustResetAt = Date.now(); persistEmps();
            secLog("mfa_off", `إيقاف التحقق بخطوتين — ${me.name}`, { sev: "warn" });
            toast("تم إيقاف التحقق بخطوتين"); renderAccessPage();
          });
        },
      });
    });
    if (isOwner) {
      document.getElementById("secSaveBtn").addEventListener("click", () => {
        sec.idleMin = Number(document.getElementById("secIdle").value);
        sec.warnSec = Number(document.getElementById("secWarn").value);
        sec.maxAttempts = Number(document.getElementById("secAttempts").value);
        sec.lockMin = Number(document.getElementById("secLock").value);
        sec.minLen = Number(document.getElementById("secMinLen").value);
        sec.maxDiscountPct = Number(document.getElementById("secMaxDisc").value);
        const mfaReq = document.getElementById("secMfaReq").checked;
        if (mfaReq !== !!sec.mfaRequired) secLog("policy", `${mfaReq ? "تفعيل" : "إيقاف"} إلزام التحقق بخطوتين لحسابات الإدارة بواسطة ${me.name}`, { sev: mfaReq ? "info" : "warn" });
        sec.mfaRequired = mfaReq;
        saveSec();
        logActivity(`تعديل سياسات الأمان (خمول ${sec.idleMin} د، ${sec.maxAttempts} محاولات، قفل ${sec.lockMin} د، طول ${sec.minLen}) بواسطة ${me.name}`);
        toast("تم حفظ سياسات الأمان");
      });
      document.getElementById("secNewRecBtn").addEventListener("click", () => {
        openQuickForm({
          title: "رمز استرداد جديد", sub: "سيبطل الرمز القديم فوراً. أدخل كلمة مرورك للتأكيد",
          fields: [{ id: "pw", label: "كلمة المرور الحالية", type: "password" }], submitLabel: "إنشاء",
          onSubmit: (v) => {
            if (!verifyPw(me, v.pw)) { toast(AX("e_cur")); return false; }
            setTimeout(() => issueRecovery("rec_title_new", () => { hideAuth(); renderAccessPage(); }), 80);
          },
        });
      });
    }
  }

  document.querySelectorAll(".nav-item[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => openPage(btn.dataset.page));
  });
  document.querySelectorAll("[data-open-page]").forEach((btn) => {
    btn.addEventListener("click", () => openPage(btn.dataset.openPage));
  });
  document.getElementById("menuBtn")?.addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
  });

  /* ============ المصادقة والجلسات والصلاحيات (تسجيل دخول حقيقي) ============ */
  const RANKS = { worker: 1, accountant: 2, manager: 3, owner: 4 };
  const validRole = (r) => (RANKS[r] ? r : "worker");
  const $a = (id) => document.getElementById(id);
  let me = null; // الحساب المسجَّل دخوله حالياً (null = لا أحد، والنظام مقفل)
  let pendingUser = null; // حساب صحيح كلمة مروره لكنه ينتظر تغيير كلمة المرور المؤقتة

  function emps() { return window.L997Enterprise ? window.L997Enterprise.data.employees : []; }
  // له حساب دخول: كلمة المرور محفوظة على هذا الجهاز، أو له حساب في السحابة، أو دخل من قبل (كلمات المرور لا تُرفع للسحابة —
  // فعلى جهاز المالك لا تظهر كلمة مرور موظف دخل من جهاز آخر)
  function hasLoginAccount(e) { return !!(e && (e.passHash || e.cloudUserId || (e.username && e.lastLogin))); }
  // حقول مؤقتة لعملية الدخول (تبدأ بـ _) لا تُحفظ ولا تُزامن مع السحابة
  function persistEmps() { save("l997_employees", emps().map((e) => { const o = {}; Object.keys(e).forEach((k) => { if (k[0] !== "_") o[k] = e[k]; }); return o; })); }

  /* ---------- تجزئة SHA-256 (بدون اعتماد على مكتبات أو https) ---------- */
  const SHA_K = new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
  const SHA_W = new Uint32Array(64);
  function sha256(msg) {
    const bytes = new TextEncoder().encode(msg);
    const l = bytes.length;
    const nb = ((l + 9 + 63) >> 6) << 6;
    const buf = new Uint8Array(nb);
    buf.set(bytes);
    buf[l] = 0x80;
    const dv = new DataView(buf.buffer);
    dv.setUint32(nb - 4, (l * 8) >>> 0);
    dv.setUint32(nb - 8, Math.floor((l * 8) / 4294967296));
    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a, h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    const w = SHA_W;
    for (let o = 0; o < nb; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
      for (let i = 16; i < 64; i++) {
        const a = w[i - 15], b = w[i - 2];
        const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
        const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (let i = 0; i < 64; i++) {
        const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + SHA_K[i] + w[i]) | 0;
        const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        const mj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + mj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
      h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
    }
    return [h0, h1, h2, h3, h4, h5, h6, h7].map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
  }
  window.sha256Hex997 = sha256; // بصمات سجل التدقيق
  function hashPw(pw, salt) {
    let h = sha256(salt + ":" + pw);
    for (let i = 0; i < 2000; i++) h = sha256(h + salt + pw);
    return h;
  }
  function randBytes(n) {
    const a = new Uint8Array(n);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(a);
    else for (let i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 256);
    return a;
  }
  const randHex = (n) => Array.from(randBytes(n)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const CODE_ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  function randFrom(alpha, n) { return Array.from(randBytes(n)).map((b) => alpha[b % alpha.length]).join(""); }
  function genTempPassword() { return randFrom("abcdefghjkmnpqrstuvwxyz", 4) + randFrom("23456789", 2) + randFrom("ABCDEFGHJKMNPQRSTUVWXYZ", 2); }
  function genRecoveryCode() { const c = randFrom(CODE_ALPHA, 16); return c.match(/.{4}/g).join("-"); }
  const normCode = (s) => String(s || "").replace(/[\s-]/g, "").toUpperCase();
  const toLatinDigits = (s) => String(s || "").replace(/[٠-٩]/g, (d) => d.charCodeAt(0) - 0x660).replace(/[۰-۹]/g, (d) => d.charCodeAt(0) - 0x6f0);

  /* ---------- سياسات الأمان ---------- */
  const SEC_DEFAULT = { idleMin: 30, warnSec: 60, maxAttempts: 5, lockMin: 10, minLen: 6, maxDiscountPct: 25, mfaRequired: false, recoveryHash: "", recoverySalt: "", recoveryAt: "" };
  function loadSec() {
    let s = {};
    try { s = JSON.parse(localStorage.getItem("l997_security") || "{}") || {}; } catch (e) { s = {}; }
    const out = { ...SEC_DEFAULT, ...s };
    ["idleMin", "warnSec", "maxAttempts", "lockMin", "minLen", "maxDiscountPct"].forEach((k) => { out[k] = Number(out[k]) > 0 ? Number(out[k]) : SEC_DEFAULT[k]; });
    return out;
  }
  let sec = loadSec();
  function saveSec() { save("l997_security", sec); }

  /* ---------- نصوص شاشة الدخول (3 لغات) ---------- */
  const AU = {
    ar: {
      brand_sub: "نظام إدارة المغسلة", login_title: "تسجيل الدخول", login_sub: "أدخل بيانات حسابك للمتابعة",
      f_user: "اسم المستخدم أو البريد أو الرقم الوظيفي", f_pass: "كلمة المرور", show: "إظهار", hide: "إخفاء", btn_login: "دخول", forgot: "نسيت كلمة المرور؟",
      e_empty: "أدخل اسم المستخدم وكلمة المرور", e_bad: "اسم المستخدم أو كلمة المرور غير صحيحة", e_bad_left: "المحاولات المتبقية: {0}",
      e_locked: "الحساب مقفل مؤقتاً بسبب محاولات خاطئة متكررة — حاول بعد {0} دقيقة", e_inactive: "هذا الحساب معطّل — راجع المالك",
      e_expired: "انتهت صلاحية هذا الحساب — راجع المالك", e_nocred: "لم تُعيَّن كلمة مرور لهذا الحساب بعد — اطلب من المالك تعيينها",
      n_idle: "تم تسجيل خروجك تلقائياً بسبب عدم النشاط", n_out: "تم تسجيل الخروج بنجاح", n_revoked: "أُنهيت جلستك لأن الحساب تغيّر أو عُطّل",
      n_pwchanged: "تم تغيير كلمة المرور — سجّل الدخول الآن",
      setup_title: "الإعداد الأول — إنشاء حساب المالك", setup_sub: "لا يوجد حساب مالك بعد. أنشئ حساب المالك لحماية النظام؛ بدونه لا يمكن لأحد الدخول.",
      f_name: "الاسم الكامل", f_username: "اسم المستخدم (حروف إنجليزية وأرقام)", f_email: "البريد الإلكتروني (اختياري)", f_newpass: "كلمة المرور", f_newpass2: "تأكيد كلمة المرور",
      btn_setup: "إنشاء الحساب والدخول", restore_link: "لدي نسخة احتياطية — استعادتها",
      pw_rules: "{0} أحرف على الأقل، وتحتوي على حرف ورقم", e_pw_len: "كلمة المرور يجب ألا تقل عن {0} أحرف", e_pw_mix: "كلمة المرور يجب أن تحتوي على حرف ورقم معاً",
      e_pw_user: "كلمة المرور لا يجوز أن تطابق اسم المستخدم", e_pw_match: "كلمتا المرور غير متطابقتين",
      e_user_fmt: "اسم المستخدم من 3 إلى 30 خانة: حروف إنجليزية وأرقام و . _ -", e_user_taken: "اسم المستخدم مستخدم مسبقاً", e_email_fmt: "البريد الإلكتروني غير صحيح", e_name: "أدخل الاسم",
      forgot_title: "استعادة كلمة المرور", forgot_sub: "أدخل اسم المستخدم ورمز الاسترداد الخاص بالمالك ثم اختر كلمة مرور جديدة",
      f_code: "رمز الاسترداد", btn_reset: "تعيين كلمة المرور الجديدة",
      forgot_note: "رمز الاسترداد يظهر مرة واحدة عند إنشاء حساب المالك. إن لم يكن لديك الرمز اطلب من المالك إعادة تعيين كلمة مرورك من صفحة «المستخدمون والصلاحيات». لا يُرسَل أي بريد إلكتروني لأن النظام يعمل بدون خادم.",
      e_code: "رمز الاسترداد أو اسم المستخدم غير صحيح", e_no_recovery: "لم يُنشأ رمز استرداد بعد — راجع المالك أو استعد نسخة احتياطية", back_login: "رجوع لتسجيل الدخول",
      mc_title: "يلزم تغيير كلمة المرور", mc_sub: "كلمة مرورك مؤقتة. اختر كلمة مرور جديدة للمتابعة.", btn_save_continue: "حفظ ومتابعة", e_same_pw: "اختر كلمة مرور مختلفة عن المؤقتة",
      rec_title: "رمز الاسترداد — احفظه الآن", rec_title_new: "رمز استرداد جديد — احفظه الآن",
      rec_sub: "هذا الرمز يظهر مرة واحدة فقط. يمكّنك من استعادة الدخول إذا نسيت كلمة المرور. احفظه في مكان آمن خارج هذا الجهاز (ورقة أو مدير كلمات مرور).",
      btn_copy: "نسخ", btn_download: "تنزيل ملف", copied: "تم النسخ", rec_confirm: "حفظت الرمز في مكان آمن", btn_continue: "متابعة",
      idle_title: "هل ما زلت هنا؟", idle_text: "سيتم تسجيل خروجك تلقائياً بعد {0} ثانية بسبب عدم النشاط", idle_stay: "البقاء متصلاً", idle_out: "تسجيل الخروج",
      btn_logout: "⎋ خروج", btn_changepw: "🔑 كلمة المرور", e_noperm: "ليست لديك صلاحية لهذا الإجراء",
      cp_title: "تغيير كلمة المرور", cp_cur: "كلمة المرور الحالية", cp_new: "كلمة المرور الجديدة", cp_new2: "تأكيد كلمة المرور الجديدة", e_cur: "كلمة المرور الحالية غير صحيحة", ok_changed: "تم تغيير كلمة المرور",
      restore_ok: "تمت الاستعادة — يُعاد تحميل النظام", restore_bad: "ملف النسخة الاحتياطية غير صالح", you: "أنت",
    },
    en: {
      brand_sub: "Laundry Management System", login_title: "Sign in", login_sub: "Enter your account details to continue",
      f_user: "Username, email or employee no.", f_pass: "Password", show: "Show", hide: "Hide", btn_login: "Sign in", forgot: "Forgot password?",
      e_empty: "Enter your username and password", e_bad: "Incorrect username or password", e_bad_left: "Attempts left: {0}",
      e_locked: "Account temporarily locked after repeated failed attempts — try again in {0} min", e_inactive: "This account is disabled — contact the owner",
      e_expired: "This account has expired — contact the owner", e_nocred: "No password has been set for this account yet — ask the owner to set one",
      n_idle: "You were signed out automatically due to inactivity", n_out: "Signed out successfully", n_revoked: "Your session ended because the account changed or was disabled",
      n_pwchanged: "Password changed — sign in now",
      setup_title: "First-time setup — create the owner account", setup_sub: "There is no owner account yet. Create it to protect the system; nobody can sign in without it.",
      f_name: "Full name", f_username: "Username (English letters and digits)", f_email: "Email (optional)", f_newpass: "Password", f_newpass2: "Confirm password",
      btn_setup: "Create account & sign in", restore_link: "I have a backup — restore it",
      pw_rules: "At least {0} characters, with a letter and a digit", e_pw_len: "Password must be at least {0} characters", e_pw_mix: "Password must contain both a letter and a digit",
      e_pw_user: "Password must not equal the username", e_pw_match: "Passwords do not match",
      e_user_fmt: "Username: 3–30 characters, English letters, digits and . _ -", e_user_taken: "That username is already taken", e_email_fmt: "Invalid email address", e_name: "Enter the name",
      forgot_title: "Recover password", forgot_sub: "Enter your username, the owner's recovery code and a new password",
      f_code: "Recovery code", btn_reset: "Set new password",
      forgot_note: "The recovery code is shown once when the owner account is created. If you don't have it, ask the owner to reset your password from the Users & Permissions page. No email is sent because the system runs without a server.",
      e_code: "Recovery code or username is incorrect", e_no_recovery: "No recovery code has been created yet — contact the owner or restore a backup", back_login: "Back to sign in",
      mc_title: "Password change required", mc_sub: "Your password is temporary. Choose a new one to continue.", btn_save_continue: "Save & continue", e_same_pw: "Choose a password different from the temporary one",
      rec_title: "Recovery code — save it now", rec_title_new: "New recovery code — save it now",
      rec_sub: "This code is shown only once. It lets you regain access if you forget your password. Store it somewhere safe outside this device (paper or a password manager).",
      btn_copy: "Copy", btn_download: "Download file", copied: "Copied", rec_confirm: "I saved the code in a safe place", btn_continue: "Continue",
      idle_title: "Are you still there?", idle_text: "You will be signed out automatically in {0} seconds due to inactivity", idle_stay: "Stay signed in", idle_out: "Sign out",
      btn_logout: "⎋ Sign out", btn_changepw: "🔑 Password", e_noperm: "You don't have permission for this action",
      cp_title: "Change password", cp_cur: "Current password", cp_new: "New password", cp_new2: "Confirm new password", e_cur: "Current password is incorrect", ok_changed: "Password changed",
      restore_ok: "Restored — reloading the system", restore_bad: "Invalid backup file", you: "You",
    },
    ur: {
      brand_sub: "لانڈری مینجمنٹ سسٹم", login_title: "لاگ ان", login_sub: "جاری رکھنے کے لیے اپنے اکاؤنٹ کی تفصیلات درج کریں",
      f_user: "صارف نام، ای میل یا ملازم نمبر", f_pass: "پاس ورڈ", show: "دکھائیں", hide: "چھپائیں", btn_login: "لاگ ان", forgot: "پاس ورڈ بھول گئے؟",
      e_empty: "صارف نام اور پاس ورڈ درج کریں", e_bad: "صارف نام یا پاس ورڈ غلط ہے", e_bad_left: "باقی کوششیں: {0}",
      e_locked: "بار بار غلط کوششوں کی وجہ سے اکاؤنٹ عارضی طور پر مقفل ہے — {0} منٹ بعد کوشش کریں", e_inactive: "یہ اکاؤنٹ غیر فعال ہے — مالک سے رابطہ کریں",
      e_expired: "اس اکاؤنٹ کی مدت ختم ہو چکی ہے — مالک سے رابطہ کریں", e_nocred: "اس اکاؤنٹ کا پاس ورڈ ابھی سیٹ نہیں ہے — مالک سے سیٹ کروائیں",
      n_idle: "عدم سرگرمی کی وجہ سے آپ کو خودکار طور پر لاگ آؤٹ کر دیا گیا", n_out: "کامیابی سے لاگ آؤٹ ہو گئے", n_revoked: "آپ کا سیشن ختم کر دیا گیا کیونکہ اکاؤنٹ بدل گیا یا غیر فعال ہو گیا",
      n_pwchanged: "پاس ورڈ تبدیل ہو گیا — اب لاگ ان کریں",
      setup_title: "پہلی ترتیب — مالک کا اکاؤنٹ بنائیں", setup_sub: "ابھی کوئی مالک اکاؤنٹ موجود نہیں۔ سسٹم کی حفاظت کے لیے بنائیں؛ اس کے بغیر کوئی داخل نہیں ہو سکتا۔",
      f_name: "پورا نام", f_username: "صارف نام (انگریزی حروف/ہندسے)", f_email: "ای میل (اختیاری)", f_newpass: "پاس ورڈ", f_newpass2: "پاس ورڈ دوبارہ",
      btn_setup: "اکاؤنٹ بنائیں اور داخل ہوں", restore_link: "میرے پاس بیک اپ ہے — بحال کریں",
      pw_rules: "کم از کم {0} حروف، جن میں حرف اور عدد دونوں ہوں", e_pw_len: "پاس ورڈ کم از کم {0} حروف کا ہونا چاہیے", e_pw_mix: "پاس ورڈ میں حرف اور عدد دونوں ہونے چاہییں",
      e_pw_user: "پاس ورڈ صارف نام جیسا نہیں ہو سکتا", e_pw_match: "دونوں پاس ورڈ مختلف ہیں",
      e_user_fmt: "صارف نام 3 سے 30 حروف: انگریزی حروف، ہندسے اور . _ -", e_user_taken: "یہ صارف نام پہلے سے موجود ہے", e_email_fmt: "ای میل درست نہیں", e_name: "نام درج کریں",
      forgot_title: "پاس ورڈ کی بحالی", forgot_sub: "صارف نام، مالک کا بحالی کوڈ اور نیا پاس ورڈ درج کریں",
      f_code: "بحالی کوڈ", btn_reset: "نیا پاس ورڈ سیٹ کریں",
      forgot_note: "بحالی کوڈ مالک کا اکاؤنٹ بنتے وقت ایک بار دکھایا جاتا ہے۔ اگر آپ کے پاس نہیں ہے تو مالک سے کہیں کہ «صارفین اور اجازتیں» صفحے سے آپ کا پاس ورڈ ری سیٹ کرے۔ کوئی ای میل نہیں بھیجی جاتی کیونکہ سسٹم بغیر سرور کے چلتا ہے۔",
      e_code: "بحالی کوڈ یا صارف نام غلط ہے", e_no_recovery: "ابھی بحالی کوڈ نہیں بنایا گیا — مالک سے رابطہ کریں یا بیک اپ بحال کریں", back_login: "لاگ ان پر واپس",
      mc_title: "پاس ورڈ تبدیل کرنا ضروری ہے", mc_sub: "آپ کا پاس ورڈ عارضی ہے۔ جاری رکھنے کے لیے نیا پاس ورڈ منتخب کریں۔", btn_save_continue: "محفوظ کریں اور جاری رکھیں", e_same_pw: "عارضی پاس ورڈ سے مختلف پاس ورڈ چنیں",
      rec_title: "بحالی کوڈ — ابھی محفوظ کریں", rec_title_new: "نیا بحالی کوڈ — ابھی محفوظ کریں",
      rec_sub: "یہ کوڈ صرف ایک بار دکھایا جاتا ہے۔ پاس ورڈ بھول جانے پر اسی سے رسائی بحال ہوگی۔ اسے اس ڈیوائس کے باہر محفوظ جگہ رکھیں۔",
      btn_copy: "کاپی", btn_download: "فائل ڈاؤنلوڈ", copied: "کاپی ہو گیا", rec_confirm: "میں نے کوڈ محفوظ کر لیا ہے", btn_continue: "جاری رکھیں",
      idle_title: "کیا آپ ابھی موجود ہیں؟", idle_text: "عدم سرگرمی کی وجہ سے {0} سیکنڈ میں خودکار لاگ آؤٹ ہو جائے گا", idle_stay: "منسلک رہیں", idle_out: "لاگ آؤٹ",
      btn_logout: "⎋ خروج", btn_changepw: "🔑 پاس ورڈ", e_noperm: "آپ کو اس کی اجازت نہیں",
      cp_title: "پاس ورڈ تبدیل کریں", cp_cur: "موجودہ پاس ورڈ", cp_new: "نیا پاس ورڈ", cp_new2: "نیا پاس ورڈ دوبارہ", e_cur: "موجودہ پاس ورڈ غلط ہے", ok_changed: "پاس ورڈ تبدیل ہو گیا",
      restore_ok: "بحال ہو گیا — سسٹم دوبارہ لوڈ ہو رہا ہے", restore_bad: "بیک اپ فائل درست نہیں", you: "آپ",
    },
  };
  function AX(key, ...args) {
    let s = (AU[lang] && AU[lang][key]) || AU.ar[key] || key;
    args.forEach((v, i) => { s = s.replace("{" + i + "}", v); });
    return s;
  }

  function pwProblem(pw, emp) {
    if (!pw || pw.length < sec.minLen) return AX("e_pw_len", sec.minLen);
    if (!/[A-Za-z؀-ۿ]/.test(pw) || !/[0-9٠-٩۰-۹]/.test(pw)) return AX("e_pw_mix");
    if (emp && emp.username && pw.toLowerCase() === String(emp.username).toLowerCase()) return AX("e_pw_user");
    return "";
  }
  const USERNAME_RE = /^[A-Za-z0-9._-]{3,30}$/;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  function identTaken(ident, exceptId) {
    const n = toLatinDigits(ident).trim().toLowerCase();
    if (!n) return false;
    return emps().some((e) => e.id !== exceptId && [e.username, e.email].some((v) => v && String(v).toLowerCase() === n));
  }

  /* ---------- الحسابات ---------- */
  function findAccount(ident) {
    const n = toLatinDigits(ident).trim().toLowerCase();
    if (!n) return null;
    const isNum = /^\d+$/.test(n);
    return emps().find((e) => {
      if (e.username && String(e.username).toLowerCase() === n) return true;
      if (e.email && String(e.email).toLowerCase() === n) return true;
      if (e.cloudEmail && String(e.cloudEmail).toLowerCase() === n) return true;
      if (e.employeeNumber) {
        const en = String(e.employeeNumber).toLowerCase();
        if (en === n) return true;
        if (isNum && /^\d+$/.test(en) && Number(en) === Number(n)) return true;
      }
      return false;
    }) || null;
  }
  function verifyPw(e, pw) { return !!(e && e.passHash && e.salt && hashPw(pw, e.salt) === e.passHash); }
  function setPassword(e, pw, mustChange) {
    e.salt = randHex(16);
    e.passHash = hashPw(pw, e.salt);
    delete e.password;
    e.mustChange = !!mustChange;
    e.passChangedAt = new Date().toISOString();
    persistEmps();
  }
  // ترحيل الحسابات القديمة: تحويل كلمات المرور المخزّنة نصاً صريحاً إلى تجزئة مملّحة
  function migrateAccounts() {
    let changed = false;
    // حذف الموظفَين التجريبيَّين اللذين كانت النسخ السابقة تضيفهما تلقائياً — فقط إن لم يُستخدما أبداً
    const list = emps();
    const DEMO = [["مدير المغسلة", "manager", 350], ["عامل 1", "worker", 180]];
    const E0 = window.L997Enterprise ? window.L997Enterprise.data : {};
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      const demo = DEMO.some(([n, r, sal]) => e.name === n && e.role === r && Number(e.salary) === sal);
      const used = e.passHash || e.username || e.email || e.permOverrides
        || orders.some((o) => o.employeeId === e.id)
        || (E0.attendance || []).some((a) => a.employeeId === e.id)
        || (E0.payroll || []).some((p) => p.employeeId === e.id);
      if (demo && !used) { list.splice(i, 1); changed = true; }
    }
    list.forEach((e) => { if (!e.employeeNumber) { e.employeeNumber = nextEmployeeNumber(); changed = true; } });
    emps().forEach((e) => {
      if (typeof e.password === "string") {
        if (e.password.trim()) {
          e.salt = randHex(16);
          e.passHash = hashPw(e.password, e.salt);
          e.passChangedAt = e.passChangedAt || new Date().toISOString();
          if (!e.username && !e.email && !e.employeeNumber) e.employeeNumber = nextEmployeeNumber();
        }
        delete e.password;
        changed = true;
      }
      if (!RANKS[e.role]) { e.role = "worker"; changed = true; }
    });
    if (changed) persistEmps();
    return changed;
  }
  // جهاز مربوط بالسحابة لا يحتاج «إعداد أول» حتى لو لم يدخل المالك عليه (كلمات المرور لا تُنزَّل من السحابة)
  const needsSetup = () => !cloudOn() && !emps().some((e) => e.role === "owner" && e.passHash);

  /* ---------- محاولات الدخول والقفل المؤقت ---------- */
  function attGet() { try { return JSON.parse(localStorage.getItem("l997_attempts") || "{}") || {}; } catch (e) { return {}; } }
  function attSet(o) { try { localStorage.setItem("l997_attempts", JSON.stringify(o)); } catch (e) { /* تجاهل */ } }
  function lockLeftMs(key) { const a = attGet()[key]; return a && a.until && a.until > Date.now() ? a.until - Date.now() : 0; }
  function attFail(key) {
    const o = attGet();
    const a = o[key] || { n: 0, until: 0 };
    if (a.until && a.until <= Date.now()) { a.n = 0; a.until = 0; }
    a.n += 1;
    let locked = false;
    if (a.n >= sec.maxAttempts) { a.until = Date.now() + sec.lockMin * 60000; a.n = 0; locked = true; }
    o[key] = a;
    attSet(o);
    return { left: Math.max(0, sec.maxAttempts - a.n), locked };
  }
  function attClear(key) { const o = attGet(); if (o[key]) { delete o[key]; attSet(o); } }

  /* ---------- الجلسة ---------- */
  // الجلسة تُحفظ في الجهاز أيضاً (لا في ذاكرة التبويب فقط): بعض المتصفحات تمسح ذاكرة التبويب عند تحديث الصفحة
  // فيخرج المستخدم مع كل تحديث تلقائي بعد المزامنة. الخروج بعد الخمول (حد الأمان) يبقى كما هو.
  function sessGet() {
    for (const st of [sessionStorage, localStorage]) { try { const v = JSON.parse(st.getItem("l997_session") || "null"); if (v && v.id) return v; } catch (e) { /* تجاهل */ } }
    return null;
  }
  function sessSet(s) { [sessionStorage, localStorage].forEach((st) => { try { st.setItem("l997_session", JSON.stringify(s)); } catch (e) { /* تجاهل */ } }); }
  function sessClear() { [sessionStorage, localStorage].forEach((st) => { try { st.removeItem("l997_session"); } catch (e) { /* تجاهل */ } }); }

  let lastAct = Date.now();
  let lastPersist = 0;
  let warnShown = false;
  let idleTimer = null;

  function markActive() {
    if (!me || warnShown) return;
    lastAct = Date.now();
    if (lastAct - lastPersist > 3000) persistSession();
  }
  function persistSession() {
    if (!me) return;
    const s = sessGet() || { id: me.id, at: Date.now() };
    s.last = lastAct;
    sessSet(s);
    lastPersist = Date.now();
  }
  ["pointerdown", "mousedown", "mousemove", "keydown", "touchstart", "wheel", "scroll"].forEach((ev) => document.addEventListener(ev, markActive, { passive: true, capture: true }));

  function startIdle() {
    clearInterval(idleTimer);
    idleTimer = setInterval(idleTick, 1000);
  }
  function stopIdle() { clearInterval(idleTimer); idleTimer = null; hideIdleWarn(); }
  function idleLimitMs() { return sec.idleMin * 60000; }
  function idleTick() {
    if (!me) return;
    if (remoteRevoked()) { doLogout("remote"); return; }
    touchSession(false);
    checkSecurityBadge();
    const fresh = emps().find((e) => e.id === me.id);
    if (!fresh || fresh.active === false || isExpired(fresh)) { doLogout("revoked"); return; }
    me = fresh;
    if (validRole(me.role) !== role) { role = validRole(me.role); applyRole(); }
    const limit = idleLimitMs();
    const idle = Date.now() - lastAct;
    if (idle >= limit) { doLogout("idle"); return; }
    const warn = Math.min(sec.warnSec * 1000, limit / 2);
    if (idle >= limit - warn) showIdleWarn(Math.ceil((limit - idle) / 1000), warn);
    else if (warnShown) hideIdleWarn();
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden) idleTick(); });

  function showIdleWarn(secsLeft, warnMs) {
    const dlg = $a("idleWarnDialog");
    $a("idleTitle").textContent = AX("idle_title");
    $a("idleText").textContent = AX("idle_text", secsLeft);
    $a("idleStayBtn").textContent = AX("idle_stay");
    $a("idleOutBtn").textContent = AX("idle_out");
    $a("idleBarFill").style.width = Math.max(0, Math.min(100, (secsLeft * 1000 / warnMs) * 100)) + "%";
    if (!warnShown) { warnShown = true; try { if (!dlg.open) dlg.showModal(); } catch (e) { /* تجاهل */ } }
  }
  function hideIdleWarn() {
    warnShown = false;
    const dlg = $a("idleWarnDialog");
    try { if (dlg && dlg.open) dlg.close(); } catch (e) { /* تجاهل */ }
  }
  $a("idleStayBtn").addEventListener("click", () => { hideIdleWarn(); lastAct = Date.now(); persistSession(); });
  $a("idleOutBtn").addEventListener("click", () => doLogout("out"));
  $a("idleWarnDialog").addEventListener("cancel", (ev) => { ev.preventDefault(); hideIdleWarn(); lastAct = Date.now(); persistSession(); });

  function beginSession(emp) {
    me = emp;
    role = validRole(emp.role);
    pendingUser = null;
    save("l997_user", emp.name);
    lastAct = Date.now();
    startSessionRecord(emp);
    sessSet({ id: emp.id, at: lastAct, last: lastAct, sid: mySessionId || "" });
    lastPersist = lastAct;
    hideAuth();
    applyRole();
    startIdle();
    currentPage = "dashboard";
    renderCurrentPage();
    if (CLOUD) CLOUD.setUser(cloudOn() ? emp : null);
    document.getElementById("sidebar")?.classList.remove("open");
    // المالك الذي لا يملك رمز استرداد (نظام مُرحَّل من نسخة قديمة) يُطلب منه إنشاؤه فوراً
    if (role === "owner" && !sec.recoveryHash) setTimeout(() => issueRecovery("rec_title", () => hideAuth()), 400);
    // الموظف يبدأ ورديته عند الدخول (= تسجيل حضور)
    else if (shiftNeeded() && !openShiftOf(emp.id)) setTimeout(() => openStartShift(), 450);
  }
  function doLogout(reason) {
    if (me) {
      const nm = me.name;
      const why = reason === "idle" ? "idle" : reason === "remote" ? "revoked" : reason === "revoked" ? "disabled" : "logout";
      secLog(why === "logout" ? "logout" : why === "idle" ? "idle_logout" : "session_revoked", reason === "idle" ? `خروج تلقائي لعدم النشاط — ${nm}` : reason === "remote" ? `إنهاء الجلسة من المدير عن بُعد — ${nm}` : reason === "revoked" ? `إنهاء جلسة (تغيّر الحساب أو عُطّل) — ${nm}` : `تسجيل خروج — ${nm}`, { sev: reason === "remote" ? "warn" : "info" });
      endSessionRecord(why);
    }
    stopIdle();
    // إبطال جلسة السحابة على الخادم عند الخروج (بعد رفع آخر التغييرات)
    if (CLOUD) { if (CLOUD.endUser && me && me.cloudUserId) CLOUD.endUser(me.cloudUserId); else CLOUD.setUser(null); }
    document.querySelectorAll("dialog[open]").forEach((d) => { try { d.close(); } catch (e) { /* تجاهل */ } });
    sessClear();
    me = null; pendingUser = null; role = "worker";
    save("l997_user", "");
    applyRole();
    const gs = document.getElementById("globalSearch"); if (gs) gs.value = "";
    showAuth("login", reason === "idle" ? "idle" : reason === "revoked" || reason === "remote" ? "revoked" : "out");
  }

  /* ---------- الصلاحيات ---------- */
  function permAllows(permId, roleId) {
    const row = (typeof permMatrix !== "undefined" ? permMatrix : []).find((r) => r.id === permId);
    return row ? row[roleId] === true : false;
  }
  function can(permId, emp) {
    const e = emp || me;
    if (!e) return false;
    const r = validRole(e.role);
    if (r === "owner") return true; // المالك يملك كل الصلاحيات دائماً ولا يمكن تقييده
    const o = e.permOverrides && e.permOverrides[permId];
    if (o === true || o === false) return o;
    return permAllows(permId, r);
  }
  // الصفحة الأولى لكل مستخدم: الرئيسية لمن يملكها، وإلا شاشة الطلب الجديد (الموظف)
  function homePage() {
    const order = [["dashboard", "view_dashboard"], ["new-order", "create_order"], ["orders", "view_orders"], ["customers", "view_customers"], ["delivery", "delivery"], ["balances", "view_balances"], ["reports", "view_reports"]];
    const hit = order.find(([, perm]) => can(perm));
    return hit ? hit[0] : "orders";
  }
  const goOrders = () => openPage(can("view_orders") ? "orders" : homePage());
  const PAGE_NEED = { whatsapp: "whatsapp_inbox", orders: "view_orders", customers: "view_customers", delivery: "delivery", dashboard: "view_dashboard", balances: "view_balances", "new-order": "create_order", reports: "view_reports", finance: "view_reports", inventory: "add_expense", employees: "payroll", closures: "view_closures", audit: "audit_log", security: "security_center", profile: "admin_settings", settings: "admin_settings", access: "manage_users" };
  function denied() { toast(AX("e_noperm")); }
  window.L997Auth = { can: (p) => can(p), user: () => me, role: () => role };

  function roleLabel() { return t("role_" + role); }
  function refreshUserCard() {
    const nm = me ? me.name : "—";
    $a("userName").textContent = nm;
    $a("userAvatar").textContent = me ? (String(me.name || "?").trim().charAt(0).toUpperCase() || "?") : "?";
    $a("roleChip").textContent = me ? roleLabel() : "—";
    $a("changePwBtn").textContent = AX("btn_changepw");
    $a("logoutBtn").textContent = AX("btn_logout");
    const tl = document.getElementById("topLogoutBtn"); if (tl) tl.textContent = lang === "en" ? "Logout" : lang === "ur" ? "لاگ آؤٹ" : "خروج";
    try { refreshShiftUi(); } catch (e) { /* قبل تهيئة الورديات */ }
  }
  function applyRole() {
    refreshUserCard();
    document.querySelectorAll("[data-need]").forEach((el) => el.classList.toggle("admin-hidden", !can(el.dataset.need)));
    document.querySelectorAll('.nav-item[data-page="new-order"]').forEach((el) => el.classList.toggle("admin-hidden", !can("create_order")));
    const canApproveClosing = can("approve_closing");
    document.getElementById("closeDayBtn")?.classList.toggle("admin-hidden", !canApproveClosing);
    document.getElementById("closeMonthBtn")?.classList.toggle("admin-hidden", !canApproveClosing);
    const canEditPricing = can("edit_pricing");
    document.querySelectorAll("#pricesBody input[data-price]").forEach((el) => (el.disabled = !canEditPricing));
    document.getElementById("savePricesBtn")?.classList.toggle("admin-hidden", !canEditPricing);
    save("l997_role", me ? roleLabel() : "—");
    save("l997_role_id", me ? role : "");
    const hiddenPageBtn = document.querySelector(`.nav-item[data-page="${currentPage}"]`);
    if (me && hiddenPageBtn && hiddenPageBtn.classList.contains("admin-hidden")) openPage(homePage());
  }

  /* ---------- موافقة المشرف (Override): صلاحية حساسة بيد موظف بلا صلاحية تتطلب مدير/مالك حاضراً ---------- */
  function requireOverride(permId, what, onApproved) {
    if (can(permId)) { onApproved(me, false); return; }
    openQuickForm({
      title: "🔐 موافقة مشرف مطلوبة", sub: `${what} — يلزم أن يعتمده مدير أو مالك بإدخال بياناته هنا`,
      fields: [
        { id: "u", label: "اسم مستخدم المشرف", type: "text" },
        { id: "p", label: "كلمة مرور المشرف", type: "password" },
      ],
      submitLabel: "اعتماد",
      onSubmit: (v) => {
        const sup = findAccount(v.u);
        // the name typed is not on this device's list (cloud login name, e-mail, or the list is not synced here yet):
        // check it in the cloud, then match the account by its cloud id
        if (!sup && cloudOn() && String(v.u || "").trim() && v.p) {
          const lk = "ov:" + toLatinDigits(v.u).toLowerCase();
          const left0 = lockLeftMs(lk);
          if (left0 > 0) { toast(AX("e_locked", Math.ceil(left0 / 60000))); return false; }
          const btn = document.getElementById("quickFormSubmitBtn"); btn.disabled = true;
          CLOUD.verifyPassword(toLatinDigits(v.u).trim(), v.p).then((r) => {
            btn.disabled = false;
            if (r && r.error === "offline") { toast(cloudErr("offline")); return; }
            const found = r && r.ok ? emps().find((e) => e.cloudUserId && e.cloudUserId === r.uid) : null;
            if (!found || found.active === false || isExpired(found)) {
              const f = attFail(lk);
              logActivity(`محاولة موافقة مشرف فاشلة — ${what} — بواسطة ${me ? me.name : "؟"}`);
              toast(f.locked ? AX("e_locked", sec.lockMin) : AX("e_bad"));
              return;
            }
            if (me && found.id === me.id) { toast("لا يمكنك اعتماد إجراء بنفسك"); return; }
            if (!can(permId, found)) { toast("هذا المشرف لا يملك صلاحية اعتماد هذا الإجراء"); return; }
            attClear(lk);
            logActivity(`موافقة مشرف: ${found.name} اعتمد «${what}» — طلب بواسطة ${me ? me.name : "؟"} (تحقق سحابي)`);
            quickFormDialog.close();
            setTimeout(() => onApproved(found, true), 60);
          });
          return false;
        }
        const key = "ov:" + (sup ? sup.id : toLatinDigits(v.u).toLowerCase());
        const left = lockLeftMs(key);
        if (left > 0) { toast(AX("e_locked", Math.ceil(left / 60000))); return false; }
        const usable = sup && sup.active !== false && !isExpired(sup);
        // على جهاز موظف لا توجد كلمة مرور المشرف محلياً (لا تُنزَّل من السحابة) — نتحقق منها في السحابة
        if (usable && !verifyPw(sup, v.p) && cloudOn() && sup.username && !v._cloudOk) {
          const btn = document.getElementById("quickFormSubmitBtn"); btn.disabled = true;
          CLOUD.verifyPassword(sup.username, v.p).then((r) => {
            btn.disabled = false;
            if (r.ok && (!sup.cloudUserId || r.uid === sup.cloudUserId)) { v._cloudOk = true; finishOverride(true); }
            else if (r.error === "offline") toast(cloudErr("offline"));
            else if (r.ok) { logActivity(`موافقة مشرف: حساب السحابة لا يطابق «${sup.name}» — ${what}`); toast("⚠ الحساب في السحابة لا يطابق هذا المستخدم على هذا الجهاز — سجّل خروج ودخول مرة على هذا الجهاز ثم أعد المحاولة"); }
            else if (r.error && r.error !== "bad-credentials") toast(`⚠ تعذّر التحقق من السحابة الآن (${r.error}) — انتظر دقيقة وأعد المحاولة`);
            else finishOverride(false);
          });
          return false;
        }
        const ok = usable && (verifyPw(sup, v.p) || v._cloudOk);
        return finishOverride(ok);
        function finishOverride(ok2) {
        if (!ok2) {
          const f = attFail(key);
          logActivity(`محاولة موافقة مشرف فاشلة — ${what} — بواسطة ${me ? me.name : "؟"}`);
          toast(f.locked ? AX("e_locked", sec.lockMin) : AX("e_bad"));
          return false;
        }
        if (me && sup.id === me.id) { toast("لا يمكنك اعتماد إجراء بنفسك"); return false; }
        if (!can(permId, sup)) { toast("هذا المشرف لا يملك صلاحية اعتماد هذا الإجراء"); return false; }
        attClear(key);
        logActivity(`موافقة مشرف: ${sup.name} اعتمد «${what}» — طلب بواسطة ${me ? me.name : "؟"}${v._cloudOk ? " (تحقق سحابي)" : ""}`);
        if (v._cloudOk) quickFormDialog.close(); // اكتمل بعد التحقق السحابي (النموذج كان ينتظر)
        setTimeout(() => onApproved(sup, true), 60);
        }
      },
    });
  }

  /* ---------- شاشات الدخول ---------- */
  let authView = "login";
  let authNotice = "";
  let authCtx = {};
  function showAuth(view, notice, ctx) {
    authView = view; authNotice = notice || ""; authCtx = ctx || {};
    document.body.classList.add("auth-locked");
    $a("authScreen").hidden = false;
    renderAuth();
  }
  function hideAuth() {
    document.body.classList.remove("auth-locked");
    $a("authScreen").hidden = true;
    $a("authCard").innerHTML = "";
  }
  function noticeHtml() {
    if (!authNotice) return "";
    const map = { idle: ["warn", "n_idle"], out: ["ok", "n_out"], revoked: ["warn", "n_revoked"], pwchanged: ["ok", "n_pwchanged"] };
    const m = map[authNotice];
    return m ? `<div class="auth-note ${m[0]}" id="au_notice">${esc(AX(m[1]))}</div>` : "";
  }
  function authHead() {
    return `<div class="auth-top"><div class="auth-brand"><img class="brand-logo" src="${LOGO_997}" alt="997 Laundry"><div><h1><bdi>997 Laundry</bdi></h1><p>${esc(AX("brand_sub"))}</p></div></div>
      <select class="auth-lang" id="au_lang"><option value="ar">العربية</option><option value="en">English</option><option value="ur">اردو</option></select></div>`;
  }
  const pwField = (id, label, auto) => `<label><span>${esc(label)}</span><div class="auth-pw"><input type="password" id="${id}" dir="ltr" autocomplete="${auto}"><button type="button" class="auth-eye" data-eye="${id}">${esc(AX("show"))}</button></div></label>`;
  const txtField = (id, label, auto, extra) => `<label><span>${esc(label)}</span><input type="text" id="${id}" dir="ltr" autocomplete="${auto || "off"}" autocapitalize="off" spellcheck="false" ${extra || ""}></label>`;

  function renderAuth() {
    const card = $a("authCard");
    let html = authHead();
    if (authView === "login") {
      html += `<h2>${esc(AX("login_title"))}</h2><p class="auth-sub">${esc(AX("login_sub"))}</p>${noticeHtml()}
        <form id="au_form" novalidate>${txtField("au_user", AX("f_user"), "username")}${pwField("au_pass", AX("f_pass"), "current-password")}
        <div class="auth-err" id="au_err" role="alert"></div><button type="submit" class="primary-btn full" id="au_go">${esc(AX("btn_login"))}</button></form>
        <div class="auth-links"><button type="button" class="link-btn" id="au_forgot">${esc(AX("forgot"))}</button></div>
        ${CLOUD && !cloudOn() ? `<div class="auth-links"><button type="button" class="link-btn" id="au_cloud_join_replace">☁ ${lang === "en" ? "This device is not linked to the cloud — download the shop's data" : "هذا الجهاز غير مربوط بالسحابة — تنزيل بيانات المحل من السحابة"}</button></div>` : ""}
        ${cloudOn() ? `<p class="auth-hint" style="text-align:center;margin-top:8px">☁ ${lang === "en" ? "This device is linked to the cloud" : "هذا الجهاز مربوط بالسحابة"}</p>` : ""}`;
    } else if (authView === "setup") {
      html += `<h2>${esc(AX("setup_title"))}</h2><p class="auth-sub">${esc(AX("setup_sub"))}</p>
        <form id="au_form" novalidate>${txtField("au_name", AX("f_name"), "name").replace('dir="ltr"', "")}${txtField("au_user", AX("f_username"), "username")}${txtField("au_email", AX("f_email"), "email")}
        ${pwField("au_pw", AX("f_newpass"), "new-password")}${pwField("au_pw2", AX("f_newpass2"), "new-password")}
        <div class="auth-hint" style="margin:-6px 0 8px">${esc(AX("pw_rules", sec.minLen))}</div>
        <div class="auth-err" id="au_err" role="alert"></div><button type="submit" class="primary-btn full">${esc(AX("btn_setup"))}</button></form>
        <div class="auth-links"><button type="button" class="link-btn" id="au_restore">${esc(AX("restore_link"))}</button><input type="file" id="au_restore_file" accept=".json" style="display:none"></div>
        ${CLOUD ? `<div class="auth-links"><button type="button" class="link-btn" id="au_cloud_join">☁ ${lang === "en" ? "I have an account in the cloud — download the shop's data to this device" : "لدي حساب في السحابة — تنزيل بيانات المحل لهذا الجهاز"}</button></div>` : ""}`;
    } else if (authView === "cloudJoin") {
      html += `<h2>☁ ${lang === "en" ? "Sign in from the cloud" : "الدخول من السحابة"}</h2><p class="auth-sub">${lang === "en" ? "Your shop's data will be downloaded to this device. Use the username and password you use in the system." : "ستُنزَّل بيانات المحل كاملة لهذا الجهاز. استخدم اسم الدخول وكلمة المرور التي تستخدمها في النظام."}</p>
        ${authCtx.replace ? `<div class="cloud-warn">⚠ ${lang === "en" ? "This replaces the data currently on this device with the shop's cloud data. A backup file of this device is downloaded first." : "سيتم استبدال البيانات الموجودة على هذا الجهاز ببيانات المحل من السحابة. يُنزَّل أولاً ملف نسخة احتياطية من بيانات هذا الجهاز."}</div>` : ""}
        <form id="au_form" novalidate>${txtField("au_user", lang === "en" ? "Username (not the employee number)" : "اسم الدخول (وليس الرقم الوظيفي)", "username", 'autocorrect="off"')}${pwField("au_pass", AX("f_pass"), "current-password")}
        <div class="auth-hint" style="margin:-6px 0 8px">${lang === "en" ? "On a new device use the username the owner gave you (e.g. Yassen997). The employee number works only on devices that already have the shop's data." : "على جهاز جديد اكتب اسم الدخول الذي أعطاك إياه المالك (مثل Yassen997). الرقم الوظيفي يعمل فقط على الأجهزة التي فيها بيانات المحل."}</div>
        <div class="auth-err" id="au_err" role="alert"></div><button type="submit" class="primary-btn full">☁ ${lang === "en" ? "Sign in and download" : "دخول وتنزيل البيانات"}</button></form>
        <div class="auth-links"><button type="button" class="link-btn" id="au_back">${esc(AX("back_login"))}</button></div>`;
    } else if (authView === "forgot") {
      html += `<h2>${esc(AX("forgot_title"))}</h2><p class="auth-sub">${esc(AX("forgot_sub"))}</p>
        <form id="au_form" novalidate>${txtField("au_user", AX("f_user"), "username")}${txtField("au_code", AX("f_code"), "off", 'style="text-transform:uppercase;letter-spacing:1px"')}
        ${pwField("au_pw", AX("cp_new"), "new-password")}${pwField("au_pw2", AX("cp_new2"), "new-password")}
        <div class="auth-hint" style="margin:-6px 0 8px">${esc(AX("pw_rules", sec.minLen))}</div>
        <div class="auth-err" id="au_err" role="alert"></div><button type="submit" class="primary-btn full">${esc(AX("btn_reset"))}</button></form>
        <p class="auth-hint">${esc(AX("forgot_note"))}</p>
        ${cloudOn() || CLOUD ? `<div class="auth-mail-box" style="border-top:1px solid var(--border);margin-top:14px;padding-top:14px">
          <p class="auth-sub" style="margin:0 0 8px">📧 ${lang === "en" ? "Owner: get a reset link by email" : "المالك: أرسل رابط استرداد إلى بريدي"}</p>
          ${txtField("au_email", lang === "en" ? "Owner's email" : "بريد المالك", "email", 'inputmode="email" dir="ltr"')}
          <button type="button" class="secondary-btn full" id="au_email_send">📧 ${lang === "en" ? "Send link to my email" : "إرسال رابط إلى بريدي"}</button>
          <p class="auth-hint" id="au_email_ok" hidden>✓ ${lang === "en" ? "If this email is registered, a link is on its way. Open it on this device to set a new password." : "إذا كان البريد مسجّلاً ستصلك رسالة خلال دقائق. افتح الرابط على هذا الجهاز لتعيين كلمة مرور جديدة."}</p>
        </div>` : ""}
        <div class="auth-links"><button type="button" class="link-btn" id="au_back">${esc(AX("back_login"))}</button></div>`;
    } else if (authView === "mfa") {
      html += `<h2>🔐 ${lang === "en" ? "Two-step verification" : "التحقق بخطوتين"}</h2><p class="auth-sub">${lang === "en" ? "Open your authenticator app (Google Authenticator / Microsoft Authenticator) and enter the 6-digit code for 997 Laundry." : "افتح تطبيق المصادقة (Google Authenticator أو Microsoft Authenticator) واكتب الرمز المكوّن من 6 أرقام الخاص بـ 997 Laundry."}</p>
        <form id="au_form" novalidate>${txtField("au_code", lang === "en" ? "6-digit code" : "الرمز (6 أرقام)", "one-time-code", 'inputmode="numeric" maxlength="8" style="letter-spacing:4px;font-size:20px;text-align:center"')}
        <label class="check-line auth-trust"><input type="checkbox" id="au_trust" checked /> <span>${lang === "en" ? `Remember this device for ${MFA_TRUST_DAYS} days (don't ask for a code here again)` : `تذكّر هذا الجهاز ${MFA_TRUST_DAYS} يوماً (لا يطلب الرمز مرة أخرى عليه)`}</span></label>
        <div class="auth-err" id="au_err" role="alert"></div><button type="submit" class="primary-btn full">${lang === "en" ? "Verify" : "تحقق"}</button></form>
        <div class="auth-links"><button type="button" class="link-btn" id="au_back">${esc(AX("back_login"))}</button></div>`;
    } else if (authView === "mfaSetup") {
      html += `<h2>🔐 ${lang === "en" ? "Set up two-step verification" : "إعداد التحقق بخطوتين"}</h2><p class="auth-sub">${authCtx.required ? (lang === "en" ? "The owner requires two-step verification for admin accounts. " : "المالك يشترط التحقق بخطوتين لحسابات الإدارة. ") : ""}${lang === "en" ? "1) Install Google Authenticator or Microsoft Authenticator. 2) Scan the code (or type the key). 3) Enter the 6-digit code." : "1) ثبّت تطبيق Google Authenticator أو Microsoft Authenticator. ‏2) امسح الرمز (أو اكتب المفتاح). ‏3) اكتب الرمز المكوّن من 6 أرقام."}</p>
        <div id="au_mfa_qr" style="text-align:center;margin:8px 0 12px"><div class="auth-hint">☁ …</div></div>
        <form id="au_form" novalidate>${txtField("au_code", lang === "en" ? "6-digit code" : "الرمز (6 أرقام)", "one-time-code", 'inputmode="numeric" maxlength="8" style="letter-spacing:4px;font-size:20px;text-align:center"')}
        <div class="auth-err" id="au_err" role="alert"></div><button type="submit" class="primary-btn full">${lang === "en" ? "Turn on and continue" : "تفعيل ومتابعة"}</button></form>
        <div class="auth-links"><button type="button" class="link-btn" id="au_back">${authCtx.fromSettings ? (lang === "en" ? "Cancel" : "إلغاء") : esc(AX("back_login"))}</button></div>`;
    } else if (authView === "emailReset") {
      html += `<h2>${lang === "en" ? "Set a new password" : "تعيين كلمة مرور جديدة"}</h2><p class="auth-sub">${lang === "en" ? "You opened the link from your email. Choose a new password." : "فتحت الرابط من بريدك. اختر كلمة مرور جديدة."}</p>
        <form id="au_form" novalidate>${pwField("au_pw", AX("cp_new"), "new-password")}${pwField("au_pw2", AX("cp_new2"), "new-password")}
        <div class="auth-hint" style="margin:-6px 0 8px">${esc(AX("pw_rules", sec.minLen))}</div>
        <div class="auth-err" id="au_err" role="alert"></div><button type="submit" class="primary-btn full">${esc(AX("btn_save_continue"))}</button></form>
        <div class="auth-links"><button type="button" class="link-btn" id="au_back">${esc(AX("back_login"))}</button></div>`;
    } else if (authView === "mustChange") {
      html += `<h2>${esc(AX("mc_title"))}</h2><p class="auth-sub">${esc(AX("mc_sub"))}</p>
        <form id="au_form" novalidate>${pwField("au_pw", AX("cp_new"), "new-password")}${pwField("au_pw2", AX("cp_new2"), "new-password")}
        <div class="auth-hint" style="margin:-6px 0 8px">${esc(AX("pw_rules", sec.minLen))}</div>
        <div class="auth-err" id="au_err" role="alert"></div><button type="submit" class="primary-btn full">${esc(AX("btn_save_continue"))}</button></form>
        <div class="auth-links"><button type="button" class="link-btn" id="au_back">${esc(AX("back_login"))}</button></div>`;
    } else if (authView === "recovery") {
      html += `<h2>${esc(AX(authCtx.titleKey || "rec_title"))}</h2><p class="auth-sub">${esc(AX("rec_sub"))}</p>
        <div class="auth-code" id="au_code_box">${esc(authCtx.code)}</div>
        <div class="auth-row"><button type="button" class="secondary-btn" id="au_copy">${esc(AX("btn_copy"))}</button><button type="button" class="secondary-btn" id="au_dl">${esc(AX("btn_download"))}</button></div>
        <label class="auth-check"><input type="checkbox" id="au_saved"><span style="margin:0">${esc(AX("rec_confirm"))}</span></label>
        <button type="button" class="primary-btn full" id="au_next" disabled>${esc(AX("btn_continue"))}</button>`;
    }
    card.innerHTML = html;
    if (window.__l997MemStorage) card.insertAdjacentHTML("afterbegin", `<div class="auth-mem-warn" id="authMemWarn">${MEM_STORAGE_WARN}</div>`);
    if (OLD_HOST) card.insertAdjacentHTML("afterbegin", `<div class="auth-mem-warn" style="background:#1f7ea8">${MOVED_NOTE}</div>`);
    const sel = $a("au_lang"); if (sel) sel.value = lang;
    wireAuth();
    const first = card.querySelector("input[type=text], input[type=password]");
    // التركيز على أول حقل — إلا إذا بدأ المستخدم الكتابة في حقل آخر (لا نسحب المؤشر منه)
    if (first && authView !== "recovery") setTimeout(() => { try { if (!card.contains(document.activeElement) || document.activeElement === card) first.focus(); } catch (e) { /* تجاهل */ } }, 30);
  }
  const setErr = (msg) => { const el = $a("au_err"); if (el) el.textContent = msg || ""; };

  function wireAuth() {
    const card = $a("authCard");
    $a("au_lang")?.addEventListener("change", (ev) => { setLanguage(ev.target.value); renderAuth(); });
    card.querySelectorAll("[data-eye]").forEach((b) => b.addEventListener("click", () => {
      const inp = $a(b.dataset.eye); const show = inp.type === "password";
      inp.type = show ? "text" : "password"; b.textContent = AX(show ? "hide" : "show");
    }));
    $a("au_back")?.addEventListener("click", () => showAuth("login"));
    $a("au_forgot")?.addEventListener("click", () => showAuth("forgot"));
    const form = $a("au_form");
    if (authView === "login") form.addEventListener("submit", (ev) => { ev.preventDefault(); submitLogin(); });
    if (authView === "setup") form.addEventListener("submit", (ev) => { ev.preventDefault(); submitSetup(); });
    if (authView === "forgot") form.addEventListener("submit", (ev) => { ev.preventDefault(); submitForgot(); });
    if (authView === "emailReset") form.addEventListener("submit", (ev) => { ev.preventDefault(); submitEmailReset(); });
    if (authView === "mfa") form.addEventListener("submit", (ev) => { ev.preventDefault(); submitMfaCode(); });
    if (authView === "mfaSetup") { form.addEventListener("submit", (ev) => { ev.preventDefault(); submitMfaSetup(); }); startMfaSetup(); }
    if ((authView === "mfa" || authView === "mfaSetup") && !authCtx.fromSettings) $a("au_back")?.addEventListener("click", () => { pendingUser = null; if (CLOUD && CLOUD.signOut) CLOUD.signOut(authCtx.uid); });
    if (authView === "mfaSetup" && authCtx.fromSettings) { const bk = $a("au_back"); if (bk) { const nb = bk.cloneNode(true); bk.replaceWith(nb); nb.addEventListener("click", () => { pendingUser = null; hideAuth(); }); } }
    $a("au_email_send")?.addEventListener("click", sendRecoveryEmail);
    if (authView === "mustChange") form.addEventListener("submit", (ev) => { ev.preventDefault(); submitMustChange(); });
    if (authView === "cloudJoin") form.addEventListener("submit", (ev) => { ev.preventDefault(); submitCloudJoin(); });
    $a("au_cloud_join")?.addEventListener("click", () => showAuth("cloudJoin"));
    $a("au_cloud_join_replace")?.addEventListener("click", () => showAuth("cloudJoin", "", { replace: true }));
    if (authView === "setup") {
      $a("au_restore").addEventListener("click", () => { if (cloudOn()) { setErr("الجهاز مربوط بالسحابة — استخدم «الدخول من السحابة»"); return; } $a("au_restore_file").click(); });
      $a("au_restore_file").addEventListener("change", (ev) => { const f = ev.target.files[0]; if (f) restoreBackupFile(f); });
    }
    if (authView === "recovery") {
      const code = authCtx.code;
      $a("au_saved").addEventListener("change", (ev) => { $a("au_next").disabled = !ev.target.checked; });
      $a("au_copy").addEventListener("click", () => {
        const done = () => { $a("au_copy").textContent = AX("copied"); };
        try { navigator.clipboard.writeText(code).then(done, () => { selectCode(); }); } catch (e) { selectCode(); }
      });
      $a("au_dl").addEventListener("click", () => {
        const blob = new Blob([`997 Laundry — Recovery code / رمز الاسترداد\n\n${code}\n\n${new Date().toISOString()}\n`], { type: "text/plain" });
        const url = URL.createObjectURL(blob); const a = document.createElement("a");
        a.href = url; a.download = "997-recovery-code.txt"; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      });
      $a("au_next").addEventListener("click", () => { const next = authCtx.next; if (next) next(); });
    }
  }
  function selectCode() { try { const r = document.createRange(); r.selectNodeContents($a("au_code_box")); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) { /* تجاهل */ } }

  /* ---------- السحابة (Supabase) — تعمل فقط بعد أن يربط المالك النظام بالسحابة ---------- */
  const CLOUD = window.L997Cloud || null;
  const cloudOn = () => !!(CLOUD && CLOUD.isLinked());
  const CLOUD_ERR = {
    offline: "لا يوجد اتصال بالإنترنت — هذه العملية تحتاج إنترنت",
    "bad-credentials": "اسم الدخول أو كلمة المرور غير صحيحة — تأكد أن الكيبورد إنجليزي واسم الدخول بالشرطة (997-laundry)",
    "email-unconfirmed": "البريد لم يُؤكَّد بعد — افتح بريدك واضغط رابط «Confirm» ثم أعد المحاولة، أو ادخل باسم الدخول",
    "too-many": "محاولات كثيرة — انتظر 5 دقائق ثم أعد المحاولة",
    "username-taken": "اسم الدخول مستخدم مسبقاً في السحابة — اختر اسماً آخر",
    "not-member": "هذا الحساب غير مضاف للمحل في السحابة أو معطّل — راجع المالك",
    "cloud-has-data": "السحابة فيها بيانات مسبقاً — لا يمكن رفع بيانات هذا الجهاز فوقها",
    "shop-exists": "السحابة مرتبطة بمحل/مالك آخر",
    "exists-other-password": "اسم الدخول موجود في السحابة بكلمة مرور مختلفة",
    "not-owner": "هذا الحساب ليس مالك المحل في السحابة",
    "owner-not-named": "اسم دخول المالك غير مسجّل في السحابة بعد — شغّل ملف set_owner في Supabase باسم دخولك ثم أعد المحاولة",
  };
  const cloudErr = (code) => CLOUD_ERR[code] || (/[\u0600-\u06FF]/.test(code) ? code : "تعذّر الاتصال بالسحابة: " + code);
  // يحدّث نسخة كلمة المرور المحفوظة على هذا الجهاز (للدخول بدون إنترنت لاحقاً) بدون تغيير بيانات الحساب
  function cacheLocalPassword(e, pw) {
    if (verifyPw(e, pw)) return;
    e.salt = randHex(16); e.passHash = hashPw(pw, e.salt); delete e.password; persistEmps();
  }
  // تشغيل خطوة سحابية من داخل نموذج مفتوح: يبقى مفتوحاً حتى تنجح، ثم يُغلق ويكمل
  function cloudStep(run, onOk, onErr) {
    const btn = document.getElementById("quickFormSubmitBtn"), label = btn.textContent;
    btn.disabled = true; btn.textContent = "☁ جاري الاتصال بالسحابة…";
    Promise.resolve().then(run).then((r) => {
      btn.disabled = false; btn.textContent = label;
      if (r && r.error) { if (onErr && onErr(r.error)) return; toast(cloudErr(r.error)); return; }
      quickFormDialog.close();
      onOk(r || {});
    }, (err) => { btn.disabled = false; btn.textContent = label; toast(cloudErr(String(err && err.message || err))); });
    return false;
  }
  window.L997CloudHost = {
    // الجهاز «مشغول» = نافذة مفتوحة، شاشة دخول، سلة فيها قطع، أو كتابة في حقل — لا تُطبَّق تحديثات الأجهزة الأخرى الآن
    busy: () => !!document.querySelector("dialog[open]") || !$a("authScreen").hidden || draftItems.length > 0
      || !!(document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) && document.activeElement.id !== "globalSearch"),
    // للتحديث الفوري فقط: شاشة عرض الطلب وملف العميل لا تمنعان التحديث (تُعاد رسمهما) — نوافذ الإدخال تمنعه
    softBusy: () => [...document.querySelectorAll("dialog[open]")].some((d) => d.id !== "orderDialog" && d.id !== "customerProfileDialog") || !$a("authScreen").hidden || draftItems.length > 0
      || !!(document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName) && document.activeElement.id !== "globalSearch"),
    page: () => currentPage,
    // تحديثات الأجهزة الأخرى (طلبات، عملاء، دفعات…) تظهر فوراً بدون إعادة تحميل الصفحة — أسرع بكثير على الجوال
    // يحافظ على مكان المستخدم: موضع التمرير، نص البحث، تبويب الأصناف — لا يرجعه لأعلى الصفحة أو لأول خطوة
    refresh: () => {
      const y = window.scrollY, x = window.scrollX, focusId = document.activeElement && document.activeElement.id;
      customers = load(KEYS.customers, []); orders = load(KEYS.orders, []); ledger = load(KEYS.ledger, []);
      customerPackages = load(KEYS.customerPackages, []); suspendedOrders = load("l997_suspended_orders", []); shifts = load(SHIFT_KEY, []);
      if (window.L997Enterprise.reloadData) window.L997Enterprise.reloadData();
      if (reconcileDerived()) persistAll();
      if (me) { const fresh = emps().find((e) => e.id === me.id); if (fresh) me = fresh; }
      if (currentPage === "new-order") {
        // شاشة الطلب الجديد: لا يُعاد ضبط البحث والتبويب — فقط تحديث بيانات العميل المختار والملخص
        if (draftCustomerId) { const cust = customers.find((c) => c.id === draftCustomerId); if (cust) selectCustomerForOrder(cust, true); }
        renderOrderItemsTable(); updateSummary();
      } else openPage(currentPage);
      window.scrollTo(x, y);
      if (focusId && document.activeElement && document.activeElement.id !== focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
      if (orderDialog.open) renderOrderDialog();
      if (customerProfileDialog.open) renderCustomerProfile();
    },
    openCloudPanel: () => { if (role === "owner") { openPage("profile"); setTimeout(() => document.getElementById("cloudPanel")?.scrollIntoView({ block: "start" }), 50); } },
  };

  /* ---------- تسجيل الدخول ---------- */
  function attemptLogin(ident, pw) {
    const raw = String(ident || "").trim();
    if (!raw || !pw) return { err: AX("e_empty") };
    const emp = findAccount(raw);
    const key = emp ? "u:" + emp.id : "x:" + toLatinDigits(raw).toLowerCase();
    const left = lockLeftMs(key);
    if (left > 0) return { err: AX("e_locked", Math.ceil(left / 60000)) };
    if (emp && !emp.passHash) return { err: AX("e_nocred") };
    if (!verifyPw(emp, pw)) {
      const f = attFail(key);
      save("l997_user", ""); save("l997_role", "—");
      secLog(f.locked ? "lockout" : "login_fail", emp ? `محاولة دخول فاشلة — حساب: ${emp.name}${f.locked ? " (تم قفل الحساب مؤقتاً)" : ""}` : `محاولة دخول فاشلة — اسم مستخدم غير معروف: «${String(raw).slice(0, 40)}»`, { u: emp ? emp.username : String(raw).slice(0, 40), sev: f.locked ? "risk" : "warn" });
      if (!f.locked) checkFailedBurst(emp ? emp.username : String(raw).slice(0, 40)); else secLog("alert", `🔒 قفل حساب «${emp ? emp.name : raw}» مؤقتاً بعد ${sec.maxAttempts} محاولات فاشلة — ${deviceLabel()}`, { u: emp ? emp.username : "", sev: "risk", target: "lock:" + (emp ? emp.id : raw) });
      return { err: f.locked ? AX("e_locked", sec.lockMin) : AX("e_bad") + (f.left > 0 && f.left < sec.maxAttempts ? " — " + AX("e_bad_left", f.left) : "") };
    }
    // كلمة المرور صحيحة — فحص حالة الحساب
    if (emp.active === false) { secLog("login_fail", `محاولة دخول لحساب معطّل — ${emp.name}`, { u: emp.username, sev: "warn" }); return { err: AX("e_inactive") }; }
    if (isExpired(emp)) { logActivity(`محاولة دخول لحساب منتهي الصلاحية — ${emp.name}`); return { err: AX("e_expired") }; }
    attClear(key);
    return { emp };
  }
  function finishLogin(emp) {
    // with the cloud, a worker cannot write the staff list (it would be refused) — the session log records the login instead
    if (!(cloudOn() && validRole(emp.role) === "worker")) { emp.lastLogin = new Date().toISOString(); persistEmps(); }
    role = validRole(emp.role);
    save("l997_user", emp.name);
    save("l997_role", t("role_" + role));
    checkNewAdminDevice(emp);
    secLog("login_ok", `تسجيل دخول — ${emp.name} (${ACCESS_ROLE_AR[role]})${emp._mfaPassed ? " — بالتحقق بخطوتين" : emp._mfaTrusted ? " — جهاز موثوق (بدون رمز)" : ""} — ${deviceLabel()}`, { u: emp.username });
    beginSession(emp);
    delete emp._mfaPassed; delete emp._mfaTrusted;
    setTimeout(() => { try { monthReportNudge(); } catch (e) { /* ignore */ } }, 2500);
  }
  function submitLogin() {
    if (cloudOn()) { submitLoginCloud(); return; }
    const r = attemptLogin($a("au_user").value, $a("au_pass").value);
    if (r.err) { setErr(r.err); $a("au_pass").value = ""; $a("au_pass").focus(); return; }
    if (r.emp.mustChange) { pendingUser = r.emp; showAuth("mustChange"); return; }
    finishLogin(r.emp);
  }
  // مع السحابة: كلمة المرور في السحابة هي المرجع (قد تكون تغيّرت من جهاز آخر). بدون إنترنت → الدخول المحلي كما هو
  async function submitLoginCloud() {
    const ident = $a("au_user").value, pw = $a("au_pass").value;
    const emp = findAccount(ident);
    let cloudRes = null;
    // الحساب غير موجود في قائمة هذا الجهاز (بريد الدخول، اسم تغيّر، أو بيانات الجهاز قديمة): نتحقق من السحابة مباشرة،
    // وعند النجاح نُنزّل بيانات المحل من جديد (نفس «ربط جهاز») — بدل «اسم أو كلمة مرور غير صحيحة» من بيانات قديمة
    if (!emp && String(ident).trim() && pw && !lockLeftMs("u:" + toLatinDigits(ident).trim().toLowerCase())) {
      const btn = $a("au_form").querySelector("button[type=submit]");
      btn.disabled = true; setErr(lang === "en" ? "☁ Checking with the cloud…" : "☁ جاري التحقق من السحابة…");
      // تغييرات على هذا الجهاز لم تُرفع بعد؟ تُحفظ في ملف قبل تنزيل نسخة السحابة
      try { if (CLOUD.status && (CLOUD.status().pending || 0) > 0) downloadLocalBackup("before-relink"); } catch (e) { /* تجاهل */ }
      const j = await CLOUD.joinDevice(String(ident).trim(), pw);
      btn.disabled = false;
      if (!j.error) {
        const list = JSON.parse(localStorage.getItem("l997_employees") || "[]");
        const e2 = list.find((x) => x.cloudUserId === j.uid) || list.find((x) => String(x.username || "").toLowerCase() === String(ident).trim().toLowerCase());
        if (e2) { e2.cloudUserId = j.uid; e2.salt = randHex(16); e2.passHash = hashPw(pw, e2.salt); localStorage.setItem("l997_employees", JSON.stringify(list)); }
        try { localStorage.setItem("l997_cloud_joined_notice", "1"); } catch (e) { /* تجاهل */ }
        window.location.reload();
        return;
      }
      if (j.error !== "bad-credentials") { setErr(cloudErr(j.error)); return; }
    }
    if (emp && emp.username && pw && emp.active !== false && lockLeftMs("u:" + emp.id) <= 0) {
      const btn = $a("au_form").querySelector("button[type=submit]");
      btn.disabled = true; setErr("☁ …");
      const c = await CLOUD.signIn(emp.username, pw);
      btn.disabled = false; setErr("");
      cloudRes = c;
      if (!c.error) {
        if (!emp.cloudUserId) { emp.cloudUserId = c.uid; persistEmps(); }
        cacheLocalPassword(emp, pw);
      } else if (c.error === "bad-credentials") {
        const r0 = attemptLogin(ident, "\u0000" + pw); // تُحسب محاولة فاشلة (والقفل بعد 5)
        // دخلت باسم الدخول؟ إذا أضاف صاحب الحساب بريد استرداد صار هو بريد الدخول في السحابة — جهاز لم يتزامن بعد لا يعرفه
        const tip = !String(ident).includes("@") && isAdminRole(emp.role) ? (lang === "en" ? " — if you added a recovery e-mail, sign in with that e-mail instead" : " — إذا أضفت بريداً لاسترداد كلمة المرور، ادخل بالبريد بدل اسم الدخول") : "";
        setErr((r0.err || AX("e_bad")) + tip); $a("au_pass").value = ""; $a("au_pass").focus();
        return;
      }
    }
    const r = attemptLogin(ident, pw);
    // السحابة لم ترد (شبكة محجوبة/لا إنترنت) وكلمة المرور المحفوظة على الجهاز قديمة: قل السبب الحقيقي
    if (r.err && cloudRes && cloudRes.error && cloudRes.error !== "bad-credentials") { setErr(`${r.err} — ${cloudErr(cloudRes.error)}`); $a("au_pass").value = ""; $a("au_pass").focus(); return; }
    if (r.err) { setErr(r.err); $a("au_pass").value = ""; $a("au_pass").focus(); return; }
    // التحقق بخطوتين لحسابات الإدارة
    const admin = isAdminRole(r.emp.role), signed = cloudRes && !cloudRes.error;
    if (signed && cloudRes.factors && cloudRes.factors.length) {
      if (isTrustedDevice(r.emp, cloudRes.factors[0].id)) { r.emp._mfaTrusted = true; afterPasswordOk(r.emp); return; }
      pendingUser = r.emp; showAuth("mfa", "", { uid: cloudRes.uid, factor: cloudRes.factors[0].id, tries: 0 }); return;
    }
    if (!signed && admin && r.emp.mfaOn && !isTrustedDevice(r.emp, null)) {
      secLog("login_fail", `دخول حساب إداري بدون التحقق بخطوتين (لا يوجد اتصال) — رُفض — ${r.emp.name}`, { u: r.emp.username, sev: "warn" });
      setErr(lang === "en" ? "This admin account uses two-step verification — an internet connection is needed to sign in" : "حساب الإدارة محمي بالتحقق بخطوتين — الدخول يحتاج اتصال إنترنت"); return;
    }
    if (signed && admin && sec.mfaRequired && !r.emp.mfaOn) { pendingUser = r.emp; showAuth("mfaSetup", "", { uid: cloudRes.uid, required: true }); return; }
    afterPasswordOk(r.emp);
  }
  const isAdminRole = (r0) => ["owner", "manager"].includes(validRole(r0));
  /* «تذكّر هذا الجهاز»: بعد رمز صحيح، لا يُطلب الرمز على نفس الجهاز لمدة 30 يوماً.
     الثقة تُحفظ على الجهاز نفسه (لا تعتمد على قائمة مشتركة كانت تُمسح عند تعارض المزامنة بين جهازين).
     الإلغاء عن بُعد: «إلغاء الثقة بكل الأجهزة» يسجّل تاريخاً في حساب الموظف (mfaTrustResetAt) — أي ثقة أقدم منه تسقط.
     وتسقط أيضاً عند إيقاف/إعادة إعداد التحقق بخطوتين (تغيّر معرّف عامل المصادقة) أو انتهاء المدة.
     قائمة mfaTrust في الحساب للعرض فقط (أي الأجهزة موثوقة). */
  const MFA_TRUST_DAYS = 30, MFA_TRUST_KEY = "l997_mfa_trust";
  function mfaTrustLocal() { try { return JSON.parse(localStorage.getItem(MFA_TRUST_KEY) || "{}") || {}; } catch (e) { return {}; } }
  function isTrustedDevice(emp, factorId) {
    const loc = mfaTrustLocal()[emp.id], now = Date.now();
    if (!loc || !(loc.until > now) || (factorId && loc.factor && loc.factor !== factorId)) return false;
    const made = Number(loc.at) || (Number(loc.until) - MFA_TRUST_DAYS * 864e5);
    return made > (Number(emp.mfaTrustResetAt) || 0);
  }
  function trustThisDevice(emp, factorId) {
    const tok = uid(), until = Date.now() + MFA_TRUST_DAYS * 864e5;
    const all = mfaTrustLocal(); all[emp.id] = { tok, until, factor: factorId || "", at: Date.now() };
    try { localStorage.setItem(MFA_TRUST_KEY, JSON.stringify(all)); } catch (e) { return; }
    emp.mfaTrust = (emp.mfaTrust || []).filter((x) => x.dev !== deviceId() && x.until > Date.now()).concat([{ dev: deviceId(), label: deviceLabel(), tok, until, at: new Date().toISOString() }]);
    persistEmps();
    secLog("mfa_trust", `تذكّر الجهاز ${MFA_TRUST_DAYS} يوماً للتحقق بخطوتين — ${emp.name} — ${deviceLabel()}`, { u: emp.username });
  }
  function forgetTrustedDevices(emp, why) {
    const n = (emp.mfaTrust || []).length;
    emp.mfaTrust = []; emp.mfaTrustResetAt = Date.now(); persistEmps();
    try { const all = mfaTrustLocal(); delete all[emp.id]; localStorage.setItem(MFA_TRUST_KEY, JSON.stringify(all)); } catch (e) { /* ignore */ }
    secLog("mfa_trust", `إلغاء الأجهزة الموثوقة (${n}) — ${emp.name}${why ? " — " + why : ""}`, { u: emp.username, sev: "warn" });
    return n;
  }
  function afterPasswordOk(emp) {
    if (emp.mustChange) { pendingUser = emp; showAuth("mustChange"); return; }
    finishLogin(emp);
  }
  async function submitMfaCode() {
    const e = pendingUser; if (!e) { showAuth("login"); return; }
    const code = toLatinDigits($a("au_code").value).replace(/\D/g, "");
    if (code.length !== 6) return setErr(lang === "en" ? "Enter the 6-digit code from your authenticator app" : "اكتب الرمز المكوّن من 6 أرقام من تطبيق المصادقة");
    const btn = $a("au_form").querySelector("button[type=submit]"); btn.disabled = true; setErr("☁ …");
    const v = await CLOUD.mfaVerify(authCtx.uid, authCtx.factor, code);
    btn.disabled = false;
    if (v.error) {
      authCtx.tries = (authCtx.tries || 0) + 1;
      secLog("mfa_fail", `رمز تحقق بخطوتين خاطئ — ${e.name} (محاولة ${authCtx.tries})`, { u: e.username, sev: "warn" });
      if (authCtx.tries >= 3) secLog("alert", `🚨 رموز تحقق بخطوتين خاطئة متكررة لحساب «${e.name}» — ${deviceLabel()}`, { u: e.username, sev: "risk", target: "mfa:" + e.id });
      if (authCtx.tries >= 5) { pendingUser = null; if (CLOUD.signOut) CLOUD.signOut(authCtx.uid); showAuth("login"); setErr(lang === "en" ? "Too many wrong codes — sign in again" : "رموز خاطئة كثيرة — سجّل الدخول من جديد"); return; }
      $a("au_code").value = ""; return setErr(v.error === "bad-code" ? (lang === "en" ? "Wrong or expired code" : "الرمز غير صحيح أو انتهت صلاحيته") : cloudErr(v.error));
    }
    e._mfaPassed = true;
    if ($a("au_trust") ? $a("au_trust").checked : false) trustThisDevice(e, authCtx.factor);
    afterPasswordOk(e);
  }
  // إعداد التحقق بخطوتين (إلزامي عند الدخول إن فعّله المالك، أو اختياري من «سياسات الأمان»)
  async function startMfaSetup() {
    const box = $a("au_mfa_qr"); if (!box) return;
    const r = await CLOUD.mfaEnroll(authCtx.uid, pendingUser ? pendingUser.name : "997 Laundry");
    if (r.error) { box.innerHTML = `<div class="auth-err">${esc(cloudErr(r.error))}</div>`; return; }
    authCtx.factor = r.id;
    box.innerHTML = `${r.qr ? `<img alt="QR" src="${esc(r.qr)}" style="width:180px;height:180px;background:#fff;border-radius:12px;padding:6px;border:1px solid var(--border)">` : ""}
      <div class="auth-hint" style="margin-top:6px">${lang === "en" ? "Or enter this key in the app:" : "أو اكتب هذا المفتاح في التطبيق:"}</div>
      <div class="auth-code" id="au_mfa_secret" style="font-size:14px;letter-spacing:1px;word-break:break-all">${esc((r.secret || "").replace(/(.{4})/g, "$1 ").trim())}</div>`;
  }
  async function submitMfaSetup() {
    const e = pendingUser; if (!e || !authCtx.factor) return;
    const code = toLatinDigits($a("au_code").value).replace(/\D/g, "");
    if (code.length !== 6) return setErr(lang === "en" ? "Enter the 6-digit code shown in the app" : "اكتب الرمز المكوّن من 6 أرقام الظاهر في التطبيق");
    const btn = $a("au_form").querySelector("button[type=submit]"); btn.disabled = true; setErr("☁ …");
    const v = await CLOUD.mfaVerify(authCtx.uid, authCtx.factor, code);
    btn.disabled = false;
    if (v.error) return setErr(v.error === "bad-code" ? (lang === "en" ? "Wrong code — check the time on the phone and try the new code" : "الرمز غير صحيح — تأكد من وقت الجوال وجرّب الرمز الجديد") : cloudErr(v.error));
    e.mfaOn = true; e.mfaAt = new Date().toISOString(); e.mfaTrust = []; e.mfaTrustResetAt = Date.now(); persistEmps();
    secLog("mfa_on", `تفعيل التحقق بخطوتين — ${e.name}`, { u: e.username, sev: "info" });
    e._mfaPassed = true;
    if (authCtx.fromSettings) { pendingUser = null; hideAuth(); toast("✓ تم تفعيل التحقق بخطوتين"); renderAccessPage(); return; }
    afterPasswordOk(e);
  }
  let cloudPwChangedFor = null;
  function submitMustChange() {
    const e = pendingUser; if (!e) { showAuth("login"); return; }
    const p1 = $a("au_pw").value, p2 = $a("au_pw2").value;
    const prob = pwProblem(p1, e);
    if (prob) return setErr(prob);
    if (p1 !== p2) return setErr(AX("e_pw_match"));
    if (verifyPw(e, p1)) return setErr(AX("e_same_pw"));
    if (cloudOn() && e.cloudUserId && cloudPwChangedFor !== e.id) {
      const btn = $a("au_form").querySelector("button[type=submit]"); btn.disabled = true; setErr("☁ …");
      CLOUD.changeOwnPassword(p1, e.cloudUserId).then((c) => {
        btn.disabled = false;
        if (c.error) { setErr(cloudErr(c.error)); return; }
        cloudPwChangedFor = e.id; submitMustChange(); cloudPwChangedFor = null;
      });
      return;
    }
    setPassword(e, p1, false);
    save("l997_user", e.name);
    logActivity(`تغيير كلمة المرور (إلزامي بعد كلمة مؤقتة) — ${e.name}`);
    finishLogin(e);
  }
  function submitSetup() {
    const name = $a("au_name").value.trim(), username = $a("au_user").value.trim(), email = $a("au_email").value.trim();
    const p1 = $a("au_pw").value, p2 = $a("au_pw2").value;
    if (!name) return setErr(AX("e_name"));
    if (!USERNAME_RE.test(username)) return setErr(AX("e_user_fmt"));
    if (email && !EMAIL_RE.test(email)) return setErr(AX("e_email_fmt"));
    const existing = emps().find((e) => e.role === "owner" && !e.passHash);
    if (identTaken(username, existing && existing.id) || (email && identTaken(email, existing && existing.id))) return setErr(AX("e_user_taken"));
    const prob = pwProblem(p1, { username });
    if (prob) return setErr(prob);
    if (p1 !== p2) return setErr(AX("e_pw_match"));
    let owner = existing;
    if (!owner) owner = window.L997Enterprise.addEmployee({ name, role: "owner", salary: 0, commission: 0 });
    Object.assign(owner, { name, role: "owner", username, email, active: true, employeeNumber: owner.employeeNumber || nextEmployeeNumber(), createdDate: owner.createdDate || todayStr() });
    setPassword(owner, p1, false);
    owner.lastLogin = new Date().toISOString();
    persistEmps();
    role = "owner";
    save("l997_user", name);
    logActivity(`الإعداد الأول: إنشاء حساب المالك — ${name}`);
    issueRecovery("rec_title", () => beginSession(owner));
  }
  function issueRecovery(titleKey, next) {
    const code = genRecoveryCode();
    sec.recoverySalt = randHex(16);
    sec.recoveryHash = hashPw(normCode(code), sec.recoverySalt);
    sec.recoveryAt = new Date().toISOString();
    saveSec();
    logActivity("إنشاء رمز استرداد جديد لكلمة المرور");
    showAuth("recovery", "", { code, titleKey, next });
  }
  function submitForgot() {
    const ident = $a("au_user").value, code = normCode($a("au_code").value);
    const p1 = $a("au_pw").value, p2 = $a("au_pw2").value;
    if (!ident.trim() || !code) return setErr(AX("e_code"));
    if (!sec.recoveryHash) return setErr(AX("e_no_recovery"));
    const left = lockLeftMs("rec");
    if (left > 0) return setErr(AX("e_locked", Math.ceil(left / 60000)));
    const emp = findAccount(ident);
    const ok = emp && hashPw(code, sec.recoverySalt) === sec.recoveryHash;
    if (!ok) {
      const f = attFail("rec");
      save("l997_user", ""); save("l997_role", "—");
      logActivity("محاولة استعادة كلمة مرور فاشلة (رمز أو حساب غير صحيح)");
      return setErr(f.locked ? AX("e_locked", sec.lockMin) : AX("e_code"));
    }
    const prob = pwProblem(p1, emp);
    if (prob) return setErr(prob);
    if (p1 !== p2) return setErr(AX("e_pw_match"));
    attClear("rec"); attClear("u:" + emp.id);
    setPassword(emp, p1, false);
    save("l997_user", emp.name); save("l997_role", "—");
    logActivity(`استعادة كلمة المرور برمز الاسترداد — ${emp.name}`);
    // الرمز للاستعمال مرة واحدة: يُصدَر رمز جديد فوراً
    issueRecovery("rec_title_new", () => showAuth("login", "pwchanged"));
  }

  /* ---------- استعادة نسخة احتياطية من شاشة الإعداد الأول ---------- */
  // ملف نسخة احتياطية بكل بيانات هذا الجهاز (بدون الحاجة لتسجيل الدخول)
  function downloadLocalBackup(tag) {
    try {
      const backup = { exportedAt: new Date().toISOString(), version: 1, data: {} };
      BACKUP_KEYS.forEach((k) => { const v = localStorage.getItem(k); if (v !== null) backup.data[k] = v; });
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url; a.download = `997-laundry-backup-${tag || "device"}-${todayStr()}.json`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch (e) { /* تجاهل */ }
  }
  // جهاز جديد: تنزيل بيانات المحل من السحابة ثم إعادة فتح النظام على شاشة الدخول
  async function submitCloudJoin() {
    const ident = $a("au_user").value.trim(), pw = $a("au_pass").value;
    if (!ident || !pw) return setErr(AX("e_empty"));
    const btn = $a("au_form").querySelector("button[type=submit]");
    if (authCtx.replace) downloadLocalBackup("before-cloud"); // بيانات هذا الجهاز تُحفظ في ملف قبل استبدالها
    btn.disabled = true; setErr(lang === "en" ? "☁ Downloading the shop's data…" : "☁ جاري تنزيل بيانات المحل…");
    const r = await CLOUD.joinDevice(ident, pw);
    btn.disabled = false;
    if (r.error) {
      // رقم وظيفي على جهاز جديد: لا توجد قائمة موظفين بعد لمعرفة صاحبه — رسالة واضحة بدل «اسم أو كلمة مرور غير صحيحة»
      if (/^\s*[0-9٠-٩]+\s*$/.test(ident) && r.error === "bad-credentials") return setErr(lang === "en" ? "That looks like an employee number. On a new device type your USERNAME (e.g. Yassen997) — ask the owner if you don't know it." : "هذا رقم وظيفي. على جهاز جديد اكتب «اسم الدخول» (مثل Yassen997) — اسأل المالك إذا ما تعرفه.");
      return setErr(cloudErr(r.error));
    }
    const list = JSON.parse(localStorage.getItem("l997_employees") || "[]");
    const emp = list.find((x) => x.cloudUserId === r.uid) || list.find((x) => String(x.username || "").toLowerCase() === ident.toLowerCase());
    if (emp) { emp.cloudUserId = r.uid; emp.salt = randHex(16); emp.passHash = hashPw(pw, emp.salt); localStorage.setItem("l997_employees", JSON.stringify(list)); }
    try { localStorage.setItem("l997_cloud_joined_notice", "1"); } catch (e) { /* تجاهل */ }
    window.location.reload();
  }

  // بريد استرداد كلمة المرور للمالك: يصبح بريد دخوله في السحابة (اسم المستخدم يبقى كما هو للدخول)
  function openRecoveryEmailForm() {
    if (role !== "owner" || !me) { denied(); return; }
    openQuickForm({
      title: "📧 بريد استرداد كلمة المرور", sub: "اكتب بريدك الشخصي. يصله رابط تعيين كلمة مرور جديدة إذا نسيتها. للتأكيد اكتب كلمة المرور الحالية.",
      fields: [
        { id: "email", label: "البريد الإلكتروني", type: "text", value: me.cloudEmail || "", autocomplete: "email" },
        { id: "pw", label: "كلمة المرور الحالية", type: "password", value: "" },
      ],
      submitLabel: "حفظ البريد",
      onSubmit: (v) => {
        const email = String(v.email || "").trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { toast("اكتب بريداً صحيحاً (مثال: name@gmail.com)"); return false; }
        if (!v.pw) { toast("اكتب كلمة المرور الحالية"); return false; }
        const localOk = !!me.salt && hashPw(v.pw, me.salt) === me.passHash;
        return cloudStep(async () => {
          // كلمة المرور على هذا الجهاز قد تكون قديمة (تغيّرت من جهاز آخر) — التحقق من السحابة هو المرجع
          if (!localOk) { const vr = await CLOUD.verifyPassword(me.username, v.pw); if (!vr.ok) return { error: "bad-credentials" }; cacheLocalPassword(me, v.pw); }
          return CLOUD.setRecoveryEmail(email, me.cloudUserId);
        }, (c) => {
          me.cloudEmail = email; persistEmps();
          logActivity(`إضافة/تغيير بريد استرداد كلمة المرور للمالك — ${me.name}`);
          toast(c.pending ? "تم — افتح بريدك واضغط رابط التأكيد ليُفعَّل" : "✓ تم حفظ البريد — رابط الاسترداد يصل إليه");
          renderCloudPanel();
        });
      },
    });
  }
  function recoveryLanding() {
    const base = /^https?:$/.test(location.protocol) ? location.origin + location.pathname : "https://997-laundry.github.io/";
    return base;
  }
  async function sendRecoveryEmail() {
    const email = ($a("au_email") && $a("au_email").value || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return setErr(lang === "en" ? "Enter the owner's email" : "اكتب بريد المالك");
    const left = lockLeftMs("mail");
    if (left > 0) return setErr(AX("e_locked", Math.ceil(left / 60000)));
    attFail("mail");
    const btn = $a("au_email_send"); if (btn) btn.disabled = true;
    setErr(lang === "en" ? "📧 Sending…" : "📧 جاري الإرسال…");
    const r = await CLOUD.sendRecovery(email, recoveryLanding());
    if (btn) btn.disabled = false;
    if (r.error) return setErr(r.error === "rate-limit" ? (lang === "en" ? "Too many emails — try again in an hour" : "طلبات كثيرة — حاول بعد ساعة") : cloudErr(r.error));
    setErr("");
    const ok = $a("au_email_ok"); if (ok) ok.hidden = false;
  }
  // فتح رابط الاسترداد من البريد: النظام يُفتح على «كلمة مرور جديدة»
  function recoveryFromUrl() {
    const h = String(location.hash || "").replace(/^#/, "");
    if (!/(^|&)type=recovery(&|$)/.test(h)) return null;
    const p = new window.URLSearchParams(h);
    const token = p.get("access_token");
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* ignore */ }
    return token || null;
  }
  async function submitEmailReset() {
    const p1 = $a("au_pw").value, p2 = $a("au_pw2").value;
    const prob = pwProblem(p1, null);
    if (prob) return setErr(prob);
    if (p1 !== p2) return setErr(AX("e_pw_match"));
    const btn = $a("au_form").querySelector("button[type=submit]"); btn.disabled = true; setErr("☁ …");
    const r = await CLOUD.completeRecovery(authCtx.token, p1);
    btn.disabled = false;
    if (r.error) return setErr(r.error === "link-expired" ? (lang === "en" ? "This link has expired — request a new one" : "انتهت صلاحية الرابط — اطلب رابطاً جديداً") : cloudErr(r.error));
    const e = emps().find((x) => x.cloudUserId && x.cloudUserId === r.uid);
    if (e) {
      setPassword(e, p1, false); attClear("u:" + e.id);
      logActivity(`استعادة كلمة المرور عبر البريد — ${e.name}`);
      save("l997_user", e.name); save("l997_role", "—");
      showAuth("login", "pwchanged");
    } else {
      // جهاز غير مربوط بعد: الدخول من السحابة بالبريد وكلمة المرور الجديدة
      showAuth("cloudJoin", "", { email: r.email || "" });
      setTimeout(() => { if ($a("au_user") && r.email) $a("au_user").value = r.email; }, 50);
    }
  }

  /* ---------- لوحة السحابة (ملف المنشأة — للمالك) ---------- */
  function renderCloudPanel() {
    const el = document.getElementById("cloudPanel");
    if (!el) return;
    if (!CLOUD || role !== "owner") { el.style.display = "none"; return; }
    el.style.display = "";
    const s = CLOUD.status();
    const when = (iso) => (iso ? fmtDT(iso) : "—");
    if (!s.linked) {
      el.innerHTML = `<div class="panel-header"><div><h3>☁ المزامنة السحابية</h3><p>بيانات موحّدة على كل الأجهزة + نسخة محفوظة في السحابة</p></div></div>
        <ul class="cloud-list">
          <li>تُرفع كل بيانات هذا الجهاز للسحابة، وبعدها كل تغيير يُرفع خلال ثوانٍ.</li>
          <li>الأجهزة الأخرى تدخل من شاشة الإعداد ← «لدي حساب في السحابة».</li>
          <li>يستمر العمل بدون إنترنت، ويُرفع كل شيء عند عودة الاتصال.</li>
          <li>كلمات المرور لا تُرفع — كل موظف له حساب دخول خاص في السحابة.</li>
        </ul>
        <p class="section-note">قبل الربط يُنزَّل تلقائياً ملف نسخة احتياطية من بيانات هذا الجهاز.</p>
        <button class="primary-btn" id="cloudLinkBtn" type="button">☁ ربط النظام بالسحابة ورفع بيانات هذا الجهاز</button>`;
      document.getElementById("cloudLinkBtn").addEventListener("click", openCloudLinkForm);
      return;
    }
    const noCloud = emps().filter((e) => e.active !== false && e.passHash && e.username && !e.cloudUserId);
    el.innerHTML = `<div class="panel-header"><div><h3>☁ المزامنة السحابية — مفعّلة</h3><p>مربوط منذ ${when(s.linkedAt)}</p></div><button class="secondary-btn" id="cloudSyncNowBtn" type="button">🔄 مزامنة الآن</button></div>
      <div class="cloud-stats">
        <div><span>آخر مزامنة</span><strong>${when(s.lastSyncAt)}</strong></div>
        <div><span>الاتصال</span><strong>${s.needLogin ? "يحتاج تسجيل دخول" : s.online ? "متصل ✓" : "بدون إنترنت"}</strong></div>
        <div><span>بانتظار الرفع</span><strong>${s.pending}</strong></div>
        <div><span>تحديثات واردة</span><strong>${s.incoming}</strong></div>
        <div><span>رابط الإيصال على واتساب</span><strong>${s.receiptLinks ? "مفعّل ✓" : s.receiptLinks === false ? "غير مفعّل" : "…"}</strong></div>
      </div>
      ${s.receiptLinks === false ? `<div class="cloud-warn">⚠ لتفعيل إرسال رابط الإيصال تلقائياً عند التسليم: افتح Supabase ← SQL Editor والصق محتوى الملف <b>supabase/receipt_link.sql</b> ثم Run (مرة واحدة). حتى ذلك الحين يسأل النظام قبل إرسال رسالة التسليم كالمعتاد.</div>` : ""}
      ${noCloud.length ? `<div class="cloud-warn">⚠ موظفون لهم دخول على هذا الجهاز وليس لهم حساب سحابي بعد: <b>${noCloud.map((e) => esc(e.name)).join("، ")}</b>.<br><button class="primary-btn" id="cloudStaffBtn" type="button" style="margin-top:8px">☁ إنشاء حساباتهم في السحابة الآن</button></div>` : ""}
      ${s.conflicts ? `<details class="cloud-warn"><summary>⚠ ${s.conflicts} تعديل تعارض مع جهاز آخر (اعتُمدت نسخة السحابة) — اضغط للتفاصيل</summary>${s.conflictList.map((c) => `<div class="cloud-row">${fmtDT(c.at)} · ${esc(c.collection)} · ${esc(c.id)}</div>`).join("")}</details>` : ""}
      ${s.rejected ? `<details class="cloud-warn"><summary>⚠ ${s.rejected} تعديل رفضته السحابة (صلاحيات) — اضغط للتفاصيل</summary>${s.rejectedList.map((c) => `<div class="cloud-row">${fmtDT(c.at)} · ${esc(c.collection)} · ${esc(c.why)}</div>`).join("")}</details>` : ""}
      ${s.conflicts || s.rejected ? `<button class="ghost-btn" id="cloudClearNotesBtn" type="button">✓ تمت المراجعة — مسح التنبيهات</button>` : ""}
      ${role === "owner" && me ? `<div class="wa-api-box" style="border:1px solid var(--border);border-radius:14px;padding:12px 14px;background:var(--panel-soft);margin:10px 0">
        <strong>📧 بريد استرداد كلمة المرور (المالك)</strong>
        <p class="section-note" style="margin:6px 0 8px">إذا نسيت كلمة المرور: شاشة الدخول ← «نسيت كلمة المرور» ← «إرسال رابط إلى بريدي» — يصلك رابط لتعيين كلمة مرور جديدة. ${me.cloudEmail ? `البريد الحالي: <b dir="ltr">${esc(me.cloudEmail)}</b>` : "لم يُضف بريد بعد."}</p>
        <button class="secondary-btn" id="cloudEmailBtn" type="button">${me.cloudEmail ? "✏️ تغيير البريد" : "＋ إضافة بريدي"}</button>
      </div>` : ""}
      <p class="section-note">لإضافة جهاز: افتح الرابط على الجهاز الجديد ← «لدي حساب في السحابة».</p>
      <button class="ghost-btn" id="cloudUnlinkBtn" type="button">فك ربط هذا الجهاز فقط</button>`;
    document.getElementById("cloudEmailBtn")?.addEventListener("click", openRecoveryEmailForm);
    document.getElementById("cloudStaffBtn")?.addEventListener("click", () => openCloudStaffForm(noCloud));
    document.getElementById("cloudClearNotesBtn")?.addEventListener("click", () => { CLOUD.clearNotes(); renderCloudPanel(); toast("تم مسح التنبيهات"); });
    document.getElementById("cloudSyncNowBtn").addEventListener("click", () => { CLOUD.syncNow().then(() => { renderCloudPanel(); toast("تمت المزامنة"); }); });
    document.getElementById("cloudUnlinkBtn").addEventListener("click", () => {
      openQuickForm({
        title: "فك ربط هذا الجهاز", sub: "يتوقف هذا الجهاز عن المزامنة. البيانات تبقى عليه وفي السحابة. اكتب «فك» للتأكيد.",
        fields: [{ id: "c", label: "اكتب: فك", type: "text" }], submitLabel: "فك الربط",
        onSubmit: (v) => { if (v.c !== "فك") { toast("اكتب «فك» للتأكيد"); return false; } CLOUD.unlink(); logActivity("فك ربط الجهاز بالسحابة بواسطة " + me.name); renderCloudPanel(); },
      });
    });
  }
  // خطوة لمرة واحدة في Supabase: تسجيل حساب المالك — نعرض الأمر جاهزاً مع زر نسخ
  function showOwnerSql(email) {
    const sql = `insert into public.shop_setup (id, owner_email) values (1, '${email}') on conflict (id) do update set owner_email = excluded.owner_email;`;
    openQuickForm({
      title: "☁ خطوة واحدة في Supabase",
      sub: "١) اضغط «نسخ الأمر» ٢) في Supabase: SQL Editor ← New query ← الصق ← Run ٣) ارجع هنا واضغط «ربط النظام بالسحابة» مرة ثانية.",
      fields: [{ id: "sql", label: "الأمر (لا تعدّله)", type: "text", value: sql }],
      submitLabel: "📋 نسخ الأمر",
      onSubmit: () => {
        const done = () => toast("تم النسخ ✓ — الصقه في Supabase واضغط Run");
        try { navigator.clipboard.writeText(sql).then(done, () => { document.getElementById("qf_sql")?.select(); toast("حدّد النص وانسخه يدوياً"); }); } catch (e) { document.getElementById("qf_sql")?.select(); }
        return false;
      },
    });
  }
  // حسابات سحابية لكل الموظفين دفعة واحدة — كلمة مؤقتة لكل واحد (يغيّرها عند أول دخول) وقائمة جاهزة للتسليم
  function openCloudStaffForm(list) {
    if (role !== "owner") { denied(); return; }
    openQuickForm({
      title: "☁ حسابات الموظفين في السحابة",
      sub: `سيُنشأ لكل من: ${list.map((e) => e.name).join("، ")} حساب سحابي بكلمة مرور مؤقتة جديدة (كلماتهم الحالية على هذا الجهاز تتوقف). بعدها تظهر قائمة الأسماء وكلمات المرور لتسليمها.`,
      fields: [], submitLabel: "☁ إنشاء الحسابات",
      onSubmit: () => cloudStep(async () => {
        const out = [];
        for (const e of list) {
          const pw = genTempPassword();
          const r = await CLOUD.createStaff(e.username, pw, validRole(e.role), e.name, e.id);
          if (r.error) { out.push({ e, error: r.error }); continue; }
          e.cloudUserId = r.uid; setPassword(e, pw, true); attClear("u:" + e.id);
          out.push({ e, pw });
        }
        persistEmps();
        return { out };
      }, ({ out }) => {
        logActivity(`إنشاء حسابات سحابية للموظفين (${out.filter((x) => x.pw).length}) بواسطة ${me.name}`);
        renderCloudPanel(); renderAccessPage();
        openQuickForm({
          title: "✅ حسابات الموظفين جاهزة",
          sub: "سلّم كل موظف اسم الدخول وكلمته المؤقتة. على جهازه: افتح الرابط ← «لدي حساب في السحابة» (أو «هذا الجهاز غير مربوط بالسحابة») ← ثم يختار كلمة مرور جديدة. الرابط: https://997-laundry.github.io",
          fields: out.map((x, i) => ({ id: "s" + i, label: x.e.name, type: "text", value: x.pw ? `اسم الدخول: ${x.e.username} — الكلمة المؤقتة: ${x.pw}` : `لم يُنشأ: ${cloudErr(x.error)}` })),
          submitLabel: "تم", onSubmit: () => {},
        });
      }),
    });
  }
  function openCloudLinkForm() {
    if (role !== "owner" || !me) { denied(); return; }
    if (!me.username) { toast("حساب المالك يحتاج اسم دخول (username) أولاً"); return; }
    openQuickForm({
      title: "☁ ربط النظام بالسحابة",
      sub: `سيُنشأ حساب المالك في السحابة باسم الدخول «${me.username}» وكلمة مرورك الحالية، ثم تُرفع كل بيانات هذا الجهاز. يُنزَّل ملف نسخة احتياطية قبل البدء. اكتب «رفع» للتأكيد.`,
      fields: [
        { id: "pw", label: "كلمة مرورك الحالية", type: "password" },
        { id: "c", label: "اكتب: رفع", type: "text" },
      ],
      submitLabel: "☁ ربط ورفع البيانات",
      onSubmit: (v) => {
        if (!verifyPw(me, v.pw)) { toast(AX("e_cur")); return false; }
        if (v.c !== "رفع") { toast("اكتب «رفع» للتأكيد"); return false; }
        document.getElementById("exportBackupBtn")?.click(); // نسخة احتياطية قبل أي شيء
        return cloudStep(async () => {
          const l = await CLOUD.linkOwner(me.username, v.pw, loadProfile().nameEn || "997 Laundry", me.name);
          if (l.error) return l;
          me.cloudUserId = l.uid; persistEmps();
          return CLOUD.uploadAll(me.id);
        }, (u) => {
          logActivity(`ربط النظام بالسحابة ورفع البيانات بواسطة ${me.name}`);
          CLOUD.setUser(me);
          renderCloudPanel();
          toast(u.rejected ? `تم الربط — ${u.rejected} سجل لم يُقبل (راجع اللوحة)` : "☁ تم الربط ورفع كل البيانات بنجاح");
        }, (code) => {
          if (code !== "owner-not-named") return false;
          quickFormDialog.close();
          showOwnerSql(CLOUD.emailOf(me.username));
          return true;
        });
      },
    });
  }

  function restoreBackupFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || typeof parsed.data !== "object") throw new Error("bad");
        const entries = Object.entries(parsed.data).filter(([k, v]) => BACKUP_KEYS.includes(k) && typeof v === "string");
        entries.forEach(([, v]) => JSON.parse(v));
        entries.forEach(([k, v]) => localStorage.setItem(k, v));
        localStorage.removeItem("l997_attempts");
        localStorage.removeItem("l997_audit_scrubbed");
        setErr(""); const n = document.createElement("div"); n.className = "auth-note ok"; n.textContent = AX("restore_ok");
        $a("authCard").prepend(n);
        setTimeout(() => window.location.reload(), 900);
      } catch (e) { setErr(AX("restore_bad")); }
    };
    reader.readAsText(file);
  }

  /* ---------- تغيير كلمة المرور وزر الخروج ---------- */
  function openChangePw() {
    if (!me) return;
    openQuickForm({
      title: AX("cp_title"), sub: AX("pw_rules", sec.minLen),
      fields: [
        { id: "cur", label: AX("cp_cur"), type: "password" },
        { id: "p1", label: AX("cp_new"), type: "password" },
        { id: "p2", label: AX("cp_new2"), type: "password" },
      ],
      submitLabel: AX("cp_title"),
      onSubmit: (v) => {
        if (!verifyPw(me, v.cur)) { toast(AX("e_cur")); return false; }
        const prob = pwProblem(v.p1, me);
        if (prob) { toast(prob); return false; }
        if (v.p1 !== v.p2) { toast(AX("e_pw_match")); return false; }
        if (v.p1 === v.cur) { toast(AX("e_same_pw")); return false; }
        const done = () => { setPassword(me, v.p1, false); logActivity(`تغيير كلمة المرور — ${me.name}`); toast(AX("ok_changed")); };
        if (cloudOn() && me.cloudUserId) return cloudStep(() => CLOUD.changeOwnPassword(v.p1, me.cloudUserId), done);
        done();
      },
    });
  }
  $a("changePwBtn").addEventListener("click", openChangePw);
  $a("logoutBtn").addEventListener("click", () => logoutClicked());
  // زر خروج إضافي في الشريط العلوي (للجوال) — يبقى ظاهراً دائماً حتى لو غطّى شريط المتصفح أسفل القائمة
  document.getElementById("topLogoutBtn")?.addEventListener("click", () => logoutClicked());

  // رابط الاسترداد فُتح والنظام مفتوح أصلاً في نفس التبويب (لا تُعاد الصفحة) — نلتقطه أيضاً
  window.addEventListener("hashchange", () => {
    const t0 = recoveryFromUrl();
    if (t0) { me = null; showAuth("emailReset", "", { token: t0 }); }
  });
  function initAuth() {
    const recToken = recoveryFromUrl();
    if (recToken) { migrateAccounts(); showAuth("emailReset", "", { token: recToken }); return; }
    migrateAccounts();
    if (reconcileDerived()) persistAll();
    me = null;
    let notice = "";
    const s = sessGet();
    if (s) {
      const e = emps().find((x) => x.id === s.id);
      const okAcct = e && e.active !== false && !isExpired(e) && e.passHash;
      if (okAcct && Date.now() - (s.last || 0) < idleLimitMs()) {
        me = e; role = validRole(e.role);
        lastAct = s.last || Date.now(); lastPersist = Date.now();
        // نفس الجلسة بعد تحديث الصفحة (ولجلسة قديمة بلا سجل: يُنشأ سجلها الآن)
        mySessionId = s.sid || null;
        if (!mySessionId || !loadSessions().some((x) => x.id === mySessionId)) { startSessionRecord(e); sessSet({ ...s, sid: mySessionId }); }
        save("l997_user", e.name);
        // بعد تحديث تلقائي من السحابة نعود لنفس الصفحة
        let back = ""; try { back = sessionStorage.getItem("l997_cloud_page") || ""; sessionStorage.removeItem("l997_cloud_page"); } catch (err) { back = ""; }
        hideAuth(); applyRole(); startIdle(); openPage(back && document.getElementById("page-" + back) ? back : homePage());
        if (back) { let y = 0; try { y = Number(sessionStorage.getItem("l997_cloud_scroll")) || 0; sessionStorage.removeItem("l997_cloud_scroll"); } catch (err) { y = 0; } if (y) { window.scrollTo(0, y); requestAnimationFrame(() => window.scrollTo(0, y)); } }
        if (CLOUD) CLOUD.setUser(cloudOn() ? e : null);
        return;
      }
      sessClear();
      notice = okAcct ? "idle" : "revoked";
    }
    save("l997_user", "");
    applyRole();
    if (needsSetup()) showAuth("setup");
    else showAuth("login", notice);
    let joined = false; try { joined = !!localStorage.getItem("l997_cloud_joined_notice"); localStorage.removeItem("l997_cloud_joined_notice"); } catch (e) { joined = false; }
    if (joined) setErr(lang === "en" ? "☁ The shop's data is on this device now — sign in." : "☁ تم تنزيل بيانات المحل على هذا الجهاز — سجّل الدخول الآن.");
  }

  /* ------------------------------ البحث العام ------------------------------ */
  document.getElementById("globalSearch")?.addEventListener("input", (e) => {
    const q = e.target.value.trim();
    if (q) {
      openPage("orders");
      renderOrdersPage(q);
    } else if (currentPage === "orders") {
      // مسح مربع البحث أثناء التواجد بصفحة الطلبات يعيد عرض القائمة الكاملة بدل تجميدها على آخر نتيجة مفلترة
      renderOrdersPage("");
    }
  });

  /* ============================= لوحة التحكم ============================= */
  /* ------------------ نصوص الأرقام المالية (مصدر واحد للتسميات) ------------------ */
  const FT = {
    ar: {
      sales: "المبيعات", sales_note: (n, p) => `${n} طلب مدفوع${p ? ` + ${p} باقة` : ""}`,
      collected: "المحصّل فعلياً", collected_note: "نقد + بطاقة + Benefit + تحويل − المرتجع",
      expenses: "المصروفات", expenses_note: "المسجّلة بالفترة",
      profit: "الربح التقديري", profit_note: "الإيراد بدون ضريبة − كل المصروفات (تشمل الرواتب)",
      receivables: "ديون العملاء", receivables_note: (n) => `${n} عميل عليه مبالغ (الآن)`,
      open_value: "طلبات لم تُدفع بعد", open_note: (n) => `${n} طلب قيد التنفيذ`,
      ready_note: "بانتظار التسليم للعميل",
      gross: "المبيعات (شامل الضريبة)", vat: "ضريبة القيمة المضافة", net_rev: "الإيراد الصافي (بدون ضريبة)",
      staff: "مكافآت وعمولات الموظفين", salaries: "الرواتب والأجور", government: "الجهات الحكومية", avg: "متوسط قيمة الطلب", discounts: "الخصومات الممنوحة",
      pkg_sales: "مبيعات الباقات", from_balance: "مدفوع من أرصدة العملاء", credit: "بيع آجل (دين جديد)",
      deposits: "إيداعات أرصدة وسداد ديون", refunds: "مبالغ مُرجَعة للعملاء", prepaid: "أرصدة العملاء المدفوعة مقدماً",
      by_day: "حسب اليوم", by_month: "حسب الشهر", ready_old: "جاهز منذ أكثر من 3 أيام — تواصل مع العميل",
      low_stock: (n, q, u) => `مخزون منخفض: ${n} — متبقي ${q} ${u}`, out_stock: (n) => `نفد من المخزون: ${n}`,
      profit_hint: "الرواتب تُصرف من صفحة الموظفين (زر «صرف رواتب الشهر») والسلف تُسجَّل عند صرفها، فتدخل المصروفات تلقائياً. مشتريات المخزون تُحسب مصروفاً عند دفعها. التفاصيل الكاملة في «التقرير الشهري».",
      cash_in: "إجمالي المبالغ المستلمة", cash_methods: "التحصيل حسب طريقة الدفع", orders_count: "عدد الطلبات المدفوعة", created_count: "طلبات جديدة مستلمة",
    },
    en: {
      sales: "Sales", sales_note: (n, p) => `${n} paid orders${p ? ` + ${p} packages` : ""}`,
      collected: "Cash collected", collected_note: "Cash + card + Benefit + transfer − refunds",
      expenses: "Expenses", expenses_note: "Recorded in period",
      profit: "Estimated profit", profit_note: "Revenue excl. VAT − all expenses (incl. salaries)",
      receivables: "Customer debts", receivables_note: (n) => `${n} customers owe money (now)`,
      open_value: "Not yet paid orders", open_note: (n) => `${n} orders in progress`,
      ready_note: "Waiting for customer pickup",
      gross: "Sales (incl. VAT)", vat: "VAT", net_rev: "Net revenue (excl. VAT)",
      staff: "Staff bonuses & commissions", salaries: "Salaries & wages", government: "Government fees", avg: "Average order value", discounts: "Discounts given",
      pkg_sales: "Package sales", from_balance: "Paid from customer balances", credit: "Credit sales (new debt)",
      deposits: "Balance deposits & debt payments", refunds: "Refunded to customers", prepaid: "Customer prepaid balances",
      by_day: "By day", by_month: "By month", ready_old: "Ready for over 3 days — contact the customer",
      low_stock: (n, q, u) => `Low stock: ${n} — ${q} ${u} left`, out_stock: (n) => `Out of stock: ${n}`,
      profit_hint: "Salaries are paid from the Employees page (\"Pay this month's salaries\") and advances are recorded when given, so they enter expenses automatically. Stock purchases count when paid. Full details in the Monthly report.",
      cash_in: "Total money received", cash_methods: "Collected by payment method", orders_count: "Paid orders", created_count: "New orders received",
    },
  };
  const FX = (k, ...a) => { const d = FT[lang] || FT.ar; const v = d[k] !== undefined ? d[k] : FT.ar[k]; return typeof v === "function" ? v(...a) : v; };
  window.FX997 = FX;
  const FIN = window.L997Finance;
  function finData() {
    const E = window.L997Enterprise ? window.L997Enterprise.data : {};
    return { orders, ledger, customers, customerPackages, expenses: E.expenses || [], payroll: E.payroll || [] };
  }

  function computeCounts() {
    const active = orders.filter((o) => o.status === "received");
    const ready = orders.filter((o) => o.status === "ready");
    const today = FIN.todayStr();
    const deliveredToday = orders.filter((o) => o.deliveredAt && FIN.localDay(o.deliveredAt) === today);
    return { active: active.length, ready: ready.length, deliveredToday: deliveredToday.length };
  }

  /* ------------------------------ فلتر الفترة ------------------------------ */
  function fmtDateInput(d) { return FIN.localDay(d); }
  function applyDashPreset(preset) {
    const now = new Date();
    const to = new Date(now);
    let from = new Date(now);
    if (preset === "today") { /* from = to */ }
    else if (preset === "week") from.setDate(from.getDate() - 6);
    else if (preset === "month") from.setDate(from.getDate() - 29);
    else if (preset === "year") from.setDate(from.getDate() - 364);
    document.getElementById("dashFromDate").value = fmtDateInput(from);
    document.getElementById("dashToDate").value = fmtDateInput(to);
    document.querySelectorAll(".dash-range-presets .mini-btn").forEach((b) => b.classList.toggle("active", b.dataset.range === preset));
  }
  document.querySelectorAll(".dash-range-presets .mini-btn").forEach((btn) => {
    btn.addEventListener("click", () => { applyDashPreset(btn.dataset.range); renderDashboard(); });
  });
  document.getElementById("dashApplyRange").addEventListener("click", () => {
    document.querySelectorAll(".dash-range-presets .mini-btn").forEach((b) => b.classList.remove("active"));
    renderDashboard();
  });

  function drawBarChart(containerId, rows, opts) {
    const el = document.getElementById(containerId);
    if (!rows.length) { el.innerHTML = `<div class="empty-state compact">${t("empty_no_data")}</div>`; return; }
    const max = Math.max(1, ...rows.map((r) => r.value));
    el.innerHTML = rows.map((r) => `
      <div class="dash-bar-row">
        <span class="dash-bar-label">${r.label}</span>
        <div class="dash-bar-track"><div class="dash-bar-fill" style="width:${Math.max(3, Math.round((r.value / max) * 100))}%;${r.color ? `background:${r.color}` : ""}"></div></div>
        <span class="dash-bar-value">${opts && opts.money ? money(r.value) : r.value}</span>
      </div>`).join("");
  }
  // مخطط المبيعات: يوم بيوم للفترات القصيرة وشهر بشهر للطويلة
  function salesTrendRows(s, from, to, maxBars) {
    const spanDays = from && to ? Math.round((new Date(to) - new Date(from)) / 86400000) + 1 : 30;
    const byMonth = spanDays > 31;
    const src = byMonth ? s.salesByMonth : s.salesByDay;
    return { byMonth, rows: Object.keys(src).sort().slice(-maxBars).map((k) => ({ label: k.slice(5), value: src[k] })) };
  }

  /* ===================== 🧭 لوحة القرار (الصفحة الرئيسية) =====================
     أرقام الفترة مقارنة بالفترة السابقة بنفس الطول + توصيات مرتبة بالأولوية مبنية على البيانات الفعلية
     (نفس دالة FIN.summarize المستخدمة في التقارير والمالية — الأرقام متطابقة في كل الشاشات). */
  const DD = (ar, en) => (lang === "ar" ? ar : en);
  const pctChange = (cur, prev) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : cur > 0 ? null : 0);
  const bhHour = (iso) => Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Bahrain" }).format(new Date(iso)));
  function renderCockpit(from, to) {
    const root = document.getElementById("dashCockpit"); if (!root) return;
    const fin = can("view_reports"), today = FIN.todayStr(), now = Date.now();
    const span = from && to ? Math.round((new Date(to) - new Date(from)) / 864e5) + 1 : 30;
    const pFrom = FIN.addDays(from, -span), pTo = FIN.addDays(from, -1);
    const data = finData(), s = FIN.summarize(data, from, to), sp = FIN.summarize(data, pFrom, pTo), snap = FIN.snapshot(data);
    const inP = (iso) => FIN.inRange(iso, from, to);
    const custName = (id) => (customers.find((c) => c.id === id) || {}).name || "—";

    // ---------- العمليات ----------
    const hoursLimit = (o) => (o.priority === "urgent" ? settings.urgentHours : settings.normalHours) * 3600e3;
    const received = orders.filter((o) => o.status === "received");
    const late = received.filter((o) => now - new Date(o.createdAt).getTime() > hoursLimit(o));
    const urgent = received.filter((o) => o.priority === "urgent");
    const ready = orders.filter((o) => o.status === "ready");
    const readyOld = ready.filter((o) => now - new Date(FIN.orderPaidAt(o) || o.readyAt || o.createdAt).getTime() > 3 * 864e5);
    const deliveredToday = orders.filter((o) => o.deliveredAt && FIN.localDay(o.deliveredAt) === today).length;
    const readyOldValue = round3(readyOld.reduce((a, o) => a + (Number(o.payment && o.payment.total) || 0), 0));

    // ---------- العملاء ----------
    const pOrders = orders.filter((o) => o.status !== "cancelled" && inP(o.createdAt));
    const pCust = [...new Set(pOrders.map((o) => o.customerId))];
    const firstOrder = {};
    orders.forEach((o) => { if (o.status === "cancelled") return; const t0 = String(o.createdAt); if (!firstOrder[o.customerId] || t0 < firstOrder[o.customerId]) firstOrder[o.customerId] = t0; });
    const newCust = pCust.filter((id) => inP(firstOrder[id])).length, returning = pCust.length - newCust;
    const salesByCust = {};
    s.salesList.forEach((o) => { salesByCust[o.customerId] = round3((salesByCust[o.customerId] || 0) + (Number(o.payment.total) || 0)); });
    const topCust = Object.entries(salesByCust).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const lastOrder = {}, orderCount = {};
    orders.forEach((o) => { if (o.status === "cancelled") return; orderCount[o.customerId] = (orderCount[o.customerId] || 0) + 1; if (!lastOrder[o.customerId] || String(o.createdAt) > lastOrder[o.customerId]) lastOrder[o.customerId] = String(o.createdAt); });
    const inactive = Object.keys(orderCount).filter((id) => orderCount[id] >= 2 && now - new Date(lastOrder[id]).getTime() > 30 * 864e5 && customers.some((c) => c.id === id));

    // ---------- الأصناف والخدمات وطرق الدفع والموظفين ----------
    const topItems = Object.entries(s.piecesByGarment).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const totalPieces = Object.values(s.piecesByGarment).reduce((a, v) => a + v, 0);
    const svc = Object.entries(s.piecesByService).sort((a, b) => b[1] - a[1]);
    const pay = Object.entries(s.collectedBy).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const byEmp = {};
    pOrders.forEach((o) => { const k = o.createdBy || "—"; byEmp[k] = byEmp[k] || { n: 0, v: 0 }; byEmp[k].n++; byEmp[k].v = round3(byEmp[k].v + (Number(o.payment && o.payment.total) || 0)); });
    const emps2 = Object.entries(byEmp).sort((a, b) => b[1].n - a[1].n).slice(0, 6);
    const wd = [0, 0, 0, 0, 0, 0, 0], hr = new Array(24).fill(0);
    pOrders.forEach((o) => { wd[new Date(FIN.localDay(o.createdAt) + "T12:00:00").getDay()]++; hr[bhHour(o.createdAt)]++; });
    const busyDay = wd.indexOf(Math.max(...wd)), busyHour = hr.indexOf(Math.max(...hr));

    // ---------- الديون والالتزامات ----------
    const owedOrders = orders.filter((o) => o.status === "delivered" && orderOwedNow(o) > 0);
    const oldDebt = owedOrders.filter((o) => now - new Date(o.deliveredAt || o.createdAt).getTime() > 14 * 864e5);
    const oldDebtValue = round3(oldDebt.reduce((a, o) => a + orderOwedNow(o), 0));
    const activePk = customerPackages.filter((cp) => cp.remainingPieces > 0 && !pkgExpired(cp));
    const pkgLiability = round3(activePk.reduce((a, cp) => a + (cp.totalPieces ? (Number(cp.price) || 0) * cp.remainingPieces / cp.totalPieces : 0), 0));
    const pkgSoon = activePk.filter((cp) => (cp.expiresAt && daysLeft(cp.expiresAt) <= 7) || cp.remainingPieces <= Math.max(2, Math.round(cp.totalPieces * 0.1)));
    const stockLow = (window.L997Enterprise ? window.L997Enterprise.data.inventory : []).filter((i) => Number(i.qty) <= Number(i.minQty || 0));
    const unclosed = can("approve_closing") && window.L997Enterprise ? FIN.unclosedDays(data, window.L997Enterprise.data.closures, FIN.addDays(today, -7), FIN.addDays(today, -1)) : [];
    const dlvLegs = pOrders.flatMap((o) => (o.extras || []).filter((l) => String(l.id).startsWith("dlv_")));
    const dlvIncome = round3(dlvLegs.reduce((a, l) => a + (Number(l.total) || 0), 0)), dlvFree = dlvLegs.filter((l) => l.free).length;
    const margin = s.netRevenue > 0 ? Math.round((s.profit / s.netRevenue) * 100) : null;
    const discPct = s.grossOrderSales + s.discounts > 0 ? Math.round((s.discounts / (s.grossOrderSales + s.discounts)) * 100) : 0;
    const topExp = Object.entries(s.expensesByGroup || {}).sort((a, b) => b[1] - a[1])[0];

    // ---------- التوصيات (مرتبة: 1 عاجل، 2 مهم، 3 فرصة) ----------
    const tips = [];
    const tip = (lvl, icon, title, body, act, page) => tips.push({ lvl, icon, title, body, act, page });
    if (late.length) tip(1, "⏰", DD(`${late.length} طلب متأخر عن موعده`, `${late.length} orders are past their due time`), DD("العملاء ينتظرون — قدّمها في التشغيل الآن، وأرسل للعميل رسالة اعتذار مع الموعد الجديد.", "Customers are waiting — move them up now and message the customer with a new time."), DD("عرض الطلبات", "Open orders"), "orders");
    if (readyOld.length) tip(1, "📦", DD(`${readyOld.length} طلب جاهز لم يُستلم منذ أكثر من 3 أيام (${money(readyOldValue)})`, `${readyOld.length} ready orders uncollected for 3+ days (${money(readyOldValue)})`), DD("أموال ومساحة مجمّدة — أرسل تذكيراً على واتساب أو اعرض التوصيل للبيت.", "Money and shelf space are stuck — send a WhatsApp reminder or offer home delivery."), DD("عرض الطلبات", "Open orders"), "orders");
    if (fin && oldDebt.length) tip(1, "💳", DD(`ديون أقدم من 14 يوماً: ${money(oldDebtValue)} على ${new Set(oldDebt.map((o) => o.customerId)).size} عميل`, `Debts older than 14 days: ${money(oldDebtValue)} from ${new Set(oldDebt.map((o) => o.customerId)).size} customers`), DD("ابدأ بالأكبر قيمة: تذكير لطيف اليوم، ثم اتصال. لا تقبل طلباً آجلاً جديداً قبل السداد.", "Start with the largest: a friendly reminder today, then a call. Avoid new credit until they pay."), DD("الأرصدة", "Balances"), "balances");
    const unc = unclosed.slice(-3).map((x) => x.slice(5)).join(lang === "ar" ? "، " : ", ") + (unclosed.length > 3 ? (lang === "ar" ? ` و${unclosed.length - 3} أيام أخرى` : ` +${unclosed.length - 3} more`) : "");
    if (unclosed.length) tip(1, "📅", DD(`${unclosed.length} أيام لم يُعتمد إغلاقها: ${unc}`, `${unclosed.length} days not closed: ${unc}`), DD("أغلق كل يوم بعدّ النقد — هذا يكشف أي فرق في الصندوق مبكراً.", "Close each day by counting the cash — it catches any till difference early."), DD("الإغلاقات", "Closures"), "closures");
    if (stockLow.length) tip(2, "🧴", DD(`مخزون منخفض: ${stockLow.slice(0, 3).map((i) => i.name).join("، ")}${stockLow.length > 3 ? ` و${stockLow.length - 3} غيرها` : ""}`, `Low stock: ${stockLow.slice(0, 3).map((i) => i.name).join(", ")}${stockLow.length > 3 ? ` +${stockLow.length - 3}` : ""}`), DD("اطلبها الآن قبل أن يتوقف العمل.", "Order now before work stops."), DD("المخزون", "Inventory"), "inventory");
    if (fin && sp.salesTotal > 0) {
      const ch = pctChange(s.salesTotal, sp.salesTotal);
      if (ch !== null && ch <= -10) tip(2, "📉", DD(`المبيعات أقل بـ ${Math.abs(ch)}% من الفترة السابقة`, `Sales are ${Math.abs(ch)}% lower than the previous period`), DD(`أرسل عرضاً للعملاء غير النشطين${inactive.length ? ` (${inactive.length} عميل)` : ""} أو كوداً لمدة محدودة لتنشيط الطلب.`, `Send an offer to inactive customers${inactive.length ? ` (${inactive.length})` : ""} or a time-limited code to lift demand.`), DD("العملاء", "Customers"), "customers");
      else if (ch !== null && ch >= 15) tip(3, "📈", DD(`المبيعات أعلى بـ ${ch}% من الفترة السابقة 👏`, `Sales are up ${ch}% on the previous period 👏`), DD("حافظ على الزخم: راقب مدة التسليم حتى لا تتأخر الطلبات مع زيادة الضغط.", "Keep the momentum: watch turnaround times so busy days don't cause delays."));
    }
    if (fin && margin !== null && margin < 20 && s.netRevenue > 0) tip(2, "⚖️", DD(`هامش الربح ${margin}% فقط`, `Profit margin is only ${margin}%`), DD(`أكبر بند مصروفات: ${topExp ? `${FX(topExp[0]) || topExp[0]} (${money(topExp[1])})` : "—"}. راجعه، أو ارفع أسعار الأصناف الأكثر طلباً قليلاً.`, `Largest expense: ${topExp ? `${topExp[0]} (${money(topExp[1])})` : "—"}. Review it, or raise the price of top items slightly.`), DD("المالية", "Finance"), "finance");
    if (fin && discPct >= 12) tip(2, "🏷", DD(`الخصومات ${discPct}% من المبيعات (${money(s.discounts)})`, `Discounts are ${discPct}% of sales (${money(s.discounts)})`), DD("راجع أكواد الخصم والعملاء المستفيدين — ضع تاريخ انتهاء أو حداً للاستخدام.", "Review discount codes and who uses them — add an expiry date or a use limit."), DD("الإعدادات", "Settings"), "settings");
    if (inactive.length) tip(3, "👋", DD(`${inactive.length} عميل متكرر لم يطلب منذ أكثر من 30 يوماً`, `${inactive.length} regular customers haven't ordered in 30+ days`), DD("رسالة «اشتقنا لك» مع خصم بسيط ترجع أغلبهم — العميل الحالي أرخص من عميل جديد.", "A “we miss you” message with a small discount brings most back — cheaper than finding new customers."), DD("العملاء", "Customers"), "customers");
    if (pkgSoon.length) tip(3, "🎟", DD(`${pkgSoon.length} باقة قاربت على الانتهاء (مدة أو قطع)`, `${pkgSoon.length} packages are about to run out (time or pieces)`), DD("اعرض التجديد الآن مع هدية صغيرة — التجديد أسهل بيع ممكن.", "Offer renewal now with a small gift — renewals are the easiest sale."), DD("العملاء", "Customers"), "customers");
    if (topItems.length && totalPieces >= 10) {
      const [gid, n] = topItems[0], share = Math.round((n / totalPieces) * 100);
      if (share >= 25) tip(3, "⭐", DD(`«${clothingName(gid)}» = ${share}% من القطع`, `“${clothingName(gid)}” is ${share}% of all pieces`), DD(`صمّم باقة خاصة بـ«${clothingName(gid)}» — أكثر صنف يطلبه عملاؤك.`, `Create a package just for “${clothingName(gid)}” — it's what your customers order most.`), DD("الإعدادات", "Settings"), "settings");
    }
    if (pOrders.length >= 10 && Math.max(...wd) > 0) tip(3, "👥", DD(`أكثر الأيام ضغطاً: ${weekdayName(busyDay)} — وأكثر ساعة: ${busyHour}:00`, `Busiest day: ${weekdayName(busyDay)} — busiest hour: ${busyHour}:00`), DD("رتّب الورديات بحيث يكون أكبر عدد من الموظفين في هذا اليوم والوقت.", "Plan shifts so most staff are on at this day and time."), DD("الموظفون", "Employees"), "employees");
    if (fin && dlvFree > 0 && dlvFree > dlvLegs.length - dlvFree && dlvLegs.length >= 6) tip(3, "🚚", DD(`${dlvFree} من ${dlvLegs.length} مشوار مجاني هذه الفترة`, `${dlvFree} of ${dlvLegs.length} trips were free this period`), DD("المشاوير المجانية تكلفة عليك — تأكد أن عدد المشاوير في كل باقة مناسب لسعرها.", "Free trips cost you — check each package's trip allowance suits its price."), DD("التوصيل", "Delivery"), "delivery");
    tips.sort((a, b) => a.lvl - b.lvl);

    // ---------- الرسم ----------
    const delta = (cur, prev, goodUp) => {
      const ch = pctChange(cur, prev);
      if (ch === null) return `<span class="ck-delta up">${DD("جديد", "new")}</span>`;
      if (ch === 0) return `<span class="ck-delta">= ${DD("نفس السابق", "same as before")}</span>`;
      const up = ch > 0, good = goodUp ? up : !up;
      return `<span class="ck-delta ${good ? "up" : "down"}">${up ? "▲" : "▼"} ${Math.abs(ch)}% <small>${DD("عن الفترة السابقة", "vs previous")}</small></span>`;
    };
    const hero = (icon, label, value, d, note, neg) => `<div class="ck-hero"><div class="ck-hero-top"><span>${icon} ${label}</span></div><div class="ck-hero-val" style="${neg ? "color:var(--danger)" : ""}">${value}</div>${d || ""}${note ? `<div class="ck-note">${note}</div>` : ""}</div>`;
    const bar = (label, v, max, txt, color) => `<div class="ck-bar"><span class="ck-bar-l">${label}</span><div class="ck-bar-t"><div style="width:${max ? Math.max(3, Math.round((v / max) * 100)) : 0}%;${color ? `background:${color}` : ""}"></div></div><span class="ck-bar-v">${txt}</span></div>`;
    const lvlName = { 1: DD("عاجل", "Urgent"), 2: DD("مهم", "Important"), 3: DD("فرصة", "Opportunity") };
    const pipe = (n, label, cls, page) => `<button type="button" class="ck-pipe ${cls || ""}" data-ck-go="${page}"><b>${n}</b><span>${label}</span></button>`;
    const panel = (title, sub, body) => `<div class="panel ck-panel"><div class="ck-head"><h3>${title}</h3>${sub ? `<p>${sub}</p>` : ""}</div>${body}</div>`;
    const empty = `<div class="empty-state compact">${DD("لا توجد بيانات في هذه الفترة", "No data in this period")}</div>`;
    const maxWd = Math.max(1, ...wd);

    root.innerHTML = `
      ${fin ? `<div class="ck-heroes">
        ${hero("💰", DD("المبيعات", "Sales"), money(s.salesTotal), delta(s.salesTotal, sp.salesTotal, true), DD(`${s.salesOrders} طلب مدفوع${s.packageCount ? ` + ${s.packageCount} باقة` : ""}`, `${s.salesOrders} paid orders${s.packageCount ? ` + ${s.packageCount} packages` : ""}`))}
        ${hero("Σ", DD("صافي الربح", "Net profit"), money(s.profit), delta(s.profit, sp.profit, true), margin !== null ? DD(`هامش الربح ${margin}% · المصروفات ${money(s.expenses)}`, `Margin ${margin}% · expenses ${money(s.expenses)}`) : DD(`المصروفات ${money(s.expenses)}`, `Expenses ${money(s.expenses)}`), s.profit < 0)}
        ${hero("💵", DD("المحصّل فعلياً", "Cash collected"), money(s.collected), delta(s.collected, sp.collected, true), DD(`المتوقع في الصندوق نقداً ${money(s.expectedCash)}`, `Expected cash in till ${money(s.expectedCash)}`))}
        ${hero("🧾", DD("الطلبات", "Orders"), pOrders.length, delta(pOrders.length, orders.filter((o) => o.status !== "cancelled" && FIN.inRange(o.createdAt, pFrom, pTo)).length, true), DD(`متوسط الطلب ${money(s.avgOrder)} · ${totalPieces} قطعة`, `Avg order ${money(s.avgOrder)} · ${totalPieces} pieces`))}
      </div>` : ""}

      <div class="ck-grid">
        <div class="panel ck-panel ck-tips"><div class="ck-head"><h3>💡 ${DD("قرارات اليوم", "Today's decisions")}</h3><p>${DD("توصيات مبنية على أرقامك الفعلية — الأهم أولاً", "Recommendations from your real numbers — most important first")}</p></div>
          ${tips.length ? tips.slice(0, 8).map((x) => `<div class="ck-tip l${x.lvl}"><span class="ck-tip-ic">${x.icon}</span><div class="ck-tip-body"><div class="ck-tip-top"><b>${esc(x.title)}</b><span class="ck-lvl l${x.lvl}">${lvlName[x.lvl]}</span></div><p>${esc(x.body)}</p>${x.page ? `<button type="button" class="mini-btn" data-ck-go="${x.page}">${esc(x.act)} ←</button>` : ""}</div></div>`).join("")
            : `<div class="ck-allgood">✅ ${DD("كل شيء تحت السيطرة — لا توجد تنبيهات الآن.", "Everything is under control — nothing needs attention now.")}</div>`}
        </div>
        ${panel(`⚙️ ${DD("التشغيل الآن", "Operations now")}`, DD("اضغط أي رقم لفتح الطلبات", "Tap a number to open the orders"), `<div class="ck-pipes">
          ${pipe(received.length, DD("قيد التنظيف", "In progress"), "", "orders")}${pipe(late.length, DD("متأخرة", "Late"), late.length ? "bad" : "", "orders")}${pipe(urgent.length, DD("مستعجلة", "Urgent"), urgent.length ? "warn" : "", "orders")}
          ${pipe(ready.length, DD("جاهزة للاستلام", "Ready"), "", "orders")}${pipe(readyOld.length, DD("جاهزة +3 أيام", "Ready 3+ days"), readyOld.length ? "warn" : "", "orders")}${pipe(deliveredToday, DD("سُلّمت اليوم", "Delivered today"), "good", "orders")}
        </div>${fin ? `<div class="ck-mini">
          <div><span>${DD("ديون العملاء", "Customer debts")}</span><b style="color:${snap.receivables > 0 ? "var(--danger)" : ""}">${money(snap.receivables)}</b><small>${snap.debtorsCount} ${DD("عميل", "customers")}</small></div>
          <div><span>${DD("أرصدة مدفوعة مقدماً", "Prepaid balances")}</span><b>${money(snap.prepaid)}</b><small>${DD("التزام عليك", "you owe in service")}</small></div>
          <div><span>${DD("قطع باقات لم تُستخدم", "Unused package pieces")}</span><b>${money(pkgLiability)}</b><small>${activePk.reduce((a, cp) => a + cp.remainingPieces, 0)} ${DD("قطعة", "pcs")}</small></div>
          <div><span>${DD("قيمة الطلبات المفتوحة", "Open orders value")}</span><b>${money(snap.openValue)}</b><small>${snap.openCount} ${DD("طلب", "orders")}</small></div>
        </div>` : ""}`)}
      </div>

      ${fin ? `<div class="ck-grid3">
        ${panel(`👥 ${DD("العملاء", "Customers")}`, DD("خلال الفترة", "In this period"), `<div class="ck-mini three">
            <div><span>${DD("عملاء طلبوا", "Ordering customers")}</span><b>${pCust.length}</b></div>
            <div><span>${DD("جدد", "New")}</span><b style="color:var(--success)">${newCust}</b></div>
            <div><span>${DD("عائدون", "Returning")}</span><b>${pCust.length ? Math.round((returning / pCust.length) * 100) : 0}%</b></div></div>
          <div class="ck-sub">${DD("أعلى العملاء إنفاقاً", "Top customers by spend")}</div>
          ${topCust.length ? topCust.map(([id, v], i) => `<button type="button" class="ck-row" data-ck-cust="${id}"><span>${i + 1}. ${esc(custName(id))}</span><b>${money(v)}</b></button>`).join("") : empty}`)}
        ${panel(`⭐ ${DD("الأصناف الأكثر طلباً", "Top items")}`, DD("حسب عدد القطع", "By number of pieces"), topItems.length ? topItems.map(([gid, n]) => `<div class="ck-item"><span class="cart-icon">${gIcon(gid, 26)}</span>${bar(esc(clothingName(gid)), n, topItems[0][1], `${n} · ${Math.round((n / Math.max(1, totalPieces)) * 100)}%`)}</div>`).join("") +
            `<div class="ck-sub">${DD("حسب الخدمة", "By service")}</div>` + svc.map(([k, v]) => bar(esc(serviceName(k)), v, svc[0][1], v, "var(--success)")).join("") : empty)}
        ${panel(`💳 ${DD("طرق الدفع", "Payment methods")}`, DD("المحصّل في الفترة", "Collected in this period"), (pay.length ? pay.map(([k, v]) => bar(esc(paymentLabel(k)), v, pay[0][1], money(v), "var(--warning)")).join("") : empty) +
            (dlvLegs.length ? `<div class="ck-sub">🚚 ${DD("التوصيل", "Delivery")}</div><div class="ck-mini three"><div><span>${DD("مشاوير", "Trips")}</span><b>${dlvLegs.length}</b></div><div><span>${DD("مجانية", "Free")}</span><b>${dlvFree}</b></div><div><span>${DD("الإيراد", "Income")}</span><b>${money(dlvIncome)}</b></div></div>` : ""))}
      </div>
      <div class="ck-grid">
        ${panel(`🧑‍💼 ${DD("إنتاجية الموظفين", "Staff productivity")}`, DD("الطلبات التي أدخلها كل موظف بالفترة", "Orders entered by each employee in this period"), emps2.length ? emps2.map(([nm, x]) => bar(esc(nm), x.n, emps2[0][1].n, `${x.n} · ${money(x.v)}`)).join("") : empty)}
        ${panel(`📆 ${DD("أوقات الضغط", "Busy times")}`, DD(`أكثر يوم: ${pOrders.length ? weekdayName(busyDay) : "—"} · أكثر ساعة: ${pOrders.length ? busyHour + ":00" : "—"}`, `Busiest day: ${pOrders.length ? weekdayName(busyDay) : "—"} · busiest hour: ${pOrders.length ? busyHour + ":00" : "—"}`),
          pOrders.length ? `<div class="ck-week">${wd.map((n, i) => `<div class="ck-day ${i === busyDay ? "top" : ""}"><div class="ck-col"><div style="height:${Math.round((n / maxWd) * 100)}%"></div></div><b>${n}</b><span>${(lang === "ar" ? ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"])[i]}</span></div>`).join("")}</div>` : empty)}
      </div>` : ""}`;
    root.querySelectorAll("[data-ck-go]").forEach((b) => (b.onclick = () => openPage(b.dataset.ckGo)));
    root.querySelectorAll("[data-ck-cust]").forEach((b) => (b.onclick = () => window.openCustomerProfile997 && window.openCustomerProfile997(b.dataset.ckCust)));
  }
  function renderDashboard() {
    if (!document.getElementById("dashFromDate").value) applyDashPreset("month");
    const c = computeCounts();
    const fromInput = document.getElementById("dashFromDate").value, toInput = document.getElementById("dashToDate").value;
    const s = FIN.summarize(finData(), fromInput, toInput);
    const snap = FIN.snapshot(finData());
    try { renderCockpit(fromInput, toInput); } catch (e) { console.error(e); }
    { const det = document.getElementById("dashDetails"), tt = document.querySelector("#dashDetails .ck-det-t");
      if (tt) tt.textContent = DD("التفاصيل: البطاقات، المخططات، الطلبات التي تحتاج انتباه، وحركة اليوم", "Details: cards, charts, orders needing attention and today's activity");
      if (det && !det.dataset.bound) { det.dataset.bound = "1"; try { det.open = localStorage.getItem("l997_dash_details") === "1"; } catch (e) { /* ignore */ } det.addEventListener("toggle", () => { try { localStorage.setItem("l997_dash_details", det.open ? "1" : "0"); } catch (e) { /* ignore */ } }); } }

    const grid = document.getElementById("metricsGrid");
    const cards = [
      { label: t("metric_active"), value: c.active, icon: "▦", note: t("metric_active_note") },
      { label: statusLabel("ready"), value: c.ready, icon: "✓", note: FX("ready_note") },
      { label: t("metric_delivered_today"), value: c.deliveredToday, icon: "◎", note: new Date().toLocaleDateString(DATE_LOCALES[lang] || "en-GB", { dateStyle: "medium", timeZone: "Asia/Bahrain" }) },
      { fin: true, label: FX("sales"), value: money(s.salesTotal), icon: "💰", note: FX("sales_note", s.salesOrders, s.packageCount) },
      { fin: true, label: FX("collected"), value: money(s.collected), icon: "💵", note: FX("collected_note") },
      { fin: true, label: FX("expenses"), value: money(s.expenses), icon: "🧾", note: FX("expenses_note") },
      { fin: true, label: FX("profit"), value: money(s.profit), icon: "Σ", note: FX("profit_note"), neg: s.profit < 0 },
      { fin: true, label: FX("receivables"), value: money(snap.receivables), icon: "!", note: FX("receivables_note", snap.debtorsCount) },
      { fin: true, label: FX("open_value"), value: money(snap.openValue), icon: "⏳", note: FX("open_note", snap.openCount) },
    ];
    grid.innerHTML = cards.filter((card) => can("view_reports") || !card.fin).map((card) => `
      <div class="metric-card">
        <div class="metric-top"><span>${card.label}</span><span class="metric-icon">${card.icon}</span></div>
        <div class="metric-value" style="${card.neg ? "color:var(--danger)" : ""}">${card.value}</div>
        <div class="metric-note">${card.note}</div>
      </div>`).join("");

    const trend = salesTrendRows(s, fromInput, toInput, 12);
    document.getElementById("dashChartSub").textContent = trend.byMonth ? FX("by_month") : FX("by_day");
    drawBarChart("dashSalesChart", trend.rows, { money: true });

    const line = (label, value, color) => `<div class="dash-revexp-row"><span class="label">${label}</span><span class="value"${color ? ` style="color:${color}"` : ""}>${money(value)}</span></div>`;
    document.getElementById("dashRevExpBreakdown").innerHTML =
      line(FX("gross"), s.salesTotal, "var(--success)") +
      (s.vat > 0 ? line(FX("vat"), s.vat) + line(FX("net_rev"), s.netRevenue) : "") +
      line(FX("expenses"), s.expenses, "var(--danger)") +
      (s.expensesByGroup.salaries ? line("  · " + FX("salaries"), s.expensesByGroup.salaries) : "") +
      (s.expensesByGroup.government ? line("  · " + FX("government"), s.expensesByGroup.government) : "") +
      line(FX("profit"), s.profit, s.profit < 0 ? "var(--danger)" : "") +
      line(FX("collected"), s.collected) +
      line(FX("avg"), s.avgOrder);

    // الطلبات حسب الحالة
    const byStatus = { received: 0, ready: 0, delivered: 0 };
    orders.forEach((o) => { if (byStatus[o.status] !== undefined) byStatus[o.status]++; });
    drawBarChart("dashStatusChart", [
      { label: statusLabel("received"), value: byStatus.received, color: "var(--warning)" },
      { label: statusLabel("ready"), value: byStatus.ready, color: "var(--primary)" },
      { label: statusLabel("delivered"), value: byStatus.delivered, color: "var(--success)" },
    ]);

    // أكثر الخدمات استخداماً بالفترة
    drawBarChart("dashServiceChart", Object.entries(s.piecesByService).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => ({ label: serviceName(k), value: v })));

    const now = Date.now();
    const attention = [];
    orders.forEach((o) => {
      if (o.status !== "received") return;
      const cust = customers.find((c2) => c2.id === o.customerId);
      const hoursLimit = o.priority === "urgent" ? settings.urgentHours : settings.normalHours;
      const receivedAt = new Date(o.createdAt).getTime();
      const overdue = now - receivedAt > hoursLimit * 3600 * 1000;
      if (o.priority === "urgent") attention.push({ o, cust, reason: t("reason_urgent") });
      else if (overdue) attention.push({ o, cust, reason: t("reason_late") });
    });
    orders.forEach((o) => {
      if (o.status !== "ready" || now - new Date(FIN.orderPaidAt(o)).getTime() <= 3 * 86400000) return;
      attention.push({ o, cust: customers.find((c2) => c2.id === o.customerId), reason: FX("ready_old") });
    });
    const stockAlerts = (window.L997Enterprise ? window.L997Enterprise.data.inventory : [])
      .filter((i) => Number(i.qty) <= Number(i.minQty || 0))
      .map((i) => (Number(i.qty) <= 0 ? FX("out_stock", esc(i.name)) : FX("low_stock", esc(i.name), round3(i.qty), esc(i.unit || ""))));
    if (can("approve_closing") && window.L997Enterprise) {
      const pend = FIN.unclosedDays(finData(), window.L997Enterprise.data.closures, FIN.addDays(FIN.todayStr(), -7), FIN.addDays(FIN.todayStr(), -1));
      if (pend.length) stockAlerts.unshift(`📅 ${lang === "en" ? "Days not closed" : "أيام لم يُعتمد إغلاقها"}: ${pend.map((x) => x.slice(5)).join("، ")}`);
    }
    const attList = document.getElementById("attentionList");
    attList.innerHTML = attention.length === 0 && stockAlerts.length === 0
      ? `<div class="empty-state compact">${t("empty_attention")}</div>`
      : attention.slice(0, 8).map(({ o, cust, reason }) => `
        <div class="attention-item">
          <div><strong>#${o.number} — ${cust ? esc(cust.name) : "—"}</strong><small>${reason} · ${money(o.payment.total)}</small></div>
          <span class="status-badge ${statusClass(o.status)}">${statusLabel(o.status)}</span>
        </div>`).join("") + stockAlerts.slice(0, 5).map((msg) => `
        <div class="attention-item"><div><strong>${/^📅/.test(msg) ? "" : "📦 "}${msg}</strong></div></div>`).join("");

    const actList = document.getElementById("activityList");
    actList.innerHTML = activity.length === 0
      ? `<div class="empty-state compact">${t("empty_activity")}</div>`
      : activity.slice(0, 6).map((a) => `<div class="timeline-item"><strong>${esc(a.text)}</strong><small>${fmtDT(a.at)}</small></div>`).join("");
  }

  /* ============================= طلب جديد ============================= */
  const CLOTHING_ICONS = {
    thob_cotton: "👕", thob_wool: "🧥", ghatra: "🧢", agal: "⚫",
    abaya_plain: "🧥", abaya_emb: "🧥", shirt: "👕", tshirt: "🎽",
    pants_long: "👖", pants_short: "🩳", jacket: "🧥", overcoat: "🧥",
    suit2pcs: "🥼", dress: "👗", dress_long: "👗", blouse: "👚",
    miniskirt: "👗", skirtlong: "👗", pullover: "🧶", necktie: "👔",
    kurta_pyjama: "👘", undershirt2pcs: "🩲", underwear: "🩲", socks: "🧦",
    cap: "🧢", bedsheet_single: "🛏️", bedsheet_double: "🛏️", bedcover: "🛏️",
    bedspread: "🛏️", blanket_single: "🛌", blanket_double: "🛌", duvet: "🛌",
    pillowcase: "🛏️", bathtowel: "🛁", bathrobe: "🥋", curtain_per_m: "🪟",
    tablecloth: "🍽️", tablecloth_large: "🍽️",
    bisht: "🥻", dupatta: "🧣", gahfiya: "🧢", tshirt_half: "👕", carpet_m2: "🟫",
    shaila: "🧕", jalabiya: "👗", bdf_uniform: "🪖", hoodie_jacket: "🧥", overcoat_long: "🧥", shoes: "👟", small_towel: "🧻",
  };

  // أيقونة الصنف: رسمة SVG مخصصة (icons.js)، وإلا الإيموجي القديم
  const gIcon = (id, size) => (window.L997Icons ? window.L997Icons.svg(id, size) : (CLOTHING_ICONS[id] || "🧺"));
  let quickAddClothingId = null;
  let quickAddServiceId = null;
  let quickQty = 1;
  let suspendedOrders = load("l997_suspended_orders", []);

  function resetDraft() {
    draftItems = []; draftExtras = new Set(); draftCustomerId = null; currentQty = 1; draftDelivery = blankDelivery();
    document.getElementById("orderCustomerPhone").value = "";
    const card = document.getElementById("selectedCustomerCard");
    card.textContent = t("no_customer_selected");
    card.classList.add("empty-state", "compact");
    document.getElementById("orderNotes").value = "";
    document.getElementById("expectedDelivery").value = "";
    const empSelReset = document.getElementById("orderEmployeeSelect");
    if (empSelReset) empSelReset.value = "";
    document.getElementById("orderPriority").value = "normal";
    document.getElementById("orderPriorityToggle").checked = false;
    document.getElementById("orderPriorityToggle").indeterminate = false;
    draftUrgentAll = false;
    { const h = document.getElementById("posUrgentHint"); if (h) h.textContent = ""; }
    document.getElementById("paymentMethod").value = "cash";
    document.getElementById("paidAmount").value = 0;
    document.getElementById("balanceUse").value = 0;
    document.getElementById("discountAmount").value = 0;
    draftCode = null; const dci = document.getElementById("discountCode"); if (dci) dci.value = "";
    const drs = document.getElementById("discountReason"); if (drs) drs.value = "";
    const barText = document.getElementById("posCustomerBarText");
    barText.innerHTML = "اختر عميلاً للبدء بالطلب<small>اضغط هنا للبحث أو إضافة عميل جديد</small>";
    document.getElementById("posCustomerBarBtn").classList.remove("has-customer");
    renderOrderItemsTable();
    renderPosExtras();
    renderPosDelivery();
    updateSummary();
    if (document.getElementById("posProductGrid")) renderProductGrid();
  }
  // أزرار الإضافات في السلة — تظهر فقط للإضافات التي لها سعر في الإعدادات
  function renderPosExtras() {
    const box = document.getElementById("posExtras");
    if (!box) return;
    const list = activeExtras();
    [...draftExtras].forEach((id) => { if (!list.some((x) => x.id === id)) draftExtras.delete(id); });
    box.style.display = list.length ? "" : "none";
    box.innerHTML = list.map((x) => {
      const c = extraCfg(x.id);
      return `<label class="pos-urgent-toggle pos-extra-toggle"><input type="checkbox" data-extra="${x.id}" ${draftExtras.has(x.id) ? "checked" : ""} /> ${x.icon} ${esc(t(x.key))} <small>(${money(c.price)} ${c.per === "piece" ? "لكل قطعة" : "للطلب"})</small></label>`;
    }).join("");
    box.querySelectorAll("[data-extra]").forEach((cb) => cb.addEventListener("change", () => {
      if (cb.checked) draftExtras.add(cb.dataset.extra); else draftExtras.delete(cb.dataset.extra);
      updateSummary();
    }));
  }

  let activeCatFilter = "all";
  function renderProductGrid() {
    const grid = document.getElementById("posProductGrid");
    const q = (document.getElementById("posProductSearch")?.value || "").trim().toLowerCase();
    const items = activeGarments().filter((g) => {
      const name = g.key ? t(g.key) : g.name;
      const matchesCat = activeCatFilter === "all" || g.cat === activeCatFilter;
      const matchesSearch = !q || name.toLowerCase().includes(q);
      // صنف بلا أي سعر لخدمة مفعّلة لا يظهر في شاشة الطلب (لا يمكن بيعه)
      const priced = SERVICES_DEFAULT.some((sv) => offerPrice(g.id, sv.id) > 0);
      return matchesCat && matchesSearch && priced;
    });
    if (items.length === 0) {
      grid.innerHTML = `<div class="empty-state compact" style="grid-column:1/-1">${t("empty_no_data")}</div>`;
      return;
    }
    grid.innerHTML = items.map((g) => {
      const name = g.key ? t(g.key) : g.name;
      const prices = SERVICES_DEFAULT.map((s) => offerPrice(g.id, s.id)).filter((p) => p > 0);
      const minPrice = prices.length ? Math.min(...prices) : 0;
      const inCartQty = draftItems.filter((it) => it.clothingId === g.id && !it.fromPackageId).reduce((s, it) => s + it.qty, 0);
      return `<button type="button" class="pos-tile" data-cloth="${g.id}">
        ${inCartQty > 0 ? `<span class="pos-tile-qty-badge">${inCartQty}</span>` : ""}
        <span class="pos-tile-icon">${gIcon(g.id, 40)}</span>
        <span class="pos-tile-name">${name}</span>
        <span class="pos-tile-price">من ${money(minPrice)}</span>
        <span type="button" class="pos-tile-other-service" data-other-service="${g.id}">خدمة أخرى</span>
      </button>`;
    }).join("");
    grid.querySelectorAll("[data-cloth]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        if (e.target.closest("[data-other-service]")) return;
        quickTapAdd(btn.dataset.cloth);
      });
    });
    grid.querySelectorAll("[data-other-service]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        openQuickAdd(el.dataset.otherService);
      });
    });
  }
  document.querySelectorAll(".pos-cat-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeCatFilter = btn.dataset.cat;
      document.querySelectorAll(".pos-cat-tab").forEach((b) => b.classList.toggle("active", b === btn));
      renderProductGrid();
    });
  });
  document.getElementById("posProductSearch").addEventListener("input", renderProductGrid);

  function renderNewOrderPage() {
    activeCatFilter = "all";
    document.querySelectorAll(".pos-cat-tab").forEach((b) => b.classList.toggle("active", b.dataset.cat === "all"));
    document.getElementById("posProductSearch").value = "";
    renderProductGrid();

    const empSel = document.getElementById("orderEmployeeSelect");
    if (empSel && window.L997Enterprise) {
      const emps = window.L997Enterprise.data.employees.filter((e) => e.active !== false);
      empSel.innerHTML = `<option value="">— بدون تحديد —</option>` + emps.map((e) => `<option value="${e.id}">${esc(e.name)}</option>`).join("");
    }

    if (draftCustomerId) {
      const cust = customers.find((c) => c.id === draftCustomerId);
      if (cust) selectCustomerForOrder(cust, true);
    }
    renderOrderItemsTable();
    updateSummary();
  }

  function priceFor(clothingId, serviceId) { return settings.prices[`${clothingId}_${serviceId}`] || 0; }
  // سعر الاستعجال للقطعة (غسيل وكي) من قائمة الأسعار: فارغ = ضعف السعر (النسبة في الإعدادات)، 0 = لا خدمة مستعجلة لهذا الصنف
  function urgentFixed(clothingId) { const v = settings.urgentPrices && settings.urgentPrices[clothingId]; return v === undefined || v === null || v === "" ? null : Number(v); }
  const urgentBlocked = (it) => urgentFixed(it.clothingId) === 0;
  // رسوم الاستعجال: سعر الاستعجال المحدد للصنف (غسيل وكي) − السعر العادي، وإلا النسبة من الإعدادات. قطع الباقات بدون رسوم
  // قطع مستعجلة داخل الطلب: إذا حُددت قطع بعينها (⚡ على السطر) فالرسوم عليها فقط؛ الطلبات القديمة بدون تحديد = كل القطع
  const lineUrgent = (items, it) => ((items || []).some((x) => x.urgent === true) ? it.urgent === true : true);
  function urgentFeeOf(items) {
    let pct = 0, fixed = 0;
    (items || []).forEach((it) => {
      if (!lineUrgent(items, it) || it.fromPackageId || !(Number(it.total) > 0) || urgentBlocked(it)) return;
      const f = it.serviceId === "washiron" ? urgentFixed(it.clothingId) : null;
      if (f !== null && f > 0) fixed += Math.max(0, f * it.qty - it.total); else pct += Number(it.total) || 0;
    });
    return round3(round3((pct * settings.urgentPercent) / 100) + fixed);
  }
  // خدمة مفعّلة للطلبات الجديدة؟ (الإعدادات). الغسيل فقط مطفأ افتراضياً — أسعاره تبقى محفوظة
  function svcOn(serviceId) { const m = settings.serviceActive || {}; return m[serviceId] !== undefined ? m[serviceId] !== false : serviceId !== "wash"; }
  // السعر المعروض للطلبات الجديدة: صفر إن كانت الخدمة مطفأة (لا يمس الطلبات المحفوظة ولا الباقات المباعة)
  function offerPrice(clothingId, serviceId) { return svcOn(serviceId) ? priceFor(clothingId, serviceId) : 0; }

  /* -------------------------- نافذة الإضافة السريعة -------------------------- */
  const quickAddDialog = document.getElementById("quickAddDialog");
  let quickAddUsePackage = false;
  function updateQuickAddPackageNotice() {
    const notice = document.getElementById("quickAddPackageNotice");
    if (!draftCustomerId || !quickAddServiceId) { notice.innerHTML = ""; quickAddUsePackage = false; return; }
    const match = activePackagesForCustomer(draftCustomerId).find((cp) => pkgFits(cp, quickAddClothingId, quickAddServiceId));
    if (!match) { notice.innerHTML = ""; quickAddUsePackage = false; return; }
    quickAddUsePackage = true;
    notice.innerHTML = `<label class="package-notice"><input type="checkbox" id="quickAddPackageCheckbox" checked />
      خصم من باقة «${esc(match.name)}»${pkgWLabel(pkgWeightFor(match, quickAddClothingId, quickAddServiceId))} — متبقي ${Math.max(0, pkgLeftInDraft(match))} من ${match.totalPieces} قطعة</label>`;
    document.getElementById("quickAddPackageCheckbox").addEventListener("change", (e) => { quickAddUsePackage = e.target.checked; });
  }

  // القطع المتبقية بالباقة بعد احتساب ما في السلة الحالية
  function pkgLeftInDraft(cp) {
    return cp.remainingPieces - draftItems.filter((it) => it.fromPackageId === cp.id).reduce((s, it) => s + pkgUnits(it), 0);
  }
  // كم قطعة من رصيد الباقة تساوي قطعة واحدة من هذا الصنف بهذه الخدمة (عباية = 2، لحاف = 5 …؛ 0 = خارج الباقات)
  function pkgWeight(clothingId, serviceId) {
    const w = (settings.packageWeights || PACKAGE_WEIGHTS_997)[clothingId];
    if (w === undefined || w === null) return pkgWeightByName(clothingId, serviceId);
    if (typeof w === "number") return Math.max(0, Math.floor(w));
    const v = w[serviceId] !== undefined ? w[serviceId] : w.washiron;
    return v === undefined || v === null || v === "" ? 1 : Math.max(0, Math.floor(Number(v) || 0));
  }
  // أصناف أضافها المالك بنفسه (معرّف عشوائي): تُعرف من الاسم — ستارة/أحذية خارج الباقات، عباية/جلابية 2، لحاف 5، شرشف دبل 4
  function pkgWeightByName(clothingId, serviceId) {
    const g = customGarments.find((x) => x.id === clothingId);
    if (!g) return 1;
    const n = String(g.name || "") + " " + String(g.nameEn || "");
    if (/ستار|ستائر|برادي|curtain|حذا|احذي|أحذي|جوت|shoe|sneaker|boot/i.test(n)) return 0;
    const iron = serviceId === "iron";
    if (/لحاف|comforter|duvet|quilt/i.test(n)) return iron ? 2 : 5;
    if (/شرشف\s*(دبل|مزدوج)|double\s*(bed)?\s*sheet/i.test(n)) return iron ? 2 : 4;
    if (/عباي|عباء|abaya|جلابي|jalab/i.test(n)) return 2;
    return 1;
  }
  // القطع المستهلكة من الباقة لبند في الطلب (الوزن محفوظ بالبند وقت الإضافة — تغيير الأوزان لاحقاً لا يمس الطلبات القديمة)
  const pkgDedicated = (cp, clothingId) => Array.isArray(cp && cp.garments) && cp.garments.length > 0 && cp.garments.length <= 3 && cp.garments.includes(clothingId);
  function pkgWeightFor(cp, clothingId, serviceId) { return pkgDedicated(cp, clothingId) ? 1 : pkgWeight(clothingId, serviceId); }
  function pkgUnits(it) { return (Number(it.qty) || 0) * (it.pkgW > 0 ? it.pkgW : 1); }
  // قيمة بند الباقة بالسعر العادي (للعرض والحساب فقط — لا تُحصَّل من العميل): السعر المحفوظ وقت الإضافة، وإلا السعر الحالي
  function pkgLineValue(it) { const u = Number(it.listUnit) > 0 ? Number(it.listUnit) : priceFor(it.clothingId, it.serviceId); return round3(u * (Number(it.qty) || 0)); }
  // قيمتها من سعر الباقة المدفوع مقدماً: (سعر الباقة ÷ عدد قطعها) × القطع المخصومة
  function pkgLineCost(it) { const cp = customerPackages.find((p) => p.id === it.fromPackageId); return cp && cp.totalPieces > 0 ? round3((Number(cp.price) || 0) / cp.totalPieces * pkgUnits(it)) : 0; }
  function pkgSummary(items) {
    const pk = (items || []).filter((it) => it.fromPackageId);
    return { n: pk.length, pieces: pk.reduce((a, it) => a + pkgUnits(it), 0), value: round3(pk.reduce((a, it) => a + pkgLineValue(it), 0)), cost: round3(pk.reduce((a, it) => a + pkgLineCost(it), 0)) };
  }
  const pkgWLabel = (w) => (w > 1 ? (lang === "en" ? ` (each = ${w} pcs)` : ` (القطعة = ${w})`) : "");
  // الباقة تغطي الصنف والخدمة، وفيها رصيد كافٍ لقطعة واحدة على الأقل بوزنها
  function pkgFits(cp, clothingId, serviceId) {
    const w = pkgWeightFor(cp, clothingId, serviceId);
    return w > 0 && pkgCovers(cp, clothingId, serviceId) && pkgLeftInDraft(cp) >= w;
  }
  // باقة العميل المناسبة لهذا الصنف: خدمة الباقة متاحة له ولا تزال فيها قطع
  function packageForGarment(clothingId) {
    if (!draftCustomerId) return null;
    return activePackagesForCustomer(draftCustomerId).find((cp) => priceFor(clothingId, cp.serviceType) > 0 && pkgFits(cp, clothingId, cp.serviceType)) || null;
  }
  // هل تغطي الباقة هذا الصنف وهذه الخدمة؟ (قائمة ملابس فارغة = كل الأصناف)
  function pkgCovers(cp, clothingId, serviceId) {
    return cp.serviceType === serviceId && (!Array.isArray(cp.garments) || cp.garments.length === 0 || cp.garments.includes(clothingId));
  }
  function garmentsLabel(list, max) {
    if (!Array.isArray(list) || list.length === 0) return lang === "en" ? "All garments" : "كل الأصناف";
    const names = list.map(clothingName);
    return max && names.length > max ? names.slice(0, max).join("، ") + ` (+${names.length - max})` : names.join("، ");
  }
  function defaultServiceFor(clothingId) {
    if (offerPrice(clothingId, "washiron") > 0) return "washiron";
    const found = SERVICES_DEFAULT.find((s) => offerPrice(clothingId, s.id) > 0);
    return found ? found.id : null;
  }
  function quickTapAdd(clothingId) {
    // إن كان للعميل باقة تغطي هذا الصنف تُستخدم خدمة الباقة تلقائياً (مثلاً باقة كوي)
    const pkgFirst = packageForGarment(clothingId);
    const svc = pkgFirst ? pkgFirst.serviceType : defaultServiceFor(clothingId);
    if (!svc) { toast("لا توجد خدمة متاحة لهذا الصنف"); return; }
    // تحقق أولاً من وجود باقة نشطة للعميل تغطي هذه الخدمة تحديداً — قبل تحصيل السعر الكامل
    const activePkg = draftCustomerId ? activePackagesForCustomer(draftCustomerId).find((cp) => pkgFits(cp, clothingId, svc)) : null;
    if (activePkg) {
      const w = pkgWeightFor(activePkg, clothingId, svc);
      const existingPkgItem = draftItems.find((it) => it.clothingId === clothingId && it.serviceId === svc && it.fromPackageId === activePkg.id && (it.pkgW || 1) === w);
      if (existingPkgItem) existingPkgItem.qty += 1;
      else draftItems.push({ id: uid(), clothingId, serviceId: svc, qty: 1, unit: 0, total: 0, listUnit: priceFor(clothingId, svc), note: "", fromPackageId: activePkg.id, packageName: activePkg.name, pkgW: w });
      const left = pkgLeftInDraft(activePkg);
      toast(left > 0 ? `من باقة «${activePkg.name}»${pkgWLabel(w)} — متبقي ${left} قطعة` : `آخر قطعة في باقة «${activePkg.name}» — القطع التالية بالسعر العادي`);
      renderOrderItemsTable();
      updateSummary();
      renderProductGrid();
      return;
    }
    if (draftCustomerId) {
      const cov = activePackagesForCustomer(draftCustomerId).find((cp) => pkgCovers(cp, clothingId, svc)), w0 = cov ? pkgWeightFor(cov, clothingId, svc) : pkgWeight(clothingId, svc);
      if (cov && w0 === 0) toast(`«${clothingName(clothingId)}» خارج نظام الباقات — يُحسب بالسعر العادي`);
      else if (cov && pkgLeftInDraft(cov) < w0) toast(`رصيد باقة «${cov.name}» (${Math.max(0, pkgLeftInDraft(cov))}) لا يكفي لـ«${clothingName(clothingId)}» (= ${w0} قطع) — بالسعر العادي`);
    }
    const existing = draftItems.find((it) => it.clothingId === clothingId && it.serviceId === svc && !it.fromPackageId && !it.note);
    if (existing) {
      existing.qty += 1;
      existing.total = round3(existing.unit * existing.qty);
    } else {
      const unit = priceFor(clothingId, svc);
      draftItems.push({ id: uid(), clothingId, serviceId: svc, qty: 1, unit, total: round3(unit), note: "" });
    }
    renderOrderItemsTable();
    updateSummary();
    renderProductGrid();
  }

  function openQuickAdd(clothingId) {
    quickAddClothingId = clothingId;
    quickQty = 1;
    document.getElementById("quickQtyValue").textContent = "1";
    document.getElementById("quickAddNote").value = "";
    const g = allGarments().find((x) => x.id === clothingId);
    document.getElementById("quickAddTitle").innerHTML = `<span class="qa-icon">${gIcon(clothingId, 30)}</span> ${esc(g ? (g.key ? t(g.key) : g.name) : clothingId)}`;

    const wrap = document.getElementById("quickAddServices");
    const availableServices = SERVICES_DEFAULT.filter((s) => offerPrice(clothingId, s.id) > 0);
    wrap.innerHTML = availableServices.map((s) => {
      const price = priceFor(clothingId, s.id);
      return `<button type="button" class="quick-add-service-chip" data-service="${s.id}">${t(s.key)}<small>${money(price)}</small></button>`;
    }).join("");
    wrap.querySelectorAll("[data-service]").forEach((btn) => {
      btn.addEventListener("click", () => {
        quickAddServiceId = btn.dataset.service;
        wrap.querySelectorAll(".quick-add-service-chip").forEach((b) => b.classList.toggle("active", b.dataset.service === quickAddServiceId));
        updateQuickAddPackageNotice();
      });
    });
    quickAddServiceId = availableServices.length ? availableServices[0].id : null;
    wrap.querySelector(`[data-service="${quickAddServiceId}"]`)?.classList.add("active");
    updateQuickAddPackageNotice();

    quickAddDialog.showModal();
  }
  document.getElementById("closeQuickAddDialog").addEventListener("click", () => quickAddDialog.close());
  document.getElementById("quickQtyMinus").addEventListener("click", () => {
    quickQty = Math.max(1, quickQty - 1);
    document.getElementById("quickQtyValue").textContent = quickQty;
  });
  document.getElementById("quickQtyPlus").addEventListener("click", () => {
    quickQty += 1;
    document.getElementById("quickQtyValue").textContent = quickQty;
  });
  document.getElementById("confirmQuickAddBtn").addEventListener("click", () => {
    const note = document.getElementById("quickAddNote").value.trim();
    let usedPackage = null;
    if (quickAddUsePackage) {
      usedPackage = activePackagesForCustomer(draftCustomerId).find((cp) => pkgFits(cp, quickAddClothingId, quickAddServiceId));
    }
    const qw = (usedPackage ? pkgWeightFor(usedPackage, quickAddClothingId, quickAddServiceId) : pkgWeight(quickAddClothingId, quickAddServiceId)) || 1;
    const left = usedPackage ? Math.max(0, pkgLeftInDraft(usedPackage)) : 0;
    const fromPkg = Math.min(Math.floor(left / qw), quickQty), paidQty = quickQty - fromPkg;
    if (fromPkg > 0) draftItems.push({ id: uid(), clothingId: quickAddClothingId, serviceId: quickAddServiceId, qty: fromPkg, unit: 0, total: 0, listUnit: priceFor(quickAddClothingId, quickAddServiceId), note, fromPackageId: usedPackage.id, packageName: usedPackage.name, pkgW: qw });
    if (paidQty > 0) {
      const unit = priceFor(quickAddClothingId, quickAddServiceId);
      draftItems.push({ id: uid(), clothingId: quickAddClothingId, serviceId: quickAddServiceId, qty: paidQty, unit, total: round3(unit * paidQty), note });
    }
    if (usedPackage && paidQty > 0) toast(`الباقة «${usedPackage.name}» غطّت ${fromPkg} قطعة فقط — ${paidQty} قطعة بالسعر العادي`);
    else if (fromPkg > 0) toast(`تمت الإضافة من باقة «${usedPackage.name}» — متبقي ${pkgLeftInDraft(usedPackage)} قطعة`);
    else { const g2 = allGarments().find((g) => g.id === quickAddClothingId); toast(`تمت إضافة ${g2 ? (g2.key ? t(g2.key) : g2.name) : ""} للسلة`); }
    quickAddDialog.close();
    renderOrderItemsTable();
    updateSummary();
    renderProductGrid();
  });

  // ⚡ لكل سطر: «الطلب كله مستعجل» يضع ⚡ على كل القطع (والجديدة)، أو اختر القطع المستعجلة واحدة واحدة
  let draftUrgentAll = false;
  function syncDraftPriority() {
    draftItems.forEach((it) => { if (it.urgent === undefined) it.urgent = draftUrgentAll && !urgentBlocked(it); if (urgentBlocked(it)) it.urgent = false; });
    const can0 = draftItems.filter((it) => !urgentBlocked(it)), on = draftItems.filter((it) => it.urgent);
    const tg = document.getElementById("orderPriorityToggle");
    document.getElementById("orderPriority").value = on.length ? "urgent" : "normal";
    if (tg) { tg.checked = draftItems.length ? on.length > 0 && on.length === can0.length : draftUrgentAll; tg.indeterminate = on.length > 0 && on.length < can0.length; }
    const hint = document.getElementById("posUrgentHint");
    if (hint) hint.textContent = on.length && on.length < draftItems.length ? `⚡ ${on.reduce((a, it) => a + it.qty, 0)} ${lang === "en" ? "urgent pieces" : "قطعة مستعجلة"} · ${draftItems.filter((it) => !it.urgent).reduce((a, it) => a + it.qty, 0)} ${lang === "en" ? "normal" : "عادية"}` : "";
  }
  function renderOrderItemsTable() {
    syncDraftPriority();
    const body = document.getElementById("orderItemsBody");
    const countLabel = document.getElementById("posCartCount");
    if (draftItems.length === 0) {
      body.innerHTML = `<div class="empty-state compact">${t("empty_no_items")}</div>`;
      if (countLabel) countLabel.textContent = "لا توجد قطع مضافة بعد";
      return;
    }
    if (countLabel) countLabel.textContent = `${draftItems.length} صنف — ${draftItems.reduce((s, it) => s + it.qty, 0)} قطعة`;
    body.innerHTML = draftItems.map((it) => `
      <div class="pos-cart-row">
        <span class="cart-icon">${gIcon(it.clothingId, 28)}</span>
        <div class="pos-cart-row-info">
          <div class="pos-cart-row-title">${clothingName(it.clothingId)}</div>
          <div class="pos-cart-row-sub">
            ${it.fromPackageId
              ? `<span style="color:var(--success);font-weight:800">🎟 من الباقة (${esc(it.packageName)})${pkgWLabel(it.pkgW || 1)}${(() => { const cp = customerPackages.find((p) => p.id === it.fromPackageId); return cp ? ` — متبقي ${Math.max(0, pkgLeftInDraft(cp))}` : ""; })()}</span> · <span class="inv-muted">${lang === "en" ? "value" : "قيمتها"} ${money(pkgLineValue(it))}</span>`
              : `<select class="pos-cart-row-service-select" data-service-change="${it.id}">
                  ${SERVICES_DEFAULT.filter((s) => offerPrice(it.clothingId, s.id) > 0 || s.id === it.serviceId).map((s) => `<option value="${s.id}" ${s.id === it.serviceId ? "selected" : ""}>${t(s.key)}</option>`).join("")}
                </select> · ${money(it.unit)} × ${it.qty}`}
            ${it.note ? " · " + esc(it.note) : ""}
          </div>
        </div>
        <div class="pos-qty-mini">
          <button type="button" data-qty-minus="${it.id}">−</button>
          <strong>${it.qty}</strong>
          <button type="button" data-qty-plus="${it.id}">＋</button>
        </div>
        <div class="pos-cart-row-price">${money(it.total)}</div>
        <button type="button" class="pos-urgent-chip ${it.urgent ? "on" : ""}" data-urgent-line="${it.id}" ${urgentBlocked(it) ? `disabled title="${lang === "en" ? "No urgent service for this item" : "لا توجد خدمة مستعجلة لهذا الصنف"}"` : `title="${lang === "en" ? "Urgent" : "مستعجل"}"`}>⚡</button>
        <button type="button" class="pos-cart-remove" data-remove="${it.id}">✕</button>
      </div>`).join("");
    body.querySelectorAll("[data-urgent-line]").forEach((b) => (b.onclick = () => {
      const it = draftItems.find((x) => x.id === b.dataset.urgentLine); if (!it || urgentBlocked(it)) return;
      it.urgent = !it.urgent; draftUrgentAll = false;
      renderOrderItemsTable(); updateSummary();
    }));
    body.querySelectorAll("[data-service-change]").forEach((sel) => {
      sel.addEventListener("change", () => {
        const it = draftItems.find((x) => x.id === sel.dataset.serviceChange);
        if (!it) return;
        it.serviceId = sel.value;
        it.unit = priceFor(it.clothingId, it.serviceId);
        it.total = round3(it.unit * it.qty);
        renderOrderItemsTable();
        updateSummary();
      });
    });
    body.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", () => {
        draftItems = draftItems.filter((it) => it.id !== btn.dataset.remove);
        renderOrderItemsTable();
        updateSummary();
        renderProductGrid();
      });
    });
    body.querySelectorAll("[data-qty-plus]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const it = draftItems.find((x) => x.id === btn.dataset.qtyPlus);
        if (!it) return;
        if (it.fromPackageId) {
          const cp = customerPackages.find((p) => p.id === it.fromPackageId);
          const usedInCart = draftItems.filter((x) => x.fromPackageId === it.fromPackageId).reduce((s, x) => s + pkgUnits(x), 0);
          if (cp && usedInCart + (it.pkgW || 1) > cp.remainingPieces) {
            toast(`لا يمكن تجاوز القطع المتبقية بالباقة «${cp.name}» (${cp.remainingPieces} قطعة)`);
            return;
          }
        }
        it.qty += 1; it.total = round3(it.unit * it.qty);
        renderOrderItemsTable(); updateSummary(); renderProductGrid();
      });
    });
    body.querySelectorAll("[data-qty-minus]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const it = draftItems.find((x) => x.id === btn.dataset.qtyMinus);
        if (!it) return;
        if (it.qty <= 1) { draftItems = draftItems.filter((x) => x.id !== it.id); }
        else { it.qty -= 1; it.total = round3(it.unit * it.qty); }
        renderOrderItemsTable(); updateSummary(); renderProductGrid();
      });
    });
  }

  // سقف الخصم: المالك بلا سقف، وغيره بنسبة محددة من سياسات الأمان
  // أكواد الخصم (الإعدادات ← الباقات): حروف إنجليزية وأرقام، بنسبة يحددها المالك/المدير — لا تحتاج موافقة مشرف
  const normDiscCode = (v) => toLatinDigits(String(v || "")).toUpperCase().replace(/\s+/g, "");
  const CODE_RE = /^[A-Z0-9]{3,20}$/;
  let draftCode = null; // { code, type, percent, piecePrice }
  function findCode(v) { const c = normDiscCode(v); return (settings.discountCodes || []).find((x) => x.code === c) || null; }
  // كود خاص: يعمل فقط للعملاء الذين حددهم المالك؛ كود عام (scope ≠ customers): لكل العملاء
  const codeRestricted = (c) => c && c.scope === "customers";
  function codeAllowed(c, custId) { return !codeRestricted(c) || (!!custId && (c.customerIds || []).includes(custId)); }
  function codesForCustomer(custId) { return (settings.discountCodes || []).filter((c) => codeProblem(c) === "" && codeRestricted(c) && (c.customerIds || []).includes(custId)); }
  // صلاحية الكود: تاريخ انتهاء اختياري (فارغ = دائم) وعدد استخدامات أقصى اختياري (0 = بلا حد)
  const codeUses = (code) => orders.filter((o) => o.discountCode === code && o.status !== "cancelled").length;
  function codeProblem(c) {
    if (!c) return "missing";
    if (c.active === false) return "off";
    if (c.expiresAt && c.expiresAt < todayStr()) return "expired";
    if (Number(c.maxUses) > 0 && codeUses(c.code) >= Number(c.maxUses)) return "used_up";
    return "";
  }
  function codeLimitsText(c) {
    const parts = [];
    parts.push(c.expiresAt ? (lang === "ar" ? `حتى ${c.expiresAt}` : `until ${c.expiresAt}`) : (lang === "ar" ? "♾ دائم" : "♾ no expiry"));
    if (Number(c.maxUses) > 0) parts.push(lang === "ar" ? `${codeUses(c.code)}/${c.maxUses} استخدام` : `${codeUses(c.code)}/${c.maxUses} uses`);
    return parts.join(" · ");
  }
  // وصف الكود: «خصم 45%» أو «سعر القطعة 0.300» أو «الطلب مجاني»
  function codeDesc(c) {
    if (!c) return "";
    if (c.type === "piece") return lang === "en" ? `piece price ${money(c.piecePrice)}` : `سعر القطعة ${money(c.piecePrice)}`;
    if (Number(c.percent) >= 100) return lang === "en" ? "free order (100%)" : "الطلب مجاني (100%)";
    return lang === "en" ? `${c.percent}% off` : `خصم ${c.percent}%`;
  }
  // خصم الكود على السلة: نسبة من (القطع + الإضافات + الاستعجال)، أو سعر موحّد للقطعة (لا يرفع سعر قطعة أرخص، ولا يمس قطع الباقات)
  function codeDiscountOf(c, codeBase) {
    if (!c) return 0;
    if (c.type === "piece") {
      const pp = Math.max(0, Number(c.piecePrice) || 0);
      return round3(draftItems.reduce((s2, it) => (it.fromPackageId ? s2 : s2 + Math.max(0, (Number(it.unit) || 0) - pp) * it.qty), 0));
    }
    return round3((codeBase * (Number(c.percent) || 0)) / 100);
  }
  function discountCapAmount(base) { return role === "owner" ? base : round3((base * sec.maxDiscountPct) / 100); }
  // المجموع الأساسي = القطع + الإضافات؛ رسوم الاستعجال تُحسب على القطع فقط
  function draftBase() {
    const itemsTotal = round3(draftItems.reduce((s, it) => s + it.total, 0));
    const extras0 = extrasLines([...draftExtras], draftItems.reduce((n, it) => n + it.qty, 0));
    const extras = extras0.concat(deliveryQuote(draftCustomerId, draftDelivery, round3(itemsTotal + extrasTotalOf(extras0))).lines);
    const extrasTotal = extrasTotalOf(extras);
    const urgentFee = draftItems.some((it) => it.urgent) ? urgentFeeOf(draftItems) : 0;
    return { itemsTotal, extras, extrasTotal, subtotal: round3(itemsTotal + extrasTotal), urgentFee };
  }
  function currentTotals() {
    const { subtotal, urgentFee, extrasTotal } = draftBase();
    const codeBase = round3(subtotal + urgentFee);
    // كود الخصم يخصم من الغسيل فقط — رسوم التوصيل لا تُخصم، إلا كود 100% (الطلب كله مجاني)
    const dlvFee = extrasTotalOf(draftBase().extras.filter((l) => String(l.id).startsWith("dlv_")));
    const codeBase2 = draftCode && draftCode.type !== "piece" && Number(draftCode.percent) >= 100 ? codeBase : round3(codeBase - dlvFee);
    if (draftCode) document.getElementById("discountAmount").value = Math.min(codeBase, codeDiscountOf(draftCode, codeBase2)).toFixed(3);
    const rawDiscount = Number(document.getElementById("discountAmount").value) || 0;
    // خصم الكود حدّده المالك مسبقاً: لا يخضع لسقف الموظف (لكن لا يتجاوز قيمة الطلب)
    const discountCap = draftCode ? codeBase : discountCapAmount(codeBase);
    // الخصم لا يمكن أن يكون سالباً (يتحول لزيادة سعر مخفية) ولا يتجاوز قيمة الطلب
    const discount = round3(Math.min(Math.max(0, rawDiscount), discountCap));
    const preVatTotal = Math.max(0, round3(subtotal + urgentFee - discount));
    const vatPercent = Number(loadProfile().vatPercent) || 0;
    const vat = vatPercent > 0 ? round3(preVatTotal * vatPercent / 100) : 0;
    const total = round3(preVatTotal + vat);
    const paid = round3(Number(document.getElementById("paidAmount").value) || 0);
    const balanceUse = round3(Number(document.getElementById("balanceUse").value) || 0);
    const outstanding = round3(Math.max(0, total - paid - balanceUse));
    const discountField = document.getElementById("discountAmount");
    if (discountField) discountField.classList.toggle("input-clamped", rawDiscount !== discount);
    return { subtotal, extrasTotal, urgentFee, discount, vatPercent, vat, total, paid, balanceUse, outstanding };
  }

  // شريط ثابت أسفل شاشة الطلب على الجوال والتابلت: عدد القطع + الإجمالي + حفظ — بدون نزول للسلة
  function updatePosBar(t2) {
    let bar = document.getElementById("posStickyBar");
    const page = document.getElementById("page-new-order");
    if (!page) return;
    if (!bar) {
      bar = document.createElement("div"); bar.id = "posStickyBar"; bar.className = "pos-sticky-bar";
      bar.innerHTML = `<button type="button" class="pos-bar-cart" id="posBarCart"><span id="posBarPieces">0</span><small id="posBarLbl"></small></button><div class="pos-bar-total"><small id="posBarTotalLbl"></small><b id="posBarTotal"></b></div><button type="button" class="primary-btn" id="posBarSave"></button>`;
      page.appendChild(bar);
      bar.querySelector("#posBarCart").addEventListener("click", () => document.querySelector("#page-new-order .pos-cart")?.scrollIntoView({ behavior: "smooth", block: "start" }));
      bar.querySelector("#posBarSave").addEventListener("click", () => document.getElementById("posSaveOrderMainBtn").click());
    }
    const pieces = draftItems.reduce((n, it) => n + it.qty, 0), en = lang === "en";
    bar.hidden = pieces === 0;
    document.body.classList.toggle("pos-bar-on", pieces > 0);
    bar.querySelector("#posBarPieces").textContent = pieces;
    bar.querySelector("#posBarLbl").textContent = en ? "pcs · cart ↓" : "قطعة · السلة ↓";
    bar.querySelector("#posBarTotalLbl").textContent = en ? "Total" : "الإجمالي";
    bar.querySelector("#posBarTotal").textContent = money(t2.total);
    bar.querySelector("#posBarSave").textContent = en ? "✓ Save order" : "✓ حفظ الطلب";
  }
  function updateSummary() {
    const t2 = currentTotals();
    try { updatePosBar(t2); } catch (e) { /* ignore */ }
    try { updateDeliveryQuote(); } catch (e) { /* ignore */ }
    document.getElementById("summaryPieces").textContent = draftItems.reduce((s, it) => s + it.qty, 0);
    document.getElementById("summarySubtotal").textContent = money(t2.subtotal);
    document.getElementById("summaryUrgent").textContent = money(t2.urgentFee);
    const vatRow = document.getElementById("summaryVatRow");
    if (t2.vatPercent > 0) {
      vatRow.style.display = "";
      document.getElementById("summaryVatLabel").textContent = `ضريبة القيمة المضافة (${t2.vatPercent}%)`;
      document.getElementById("summaryVat").textContent = money(t2.vat);
    } else {
      vatRow.style.display = "none";
    }
    document.getElementById("summaryTotal").textContent = money(t2.total);
    const cust = customers.find((c) => c.id === draftCustomerId);
    document.getElementById("summaryBalance").textContent = money(cust ? cust.balance : 0);
    document.getElementById("summaryOutstanding").textContent = money(t2.outstanding);
    const dr = document.getElementById("discountReasonRow");
    if (dr) dr.style.display = t2.discount > 0 && !draftCode ? "" : "none";
    const ci = document.getElementById("discountCodeInfo");
    const sugg = !draftCode && cust ? codesForCustomer(cust.id) : [];
    if (ci) {
      ci.style.display = draftCode || sugg.length ? "" : "none";
      if (draftCode) ci.innerHTML = `<span>✓ كود <b dir="ltr">${esc(draftCode.code)}</b> — ${esc(codeDesc(draftCode))}</span><button type="button" class="link-btn" id="removeCodeBtn">إزالة</button>`;
      else if (sugg.length) ci.innerHTML = `<span>🏷 لهذا العميل: ${sugg.map((c) => `<button type="button" class="mini-btn" data-use-code="${esc(c.code)}"><b dir="ltr">${esc(c.code)}</b> · ${esc(codeDesc(c))}</button>`).join(" ")}</span>`;
      ci.querySelectorAll("[data-use-code]").forEach((b) => (b.onclick = () => { const inp = document.getElementById("discountCode"); if (inp) inp.value = b.dataset.useCode; applyDiscountCode(); }));
    }
    const rc = document.getElementById("removeCodeBtn"); if (rc) rc.onclick = () => clearDraftCode(true);
    const da = document.getElementById("discountAmount"); if (da) da.readOnly = !!draftCode;
    const chk = document.getElementById("posChecklist");
    if (chk) {
      const hasC = !!cust, hasI = draftItems.length > 0;
      chk.innerHTML = `<span class="${hasC ? "ok" : ""}">${hasC ? "✓" : "①"} العميل</span><span class="${hasI ? "ok" : ""}">${hasI ? "✓" : "②"} القطع</span><span class="${hasC && hasI ? "ok" : ""}">${hasC && hasI ? "✓" : "③"} مراجعة وحفظ</span>`;
    }
  }
  document.getElementById("orderPriorityToggle").addEventListener("change", (e) => {
    draftUrgentAll = e.target.checked;
    draftItems.forEach((it) => { it.urgent = draftUrgentAll && !urgentBlocked(it); });
    const blocked = draftUrgentAll ? draftItems.filter(urgentBlocked) : [];
    if (blocked.length) toast(`${lang === "en" ? "No urgent service for" : "لا توجد خدمة مستعجلة لـ"}: ${[...new Set(blocked.map((it) => clothingName(it.clothingId)))].join("، ")}${blocked.length < draftItems.length ? (lang === "en" ? " — the other pieces are urgent" : " — بقية القطع صارت مستعجلة") : ""}`);
    renderOrderItemsTable(); updateSummary();
  });
  function clearDraftCode(notify) {
    draftCode = null;
    const inp = document.getElementById("discountCode"); if (inp) inp.value = "";
    document.getElementById("discountAmount").value = 0;
    if (notify) toast("أُزيل كود الخصم");
    updateSummary();
  }
  function applyDiscountCode() {
    const inp = document.getElementById("discountCode");
    const raw = normDiscCode(inp.value);
    if (!raw) { toast("اكتب كود الخصم"); inp.focus(); return; }
    const c = findCode(raw);
    if (!c) { toast(`الكود «${raw}» غير موجود`); logActivity(`محاولة كود خصم غير صحيح «${raw}»`); return; }
    if (c.active === false) { toast(`الكود «${raw}» غير مفعّل`); return; }
    if (codeProblem(c) === "expired") { toast(`الكود «${c.code}» انتهت صلاحيته في ${c.expiresAt}`); logActivity(`محاولة كود منتهي «${c.code}»`); return; }
    if (codeProblem(c) === "used_up") { toast(`الكود «${c.code}» استُخدم الحد الأقصى (${c.maxUses} مرة)`); return; }
    if (codeRestricted(c) && !draftCustomerId) { toast("هذا كود خاص بعملاء محددين — اختر العميل أولاً ثم طبّق الكود"); return; }
    if (!codeAllowed(c, draftCustomerId)) {
      const cn = (customers.find((x) => x.id === draftCustomerId) || {}).name || "";
      toast(`الكود «${c.code}» خاص بعملاء محددين — غير مسموح لـ ${cn}`);
      logActivity(`محاولة استخدام كود خاص «${c.code}» لعميل غير مسموح: ${cn}`);
      return;
    }
    draftCode = { code: c.code, type: c.type === "piece" ? "piece" : "percent", percent: Number(c.percent) || 0, piecePrice: Number(c.piecePrice) || 0 };
    inp.value = c.code;
    updateSummary();
    toast(`✓ تم تطبيق ${codeDesc(draftCode)}`);
  }
  document.getElementById("applyCodeBtn")?.addEventListener("click", applyDiscountCode);
  document.getElementById("discountCode")?.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); applyDiscountCode(); } });
  ["discountAmount", "paidAmount", "balanceUse"].forEach((id) => {
    document.getElementById(id).addEventListener("input", updateSummary);
    document.getElementById(id).addEventListener("change", updateSummary);
  });
  document.getElementById("discountAmount").addEventListener("change", (e) => {
    const raw = Number(e.target.value) || 0;
    const { subtotal, urgentFee } = draftBase();
    const cap = discountCapAmount(round3(subtotal + urgentFee));
    if (raw < 0) toast("لا يمكن أن يكون الخصم رقماً سالباً — تم تصحيحه إلى صفر");
    else if (raw > cap) toast(`الخصم أكبر من الحد المسموح (${role === "owner" ? "قيمة الطلب" : sec.maxDiscountPct + "% من قيمة الطلب"}) — تم تقييده عند ${money(cap)}`);
    else if (raw > 0 && !can("give_discount")) toast("الخصم يحتاج موافقة مشرف عند الحفظ");
  });

  function selectCustomerForOrder(cust, silent) {
    let converted = 0;
    draftItems.forEach((it) => {
      if (!it.fromPackageId) return;
      const cp = customerPackages.find((p) => p.id === it.fromPackageId);
      if (cp && cp.customerId === cust.id) return;
      delete it.fromPackageId; delete it.packageName;
      it.unit = priceFor(it.clothingId, it.serviceId); it.total = round3(it.unit * it.qty); converted += it.qty;
    });
    if (converted) { toast(`تم تغيير العميل — ${converted} قطعة كانت من باقة العميل السابق أصبحت بالسعر العادي`); renderOrderItemsTable(); }
    draftCustomerId = cust.id;
    if (draftCode && !codeAllowed(findCode(draftCode.code), cust.id)) { toast(`أُزيل الكود «${draftCode.code}» — خاص بعملاء آخرين`); clearDraftCode(false); }
    const expiredPk = customerPackages.filter((cp) => cp.customerId === cust.id && cp.remainingPieces > 0 && pkgExpired(cp));
    if (expiredPk.length && !activePackagesForCustomer(cust.id).length && !silent) toast(`⛔ باقة «${expiredPk[0].name}» منتهية الصلاحية منذ ${expiredPk[0].expiresAt} (متبقي ${expiredPk[0].remainingPieces} قطعة) — مددها من ملف العميل إن أردت`);
    if (!draftDelivery.address && (cust.address || cust.area)) draftDelivery.address = [cust.area, cust.address].filter(Boolean).join(" — ");
    // موعد استلام مفتوح لهذا العميل (من واتساب أو من المحل)؟ يُربط الطلب به تلقائياً — لا يتكرر الطلب ولا يبقى الموعد معلّقاً
    if (draftDelivery.reqId) { const r0 = suspendedOrders.find((x) => x.id === draftDelivery.reqId); if (!r0 || r0.customerId !== cust.id) { draftDelivery.reqId = null; draftDelivery.pickup = false; } }
    if (draftDelivery.noLink && draftDelivery.noLink !== cust.id) draftDelivery.noLink = null;
    const openReq = !draftDelivery.reqId && draftDelivery.noLink !== cust.id ? openPickupFor(cust.id) : null;
    if (openReq) {
      Object.assign(draftDelivery, { pickup: true, drop: openReq.drop !== false, address: openReq.address || draftDelivery.address, reqId: openReq.id });
      if (openReq.notes && !document.getElementById("orderNotes").value) document.getElementById("orderNotes").value = openReq.notes;
      if (!silent) toast(DL(`📥 ${cust.name} عنده موعد استلام ${openReq.source === "whatsapp" ? "من واتساب " : ""}(${whenLabel(openReq.date, openReq.slot)}) — رُبط هذا الطلب به حتى لا يتكرر`, `📥 ${cust.name} has a pickup booking${openReq.source === "whatsapp" ? " from WhatsApp" : ""} (${whenLabel(openReq.date, openReq.slot)}) — this order is linked to it so it isn't duplicated`));
    }
    renderPosDelivery();
    const card = document.getElementById("selectedCustomerCard");
    card.classList.remove("empty-state", "compact");
    card.innerHTML = `
      <div class="details-line"><span>${t("lbl_customer_name")}</span><strong>${esc(cust.name)}</strong></div>
      <div class="details-line"><span>${t("lbl_phone")}</span><strong><span dir="ltr">${esc(fmtPhone(cust.phone))}</span></strong></div>
      <div class="details-line"><span>${t("sum_balance")}</span><strong>${money(cust.balance)}</strong></div>`;
    const barText = document.getElementById("posCustomerBarText");
    barText.innerHTML = `${esc(cust.name)}<small><span dir="ltr">${esc(fmtPhone(cust.phone))}</span> · الرصيد: ${money(cust.balance)}</small>`;
    document.getElementById("posCustomerBarBtn").classList.add("has-customer");
    updateSummary();
    if (!silent) {
      toast(t("toast_customer_selected", cust.name));
      posCustomerDialog.close();
    }
  }

  const posCustomerDialog = document.getElementById("posCustomerDialog");
  function renderCustomerResults() {
    const input = document.getElementById("orderCustomerPhone");
    const box = document.getElementById("customerResults");
    const none = document.getElementById("customerSearchNoResult");
    const q = toLatinDigits(input.value).trim();
    const digits = q.replace(/\D/g, "").replace(/^973/, "");
    const lastOrder = {};
    orders.forEach((o) => { if (!lastOrder[o.customerId] || o.createdAt > lastOrder[o.customerId].createdAt) lastOrder[o.customerId] = o; });
    let list;
    if (!q) {
      list = customers.slice().sort((x, y) => ((lastOrder[y.id] || {}).createdAt || y.createdAt || "").localeCompare((lastOrder[x.id] || {}).createdAt || x.createdAt || "")).slice(0, 8);
    } else {
      const ql = q.toLowerCase();
      list = customers.filter((c) => c.name.toLowerCase().includes(ql) || phoneMatches(c.phone, q)).slice(0, 8);
    }
    const fmtPh = (p) => esc(fmtPhone(p));
    box.innerHTML = (!q && list.length ? `<div class="cust-results-title">${customers.length ? "آخر العملاء" : ""}</div>` : "") + list.map((c) => {
      const cnt = orders.filter((o) => o.customerId === c.id).length;
      const bal = Number(c.balance) || 0;
      return `<button type="button" class="cust-result" role="option" data-pick="${c.id}">
        <span class="cust-result-main"><b>${esc(c.name)}</b><small dir="ltr">${fmtPh(c.phone)}</small></span>
        <span class="cust-result-side">${bal !== 0 ? `<span class="cust-chip ${bal < 0 ? "debt" : "credit"}">${bal < 0 ? "عليه " + money(-bal) : "رصيد " + money(bal)}</span>` : ""}<small>${cnt} طلب</small></span>
      </button>`;
    }).join("");
    if (q && !list.length) {
      none.style.display = "flex";
      document.getElementById("customerNoResultText").textContent = `لا يوجد عميل مطابق «${q}»`;
    } else none.style.display = "none";
    if (!q && !customers.length) box.innerHTML = `<div class="empty-state compact">لا يوجد عملاء محفوظون بعد — أضف أول عميل بزر +</div>`;
  }
  function openPosCustomerPicker() {
    document.getElementById("orderCustomerPhone").value = "";
    renderCustomerResults();
    posCustomerDialog.showModal();
    setTimeout(() => document.getElementById("orderCustomerPhone").focus(), 50);
  }
  document.getElementById("posCustomerBarBtn").addEventListener("click", openPosCustomerPicker);
  document.getElementById("closePosCustomerDialog").addEventListener("click", () => posCustomerDialog.close());
  document.getElementById("orderCustomerPhone").addEventListener("input", renderCustomerResults);
  document.getElementById("orderCustomerPhone").addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") { ev.preventDefault(); const first = document.querySelector("#customerResults [data-pick]"); if (first) first.click(); }
  });
  document.getElementById("customerResults").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-pick]");
    if (!b) return;
    const c = customers.find((x) => x.id === b.dataset.pick);
    if (c) selectCustomerForOrder(c);
  });
  document.getElementById("newCustomerFromNoResultBtn").addEventListener("click", () => {
    pendingCustomerContext = "order";
    openCustomerDialog();
  });

  document.getElementById("newCustomerInlineBtn").addEventListener("click", () => {
    pendingCustomerContext = "order";
    openCustomerDialog();
  });

  function buildOrder(opts) {
    opts = opts || {};
    if (!draftCustomerId) { toast(t("toast_pick_customer")); return null; }
    if (draftItems.length === 0) { toast(t("toast_add_one_item")); return null; }
    // حماية الباقات: لا يُسمح باستهلاك أكثر من المتبقي، ولا باستخدام باقة عميل آخر (مثلاً طلب معلّق قديم)
    const pkgUse = {};
    draftItems.forEach((it) => { if (it.fromPackageId) pkgUse[it.fromPackageId] = (pkgUse[it.fromPackageId] || 0) + pkgUnits(it); });
    const uncovered = draftItems.find((it) => { if (!it.fromPackageId) return false; const cp = customerPackages.find((p) => p.id === it.fromPackageId); return cp && (!pkgCovers(cp, it.clothingId, it.serviceId) || pkgWeightFor(cp, it.clothingId, it.serviceId) === 0); });
    if (uncovered) { toast(`«${clothingName(uncovered.clothingId)}» غير مشمول بباقة «${uncovered.packageName || ""}» — احذفه من السلة وأضفه بالسعر العادي`); return null; }
    for (const [pid, qty] of Object.entries(pkgUse)) {
      const cp = customerPackages.find((p) => p.id === pid);
      if (!cp || cp.customerId !== draftCustomerId) { toast("قطع من باقة لا تخص هذا العميل — احذفها من السلة وأضفها من جديد"); return null; }
      if (qty > cp.remainingPieces) { toast(`باقة «${cp.name}» متبقي فيها ${cp.remainingPieces} قطعة فقط والسلة تستخدم ${qty} — قلّل الكمية`); return null; }
    }
    const tt = currentTotals();
    const now = new Date().toISOString();
    // نحسب رقم الطلب من أعلى رقم موجود فعلياً بالتخزين (مو فقط العداد الداخلي) لتفادي تصادم الأرقام
    // في حال وجود تبويب أو جهاز آخر أنشأ طلباً بنفس اللحظة تقريباً
    const storedOrders = load(KEYS.orders, []);
    const maxExistingNum = storedOrders.reduce((m, o) => Math.max(m, Number(o.number) || 0), 0);
    // مع السحابة: الرقم التالي بالتسلسل يُحجز من الخادم لحظة الحفظ؛ بدونه (لا إنترنت) الترقيم المحلي كما كان
    const cloudNum = opts.number || null;
    const nextSeq = cloudNum || Math.max(Number(settings.orderSeq) || 1, maxExistingNum + 1);
    const number = String(nextSeq).padStart(5, "0");
    settings.orderSeq = nextSeq;
    const empSelVal = document.getElementById("orderEmployeeSelect")?.value || null;
    // الدفع يُؤجَّل بالكامل لوقت التسليم — الطلب يُحفظ كـ"غير مدفوع" عند الإنشاء
    const order = {
      id: uid(), number, customerId: draftCustomerId,
      items: draftItems.map((it) => ({ ...it })),
      extras: draftBase().extras,
      delivery: draftDelivery.pickup || draftDelivery.drop ? { pickup: !!draftDelivery.pickup, drop: !!draftDelivery.drop, address: draftDelivery.address || "", date: draftDelivery.date || "", slot: draftDelivery.slot || "", dropStatus: draftDelivery.drop ? "pending" : undefined, reqId: draftDelivery.reqId || undefined } : undefined,
      priority: document.getElementById("orderPriority").value,
      expectedDelivery: document.getElementById("expectedDelivery").value || null,
      employeeId: empSelVal || null,
      notes: document.getElementById("orderNotes").value.trim(),
      status: "received",
      statusHistory: [{ status: "received", at: now }],
      payment: { method: "unpaid", ...tt, paid: 0, balanceUse: 0, outstanding: tt.total },
      paymentConfirmed: false,
      createdBy: me ? me.name : "", createdById: me ? me.id : "",
      discountReason: tt.discount > 0 ? (draftCode ? `كود خصم ${draftCode.code} (${draftCode.type === "piece" ? `سعر القطعة ${money(draftCode.piecePrice)}` : draftCode.percent + "%"})` : opts.discountReason || "") : "",
      discountCode: tt.discount > 0 && draftCode ? draftCode.code : undefined,
      discountPercent: tt.discount > 0 && draftCode && draftCode.type !== "piece" ? draftCode.percent : undefined,
      discountPiecePrice: tt.discount > 0 && draftCode && draftCode.type === "piece" ? draftCode.piecePrice : undefined,
      discountApprovedBy: tt.discount > 0 && opts.approver ? opts.approver.name : "",
      createdAt: now, readyAt: null, deliveredAt: null,
    };
    orders.unshift(order);
    settings.orderSeq += 1;

    // خصم القطع المستخدمة من الباقات الفعلية عند تثبيت الطلب
    order.items.forEach((it) => {
      if (!it.fromPackageId) return;
      const cp = customerPackages.find((p) => p.id === it.fromPackageId);
      if (cp) {
        cp.remainingPieces = Math.max(0, cp.remainingPieces - pkgUnits(it));
        logActivity(`خصم ${pkgUnits(it)} قطعة من باقة «${cp.name}»${(it.pkgW || 1) > 1 ? ` (${it.qty} ${clothingName(it.clothingId)} × ${it.pkgW})` : ""} — متبقي ${cp.remainingPieces}`);
      }
    });

    const cust = customers.find((c) => c.id === draftCustomerId);
    if (order.delivery) {
      if (cust && order.delivery.address && !cust.address) cust.address = order.delivery.address;
      if (order.delivery.reqId) {
        const r0 = suspendedOrders.find((x) => x.id === order.delivery.reqId);
        if (r0) Object.assign(order.delivery, { pickupDriver: r0.driver || "", pickupDriverId: r0.driverId || "", pickupAt: r0.collectedAt || r0.onwayAt || "", bags: r0.bags || undefined, source: r0.source || undefined });
        suspendedOrders = suspendedOrders.filter((x) => x.id !== order.delivery.reqId); save("l997_suspended_orders", suspendedOrders);
      }
      const dl = (order.extras || []).filter((l) => String(l.id).startsWith("dlv_"));
      logActivity(`🚚 الطلب #${number}: ${[order.delivery.pickup ? "استلام من البيت" : "", order.delivery.drop ? "توصيل للبيت" : ""].filter(Boolean).join(" + ")} — ${dl.map((l) => (l.free ? `مجاني (${l.free === "package" ? "ضمن الباقة" : "فوق الحد"})` : money(l.total))).join("، ")}`);
    }
    logActivity(`${t("toast_order_saved", number)} — ${cust ? cust.name : ""} — ${money(tt.total)}${tt.discount > 0 ? ` — خصم ${money(tt.discount)} (${opts.discountReason || ""})${opts.approver ? " اعتمده " + opts.approver.name : ""}` : ""}`);
    persistAll();
    return order;
  }

  let savingOrder = false;
  function saveCurrentOrder(andPrint) {
    if (!draftCustomerId) { toast(t("toast_pick_customer")); openPosCustomerPicker(); return; }
    if (draftItems.length === 0) { toast(t("toast_add_one_item")); return; }
    const noUrgent = draftItems.filter((it) => it.urgent && urgentBlocked(it));
    if (noUrgent.length) { toast(`الخدمة المستعجلة غير متوفرة لـ: ${[...new Set(noUrgent.map((it) => clothingName(it.clothingId)))].join("، ")} — اجعل الطلب عادياً أو افصل هذه القطع في طلب عادي`); return; }
    const tt = currentTotals();
    const reason = document.getElementById("discountReason").value.trim();
    const proceed = async (approver, overridden) => {
      if (savingOrder) return;
      savingOrder = true;
      let number = null;
      try {
        // مع السحابة: الرقم التالي بالتسلسل يأتي من الخادم لحظة الحفظ — لا يتكرر ولا يقفز بين الأجهزة
        if (cloudOn()) {
          number = await CLOUD.reserveNumber(orders.reduce((m, o) => Math.max(m, Number(o.number) || 0), 0) + 1);
          if (!number) toast(lang === "en" ? "No internet: local order number used — check for duplicates later" : "بدون إنترنت: رقم الطلب محلي — قد يتكرر مع جهاز آخر، راجعه لاحقاً");
        }
      } finally { savingOrder = false; }
      const order = buildOrder({ discountReason: reason, approver: overridden ? approver : null, number });
      if (!order) return;
      const cust = customers.find((c) => c.id === order.customerId);
      resetDraft();
      if (andPrint) printOrder(order.id);
      goOrders();
      showOrderSavedPrompt(order, cust);
    };
    if (tt.discount > 0 && draftCode) {
      const c = findCode(draftCode.code);
      if (!c || codeProblem(c)) { toast("كود الخصم لم يعد صالحاً (موقوف أو منتهي أو استُنفد) — أزله أو اكتب كوداً آخر"); return; }
      if (!codeAllowed(c, draftCustomerId)) { toast(`الكود «${c.code}» غير مسموح لهذا العميل — أزله`); return; }
      proceed(null, false);
    } else if (tt.discount > 0) {
      if (!reason) { toast("اكتب سبب الخصم (إلزامي)"); document.getElementById("discountReason").focus(); return; }
      requireOverride("give_discount", `خصم ${money(tt.discount)} على الطلب`, proceed);
    } else proceed(null, false);
  }
  document.getElementById("posSaveOrderMainBtn").addEventListener("click", () => saveCurrentOrder(false));
  document.getElementById("savePrintBtn").addEventListener("click", () => saveCurrentOrder(true));

  /* ---- رسائل واتساب في كل مرحلة: تأكيد الاستلام ← جاهزية ودفع ← تسليم ---- */

  /* ============================= رسائل واتساب للعملاء =============================
     صياغة ودية موحّدة بالعربية والإنجليزية والأردو — حسب لغة النظام المختارة */
  const piecesOf = (order) => order.items.reduce((n, it) => n + it.qty, 0);
  // صيغة العدد العربية الصحيحة: قطعة واحدة، قطعتان، 3–10 قطع، 11+ قطعة
  const arPcs = (k) => (k === 1 ? "قطعة واحدة" : k === 2 ? "قطعتان" : k >= 3 && k <= 10 ? `${k} قطع` : `${k} قطعة`);
  const SIGN = { ar: "فريق 997 Laundry 💙", en: "The 997 Laundry team 💙", ur: "997 Laundry ٹیم 💙" };
  const APP_LINK = "https://997-laundry.github.io/app/"; // customer app (orders, package, home pickup)
  function waMsg(kind, d) {
    const L = lang === "en" || lang === "ur" ? lang : "ar";
    const n = d.name || "";
    // الفاتورة بوضوح: قبل الخصم · الخصم · الإجمالي النهائي (في رسائل الاستلام والجاهزية والتسليم)
    const BILL = (L) => (d.covered || !d.total ? "" : L === "en"
      ? (d.before ? `💵 Before discount: ${d.before}\n🏷 Discount: −${d.discount}\n🧾 Final total: ${d.total}` : `🧾 Total: ${d.total}`)
      : L === "ur" ? (d.before ? `💵 رعایت سے پہلے: ${d.before}\n🏷 رعایت: −${d.discount}\n🧾 کل رقم: ${d.total}` : `🧾 کل رقم: ${d.total}`)
      : (d.before ? `💵 المبلغ قبل الخصم: ${d.before}\n🏷 قيمة الخصم: −${d.discount}\n🧾 الإجمالي بعد الخصم: ${d.total}` : `🧾 الإجمالي: ${d.total}`));
    const M = {
      received: {
        ar: () => `هلا والله ${n} 🌸\nاستلمنا ملابسك وهي الحين بين أيادٍ أمينة 🧺✨\n\n🧾 رقم الطلب: #${d.number}\n👕 عدد القطع: ${d.pieces}\n${d.covered ? "💰 قيمة الطلب: مغطاة بالكامل من الباقة 🎟" : BILL("ar")}${d.expected ? `\n⏰ موعد الجاهزية المتوقع: ${d.expected}` : ""}${d.urgent ? "\n⚡ طلبك مستعجل — بنخلصه لك بأسرع وقت" : ""}${d.pkg ? `\n🎟 ${d.pkg}` : ""}${d.dlv ? `\n🚚 ${d.dlv}` : ""}\n\nبنرسل لك رسالة أول ما يجهز إن شاء الله 😊\n📱 تابع طلبك وباقتك من تطبيقنا: ${APP_LINK}\n${SIGN.ar}`,
        en: () => `Hi ${n} 🌸\nWe've received your clothes — they're in safe hands 🧺✨\n\n🧾 Order: #${d.number}\n👕 Pieces: ${d.pieces}\n${d.covered ? "💰 Order value: fully covered by your package 🎟" : BILL("en")}${d.expected ? `\n⏰ Expected ready: ${d.expected}` : ""}${d.urgent ? "\n⚡ Urgent — we'll have it ready as fast as we can" : ""}${d.pkg ? `\n🎟 ${d.pkg}` : ""}${d.dlv ? `\n🚚 ${d.dlv}` : ""}\n\nWe'll message you as soon as it's ready 😊\n📱 Track your order in our app: ${APP_LINK}\n${SIGN.en}`,
        ur: () => `السلام علیکم ${n} 🌸\nآپ کے کپڑے ہمیں موصول ہو گئے ہیں — بالکل محفوظ ہاتھوں میں 🧺✨\n\n🧾 آرڈر نمبر: #${d.number}\n👕 قطعات: ${d.pieces}\n${d.covered ? "💰 آرڈر کی قیمت: مکمل طور پر پیکیج سے 🎟" : BILL("ur")}${d.expected ? `\n⏰ متوقع تیاری: ${d.expected}` : ""}${d.urgent ? "\n⚡ فوری آرڈر — جلد از جلد تیار کریں گے" : ""}${d.pkg ? `\n🎟 ${d.pkg}` : ""}\n\nتیار ہوتے ہی آپ کو پیغام بھیج دیں گے 😊\n${SIGN.ur}`,
      },
      ready: {
        ar: () => `بشارة حلوة يا ${n} 🎉\nطلبك رقم #${d.number} جاهز ومرتب بانتظارك 👔✨ (يلمع لين يحسبونه جديد 😄)\n\n👕 عدد القطع: ${d.pieces}\n${BILL("ar") ? BILL("ar") + "\n" : ""}${d.due > 0 ? `${d.paid > 0 ? `✅ المدفوع: ${d.paidTxt}\n📌 المتبقي: ${d.dueTxt}` : `💰 المبلغ المستحق: ${d.dueTxt}`}\n💳 الدفع نقداً أو بالبطاقة أو Benefit Pay عند الاستلام${bpLine("ar", d.number) ? `\n${bpLine("ar", d.number)}` : ""}${d.credit > 0 ? `\n💙 لك رصيد لدينا ${d.creditTxt} — نقدر نخصم منه` : ""}` : `✅ مدفوع بالكامل — ما عليك إلا تشرفنا وتستلم`}\n\n${d.dlv ? `🚚 بنوصله لبيتك قريباً، وبنبلغك أول ما يطلع المندوب 🛵` : "نتشرف بزيارتك في أي وقت — المحل مفتوح 24 ساعة 🕐"}\n${SIGN.ar}`,
        en: () => `Great news, ${n} 🎉\nYour order #${d.number} is ready and waiting for you 👔✨ (crisp enough to pass for brand new 😄)\n\n👕 Pieces: ${d.pieces}\n${BILL("en") ? BILL("en") + "\n" : ""}${d.due > 0 ? `${d.paid > 0 ? `✅ Paid: ${d.paidTxt}\n📌 Remaining: ${d.dueTxt}` : `💰 Amount due: ${d.dueTxt}`}\n💳 Pay by cash, card or Benefit Pay on pickup${bpLine("en", d.number) ? `\n${bpLine("en", d.number)}` : ""}${d.credit > 0 ? `\n💙 You have ${d.creditTxt} credit with us — we can use it` : ""}` : `✅ Fully paid — just drop by and collect`}\n\n${d.dlv ? "🚚 We'll deliver it to your home soon and let you know when the driver is on the way 🛵" : "Come by anytime — we're open 24 hours 🕐"}\n${SIGN.en}`,
        ur: () => `خوشخبری ${n} 🎉\nآپ کا آرڈر #${d.number} تیار ہے اور آپ کا منتظر ہے 👔✨\n\n👕 قطعات: ${d.pieces}\n${BILL("ur") ? BILL("ur") + "\n" : ""}${d.due > 0 ? `${d.paid > 0 ? `✅ ادا شدہ: ${d.paidTxt}\n📌 باقی: ${d.dueTxt}` : `💰 واجب الادا رقم: ${d.dueTxt}`}\n💳 وصولی پر نقد، کارڈ یا Benefit Pay سے ادائیگی کریں${d.credit > 0 ? `\n💙 آپ کا بیلنس ${d.creditTxt} ہے — اس سے کٹوتی ہو سکتی ہے` : ""}` : `✅ مکمل ادائیگی ہو چکی — بس تشریف لائیں اور وصول کریں`}\n\nکسی بھی وقت تشریف لائیں — ہم 24 گھنٹے کھلے ہیں 🕐\n${SIGN.ur}`,
      },
      delivered: {
        ar: () => `شكراً لك يا ${n} 💐\nتم تسليم طلبك رقم #${d.number} (${arPcs(d.pieces)}) — نتمنى إنها تعجبك وتكون عند حسن ظنك ✨${BILL("ar") ? `\n\n${BILL("ar")}` : ""}${!(d.owed > 0) && !(d.account > 0) ? "\n😎 الكوي علينا والكشخة عليك — وإذا عجبتك خدمتنا علّم ربعك عنّا 💙" : ""}${d.owed > 0 ? `\n\n📌 للتذكير: المتبقي على هذا الطلب ${d.owedTxt}` : ""}${d.account > 0 ? `\n📌 إجمالي المتبقي على حسابك: ${d.accountTxt}` : ""}${d.link ? `\n\n🧾 إيصال طلبك: ${d.link}` : ""}\n\nرأيك يهمنا، وإذا عندك أي ملاحظة لا تتردد تراسلنا 🌷\nننتظرك في طلبك الجاي 😊\n${SIGN.ar}`,
        en: () => `Thank you, ${n} 💐\nYour order #${d.number} (${d.pieces} pcs) has been handed over — we hope you love the result ✨${BILL("en") ? `\n\n${BILL("en")}` : ""}${!(d.owed > 0) && !(d.account > 0) ? "\n😎 We handle the wrinkles, you collect the compliments — if you liked us, tell a friend 💙" : ""}${d.owed > 0 ? `\n\n📌 Just a reminder: ${d.owedTxt} remains on this order` : ""}${d.account > 0 ? `\n📌 Total remaining on your account: ${d.accountTxt}` : ""}${d.link ? `\n\n🧾 Your receipt: ${d.link}` : ""}\n\nYour feedback means a lot — message us anytime 🌷\nSee you on your next visit 😊\n${SIGN.en}`,
        ur: () => `شکریہ ${n} 💐\nآپ کا آرڈر #${d.number} (${d.pieces} قطعات) حوالے کر دیا گیا — امید ہے آپ کو پسند آئے گا ✨${BILL("ur") ? `\n\n${BILL("ur")}` : ""}${d.owed > 0 ? `\n\n📌 یاد دہانی: اس آرڈر پر ${d.owedTxt} باقی ہیں` : ""}${d.account > 0 ? `\n📌 آپ کے اکاؤنٹ پر کل باقی: ${d.accountTxt}` : ""}${d.link ? `\n\n🧾 آپ کی رسید: ${d.link}` : ""}\n\nآپ کی رائے ہمارے لیے اہم ہے — کسی بھی وقت پیغام کریں 🌷\nاگلی بار پھر ملیں گے 😊\n${SIGN.ur}`,
      },
      balance: {
        ar: () => `هلا ${n} 👋\n${{ payment: `استلمنا دفعتك ${d.amount}${d.orderNo ? ` لطلب #${d.orderNo}` : ""} ✅ شكراً لك`, deposit: `تم إيداع ${d.amount} في رصيدك لدينا ✅`, refund: `تم استرداد ${d.amount} لك ✅`, debit: `تم خصم ${d.amount} من رصيدك${d.note ? ` (${d.note})` : ""}`, plus: `تمت إضافة ${d.amount} إلى رصيدك${d.note ? ` (${d.note})` : ""} ✅` }[d.kind]}\n💳 ${d.status}\n\nشكراً لثقتك فينا، ودايماً بخدمتك 🌷\n${SIGN.ar}`,
        en: () => `Hi ${n} 👋\n${{ payment: `We've received your payment of ${d.amount}${d.orderNo ? ` for order #${d.orderNo}` : ""} ✅ Thank you`, deposit: `${d.amount} has been deposited to your balance ✅`, refund: `${d.amount} has been refunded to you ✅`, debit: `${d.amount} has been deducted from your balance${d.note ? ` (${d.note})` : ""}`, plus: `${d.amount} has been added to your balance${d.note ? ` (${d.note})` : ""} ✅` }[d.kind]}\n💳 ${d.status}\n\nThank you for trusting us — always happy to help 🌷\n${SIGN.en}`,
        ur: () => `السلام علیکم ${n} 👋\n${{ payment: `آپ کی ادائیگی ${d.amount}${d.orderNo ? ` (آرڈر #${d.orderNo})` : ""} موصول ہو گئی ✅ شکریہ`, deposit: `آپ کے بیلنس میں ${d.amount} جمع کر دیے گئے ✅`, refund: `${d.amount} آپ کو واپس کر دیے گئے ✅`, debit: `آپ کے بیلنس سے ${d.amount} منہا کر دیے گئے${d.note ? ` (${d.note})` : ""}`, plus: `آپ کے بیلنس میں ${d.amount} شامل کر دیے گئے${d.note ? ` (${d.note})` : ""} ✅` }[d.kind]}\n💳 ${d.status}\n\nہم پر اعتماد کا شکریہ — ہمیشہ خدمت میں حاضر 🌷\n${SIGN.ur}`,
      },
      receipt: {
        ar: () => `هلا ${n} 🌸\nهذا إيصال طلبك رقم #${d.number}:\n🧾 ${d.link}\n\nتقدر تفتحه وتحفظه في أي وقت 😊\n${SIGN.ar}`,
        en: () => `Hi ${n} 🌸\nHere is the receipt for your order #${d.number}:\n🧾 ${d.link}\n\nOpen and save it anytime 😊\n${SIGN.en}`,
        ur: () => `السلام علیکم ${n} 🌸\nآپ کے آرڈر #${d.number} کی رسید:\n🧾 ${d.link}\n\nکسی بھی وقت کھول کر محفوظ کریں 😊\n${SIGN.ur}`,
      },
      pickup_booked: {
        ar: () => `هلا والله ${n} 🚚\nتم تأكيد موعد استلام ملابسك من البيت ✅\n\n📅 الموعد: ${d.when}\n📍 العنوان: ${d.address || "—"}\n💰 رسوم المشوار: ${d.fee}\n\nبنبلغك أول ما يطلع المندوب 🛵\n${SIGN.ar}`,
        en: () => `Hi ${n} 🚚\nYour home pickup is confirmed ✅\n\n📅 When: ${d.when}\n📍 Address: ${d.address || "—"}\n💰 Trip fee: ${d.fee}\n\nWe'll let you know when the driver is on the way 🛵\n${SIGN.en}`,
        ur: () => `السلام علیکم ${n} 🚚\nگھر سے کپڑے وصول کرنے کا وقت طے ہو گیا ✅\n\n📅 وقت: ${d.when}\n📍 پتہ: ${d.address || "—"}\n💰 فیس: ${d.fee}\n\nڈرائیور روانہ ہوتے ہی اطلاع دیں گے 🛵\n${SIGN.ur}`,
      },
      pickup_onway: {
        ar: () => `هلا ${n} 🛵\nالمندوب في الطريق لك الحين لاستلام ملابسك 🧺\n📍 ${d.address || ""}\n\nجهّز الملابس لو سمحت، وشكراً لك 🌷\n${SIGN.ar}`,
        en: () => `Hi ${n} 🛵\nOur driver is on the way now to collect your clothes 🧺\n📍 ${d.address || ""}\n\nPlease have them ready — thank you 🌷\n${SIGN.en}`,
        ur: () => `السلام علیکم ${n} 🛵\nہمارا ڈرائیور آپ کے کپڑے لینے کے لیے روانہ ہو چکا ہے 🧺\n📍 ${d.address || ""}\n\nبراہ کرم کپڑے تیار رکھیں — شکریہ 🌷\n${SIGN.ur}`,
      },
      drop_booked: {
        ar: () => `هلا ${n} 🚚\nتم تأكيد توصيل طلبك رقم #${d.number} للبيت ✅\n\n📅 الموعد: ${d.when}\n📍 العنوان: ${d.address || "—"}\n\nبنبلغك أول ما يطلع المندوب 🛵\n${SIGN.ar}`,
        en: () => `Hi ${n} 🚚\nHome delivery of your order #${d.number} is confirmed ✅\n\n📅 When: ${d.when}\n📍 Address: ${d.address || "—"}\n\nWe'll let you know when the driver is on the way 🛵\n${SIGN.en}`,
        ur: () => `السلام علیکم ${n} 🚚\nآپ کے آرڈر #${d.number} کی گھر ڈیلیوری طے ہو گئی ✅\n\n📅 وقت: ${d.when}\n📍 پتہ: ${d.address || "—"}\n\nڈرائیور روانہ ہوتے ہی اطلاع دیں گے 🛵\n${SIGN.ur}`,
      },
      dlv_missed: {
        ar: () => `هلا ${n} 🌷\nحاول المندوب ${d.kind === "drop" ? `يوصل طلبك رقم #${d.number}` : "يستلم ملابسك"} اليوم وما قدرنا نوصل لك 🙏\n📅 الموعد الجديد: ${d.when}\n\nإذا يناسبك وقت ثاني ردّ علينا هنا 😊\n${SIGN.ar}`,
        en: () => `Hi ${n} 🌷\nOur driver tried to ${d.kind === "drop" ? `deliver your order #${d.number}` : "collect your clothes"} today but couldn't reach you 🙏\n📅 New time: ${d.when}\n\nIf another time suits you better, just reply here 😊\n${SIGN.en}`,
        ur: () => `السلام علیکم ${n} 🌷\nہمارے ڈرائیور نے آج ${d.kind === "drop" ? `آپ کا آرڈر #${d.number} پہنچانے` : "آپ کے کپڑے لینے"} کی کوشش کی مگر رابطہ نہ ہو سکا 🙏\n📅 نیا وقت: ${d.when}\n\nکوئی اور وقت مناسب ہو تو یہاں جواب دیں 😊\n${SIGN.ur}`,
      },
      drop_onway: {
        ar: () => `هلا ${n} 🛵\nطلبك رقم #${d.number} (${arPcs(d.pieces)}) طلع مع المندوب وفي الطريق لبيتك 🚚✨\n${d.due > 0 ? `💰 المبلغ المستحق عند الاستلام: ${d.dueTxt} (نقداً أو Benefit Pay)${bpLine("ar", d.number) ? `\n${bpLine("ar", d.number)}` : ""}` : "✅ مدفوع بالكامل"}\n\nنشوفك على خير 🌷\n${SIGN.ar}`,
        en: () => `Hi ${n} 🛵\nYour order #${d.number} (${d.pieces} pcs) is out for delivery 🚚✨\n${d.due > 0 ? `💰 Amount due on delivery: ${d.dueTxt} (cash or Benefit Pay)${bpLine("en", d.number) ? `\n${bpLine("en", d.number)}` : ""}` : "✅ Fully paid"}\n\nSee you soon 🌷\n${SIGN.en}`,
        ur: () => `السلام علیکم ${n} 🛵\nآپ کا آرڈر #${d.number} (${d.pieces} قطعات) ڈیلیوری کے لیے روانہ ہو گیا 🚚✨\n${d.due > 0 ? `💰 وصولی پر واجب الادا: ${d.dueTxt} (نقد یا Benefit Pay)` : "✅ مکمل ادائیگی ہو چکی"}\n\nجلد ملاقات ہوگی 🌷\n${SIGN.ur}`,
      },
      package: {
        ar: () => `هلا والله ${n} 🎟\nتم تفعيل باقتك «${d.pkg}» بنجاح ✅\n\n👕 عدد القطع: ${d.pieces}\n🧺 تشمل: ${d.garments}\n💰 قيمة الباقة: ${d.price} (${d.method})${d.bonus ? `\n🎁 هدية الباقة: ${d.bonus}` : ""}${d.rules ? `\n📌 ${d.rules}` : ""}${d.dlv ? `\n🚚 ${d.dlv}` : ""}\n\nتُخصم القطع تلقائياً من باقتك مع كل طلب، وبنبلغك بالمتبقي في كل مرة 😊\n${SIGN.ar}`,
        en: () => `Hi ${n} 🎟\nYour package «${d.pkg}» is now active ✅\n\n👕 Pieces: ${d.pieces}\n🧺 Covers: ${d.garments}\n💰 Package price: ${d.price} (${d.method})${d.bonus ? `\n🎁 Bonus: ${d.bonus}` : ""}${d.rules ? `\n📌 ${d.rules}` : ""}\n\nPieces are deducted automatically with each order, and we'll tell you what's left every time 😊\n${SIGN.en}`,
        ur: () => `السلام علیکم ${n} 🎟\nآپ کا پیکیج «${d.pkg}» فعال ہو گیا ✅\n\n👕 قطعات: ${d.pieces}\n🧺 شامل: ${d.garments}\n💰 پیکیج کی قیمت: ${d.price} (${d.method})${d.bonus ? `\n🎁 تحفہ: ${d.bonus}` : ""}${d.rules ? `\n📌 ${d.rules}` : ""}\n\nہر آرڈر کے ساتھ قطعات خودبخود کم ہوں گی اور ہم ہر بار باقی تعداد بتائیں گے 😊\n${SIGN.ur}`,
      },
      due: {
        ar: () => `هلا والله ${n} 🌸\nحبينا نذكّرك بلطف إن المتبقي على حسابك لدينا ${d.amount}${d.lines ? `:\n${d.lines}` : "."}\n\nتقدر تسدده بأي وقت يناسبك عند زيارتك الجاية أو عن طريق Benefit Pay 🙏${bpLine("ar") ? `\n${bpLine("ar")}` : ""}\nشكراً لتعاونك ودايماً بخدمتك 💐\n${SIGN.ar}`,
        en: () => `Hi ${n} 🌸\nJust a friendly reminder that ${d.amount} is outstanding on your account${d.lines ? `:\n${d.lines}` : "."}\n\nYou can settle it whenever it suits you — on your next visit or via Benefit Pay 🙏${bpLine("en") ? `\n${bpLine("en")}` : ""}\nThank you, and we're always here for you 💐\n${SIGN.en}`,
        ur: () => `السلام علیکم ${n} 🌸\nنرم یاد دہانی: آپ کے اکاؤنٹ پر ${d.amount} باقی ہیں${d.lines ? `:\n${d.lines}` : "۔"}\n\nاپنی سہولت کے مطابق اگلی آمد پر یا Benefit Pay کے ذریعے ادا کر دیں 🙏\nشکریہ، ہم ہمیشہ آپ کی خدمت میں ہیں 💐\n${SIGN.ur}`,
      },
    };
    return M[kind][L]();
  }
  function orderMsgData(order, cust) {
    const p = order.payment;
    return { name: cust.name, number: order.number, pieces: piecesOf(order), total: money(p.total), discount: p.discount > 0 ? money(p.discount) : "", before: p.discount > 0 ? money(round3((Number(p.total) || 0) + (Number(p.discount) || 0))) : "", covered: !(p.total > 0) && order.items.some((it) => it.fromPackageId) };
  }
  // حالة حساب العميل بكلمات واضحة (بدل رقم بإشارة سالب)
  function balanceStatus(bal) {
    const b = round3(Number(bal) || 0), L = lang === "en" || lang === "ur" ? lang : "ar";
    if (b < 0) return { ar: `المتبقي عليك: ${money(-b)}`, en: `Amount you owe: ${money(-b)}`, ur: `آپ کے ذمے باقی: ${money(-b)}` }[L];
    if (b > 0) return { ar: `رصيدك لدينا: ${money(b)}`, en: `Your credit with us: ${money(b)}`, ur: `ہمارے پاس آپ کا بیلنس: ${money(b)}` }[L];
    return { ar: "حسابك مسدد بالكامل ✅", en: "Your account is fully settled ✅", ur: "آپ کا اکاؤنٹ مکمل طور پر صاف ہے ✅" }[L];
  }
  // تذكير المستحق: نفس الأرقام في ملف العميل وصفحة الأرصدة — الطلبات المستحقة + أي رصيد سابق، ومجموعها = الإجمالي
  function dueReminderData(c) {
    const cs = FIN.customerSummary(c, orders, ledger);
    const rows = cs.rows.filter((r) => r.remaining > 0 && r.state !== "in_progress");
    const lines = rows.map((r) => `• #${r.order.number}: ${money(r.remaining)}${r.state === "due_now" ? (lang === "en" ? " (ready for pickup)" : " (جاهز للاستلام)") : ""}`);
    const other = round3(cs.totalOwed - rows.reduce((a, r) => a + r.remaining, 0));
    if (other > 0.0005) lines.push(`• ${lang === "en" ? "Previous balance" : "رصيد سابق"}: ${money(other)}`);
    return { total: cs.totalOwed, data: { name: c.name, amount: money(cs.totalOwed), lines: lines.join("\n") } };
  }
  function sendDueReminder(c) {
    const r = dueReminderData(c);
    if (!(r.total > 0)) { toast(lang === "en" ? "Nothing is owed by this customer" : "لا يوجد مبلغ مستحق على هذا العميل"); return; }
    openWhatsApp(c.phone, waMsg("due", r.data));
    logActivity(`تذكير واتساب بالمستحق — ${c.name} — ${money(r.total)}`);
  }
  function sendOrderConfirmation(order, cust) {
    if (!cust) return;
    const pkg = orderPackageLines(order).join("\n🎟 ");
    openWhatsApp(cust.phone, waMsg("received", { ...orderMsgData(order, cust), expected: order.expectedDelivery ? fmtDT(order.expectedDelivery) : "", urgent: order.priority === "urgent", pkg, dlv: dlvMsgLine(order) }));
  }
  // رسالة الجاهزية: تُظهر المستحق إن لم يُدفع (أو المتبقي)، وإلا «مدفوع بالكامل»
  function sendReadyMessage(order, cust) {
    if (!cust) return;
    // المستحق الفعلي الآن (يشمل أي سداد لاحق)، والمدفوع، ورصيد العميل المسبق إن وُجد
    const due = orderOwedNow(order), paid = order.paymentConfirmed ? round3((Number(order.payment.total) || 0) - due) : 0;
    const credit = !order.paymentConfirmed ? Math.max(0, round3(cust.balance)) : 0;
    openWhatsApp(cust.phone, waMsg("ready", { ...orderMsgData(order, cust), due, dueTxt: money(due), paid, paidTxt: money(paid), credit, creditTxt: money(credit), dlv: !!(order.delivery && order.delivery.drop) }));
  }
  const sendPaymentConfirmationMessage = sendReadyMessage;
  function deliveredText(order, cust, link) {
    const owed = orderOwedNow(order);
    const accountDebt = round3(Math.max(0, -(Number(cust.balance) || 0)));
    const account = accountDebt > owed + 0.0005 ? accountDebt : 0;
    return waMsg("delivered", { ...orderMsgData(order, cust), owed, owedTxt: money(owed), account, accountTxt: money(account), link: link || "" });
  }
  function sendDeliveredMessage(order, cust, withReceipt) {
    if (!cust) return;
    const link = withReceipt ? publishReceipt(order, cust) : "";
    const owed = orderOwedNow(order);
    const accountDebt = round3(Math.max(0, -(Number(cust.balance) || 0)));
    const account = accountDebt > owed + 0.0005 ? accountDebt : 0;
    openWhatsApp(cust.phone, waMsg("delivered", { ...orderMsgData(order, cust), owed, owedTxt: money(owed), account, accountTxt: money(account), link }));
  }
  // kind: payment (سداد دين/طلب) · deposit (إيداع) · refund (استرداد) · debit (خصم) · plus (إضافة)
  function sendBalanceMessage(cust, amount, kind, extra) {
    const x = extra || {};
    openWhatsApp(cust.phone, waMsg("balance", { name: cust.name, kind: kind || (amount >= 0 ? "plus" : "debit"), amount: money(Math.abs(amount)), orderNo: x.orderNo || "", note: x.note || "", status: balanceStatus(cust.balance) }));
  }
  window.waMsg997 = waMsg;

  function waPrompt(title, sub, submitLabel, send, mandatory) {
    setTimeout(() => openQuickForm({ title, sub, fields: [], submitLabel, cancelLabel: "لاحقاً", mandatory, onSubmit: () => { send(); } }), 120);
  }
  // تأكيد الطلب على واتساب إلزامي عند إنشاء الطلب (لا يوجد «لاحقاً»)
  function showOrderSavedPrompt(order, cust) {
    const pieces = order.items.reduce((n, it) => n + it.qty, 0);
    waPrompt(`✓ تم حفظ الطلب #${order.number}`, `${cust ? cust.name : ""} — ${pieces} قطعة — الإجمالي ${money(order.payment.total)}. أرسل تأكيد الطلب للعميل على واتساب الآن.`, "📲 إرسال تأكيد الطلب على واتساب", () => { sendOrderConfirmation(order, cust); logActivity(`إرسال تأكيد استلام واتساب — طلب #${order.number}`); }, true);
  }
  function showReadyPrompt(order, cust) {
    const owed = orderOwedNow(order);
    waPrompt(owed > 0 ? `✓ الطلب #${order.number} جاهز — متبقي ${money(owed)}` : `✓ تم تأكيد الدفع — الطلب #${order.number} جاهز`, `هل ترسل رسالة «طلبك جاهز» مع تفاصيل الدفع للعميل على واتساب؟`, "📲 إرسال رسالة الجاهزية", () => { sendPaymentConfirmationMessage(order, cust); logActivity(`إرسال رسالة جاهزية واتساب — طلب #${order.number}`); });
  }
  function showDeliveredPrompt(order, cust) {
    waPrompt(`✓ تم تسليم الطلب #${order.number}`, `هل ترسل رسالة شكر وتأكيد التسليم للعميل على واتساب؟`, "📲 إرسال رسالة التسليم", () => { sendDeliveredMessage(order, cust); logActivity(`إرسال رسالة تسليم واتساب — طلب #${order.number}`); });
  }

  /* -------------------------- تعليق الطلب / إلغاؤه -------------------------- */
  document.getElementById("posCancelBtn").addEventListener("click", () => {
    if (draftItems.length > 0) logActivity(`إلغاء مسودة طلب غير محفوظة (${draftItems.reduce((n, it) => n + it.qty, 0)} قطعة — ${money(currentTotals().total)}) بواسطة ${me ? me.name : ""}`);
    resetDraft();
    toast("تم إلغاء المسودة الحالية");
  });

  document.getElementById("posSuspendBtn").addEventListener("click", () => {
    if (draftItems.length === 0) { toast(t("toast_add_one_item")); return; }
    const cust = customers.find((c) => c.id === draftCustomerId);
    suspendedOrders.unshift({
      id: uid(),
      customerId: draftCustomerId,
      customerName: cust ? cust.name : "بدون عميل",
      items: draftItems.map((it) => ({ ...it })),
      extras: [...draftExtras],
      priority: document.getElementById("orderPriority").value,
      discount: document.getElementById("discountAmount").value || "0",
      discountReason: (document.getElementById("discountReason") || {}).value || "",
      notes: document.getElementById("orderNotes").value.trim(),
      employeeId: document.getElementById("orderEmployeeSelect")?.value || null,
      suspendedAt: new Date().toISOString(),
    });
    save("l997_suspended_orders", suspendedOrders);
    logActivity(`تعليق طلب لـ ${cust ? cust.name : "بدون عميل"} (${draftItems.length} صنف)`);
    resetDraft();
    toast("تم تعليق الطلب — يمكنك استرجاعه من «المعاملات الأخيرة»");
  });

  function resumeSuspendedOrder(id) {
    const s = suspendedOrders.find((x) => x.id === id);
    if (!s) return;
    resetDraft();
    draftItems = s.items.map((it) => ({ ...it }));
    draftExtras = new Set(s.extras || []);
    renderPosExtras();
    if (s.customerId) {
      const cust = customers.find((c) => c.id === s.customerId);
      if (cust) selectCustomerForOrder(cust, true);
    }
    document.getElementById("orderNotes").value = s.notes || "";
    document.getElementById("discountAmount").value = s.discount || "0";
    const drr = document.getElementById("discountReason"); if (drr) drr.value = s.discountReason || "";
    if (s.employeeId) { const sel = document.getElementById("orderEmployeeSelect"); if (sel) sel.value = s.employeeId; }
    draftUrgentAll = s.priority === "urgent" && !draftItems.some((it) => it.urgent === true);
    if (draftUrgentAll) draftItems.forEach((it) => { it.urgent = !urgentBlocked(it); });
    syncDraftPriority();
    suspendedOrders = suspendedOrders.filter((x) => x.id !== id);
    save("l997_suspended_orders", suspendedOrders);
    renderOrderItemsTable();
    updateSummary();
    recentTransactionsDialog.close();
    toast("تم استرجاع الطلب المعلّق");
  }

  /* -------------------------- المعاملات الأخيرة -------------------------- */
  const recentTransactionsDialog = document.getElementById("recentTransactionsDialog");
  document.getElementById("posRecentBtn").addEventListener("click", () => {
    renderRecentTransactions();
    recentTransactionsDialog.showModal();
  });
  document.getElementById("closeRecentTxDialog").addEventListener("click", () => recentTransactionsDialog.close());

  function renderRecentTransactions() {
    const suspSection = document.getElementById("suspendedOrdersSection");
    const suspList = suspendedOrders.filter((x) => x.kind !== "pickup");
    suspSection.innerHTML = suspList.length === 0 ? "" : `
      <h4 style="margin:4px 0 8px">طلبات معلّقة (${suspList.length})</h4>
      ${suspList.map((s) => `
        <div class="recent-tx-row">
          <div class="recent-tx-info"><strong>${esc(s.customerName)}</strong><div class="pos-cart-row-sub">${s.items.length} صنف · ${fmtDT(s.suspendedAt)}</div></div>
          <div class="recent-tx-actions">
            <button class="mini-btn" data-resume="${s.id}">استرجاع</button>
            <button class="mini-btn danger-mini" data-drop-suspended="${s.id}">حذف</button>
          </div>
        </div>`).join("")}
      <hr style="margin:14px 0" />`;
    suspSection.querySelectorAll("[data-resume]").forEach((btn) => btn.addEventListener("click", () => resumeSuspendedOrder(btn.dataset.resume)));
    suspSection.querySelectorAll("[data-drop-suspended]").forEach((btn) => btn.addEventListener("click", () => {
      const dropped = suspendedOrders.find((x) => x.id === btn.dataset.dropSuspended);
      if (dropped) logActivity(`حذف طلب معلّق لـ ${dropped.customerName} (${dropped.items.length} صنف) بواسطة ${me ? me.name : ""}`);
      suspendedOrders = suspendedOrders.filter((x) => x.id !== btn.dataset.dropSuspended);
      save("l997_suspended_orders", suspendedOrders);
      renderRecentTransactions();
    }));

    const list = document.getElementById("recentTxList");
    const recent = orders.slice(0, 10);
    list.innerHTML = `<h4 style="margin:4px 0 8px">آخر 10 طلبات</h4>` + (recent.length === 0 ? `<div class="empty-state compact">لا توجد طلبات بعد</div>` : recent.map((o) => {
      const cust = customers.find((c) => c.id === o.customerId);
      return `<div class="recent-tx-row">
        <div class="recent-tx-info"><strong>#${o.number} — ${cust ? esc(cust.name) : "—"}</strong><div class="pos-cart-row-sub">${money(o.payment.total)} · ${statusLabel(o.status)}</div></div>
        <div class="recent-tx-actions">
          <button class="mini-btn" data-view-order="${o.id}">عرض</button>
          <button class="mini-btn" data-print-order="${o.id}">🖨</button>
        </div>
      </div>`;
    }).join(""));
    list.querySelectorAll("[data-view-order]").forEach((btn) => btn.addEventListener("click", () => { recentTransactionsDialog.close(); goOrders(); openOrderDialog(btn.dataset.viewOrder); }));
    list.querySelectorAll("[data-print-order]").forEach((btn) => btn.addEventListener("click", () => printOrder(btn.dataset.printOrder)));
  }

  // سطور رصيد الباقات المستخدمة بالطلب: «باقة كوي: استُخدم 5 — متبقي 37 من 50»
  function orderPackageLines(order) {
    const ids = [...new Set(order.items.filter((it) => it.fromPackageId).map((it) => it.fromPackageId))];
    return ids.map((id) => {
      const cp = customerPackages.find((p) => p.id === id);
      if (!cp) return "";
      const usedHere = order.items.filter((it) => it.fromPackageId === id).reduce((s, it) => s + pkgUnits(it), 0);
      return lang === "en" ? `Package «${cp.name}»: ${usedHere} used — ${cp.remainingPieces} of ${cp.totalPieces} left`
        : `باقة «${cp.name}»: استُخدم ${arPcs(usedHere)} — متبقي ${cp.remainingPieces} من ${cp.totalPieces}`;
    }).filter(Boolean);
  }





  /* ============================= الطباعة ============================= */
  /* ============================= نافذة نموذج سريع عامة (بديل prompt) ============================= */
  const quickFormDialog = document.getElementById("quickFormDialog");
  function normDigits(v) {
    return String(v == null ? "" : v).replace(/[٠-٩]/g, (d) => d.charCodeAt(0) - 1632).replace(/[۰-۹]/g, (d) => d.charCodeAt(0) - 1776).replace(/[٫،,]/g, ".").replace(/\s+/g, "");
  }
  let quickFormMandatory = false;
  function openQuickForm({ title, sub, fields, submitLabel, cancelLabel, onSubmit, mandatory }) {
    // mandatory: لا زر إلغاء ولا إغلاق ولا Esc — الإجراء الوحيد هو زر التنفيذ
    quickFormMandatory = !!mandatory;
    document.getElementById("quickFormCancelBtn").style.display = mandatory ? "none" : "";
    document.getElementById("closeQuickFormDialog").style.display = mandatory ? "none" : "";
    // «#00005» يبقى بترتيبه الصحيح داخل النص العربي
    const isoNum = (x) => String(x || "").replace(/#(\d+)/g, "\u2066#$1\u2069");
    document.getElementById("quickFormTitle").textContent = isoNum(title);
    document.getElementById("quickFormSub").textContent = isoNum(sub);
    document.getElementById("quickFormSubmitBtn").textContent = submitLabel || "حفظ";
    document.getElementById("quickFormCancelBtn").textContent = cancelLabel || "إلغاء";
    const wrap = document.getElementById("quickFormFields");
    let qfErr = document.getElementById("quickFormError");
    if (!qfErr) {
      qfErr = document.createElement("div");
      qfErr.id = "quickFormError"; qfErr.className = "auth-err"; qfErr.setAttribute("role", "alert");
      wrap.insertAdjacentElement("afterend", qfErr);
    }
    qfErr.textContent = "";
    wrap.innerHTML = fields.map((f) => {
      const id = `qf_${f.id}`;
      if (f.type === "select") {
        const opt = (o) => `<option value="${esc(o.value)}" ${o.value === f.value ? "selected" : ""}>${esc(o.label)}</option>`;
        // خيارات مجمّعة (optgroup) إن وُجدت خاصية group
        const groups = [...new Set(f.options.map((o) => o.group).filter(Boolean))];
        const body = groups.length ? groups.map((g) => `<optgroup label="${esc(g)}">${f.options.filter((o) => o.group === g).map(opt).join("")}</optgroup>`).join("") + f.options.filter((o) => !o.group).map(opt).join("") : f.options.map(opt).join("");
        return `<label><span>${esc(f.label)}</span><select id="${id}">${body}</select></label>`;
      }
      if (f.type === "checks") {
        const sel = new Set(f.value || []);
        return `<div class="qf-checks" id="${id}"><span class="qf-checks-label">${esc(f.label)}</span>${f.search ? `<input type="search" class="qf-checks-search" placeholder="🔍 ${lang === "en" ? "Search" : "بحث"}" autocomplete="off" />` : ""}
          ${f.groups ? `<div class="qf-checks-tools">${f.groups.map((g) => `<button type="button" class="mini-btn" data-qf-group="${esc(g.value)}">${esc(g.label)}</button>`).join("")}<button type="button" class="mini-btn" data-qf-group="__all">${lang === "en" ? "All" : "الكل"}</button><button type="button" class="mini-btn" data-qf-group="__none">${lang === "en" ? "None" : "إلغاء الكل"}</button></div>` : ""}
          <div class="qf-checks-grid">${f.options.map((o) => `<label class="qf-check"><input type="checkbox" value="${esc(o.value)}" data-group="${esc(o.group || "")}" ${sel.has(o.value) ? "checked" : ""}><span>${esc(o.label)}</span></label>`).join("")}</div></div>`;
      }
      if (f.type === "textarea") {
        return `<label><span>${esc(f.label)}</span><textarea id="${id}" rows="2" placeholder="${esc(f.placeholder)}">${esc(f.value)}</textarea></label>`;
      }
      return `<label><span>${esc(f.label)}</span><input id="${id}" type="${f.type === "number" ? "text" : (f.type || "text")}" ${f.type === "number" ? 'inputmode="decimal" autocomplete="off"' : f.type === "password" ? `autocomplete="${f.autocomplete || "current-password"}"` : f.autocomplete ? `autocomplete="${f.autocomplete}"` : ""} ${f.step ? `step="${esc(f.step)}"` : ""} ${f.min !== undefined ? `min="${esc(f.min)}"` : ""} value="${esc(f.value ?? "")}" placeholder="${esc(f.placeholder)}" /></label>`;
    }).join("");
    wrap.querySelectorAll(".qf-checks-search").forEach((inp) => inp.addEventListener("input", () => {
      const q2 = normDigits(inp.value.trim().toLowerCase()).replace(/\s+/g, "");
      inp.closest(".qf-checks").querySelectorAll(".qf-check").forEach((l) => { l.style.display = !q2 || normDigits(l.textContent.toLowerCase()).replace(/\s+/g, "").includes(q2) ? "" : "none"; });
    }));
    wrap.querySelectorAll("[data-qf-group]").forEach((b) => b.addEventListener("click", () => {
      const g = b.dataset.qfGroup, boxes = b.closest(".qf-checks").querySelectorAll("input[type=checkbox]");
      if (g === "__none") boxes.forEach((x) => { x.checked = false; });
      else if (g === "__all") boxes.forEach((x) => { x.checked = true; });
      else { const grp = [...boxes].filter((x) => x.dataset.group === g); const allOn = grp.every((x) => x.checked); grp.forEach((x) => { x.checked = !allOn; }); }
    }));

    const submitBtn = document.getElementById("quickFormSubmitBtn");
    const cancelBtn = document.getElementById("quickFormCancelBtn");
    const closeBtn = document.getElementById("closeQuickFormDialog");
    const cleanup = () => { submitBtn.onclick = null; cancelBtn.onclick = null; closeBtn.onclick = null; };
    submitBtn.onclick = () => {
      const values = {};
      fields.forEach((f) => {
        const el = document.getElementById(`qf_${f.id}`);
        values[f.id] = f.type === "checks" ? [...el.querySelectorAll("input:checked")].map((x) => x.value)
          : f.type === "number" ? (Number(normDigits(el.value)) || 0) : el.value.trim();
      });
      const result = onSubmit(values);
      if (result === false) return; // فشل التحقق من الصحة — تبقى النافذة مفتوحة ليصحّح المستخدم الإدخال
      cleanup();
      quickFormDialog.close();
    };
    cancelBtn.onclick = () => { cleanup(); quickFormDialog.close(); };
    closeBtn.onclick = () => { cleanup(); quickFormDialog.close(); };
    quickFormDialog.showModal();
  }

  quickFormDialog.addEventListener("cancel", (e) => { if (quickFormMandatory) e.preventDefault(); });
  function confirmAction(message, onConfirm) {
    openQuickForm({ title: "تأكيد", sub: message, fields: [], submitLabel: "تأكيد", onSubmit: () => onConfirm() });
  }
  window.openQuickForm = openQuickForm;
  window.t997 = t;
  window.getLang997 = () => lang;
  window.toast = toast;
  window.confirmAction = confirmAction;

  // إيصال نصي مفصّل يُرسل عبر واتساب (القطع، الكميات، الأسعار، الإجمالي، الدفع) — بنفس أرقام الإيصال المطبوع
  function receiptText(order, cust) {
    const en = lang === "en" || lang === "ur";
    const p = order.payment, profile = loadProfile();
    const shop = (en ? profile.nameEn : profile.nameAr) || "997 Laundry";
    const L = (ar, eng) => (en ? eng : ar);
    const lines = [`🧾 ${shop} — ${L("إيصال الطلب", "Receipt — Order")} #${order.number}`, `📅 ${fmtDT(order.createdAt)}`];
    if (cust) lines.push(`👤 ${cust.name}`);
    lines.push("");
    order.items.forEach((it) => lines.push(`• ${it.urgent || (order.priority === "urgent" && !order.items.some((x) => x.urgent === true)) ? "⚡ " : ""}${clothingName(it.clothingId)} — ${serviceName(it.serviceId)} × ${it.qty} = ${it.fromPackageId ? `${money(pkgLineValue(it))} (${L("من الباقة", "from package")})` : money(it.total)}`));
    (order.extras || []).forEach((l) => lines.push(`➕ ${extraLabel(l)}${l.per === "piece" ? ` × ${l.qty}` : ""} = ${extraVal(l)}`));
    lines.push(`👕 ${L("عدد القطع", "Pieces")}: ${piecesOf(order)}`, "──────────");
    lines.push(`${L("المجموع الأساسي", "Subtotal")}: ${money(p.subtotal)}`);
    if (p.urgentFee > 0) lines.push(`⚡ ${L("رسوم الاستعجال", "Urgent fee")}: ${money(p.urgentFee)}`);
    if (p.discount > 0) lines.push(`${L("الخصم", "Discount")}: -${money(p.discount)}`);
    if (p.vat > 0) lines.push(`${L("ضريبة القيمة المضافة", "VAT")} (${p.vatPercent}%): ${money(p.vat)}`);
    lines.push(`💰 ${L("الإجمالي", "Total")}: ${money(p.total)}`);
    if (order.status === "cancelled") lines.push(`✕ ${L("الطلب ملغي", "Order cancelled")}`);
    else if (!order.paymentConfirmed) lines.push(`⏳ ${L("المستحق عند الاستلام", "Due on pickup")}: ${money(p.total)}`);
    else {
      lines.push(`💳 ${L("طريقة الدفع", "Payment")}: ${orderPayLabel(order)}`, `✅ ${L("المدفوع", "Paid")}: ${money(p.method === "balance" ? p.total : p.paid)}`);
      const owed = order.debtRecorded && cust ? FIN.allocateDebts([cust], orders, ledger)[order.id] || 0 : 0;
      lines.push(owed > 0 ? `📌 ${L("المتبقي عليكم", "Balance due")}: ${money(owed)}` : `✔ ${L("مدفوع بالكامل", "Fully paid")}`);
    }
    orderPackageLines(order).forEach((l) => lines.push(`🎟 ${l}`));
    lines.push("", L("شكراً لتعاملكم مع 997 Laundry 💙", "Thank you for choosing 997 Laundry 💙"));
    if (profile.phone) lines.push(`📞 ${profile.phone}`);
    return lines.join("\n");
  }
  /* ---------- إيصال PDF / صورة للمشاركة عبر واتساب ----------
     يُرسم الإيصال على canvas (المتصفح يشكّل الحروف العربية تلقائياً)، ثم يُغلَّف بصفحة PDF واحدة.
     المشاركة عبر قائمة «مشاركة» في الجهاز (واتساب يرفق الملف)؛ وإن لم يدعمها الجهاز يُنزَّل الملف ويُفتح واتساب. */
  // محتوى الإيصال (نصوص جاهزة) — يُرسم بـ L997Receipt.draw هنا، وفي صفحة الإيصال العامة (r.html) لرابط واتساب
  function receiptModel(order, cust) {
    const iso = (x) => "\u2066" + x + "\u2069"; // رقم أو نص إنجليزي داخل سطر عربي يبقى بترتيبه الصحيح
    const en = lang === "en" || lang === "ur", L = (ar, eng) => (en ? eng : ar);
    const p = order.payment, profile = loadProfile();
    const rows = order.items.map((it) => ({ a: `${it.urgent || (order.priority === "urgent" && !order.items.some((x) => x.urgent === true)) ? "⚡ " : ""}${clothingName(it.clothingId)} — ${serviceName(it.serviceId)}`, q: it.qty, v: it.fromPackageId ? `${money(pkgLineValue(it))} ${L("باقة", "Pkg")}` : money(it.total) }));
    (order.extras || []).forEach((l) => rows.push({ a: `+ ${extraLabel(l)}`, q: l.per === "piece" ? l.qty : "", v: extraVal(l) }));
    const totals = [], paidRows = [], ps = pkgSummary(order.items);
    if (ps.n) totals.push([`🎟 ${L("قيمة قطع الباقة", "Package items value")}`, money(ps.value)], [`${L("مغطاة من الباقة", "Covered by package")} (${ps.pieces})`, "−" + money(ps.value)]);
    totals.push([L("المجموع الأساسي", "Subtotal"), money(p.subtotal)]);
    if (p.urgentFee > 0) totals.push([L("رسوم الاستعجال", "Urgent fee"), money(p.urgentFee)]);
    if (p.discount > 0) totals.push([L("الخصم", "Discount") + (order.discountCode ? " · " + iso(order.discountCode) : ""), en ? "−" + money(p.discount) : money(p.discount)]);
    if (p.vat > 0) totals.push([`${L("ضريبة القيمة المضافة", "VAT")} ${p.vatPercent}%`, money(p.vat)]);
    let status;
    if (order.status === "cancelled") status = { text: L("الطلب ملغي", "Order cancelled"), kind: "bad" };
    else if (!order.paymentConfirmed) status = { text: `${L("المستحق عند الاستلام", "Due on pickup")}: ${money(p.total)}`, kind: "warn" };
    else {
      const owed = order.debtRecorded && cust ? FIN.allocateDebts([cust], orders, ledger)[order.id] || 0 : 0;
      if (owed > 0 && owed < p.total - 0.0005) paidRows.push([L("المدفوع", "Paid") + ` (${orderPayLabel(order)})`, money(round3(p.total - owed))]);
      status = owed > 0 ? { text: `${L("المتبقي عليكم", "Balance due")}: ${money(owed)}`, kind: "bad" } : { text: `✓ ${L("مدفوع بالكامل", "Fully paid")} — ${orderPayLabel(order)}`, kind: "good" };
    }
    if (order.status === "delivered" && order.deliveredAt) status.note = `${L("تم التسليم", "Delivered")}: ${fmtDT(order.deliveredAt)}`;
    const footer = [profile.cr ? `${L("س.ت", "CR")}: ${iso(profile.cr)}` : "", profile.vat ? `${L("الرقم الضريبي", "VAT No.")}: ${iso(profile.vat)}` : ""].filter(Boolean).join("   ·   ");
    return {
      v: 1, en, number: order.number,
      shopName: iso((en ? profile.nameEn : profile.nameAr) || "997 Laundry"),
      sub: [profile.phone ? iso(profile.phone) : "", profile.address].filter(Boolean).join(" · ") || L("الرفاع · مملكة البحرين · مفتوح 24 ساعة", "Riffa · Bahrain · Open 24 hours"),
      title: `${L("إيصال طلب", "Receipt")} ${iso("#" + order.number)}`, dt: fmtDT(order.createdAt),
      custName: cust ? cust.name : "", custPhone: cust ? iso(cust.phone || "") : "",
      heads: [L("القطعة / الخدمة", "Item / service"), L("الكمية", "Qty"), L("المبلغ", "Amount")],
      rows, pieces: `${L("عدد القطع", "Pieces")}: ${piecesOf(order)}`, totals,
      totalLabel: L("الإجمالي", "Total"), total: money(p.total), paidRows, status,
      pkgs: orderPackageLines(order), thanks: L(`شكراً لتعاملكم مع ${iso("997 Laundry")} 💙`, "Thank you for choosing 997 Laundry 💙"), footer,
    };
  }
  function receiptCanvas(order, cust) { return window.L997Receipt.draw(receiptModel(order, cust), LOGO_IMG); }
  // رابط الإيصال للعميل (يحتاج الربط بالسحابة): نسخة من الإيصال تُحفظ مع الطلب برمز سري، وتُفتح من r.html
  function receiptToken() {
    const b = new Uint8Array(16); (window.crypto || {}).getRandomValues ? window.crypto.getRandomValues(b) : b.forEach((_, i) => { b[i] = Math.floor(Math.random() * 256); });
    return window.btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function receiptPageBase() {
    // نفس الموقع الذي يعمل عليه النظام؛ نسخة الملف الواحد المفتوحة من الجهاز تستخدم موقع المحل
    return /^https?:$/.test(location.protocol) ? location.origin + location.pathname.replace(/[^/]*$/, "") : "https://997-laundry.github.io/";
  }
  const receiptLinksOn = () => cloudOn() && !!(window.L997Cloud && window.L997Cloud.status && window.L997Cloud.status().receiptLinks);
  // صورة الإيصال كـ Blob فوراً (بدون انتظار) — لتبقى ضمن ضغطة الموظف
  function receiptPngNow(order, cust) {
    const url = receiptCanvas(order, cust).toDataURL("image/png");
    const bin = window.atob(url.split(",")[1]), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return { blob: new Blob([u8], { type: "image/png" }), b64: url.split(",")[1] };
  }
  const waApiOn = () => cloudOn() && !!(settings.waApi && settings.waApi.enabled);
  function receiptPayLine(order) {
    const owed = orderOwedNow(order), en = lang === "en";
    if (order.status === "cancelled") return en ? "Order cancelled" : "الطلب ملغي";
    return owed > 0 ? (en ? `Remaining: ${money(owed)}` : `المتبقي: ${money(owed)}`) : (en ? "Fully paid ✅" : "مدفوع بالكامل ✅");
  }
  // تلقائي عبر WhatsApp Business API: تصل صورة الإيصال للعميل بدون أي ضغطة — وعند الفشل يُعرض الإرسال اليدوي
  // أخطاء Meta / الدالة → ماذا تفعل بالضبط (بدل رسالة تقنية بالإنجليزية)
  function waErrHint(r) {
    const e = String((r && r.error) || "").toLowerCase(), st = r && r.status;
    const H = (ar, en) => (lang === "ar" ? ar : en);
    if (st === 404 || /not found|function.*not/.test(e)) return H("دالة whatsapp-send غير موجودة في Supabase — أنشئها من Edge Functions.", "The whatsapp-send function is missing in Supabase — create it under Edge Functions.");
    if (/not configured/.test(e)) return H("أضف WA_TOKEN و WA_PHONE_ID في Supabase ← Edge Functions ← Secrets.", "Add WA_TOKEN and WA_PHONE_ID in Supabase → Edge Functions → Secrets.");
    if (/sign in|no-session|not a member/.test(e)) return H("سجّل الدخول بحساب مرتبط بالسحابة (ملف المنشأة ← المزامنة السحابية) ثم أعد المحاولة.", "Sign in with an account linked to the cloud (Company profile → Cloud sync), then try again.");
    if (/offline/.test(e)) return H("لا يوجد اتصال بالإنترنت.", "No internet connection.");
    if (/^timeout$/.test(e)) return H("الدالة تأخرت في الرد (أول تشغيل قد يأخذ وقتاً) — أعد المحاولة بعد دقيقة.", "The function took too long to answer (the first run can be slow) — try again in a minute.");
    if (/server error/.test(e)) return H(`خطأ داخل الدالة في Supabase: ${String((r && r.error) || "").replace(/^server error\s*—?\s*/i, "")}`, `Error inside the Supabase function: ${String((r && r.error) || "").replace(/^server error\s*—?\s*/i, "")}`);
    if (/access token|oauth|session has expired|token.*(invalid|expired)|error validating/.test(e)) return H("رمز Meta (WA_TOKEN) غير صحيح أو منتهي — أنشئ رمز System user بمدة «Never» وضعه من جديد في Secrets.", "The Meta token (WA_TOKEN) is wrong or expired — create a System-user token that never expires and put it in Secrets again.");
    if (/template|translation/.test(e) && /not exist|does not|paused|disabled|pending|rejected|translation/.test(e)) return H("نموذج الرسالة order_delivered غير معتمد بعد أو لغته ليست العربية — راجع WhatsApp Manager ← Message templates.", "The order_delivered template isn't approved yet or isn't in Arabic — check WhatsApp Manager → Message templates.");
    if (/object with id|does not exist|unsupported (post|get) request|invalid parameter.*phone/.test(e)) return H("WA_PHONE_ID غير صحيح — انسخ «Phone number ID» (وليس رقم الهاتف) من Meta ← WhatsApp ← API Setup.", "WA_PHONE_ID is wrong — copy the “Phone number ID” (not the phone number) from Meta → WhatsApp → API Setup.");
    if (/parameter|number of (params|parameters)|format mismatch|header/.test(e)) return H("شكل النموذج لا يطابق: Header = صورة، والنص فيه {{1}} {{2}} {{3}} فقط.", "Template layout doesn't match: header = image, body with {{1}} {{2}} {{3}} only.");
    if (/allowed list|not in allowed|recipient/.test(e)) return H("الحساب ما زال في وضع التجربة — أكمل توثيق الأعمال وأضف طريقة دفع، أو أضف رقمك في API Setup ← To للتجربة.", "The account is still in test mode — finish business verification and add a payment method, or add your number under API Setup → To for testing.");
    if (/payment|billing|credit line|account.*(restricted|disabled)/.test(e)) return H("أضف بطاقة دفع في WhatsApp Manager ← Payment settings.", "Add a payment card in WhatsApp Manager → Payment settings.");
    if (/re-?engagement|24 hours/.test(e)) return H("Meta رفض الرسالة لأن العميل لم يراسلك مؤخراً — النموذج يجب أن يكون من فئة Utility ومعتمد.", "Meta refused because the customer hasn't messaged you recently — the template must be an approved Utility template.");
    if (/bad phone/.test(e)) return H("رقم العميل غير صحيح.", "The customer's phone number is invalid.");
    return "";
  }
  async function autoSendReceipt(order, cust) {
    const img = receiptPngNow(order, cust);
    const r = await CLOUD.waSend({ to: cleanPhone(cust.phone), name: cust.name, orderNo: String(order.number), line: receiptPayLine(order), image: img.b64 });
    if (r && r.ok) {
      order.waReceiptAt = new Date().toISOString(); persistAll();
      logActivity(`إرسال إيصال الطلب #${order.number} تلقائياً على واتساب (Business API) — ${cust.name}`);
      toast(lang === "en" ? `✓ Receipt sent to ${cust.name} on WhatsApp automatically` : `✓ أُرسلت صورة الإيصال إلى ${cust.name} على واتساب تلقائياً`);
      return true;
    }
    logActivity(`تعذّر الإرسال التلقائي لإيصال الطلب #${order.number}: ${(r && r.error) || "خطأ"}${waErrHint(r) ? " — " + waErrHint(r) : ""}`);
    toast(lang === "en" ? `Automatic WhatsApp failed (${(r && r.error) || "error"}) — send it manually` : `تعذّر الإرسال التلقائي (${(r && r.error) || "خطأ"}) — أرسله يدوياً`);
    waPrompt(`إرسال إيصال الطلب #${order.number} يدوياً`, "الإرسال التلقائي لم يتم — اضغط لنسخ صورة الإيصال وفتح محادثة العميل.", "📲 نسخ الإيصال وفتح واتساب", () => sendReceiptImageManual(order, cust));
    return false;
  }
  // يدوي (قبل تفعيل Business API): صورة الإيصال تُنسخ ثم يفتح واتساب على محادثة العميل (حتى لو رقمه غير محفوظ)
  // — الموظف يضغط مطوّلاً في خانة الكتابة ← «لصق» ← إرسال. إن تعذّر النسخ: معاينة الإيصال (حفظ/مشاركة) + فتح المحادثة
  async function sendReceiptImageManual(order, cust) {
    const img = receiptPngNow(order, cust);
    const text = deliveredText(order, cust);
    let copied = false;
    try { if (navigator.clipboard && navigator.clipboard.write && window.ClipboardItem) { await navigator.clipboard.write([new window.ClipboardItem({ "image/png": img.blob })]); copied = true; } } catch (e) { copied = false; }
    logActivity(`إرسال إيصال الطلب #${order.number} على واتساب (${copied ? "صورة منسوخة" : "معاينة"}) — ${cust.name}`);
    if (copied) {
      toast(lang === "en" ? "Receipt image copied — in WhatsApp: press and hold the message box → Paste → Send" : "📋 تم نسخ صورة الإيصال — في واتساب: اضغط مطوّلاً في خانة الكتابة ← «لصق» ← إرسال", 7000);
      openWhatsApp(cust.phone, text);
      return "copied";
    }
    const name = `997-laundry-receipt-${order.number}.png`;
    let file = null; try { file = new File([img.blob], name, { type: "image/png" }); } catch (e) { file = null; }
    // النسخ غير متاح لكن المشاركة متاحة: قائمة المشاركة بالصورة (للعملاء المحفوظين)، والمعاينة تبقى خلفها لفتح المحادثة
    showReceiptPreview(order, cust, "image", { blob: img.blob, file, name }, text);
    if (file && imageSendSupport().files) { try { await navigator.share({ files: [file] }); return "shared"; } catch (e) { /* أُلغيت — المعاينة مفتوحة */ } }
    return "preview";
  }
  function publishReceipt(order, cust) {
    if (!receiptLinksOn() || !cust) return "";
    const m = receiptModel(order, cust);
    const ph = toLatinDigits(cust.phone || "").replace(/\D/g, "").replace(/^973/, "");
    m.custPhone = ph.length >= 6 ? "\u2066" + ph.slice(0, 2) + "••••" + ph.slice(-2) + "\u2069" : ""; // الرابط قد يُعاد إرساله — لا يظهر الرقم كاملاً
    const token = (order.receiptPub && order.receiptPub.token) || receiptToken();
    order.receiptPub = { token, at: new Date().toISOString(), model: m };
    persistAll();
    return receiptPageBase() + "r.html?t=" + token;
  }
  // صفحة PDF واحدة تحتوي صورة الإيصال (JPEG) — بدون مكتبات خارجية
  function pdfFromCanvas(cv) {
    const b64 = cv.toDataURL("image/jpeg", 0.92).split(",")[1];
    const bin = atob(b64), jpg = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) jpg[i] = bin.charCodeAt(i);
    const wPt = 288, hPt = Math.round((288 * cv.height) / cv.width);
    const enc = new TextEncoder(), parts = [], offsets = [];
    let len = 0;
    const add = (x) => { const b = typeof x === "string" ? enc.encode(x) : x; parts.push(b); len += b.length; };
    const obj = (n, body) => { offsets[n] = len; add(`${n} 0 obj\n${body}\nendobj\n`); };
    add("%PDF-1.4\n");
    obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
    obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
    obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wPt} ${hPt}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
    offsets[4] = len;
    add(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${cv.width} /Height ${cv.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`);
    add(jpg); add("\nendstream\nendobj\n");
    const content = `q ${wPt} 0 0 ${hPt} 0 0 cm /Im0 Do Q`;
    obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const xref = len;
    add(`xref\n0 6\n0000000000 65535 f \n${[1, 2, 3, 4, 5].map((n) => String(offsets[n]).padStart(10, "0") + " 00000 n \n").join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    return new Blob(parts, { type: "application/pdf" });
  }
  /* مشاركة الإيصال (صورة / PDF) — تعمل على أندرويد وآيفون وآيباد والكمبيوتر:
     • الملف يُجهَّز مسبقاً عند فتح الطلب، فتُفتح قائمة المشاركة فوراً عند الضغط (آيفون يرفضها إن تأخرت بعد اللمس)
     • على أجهزة أبل يُشارك الملف وحده (مع نص مرافق يرسل واتساب النص فقط أحياناً ويُسقط الصورة)
     • إن لم يدعم الجهاز المشاركة: نافذة معاينة بالإيصال — ضغطة مطوّلة للحفظ/المشاركة، زر تنزيل، وفتح محادثة العميل */
  const receiptCache = new Map();
  const isApple = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  const isTouch = () => (navigator.maxTouchPoints || 0) > 0 || "ontouchstart" in window;
  // هل يستطيع متصفح هذا الجهاز إرسال صورة؟ (مشاركة ملفات أو نسخ صورة) — متصفحات الأجهزة المدمجة غالباً لا تستطيع
  function imageSendSupport() {
    let files = false;
    try { const f = new File([new Uint8Array([137, 80, 78, 71])], "t.png", { type: "image/png" }); files = !!(navigator.share && navigator.canShare && navigator.canShare({ files: [f] })); } catch (e) { files = false; }
    const clip = !!(navigator.clipboard && navigator.clipboard.write && window.ClipboardItem);
    return { files, clip, any: files || clip };
  }
  const isAndroid = () => /Android/i.test(navigator.userAgent);
  // فتح النظام نفسه في Google Chrome على أندرويد (وإن لم يكن مثبّتاً: صفحته في متجر Google Play)
  function chromeIntentUrl() {
    const target = location.host + location.pathname + location.search;
    return `intent://${target}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent("https://play.google.com/store/apps/details?id=com.android.chrome")};end`;
  }
  function receiptKey(order, kind) {
    const cust = customers.find((c) => c.id === order.customerId);
    return [kind, order.id, order.status, JSON.stringify(order.payment), order.paymentConfirmed, cust ? cust.balance : "", ledger.filter((tx) => tx.orderId === order.id).length, lang].join("|");
  }
  async function buildReceiptFile(order, cust, kind) {
    const key = receiptKey(order, kind), hit = receiptCache.get(order.id + kind);
    if (hit && hit.key === key) return hit;
    try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (e) { /* تجاهل */ }
    const cv = receiptCanvas(order, cust);
    const blob = kind === "image" ? await new Promise((r) => cv.toBlob(r, "image/png")) : pdfFromCanvas(cv);
    const name = `997-laundry-receipt-${order.number}.${kind === "image" ? "png" : "pdf"}`;
    let file = null; try { file = new File([blob], name, { type: blob.type }); } catch (e) { file = null; }
    const r = { key, blob, file, name, preview: kind === "image" ? null : cv.toDataURL("image/png") };
    receiptCache.set(order.id + kind, r);
    return r;
  }
  function prepareReceiptFiles(order, cust) {
    setTimeout(() => { ["image", "pdf"].forEach((k) => { buildReceiptFile(order, cust, k).catch(() => {}); }); }, 250);
  }
  async function shareReceiptFile(order, cust, kind) {
    const r = await buildReceiptFile(order, cust, kind);
    const caption = lang === "en" ? `Receipt for order #${order.number} — 997 Laundry` : `إيصال طلبك رقم #${order.number} — 997 Laundry`;
    logActivity(`مشاركة إيصال ${kind === "image" ? "صورة" : "PDF"} للطلب #${order.number} بواسطة ${me ? me.name : ""}`);
    // الملف وحده على كل الأجهزة: مع نص مرافق يرسل واتساب الملف مرتين (أندرويد) أو النص فقط (آيفون)
    const data = r.file ? { files: [r.file] } : null;
    if (data && navigator.canShare && navigator.share) {
      let ok = false; try { ok = navigator.canShare(data); } catch (e) { ok = false; }
      if (ok) {
        try { await navigator.share(data); return "shared"; }
        catch (e) { if (e && e.name === "AbortError") return "cancelled"; /* NotAllowedError وغيره → المعاينة */ }
      }
    }
    // الكمبيوتر: تنزيل الملف مباشرة (يُسحب إلى واتساب ويب) + المعاينة؛ الجوال: المعاينة فقط (التنزيل غير موثوق داخل تطبيق الشاشة الرئيسية في آيفون)
    if (!isTouch()) downloadBlob(r.blob, r.name);
    showReceiptPreview(order, cust, kind, r, caption, !isTouch());
    return isTouch() ? "preview" : "downloaded";
  }
  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  function showReceiptPreview(order, cust, kind, r, caption, downloaded) {
    let dlg = document.getElementById("receiptPreviewDialog");
    if (!dlg) { dlg = document.createElement("dialog"); dlg.id = "receiptPreviewDialog"; dlg.className = "modal"; document.body.appendChild(dlg); }
    const en = lang === "en";
    const src = kind === "image" ? URL.createObjectURL(r.blob) : r.preview;
    const sup = imageSendSupport();
    const weak = isAndroid() && !sup.any;
    const steps = en
      ? "<ol style=\"text-align:start;margin:6px 0 10px;padding-inline-start:20px;line-height:1.7\"><li>⬇ <b>Download image</b></li><li>📲 <b>Open customer's chat</b></li><li>In WhatsApp: 📎 → <b>Gallery</b> → choose the receipt → Send</li></ol>"
      : "<ol style=\"text-align:start;margin:6px 0 10px;padding-inline-start:20px;line-height:1.7\"><li>⬇ <b>حفظ الصورة</b></li><li>📲 <b>فتح محادثة العميل</b></li><li>في واتساب: 📎 ← <b>المعرض</b> ← اختر الإيصال ← إرسال</li></ol>";
    const weakBox = weak ? `<div style="background:#fff4e0;border:1px solid #f0c27a;border-radius:12px;padding:10px 12px;margin:0 0 10px;text-align:start;font-size:13px">⚠ ${en ? "This device's browser can't send images directly. Open the system in <b>Google Chrome</b> — then the receipt image goes in one step." : "متصفح هذا الجهاز لا يدعم إرسال الصور مباشرة. افتح النظام في <b>Google Chrome</b> — بعدها تُرسل صورة الإيصال بخطوة واحدة."}<br><a class="primary-btn" style="display:inline-block;margin-top:8px;text-decoration:none" href="${esc(chromeIntentUrl())}">🌐 ${en ? "Open in Google Chrome" : "افتح النظام في Google Chrome"}</a></div>` : "";
    dlg.innerHTML = `<div style="padding:16px;max-width:420px;margin:auto;text-align:center">
      <h3 style="margin:0 0 6px">${en ? "Receipt" : "الإيصال"} #${esc(order.number)}</h3>
      ${weakBox}${weak ? steps : ""}
      <p class="section-note" style="margin:0 0 10px${weak ? ";display:none" : ""}">${isTouch() ? (en ? "Press and hold the receipt → Save / Share, then send it in the customer's WhatsApp chat." : "اضغط مطوّلاً على الإيصال ← «حفظ» أو «مشاركة»، ثم أرسله في محادثة العميل على واتساب.") : downloaded ? (en ? "The file was downloaded — drag it into the customer's WhatsApp chat (📎)." : "تم تنزيل الملف — اسحبه إلى محادثة العميل على واتساب (📎).") : (en ? "Press Download, then attach the file in the customer's WhatsApp chat (📎)." : "اضغط «تنزيل» ثم أرفق الملف في محادثة العميل على واتساب (📎).")}</p>
      <img id="rpImg" src="${src}" alt="receipt" style="width:100%;max-height:60vh;object-fit:contain;border:1px solid var(--border);border-radius:12px;background:#fff;-webkit-touch-callout:default;user-select:auto">
      <div class="row-actions" style="justify-content:center;margin-top:12px;flex-wrap:wrap">
        <button class="primary-btn" type="button" id="rpDownload">⬇ ${en ? "Download" : "تنزيل"} ${kind === "image" ? (en ? "image" : "الصورة") : "PDF"}</button>
        ${sup.files && r.file ? `<button class="secondary-btn" type="button" id="rpShare">↗ ${en ? "Share" : "مشاركة"}</button>` : ""}
        ${cust ? `<button class="whatsapp-btn" type="button" id="rpWa">📲 ${en ? "Open customer's chat" : "فتح محادثة العميل"}</button>` : ""}
        <button class="ghost-btn" type="button" id="rpClose">${en ? "Close" : "إغلاق"}</button>
      </div></div>`;
    dlg.querySelector("#rpDownload").onclick = () => downloadBlob(r.blob, r.name);
    if (dlg.querySelector("#rpShare")) dlg.querySelector("#rpShare").onclick = () => { navigator.share({ files: [r.file] }).catch(() => {}); };
    if (cust) dlg.querySelector("#rpWa").onclick = () => openWhatsApp(cust.phone, caption);
    dlg.querySelector("#rpClose").onclick = () => { dlg.close(); if (kind === "image") setTimeout(() => URL.revokeObjectURL(src), 1000); };
    if (!dlg.open) dlg.showModal();
  }
  window.receiptFile997 = async (id, kind) => { const o = orders.find((x) => x.id === id); if (!o) return null; const cv = receiptCanvas(o, customers.find((c) => c.id === o.customerId)); return kind === "image" ? cv.toDataURL("image/png") : pdfFromCanvas(cv); };

  window.receiptText997 = (id) => { const o = orders.find((x) => x.id === id); return o ? receiptText(o, customers.find((c) => c.id === o.customerId)) : ""; };

  function ensurePrintContainer() {
    let el = document.getElementById("printReceipt");
    if (!el) { el = document.createElement("div"); el.id = "printReceipt"; el.style.display = "none"; document.body.appendChild(el); }
    return el;
  }
  function printOrder(orderId) {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    const cust = customers.find((c) => c.id === order.customerId);
    const p = order.payment;
    const profile = loadProfile();
    const shopName = profile.nameAr || t("receipt_title");

    // استخراج حركة الرصيد الفعلية المرتبطة بهذا الطلب من السجل المالي (مصدر الحقيقة الوحيد)
    const relatedTx = ledger.filter((tx) => tx.orderId === order.id);
    const balanceDelta = relatedTx.reduce((s, tx) => s + Number(tx.amount || 0), 0);
    const newBalance = cust ? cust.balance : 0;
    const previousBalance = cust ? round3(newBalance - balanceDelta) : 0;

    const el = ensurePrintContainer();
    el.innerHTML = `
      <div class="receipt" dir="${lang === "en" ? "ltr" : "rtl"}">
        <div class="receipt-header">
          <img class="receipt-logo" src="${LOGO_997}" alt="">
          <h2><bdi>${esc(shopName)}</bdi></h2>
          ${profile.phone ? `<p class="receipt-sub">${esc(profile.phone)}</p>` : ""}
          ${profile.address ? `<p class="receipt-sub">${esc(profile.address)}</p>` : ""}
        </div>
        <div class="receipt-divider"></div>
        <p class="receipt-meta"><span>${t("receipt_order", order.number)}</span><span>${fmtDT(order.createdAt)}</span></p>
        ${cust ? `<p class="receipt-meta"><span>${esc(cust.name)}</span><span><span dir="ltr">${esc(fmtPhone(cust.phone))}</span></span></p>` : ""}
        <div class="receipt-divider"></div>

        <table>
          <thead><tr><th>${t("th_cloth")}</th><th>${t("th_service")}</th><th>${t("th_qty")}</th><th>${t("th_total")}</th></tr></thead>
          <tbody>${order.items.map((it) => `<tr><td>${it.urgent || (order.priority === "urgent" && !order.items.some((x) => x.urgent === true)) ? "⚡ " : ""}${clothingName(it.clothingId)}</td><td>${serviceName(it.serviceId)}</td><td>${it.qty}</td><td>${money(it.total)}</td></tr>`).join("")}${(order.extras || []).map((l) => `<tr><td>${esc(extraLabel(l))}</td><td>—</td><td>${l.qty}</td><td>${extraVal(l)}</td></tr>`).join("")}</tbody>
        </table>
        ${order.notes ? `<div class="receipt-notes"><strong>⚠ ${t("dlg_notes")}:</strong> ${esc(order.notes)}</div>` : ""}
        ${orderPackageLines(order).map((l) => `<div class="receipt-notes">🎟 ${esc(l)}</div>`).join("")}
        <div class="receipt-divider"></div>

        <div class="receipt-line"><span>${t("sum_subtotal")}</span><span>${money(p.subtotal)}</span></div>
        ${p.urgentFee > 0 ? `<div class="receipt-line"><span>${t("sum_urgent")}</span><span>${money(p.urgentFee)}</span></div>` : ""}
        ${p.discount > 0 ? `<div class="receipt-line"><span>${t("sum_discount")}</span><span>-${money(p.discount)}</span></div>` : ""}
        ${p.vat > 0 ? `<div class="receipt-line"><span>ضريبة القيمة المضافة (${p.vatPercent}%)</span><span>${money(p.vat)}</span></div>` : ""}
        <div class="receipt-line receipt-total"><span>${t("receipt_total")}</span><span>${money(p.total)}</span></div>
        <div class="receipt-line"><span>${t("dlg_payment_method")}</span><span>${orderPayLabel(order)}</span></div>
        <div class="receipt-line"><span>${t("dlg_paid")}</span><span>${money(p.paid)}</span></div>
        ${p.balanceUse > 0 ? `<div class="receipt-line"><span>${t("lbl_balance_use")}</span><span>${money(p.balanceUse)}</span></div>` : ""}
        <div class="receipt-line receipt-total"><span>${t("receipt_remaining")}</span><span>${money(orderOwedNow(order))}</span></div>

        ${cust ? `
        <div class="receipt-divider receipt-divider-double"></div>
        <p class="receipt-section-title">${t("receipt_balance_summary")}</p>
        <div class="receipt-line"><span>${t("receipt_previous_balance")}</span><span>${money(previousBalance)}</span></div>
        ${balanceDelta !== 0 ? `<div class="receipt-line"><span>${t("receipt_this_transaction")}</span><span>${balanceDelta >= 0 ? "+" : ""}${money(balanceDelta)}</span></div>` : ""}
        <div class="receipt-line receipt-total"><span>${t("receipt_new_balance")}</span><span>${money(newBalance)}</span></div>
        ${newBalance < 0 ? `<p class="receipt-debtor">⚠ ${t("customer_debtor")}</p>` : ""}
        ` : ""}

        <div class="receipt-divider"></div>
        <p class="receipt-thanks">${t("receipt_thanks")}</p>
      </div>`;
    window.print();
  }

  /* ============================= صفحة الطلبات ============================= */
  function populateFilterOptions() {
    const statusSel = document.getElementById("orderStatusFilter");
    const currentVal = statusSel.value || "all";
    statusSel.innerHTML = `<option value="all">${t("opt_all_statuses")}</option>` +
      STATUS_IDS.map((id) => `<option value="${id}">${statusLabel(id)}</option>`).join("");
    statusSel.value = currentVal;
  }
  document.getElementById("orderStatusFilter").addEventListener("change", () => renderOrdersPage());
  document.getElementById("orderSearch")?.addEventListener("input", () => renderOrdersPage());
  // Enter على رقم طلب مطابق يفتحه مباشرة
  document.getElementById("orderSearch")?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const q = toLatinDigits(e.target.value).trim().replace(/^#/, "");
    const hit = /^\d+$/.test(q) && (orders.find((o) => Number(o.number) === Number(q)) || orders.find((o) => Number(o.prevNumber) === Number(q)));
    if (hit) { e.preventDefault(); openOrderDialog(hit.id); }
  });
  document.getElementById("orderPriorityFilter").addEventListener("change", () => renderOrdersPage());

  const dupNumber = (o) => orders.some((x) => x.id !== o.id && x.number === o.number);
  // طلب برقم مكرر (مثلاً أُنشئ بدون إنترنت على جهازين): رقم جديد لا يتكرر — يُسجَّل التغيير في سجل الطلب
  async function renumberOrder(order) {
    if (!can("create_order")) { denied(); return; }
    const maxNum = orders.reduce((m, o) => Math.max(m, Number(o.number) || 0), 0);
    let n = null;
    if (cloudOn()) n = await CLOUD.reserveNumber(maxNum + 1);
    if (!n) n = maxNum + 1;
    const old = order.number, number = String(n).padStart(5, "0");
    order.number = number;
    (order.editHistory = order.editHistory || []).push({ at: new Date().toISOString(), by: me ? me.name : "", reason: `رقم مكرر #${old} → #${number}`, before: { pieces: piecesOf(order), total: order.payment.total }, after: { pieces: piecesOf(order), total: order.payment.total } });
    logActivity(`تغيير رقم الطلب المكرر #${old} إلى #${number} بواسطة ${me ? me.name : ""}`);
    persistAll(); renderOrderDialog(); renderOrdersPage();
    toast(lang === "en" ? `New number #${number} — tell the customer` : `الرقم الجديد #${number} — أبلغ العميل`);
  }
  // المالك: ترقيم كل الطلبات 1، 2، 3… حسب تاريخ الإنشاء. الرقم القديم يُحفظ في الطلب ويبقى قابلاً للبحث
  // (إيصالات العملاء القديمة)، ويُسجَّل في سجل الطلب وسجل النشاط. يتطلب اتصالاً وأن تكون كل الأجهزة متزامنة.
  function renumberAllOrders() {
    if (role !== "owner") { denied(); return; }
    const st0 = cloudOn() ? CLOUD.status() : null;
    if (st0 && (!st0.online || st0.pending)) { toast(lang === "en" ? "Wait until this device shows ☁ Synced ✓, then try again" : "انتظر حتى تظهر «☁ متزامن ✓» على هذا الجهاز ثم أعد المحاولة"); return; }
    const sorted = orders.slice().sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)) || (Number(a.number) || 0) - (Number(b.number) || 0));
    const changes = sorted.map((o, i) => ({ o, to: String(i + 1).padStart(5, "0") })).filter((x) => x.o.number !== x.to);
    if (!changes.length) { toast(lang === "en" ? "Order numbers are already in sequence ✓" : "أرقام الطلبات مرتبة بالفعل ✓"); return; }
    const sample = changes.slice(0, 5).map((x) => `#${x.o.number} → #${x.to}`).join("، ");
    openQuickForm({
      title: "🔢 ترتيب أرقام الطلبات",
      sub: `سيُعاد ترقيم ${changes.length} طلب حسب تاريخ الإنشاء (1، 2، 3…). مثال: ${sample}. الرقم القديم يُحفظ في كل طلب ويمكن البحث به (للإيصالات التي مع العملاء). المبالغ والدفعات لا تتغير. تأكد أن كل الأجهزة الأخرى متصلة ومتزامنة قبل المتابعة.`,
      fields: [{ id: "c", label: "اكتب «ترتيب» للتأكيد", type: "text" }],
      submitLabel: "ترتيب الأرقام",
      onSubmit: (v) => {
        if (String(v.c || "").trim() !== "ترتيب") { toast("اكتب «ترتيب» للتأكيد"); return false; }
        const now = new Date().toISOString();
        changes.forEach(({ o, to }) => {
          if (!o.prevNumber) o.prevNumber = o.number;
          (o.editHistory = o.editHistory || []).push({ at: now, by: me ? me.name : "", reason: `ترتيب أرقام الطلبات #${o.number} → #${to}`, before: { pieces: piecesOf(o), total: o.payment.total }, after: { pieces: piecesOf(o), total: o.payment.total } });
          o.number = to;
        });
        settings.orderSeq = sorted.length + 1;
        logActivity(`ترتيب أرقام الطلبات: ${changes.length} طلب أُعيد ترقيمه حسب تاريخ الإنشاء (1–${sorted.length}) بواسطة ${me ? me.name : ""}`);
        persistAll(); renderOrdersPage();
        toast(lang === "en" ? `${changes.length} orders renumbered 1–${sorted.length}` : `تم ترتيب ${changes.length} طلب (1–${sorted.length})`);
        // السحابة: بعد رفع الأرقام الجديدة يبدأ الرقم التالي من بعد آخر طلب
        if (cloudOn()) {
          const next = sorted.length + 1;
          const tryCounter = async (n) => {
            await CLOUD.syncNow();
            if (CLOUD.status().pending && n > 0) { setTimeout(() => tryCounter(n - 1), 2000); return; }
            const r = await CLOUD.setOrderCounter(next);
            if (r.error) toast(lang === "en" ? "Numbers saved; the cloud counter could not be updated — run the latest setup.sql" : "تم حفظ الأرقام؛ تعذّر تحديث عدّاد السحابة — شغّل ملف setup.sql الأحدث في Supabase");
          };
          setTimeout(() => tryCounter(10), 500);
        }
      },
    });
  }
  document.getElementById("renumberAllBtn")?.addEventListener("click", renumberAllOrders);
  function renderOrdersPage(searchOverride) {
    const rb = document.getElementById("renumberAllBtn"); if (rb) rb.hidden = role !== "owner";
    populateFilterOptions();
    const statusFilter = document.getElementById("orderStatusFilter").value;
    const priorityFilter = document.getElementById("orderPriorityFilter").value;
    const q = toLatinDigits(searchOverride ?? (document.getElementById("orderSearch")?.value || document.getElementById("globalSearch").value) ?? "").trim().toLowerCase().replace(/^#/, "");
    const qPhoneDigits = q.replace(/[^0-9]/g, "").replace(/^0+/, "");

    let list = orders.slice();
    if (statusFilter !== "all") list = list.filter((o) => o.status === statusFilter);
    if (priorityFilter !== "all") list = list.filter((o) => o.priority === priorityFilter);
    if (q) {
      list = list.filter((o) => {
        const cust = customers.find((c) => c.id === o.customerId);
        const phoneMatch = qPhoneDigits.length >= 3 && cust && cust.phone.replace(/[^0-9]/g, "").includes(qPhoneDigits);
        return o.number.includes(q) || (o.prevNumber && String(o.prevNumber).includes(q)) || (cust && cust.name.toLowerCase().includes(q)) || phoneMatch;
      });
      // رقم الطلب المطابق تماماً أولاً (كتابة 5 تُظهر #00005 في الأعلى)
      if (/^\d+$/.test(q)) list.sort((x, y) => (Number(y.number) === Number(q)) - (Number(x.number) === Number(q)));
    }

    const body = document.getElementById("ordersBody");
    const cards = document.getElementById("ordersCards");
    const emptyMsg = orders.length === 0 ? t("empty_orders") : t("empty_orders_filtered");
    if (list.length === 0) {
      body.innerHTML = `<tr><td colspan="8" class="empty-state compact">${emptyMsg}</td></tr>`;
      cards.innerHTML = `<div class="empty-state compact">${emptyMsg}</div>`;
      return;
    }

    body.innerHTML = list.map((o) => {
      const cust = customers.find((c) => c.id === o.customerId);
      const pieces = o.items.reduce((s, it) => s + it.qty, 0);
      return `<tr>
        <td><strong>#${o.number}</strong>${dupNumber(o) ? ` <span class="status-badge status-cancelled" title="رقم مكرر">⚠ ${lang === "en" ? "duplicate no." : "رقم مكرر"}</span>` : ""}</td><td>${cust ? esc(cust.name) : "—"}</td><td>${pieces}</td><td>${money(o.payment.total)}</td>
        <td><span class="priority-badge ${o.priority === "urgent" ? "priority-urgent" : "priority-normal"}">${o.priority === "urgent" ? t("opt_urgent") : t("opt_normal")}</span></td>
        <td><span class="status-badge ${statusClass(o.status)}">${statusLabel(o.status)}</span>${o.status === "ready" && !o.paymentConfirmed ? ` <span class="priority-badge priority-urgent">${lang === "en" ? "Unpaid" : "غير مدفوع"}</span>` : ""}</td>
        <td>${o.expectedDelivery ? fmtDT(o.expectedDelivery) : "—"}</td>
        <td class="row-actions"><button class="mini-btn" data-view="${o.id}">${lang === "ar" ? "عرض" : "View"}</button></td>
      </tr>`;
    }).join("");

    cards.innerHTML = list.map((o) => {
      const cust = customers.find((c) => c.id === o.customerId);
      return `<div class="order-card-mobile">
        <div class="top"><strong>#${o.number} — ${cust ? esc(cust.name) : "—"}</strong><span class="status-badge ${statusClass(o.status)}">${statusLabel(o.status)}${o.status === "ready" && !o.paymentConfirmed ? (lang === "en" ? " · Unpaid" : " · غير مدفوع") : ""}</span></div>
        <div class="meta">${money(o.payment.total)} · ${o.priority === "urgent" ? t("opt_urgent") : t("opt_normal")}</div>
        <div class="actions"><button class="mini-btn" data-view="${o.id}">${lang === "ar" ? "عرض التفاصيل" : "View details"}</button></div>
      </div>`;
    }).join("");

    document.querySelectorAll("[data-view]").forEach((btn) => btn.addEventListener("click", () => openOrderDialog(btn.dataset.view)));
  }

  /* ------------------------ مربع حوار تفاصيل الطلب ------------------------ */
  const orderDialog = document.getElementById("orderDialog");
  /* ---- تأكيد الدفع وتجهيز الطلب (مع ضوابط منع التحايل) ---- */
  const PAY_OPTIONS = [
    { value: "cash", label: "نقداً" }, { value: "card", label: "بطاقة" },
    { value: "benefitpay", label: "Benefit Pay" }, { value: "balance", label: "من رصيد العميل" },
    { value: "bank_transfer", label: "تحويل بنكي" }, { value: "unpaid", label: "آجل (دين على العميل)" },
  ];
  // 💳 BenefitPay: الرقم والاسم من الإعدادات (لا يُكتب في الكود) — يظهر في رسائل واتساب، ورقم العملية إلزامي عند الدفع به
  const bpCfg = () => { const b = settings.benefitPay || {}; return { number: String(b.number || "").trim(), name: String(b.name || "").trim(), iban: String(b.iban || "").replace(/\s+/g, "").toUpperCase(), qr: typeof b.qr === "string" && b.qr.startsWith("data:image/") ? b.qr : "", requireRef: b.requireRef !== false }; };
  const fmtIban = (v) => String(v || "").replace(/(.{4})/g, "$1 ").trim();
  const normRef = (v) => toLatinDigits(String(v || "")).replace(/[^0-9A-Za-z-]/g, "").slice(0, 40);
  const bpRefField = () => ({ id: "ref", label: lang === "ar" ? "🔖 رقم عملية Benefit Pay (Reference) — مطلوب عند الدفع بـ Benefit" : "🔖 Benefit Pay reference — required when paying by Benefit", type: "text", value: "", placeholder: lang === "ar" ? "مثال: 230145678912" : "e.g. 230145678912" });
  function bpRefProblem(method, ref) {
    if (method !== "benefitpay" || !bpCfg().requireRef) return "";
    if (normRef(ref).length < 4) return lang === "ar" ? "اكتب رقم عملية Benefit Pay (Reference) من إشعار التطبيق — مطلوب للمطابقة" : "Enter the Benefit Pay reference from the app notification — needed for reconciliation";
    const dup = orders.find((o) => o.payment && o.payment.ref && o.payment.ref === normRef(ref)) || ledger.find((t) => t.ref && t.ref === normRef(ref));
    return dup ? (lang === "ar" ? `رقم العملية ${normRef(ref)} مسجّل من قبل${dup.number ? ` على الطلب #${dup.number}` : ""} — تأكد منه` : `Reference ${normRef(ref)} was already used${dup.number ? ` on order #${dup.number}` : ""} — please check`) : "";
  }
  function bpLine(L, orderNo) {
    const b = bpCfg(); if (!b.number && !b.iban) return "";
    const en = L === "en", out = [];
    if (b.number) out.push(en ? `💳 BenefitPay: ${b.number}${b.name ? ` (${b.name})` : ""}${orderNo ? ` — write order #${orderNo} in the note` : ""}` : `💳 BenefitPay على الرقم: ${b.number}${b.name ? ` (${b.name})` : ""}${orderNo ? ` — اكتب رقم الطلب #${orderNo} في الملاحظة` : ""}`);
    if (b.iban) out.push(en ? `🏦 Or transfer to IBAN: ${fmtIban(b.iban)}` : `🏦 أو تحويل للآيبان: ${fmtIban(b.iban)}`);
    return out.join("\n");
  }
  // 📲 إرسال طريقة الدفع للعميل: صورة باركود BenefitPay تُنسخ (لصق ← إرسال في واتساب) + نص بالمبلغ والرقم والآيبان
  async function sendPayInfo(cust, amount, orderNo) {
    const b = bpCfg(); if (!cust || !cust.phone || (!b.number && !b.iban && !b.qr)) return;
    const L = lang === "en" ? "en" : "ar";
    const text = L === "en" ? `Hi ${cust.name} 🌸\nAmount due: ${money(amount)}${orderNo ? ` (order #${orderNo})` : ""}\n${bpLine("en", orderNo)}${b.qr ? "\n📷 Or scan the BenefitPay QR code (image attached)" : ""}\n\nThank you 💙\n${SIGN.en}`
      : `هلا ${cust.name} 🌸\nالمبلغ المطلوب: ${money(amount)}${orderNo ? ` (طلب #${orderNo})` : ""}\n${bpLine("ar", orderNo)}${b.qr ? "\n📷 أو امسح باركود BenefitPay (الصورة مرفقة)" : ""}\n\nشكراً لك 💙\n${SIGN.ar}`;
    let copied = false;
    if (b.qr) {
      try {
        const bin = atob(b.qr.split(",")[1]), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        if (navigator.clipboard && window.ClipboardItem) { await navigator.clipboard.write([new window.ClipboardItem({ "image/png": new Blob([u8], { type: "image/png" }) })]); copied = true; }
      } catch (e) { copied = false; }
    }
    openWhatsApp(cust.phone, text);
    logActivity(`💳 إرسال طريقة الدفع BenefitPay — ${cust.name} — ${money(amount)}${orderNo ? ` — طلب #${orderNo}` : ""}`);
    if (copied) toast(lang === "en" ? "📋 QR image copied — in WhatsApp: press and hold → Paste → Send" : "📋 نُسخت صورة الباركود — في واتساب: اضغط مطوّلاً ← «لصق» ← إرسال");
  }
  // وصف حالة الدفع للعرض: الطلب الجاهز بدون دفع = "يُدفع عند الاستلام"
  // المتبقي على الطلب الآن (بعد أي سداد لاحق) — المصدر الوحيد لكل الشاشات والإيصالات
  function orderOwedNow(order) {
    if (!order || order.status === "cancelled") return 0;
    if (!order.paymentConfirmed) return round3(Number(order.payment.total) || 0);
    if (!order.debtRecorded) return 0;
    const cust = customers.find((c) => c.id === order.customerId);
    return cust ? round3(FIN.allocateDebts([cust], orders, ledger)[order.id] || 0) : 0;
  }
  function orderPayLabel(order) {
    if (!order.paymentConfirmed && order.status !== "cancelled") return order.payLater ? (lang === "en" ? "⏳ Pay on pickup" : "⏳ يُدفع عند الاستلام") : (lang === "en" ? "Not paid yet" : "لم يُدفع بعد");
    return paymentLabel(order.payment.method) + (order.payment.ref ? ` · ${order.payment.ref}` : "");
  }
  // يتحقق من مدخلات الدفع ويسجّلها على الطلب ثم يستدعي onDone(now).
  // يرجع false عند خطأ بالإدخال (تبقى النافذة مفتوحة). الآجل/الجزئي مسموح مباشرة ويُسجَّل باسم الموظف.
  function applyOrderPayment(order, cust, v, what, onDone) {
    const total = order.payment.total;
    const method = v.method;
    let paid = Math.max(0, round3(v.paid) || 0);
    if (method === "balance") {
      if (!cust || round3(cust.balance) < total) { toast(`رصيد العميل (${money(cust ? cust.balance : 0)}) لا يكفي لسداد ${money(total)} — اختر طريقة دفع أخرى`); return false; }
      paid = 0;
    } else if (method === "unpaid") paid = 0;
    else if (paid <= 0 && total > 0) { toast("أدخل المبلغ المحصّل أو اختر «آجل»"); return false; }
    { const bad = bpRefProblem(method, v.ref); if (bad) { toast(bad); document.getElementById("qf_ref")?.focus(); return false; } }
    let overpay = 0;
    if (method !== "balance" && method !== "unpaid" && paid > total) { overpay = round3(paid - total); paid = total; }
    const owed = method === "balance" ? 0 : round3(Math.max(0, total - paid));
    const finalize = (sup, overridden) => {
      if (order.paymentConfirmed) { toast("تم تأكيد دفع هذا الطلب مسبقاً"); return; }
      const now = new Date().toISOString();
      order.payment.method = method;
      if (method === "benefitpay" && normRef(v.ref)) order.payment.ref = normRef(v.ref);
      order.payment.paid = paid;
      order.payment.outstanding = owed;
      order.paymentConfirmed = true;
      order.paidAt = now;
      order.paymentBy = me ? me.name : "";
      order.paymentById = me ? me.id : "";
      order.creditApprovedBy = owed > 0 && overridden ? sup.name : "";
      if (method === "balance" && cust) {
        cust.balance = round3(cust.balance - total);
        ledger.unshift({ id: uid(), byId: me ? me.id : "", customerId: cust.id, type: "order_charge", amount: -total, balanceAfter: cust.balance, method, orderId: order.id, note: `طلب #${order.number}`, at: now });
      }
      if (overpay > 0 && cust) {
        cust.balance = round3(cust.balance + overpay);
        ledger.unshift({ id: uid(), byId: me ? me.id : "", customerId: cust.id, type: "credit", amount: overpay, balanceAfter: cust.balance, method, orderId: order.id, note: `فائض دفعة طلب #${order.number} — أُضيف كرصيد`, at: now });
        toast(`تم تحصيل ${money(overpay)} زيادة عن قيمة الطلب — أُضيفت كرصيد للعميل`);
      }
      if (owed > 0 && cust) {
        cust.balance = round3(cust.balance - owed);
        order.debtRecorded = true;
        ledger.unshift({ id: uid(), byId: me ? me.id : "", customerId: cust.id, type: "order_charge", amount: -owed, balanceAfter: cust.balance, method: "unpaid", orderId: order.id, note: `طلب #${order.number} — ${paid > 0 ? "متبقي غير مسدد" : "آجل"}`, at: now });
      }
      logActivity(`تأكيد دفع طلب #${order.number} — ${money(method === "balance" ? total : paid)}${owed > 0 ? ` — دين مسجّل ${money(owed)}${overridden ? " اعتمده " + sup.name : ""}` : ""}`);
      onDone(now);
    };
    // الآجل/الدفع الجزئي بدون موافقة مشرف — يُسجَّل باسم الموظف ويظهر في ملف العميل وسجل النشاط
    finalize(null, false);
  }
  function refreshAfterOrderChange() {
    persistAll();
    renderOrderDialog();
    renderOrdersPage();
    if (document.getElementById("page-dashboard").classList.contains("active")) renderDashboard();
  }

  /* ---- تجهيز الطلب: الدفع الآن، أو «الدفع لاحقاً عند الاستلام» ---- */
  function openReadyPaymentForm(order) {
    const cust = customers.find((c) => c.id === order.customerId);
    const total = order.payment.total;
    if (order.status !== "received") { toast("تم تجهيز هذا الطلب مسبقاً"); return; }
    if (!shiftGuard()) return;
    openQuickForm({
      title: "✓ تجهيز الطلب — جاهز للتسليم",
      sub: `طلب #${order.number} — ${cust ? cust.name : ""} — المستحق: ${money(total)}${cust && Number(cust.balance) ? ` — رصيد العميل: ${money(cust.balance)}` : ""}. اختر «الدفع لاحقاً» إذا سيدفع العميل عند الاستلام.`,
      fields: [
        { id: "method", label: "طريقة الدفع", type: "select", value: "cash", options: [{ value: "later", label: "⏳ الدفع لاحقاً — عند استلام العميل" }, ...PAY_OPTIONS] },
        { id: "paid", label: "المبلغ المحصّل (د.ب) — يُتجاهل عند «الدفع لاحقاً»", type: "number", step: "0.001", value: total, min: 0 },
        bpRefField(),
      ],
      submitLabel: "تأكيد التجهيز",
      onSubmit: (v) => {
        const markReady = (now, note) => {
          if (order.status !== "received") return;
          order.status = "ready";
          order.readyAt = now;
          order.readyBy = me ? me.name : ""; order.readyById = me ? me.id : "";
          order.statusHistory.push({ status: "ready", at: now, by: me ? me.name : "", note });
        };
        if (v.method === "later") {
          const now = new Date().toISOString();
          order.payLater = true;
          markReady(now, "الدفع عند الاستلام");
          logActivity(`تجهيز طلب #${order.number} — الدفع لاحقاً عند الاستلام (${money(total)})`);
          refreshAfterOrderChange();
          waPrompt(`✓ الطلب #${order.number} جاهز — الدفع عند الاستلام`, `هل ترسل رسالة «طلبك جاهز» مع المبلغ المستحق للعميل على واتساب؟`, "📲 إرسال رسالة الجاهزية", () => { sendReadyMessage(order, cust); logActivity(`إرسال رسالة جاهزية واتساب — طلب #${order.number}`); });
          return;
        }
        return applyOrderPayment(order, cust, v, `تجهيز طلب #${order.number}`, (now) => {
          markReady(now);
          refreshAfterOrderChange();
          showReadyPrompt(order, cust);
        });
      },
    });
  }

  /* ---- تأكيد التسليم: مطابقة عدد القطع أمام العميل + تحصيل المبلغ إن كان «الدفع لاحقاً» ---- */
  function openDeliveryForm(order) {
    const cust = customers.find((c) => c.id === order.customerId);
    if (order.status !== "ready") return;
    const needPay = !order.paymentConfirmed;
    if (needPay && !shiftGuard()) return;
    const pieces = order.items.reduce((n, it) => n + it.qty, 0);
    const fields = [
      { id: "count", label: `عدد القطع المسلّمة — عُدّها واكتب الرقم (المطلوب ${pieces})`, type: "number", value: "", min: 0 },
      { id: "receiver", label: "اسم المستلم (اختياري)", type: "text", value: "" },
    ];
    if (needPay) fields.push(
      { id: "method", label: "💳 طريقة الدفع", type: "select", value: "cash", options: PAY_OPTIONS },
      { id: "paid", label: "المبلغ المحصّل (د.ب)", type: "number", step: "0.001", value: order.payment.total, min: 0 },
      bpRefField(),
    );
    openQuickForm({
      title: `📦 تسليم الطلب #${order.number}`,
      sub: `${cust ? cust.name : ""} — عُدّ القطع أمام العميل وأدخل العدد الفعلي.${needPay ? ` 💳 المستحق الآن: ${money(order.payment.total)}` : ""}${order.debtRecorded && order.payment.outstanding > 0 ? ` ⚠ دين مسجّل على العميل: ${money(order.payment.outstanding)}` : ""}`,
      fields,
      submitLabel: needPay ? "✓ تحصيل وتسليم" : "✓ تأكيد التسليم",
      onSubmit: (v) => {
        if (Number(v.count) !== pieces) {
          logActivity(`عدد قطع غير مطابق عند تسليم طلب #${order.number} (أُدخل ${v.count || 0} والمطلوب ${pieces}) بواسطة ${me ? me.name : ""}`);
          toast(v.count ? `العدد غير مطابق — الطلب ${pieces} قطعة وأدخلت ${v.count}. راجع القطع قبل التسليم` : `اكتب عدد القطع المسلّمة (${pieces}) بعد عدّها أمام العميل`);
          return false;
        }
        const deliver = () => {
          if (order.status !== "ready") return;
          const now = new Date().toISOString();
          order.status = "delivered";
          order.deliveredAt = now;
          if (order.delivery && order.delivery.drop) { order.delivery.dropStatus = "done"; order.delivery.doneAt = now; }
          order.deliveredBy = me ? me.name : "";
          order.deliveredById = me ? me.id : "";
          order.receiver = v.receiver || "";
          order.statusHistory.push({ status: "delivered", at: now, by: me ? me.name : "" });
          logActivity(`${t("dlg_advance_to", statusLabel("delivered"))} — #${order.number}${v.receiver ? " — المستلم: " + v.receiver : ""}`);
          refreshAfterOrderChange();
          toast(t("toast_status_updated"));
          // تلقائياً بنفس ضغطة «تأكيد التسليم»: واتساب يفتح على محادثة العميل وفيها رسالة الشكر + رابط الإيصال — الموظف يضغط «إرسال» فقط
          // إيصال التسليم كصورة: تلقائياً عبر WhatsApp Business API إن كان مفعّلاً، وإلا بنفس الضغطة: نسخ الصورة + فتح محادثة العميل
          if (cust && settings.autoReceiptOnDelivery !== false && validLocalPhone(cust.phone)) {
            if (waApiOn()) autoSendReceipt(order, cust);
            else sendReceiptImageManual(order, cust);
          } else showDeliveredPrompt(order, cust);
        };
        if (needPay) return applyOrderPayment(order, cust, v, `تسليم طلب #${order.number}`, deliver);
        deliver();
      },
    });
  }

  /* ---- تعديل طلب قبل الدفع: الكميات، الأولوية، الملاحظات، الموعد — مع إعادة حساب الإجمالي وسجل التعديل ---- */
  function recomputeOrderTotals(order) {
    const p = order.payment;
    refreshOrderExtras(order);
    const itemsTotal = round3(order.items.reduce((a, it) => a + it.total, 0));
    const extrasTotal = extrasTotalOf(order.extras);
    const subtotal = round3(itemsTotal + extrasTotal);
    const urgentFee = order.priority === "urgent" ? urgentFeeOf(order.items) : 0;
    const ppc = Number(order.discountPiecePrice);
    const dlvFee = Number(order.discountPercent) >= 100 ? 0 : extrasTotalOf((order.extras || []).filter((l) => String(l.id).startsWith("dlv_")));
    const discount = order.discountCode && order.discountPercent ? round3(((subtotal + urgentFee - dlvFee) * order.discountPercent) / 100)
      : order.discountCode && order.discountPiecePrice !== undefined && ppc >= 0 ? round3(Math.min(subtotal + urgentFee, order.items.reduce((a, it) => (it.fromPackageId ? a : a + Math.max(0, (Number(it.unit) || 0) - ppc) * it.qty), 0)))
      : round3(Math.min(Number(p.discount) || 0, subtotal + urgentFee));
    const preVat = Math.max(0, round3(subtotal + urgentFee - discount));
    const vatPercent = p.vatPercent !== undefined ? Number(p.vatPercent) || 0 : Number(loadProfile().vatPercent) || 0;
    const vat = vatPercent > 0 ? round3((preVat * vatPercent) / 100) : 0;
    const total = round3(preVat + vat);
    order.payment = { ...p, subtotal, extrasTotal, urgentFee, discount, vatPercent, vat, total, paid: 0, balanceUse: 0, outstanding: total };
  }
  function openEditOrderForm(order) {
    if (order.status !== "received" || order.paymentConfirmed) { toast(lang === "en" ? "Only unpaid received orders can be edited" : "يمكن تعديل الطلب فقط قبل تأكيد الدفع"); return; }
    if (!can("create_order")) { denied(); return; }
    const toLocalInput = (iso) => { if (!iso) return ""; const d = new Date(iso); if (isNaN(d)) return iso; return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") + "T" + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
    const fields = order.items.map((it, i) => ({ id: "q" + i, label: `${it.urgent ? "⚡ " : ""}${clothingName(it.clothingId)} — ${serviceName(it.serviceId)}${it.fromPackageId ? " (باقة)" : ` (${money(it.unit)})`}`, type: "number", step: "1", value: it.qty, min: 0 }));
    // إضافة أصناف جديدة للطلب (حتى 3 في كل تعديل): الصنف + الخدمة بسعر القائمة الحالي، والكمية
    const addOpts = [{ value: "", label: lang === "en" ? "— Add an item (optional) —" : "— إضافة صنف (اختياري) —" }];
    SERVICES_DEFAULT.forEach((sv) => activeGarments().forEach((g) => { const pr = offerPrice(g.id, sv.id); if (pr > 0) addOpts.push({ value: `${g.id}|${sv.id}`, label: `${clothingName(g.id)} (${money(pr)})`, group: serviceName(sv.id) }); }));
    for (let k = 0; k < 3; k++) fields.push(
      { id: "add" + k, label: `＋ ${lang === "en" ? "New item" : "صنف جديد"} ${k + 1}`, type: "select", value: "", options: addOpts },
      { id: "addq" + k, label: lang === "en" ? "Quantity" : "الكمية", type: "number", step: "1", value: 1, min: 1 });
    fields.push(
      { id: "priority", label: t("th_priority"), type: "select", value: order.priority, options: [{ value: "normal", label: t("opt_normal") }, { value: "urgent", label: t("opt_urgent") }] },
      { id: "expected", label: "موعد التسليم المتوقع", type: "datetime-local", value: toLocalInput(order.expectedDelivery) },
      { id: "notes", label: t("dlg_notes"), type: "text", value: order.notes || "" },
      { id: "reason", label: "سبب التعديل (إلزامي)", type: "text", value: "" },
    );
    openQuickForm({
      title: `✏️ تعديل الطلب #${order.number}`, sub: `غيّر الكمية أو اجعلها 0 لحذف الصنف، أو أضف أصنافاً جديدة من القوائم. الإجمالي يُعاد حسابه تلقائياً.${can("edit_order") ? "" : " تقليل القطع يحتاج موافقة مشرف."}`,
      fields, submitLabel: "حفظ التعديل",
      onSubmit: (v) => {
        if (!v.reason) { toast("اكتب سبب التعديل"); return false; }
        const newQty = order.items.map((it, i) => Math.max(0, Math.floor(Number(v["q" + i]) || 0)));
        const adds = [0, 1, 2].map((k) => { const [cl, sv] = String(v["add" + k] || "").split("|"); const q = Math.floor(Number(v["addq" + k]) || 0); return cl && sv && q > 0 ? { clothingId: cl, serviceId: sv, qty: q, unit: offerPrice(cl, sv) } : null; }).filter((a) => a && a.unit > 0);
        if (newQty.every((q) => q === 0) && !adds.length) { toast("لا يمكن حذف كل الأصناف — استخدم إلغاء الطلب بدلاً من ذلك"); return false; }
        const flagged = order.items.some((it) => it.urgent === true);
        const blockedU = v.priority === "urgent" && !(flagged && order.priority === "urgent") ? order.items.filter((it, i) => newQty[i] > 0 && urgentBlocked(it)) : [];
        if (blockedU.length) { toast(`الخدمة المستعجلة غير متوفرة لـ: ${[...new Set(blockedU.map((it) => clothingName(it.clothingId)))].join("، ")}`); return false; }
        // الباقات: الزيادة يجب أن تتوفر بالرصيد المتبقي للباقة
        for (let i = 0; i < order.items.length; i++) {
          const it = order.items[i], diff = newQty[i] - it.qty;
          if (it.fromPackageId && diff > 0) {
            const cp = customerPackages.find((x) => x.id === it.fromPackageId);
            if (!cp || cp.remainingPieces < diff * (it.pkgW || 1)) { toast(`لا توجد قطع كافية بالباقة «${it.packageName || ""}»`); return false; }
          }
        }
        const before = { pieces: order.items.reduce((a, it) => a + it.qty, 0), total: order.payment.total, priority: order.priority };
        const reduces = newQty.some((q, i) => q < order.items[i].qty) || (order.priority === "urgent" && v.priority === "normal");
        const apply = (sup, overridden) => {
          if (order.status !== "received" || order.paymentConfirmed) return;
          order.items.forEach((it, i) => {
            const diff = newQty[i] - it.qty;
            if (it.fromPackageId && diff !== 0) {
              const cp = customerPackages.find((x) => x.id === it.fromPackageId);
              if (cp) cp.remainingPieces = Math.min(cp.totalPieces, Math.max(0, cp.remainingPieces - diff * (it.pkgW || 1)));
            }
            it.qty = newQty[i];
            it.total = round3(it.unit * it.qty);
          });
          // الأصناف الجديدة: نفس الصنف والخدمة بنفس السعر → تُضاف للسطر الموجود، وإلا سطر جديد (مستعجل إذا كان الطلب كله مستعجلاً)
          const wholeUrgent = order.priority === "urgent" && order.items.every((x) => x.urgent !== false);
          adds.forEach((a) => {
            const same = order.items.find((x) => !x.fromPackageId && x.clothingId === a.clothingId && x.serviceId === a.serviceId && Number(x.unit) === a.unit && x.qty > 0);
            if (same) { same.qty += a.qty; same.total = round3(same.unit * same.qty); return; }
            const it = { id: uid(), clothingId: a.clothingId, serviceId: a.serviceId, qty: a.qty, unit: a.unit, total: round3(a.unit * a.qty), note: "" };
            if (order.items.some((x) => x.urgent !== undefined)) it.urgent = wholeUrgent && !urgentBlocked(it);
            order.items.push(it);
          });
          order.items = order.items.filter((it) => it.qty > 0);
          if (v.priority !== order.priority) order.items.forEach((it) => { if (flagged || v.priority === "normal") it.urgent = v.priority === "urgent" && !urgentBlocked(it); });
          else if (flagged && !order.items.some((it) => it.urgent)) v.priority = "normal"; // the urgent lines were removed
          order.priority = v.priority === "urgent" ? "urgent" : "normal";
          order.expectedDelivery = v.expected || null;
          order.notes = v.notes;
          recomputeOrderTotals(order);
          const after = { pieces: order.items.reduce((a, it) => a + it.qty, 0), total: order.payment.total, priority: order.priority };
          (order.editHistory = order.editHistory || []).push({ at: new Date().toISOString(), by: me ? me.name : "", approvedBy: overridden ? sup.name : "", reason: v.reason, before, after });
          logActivity(`تعديل الطلب #${order.number} — ${before.pieces}→${after.pieces} قطعة، ${money(before.total)}→${money(after.total)}${adds.length ? ` — أُضيف: ${adds.map((a) => `${clothingName(a.clothingId)} (${serviceName(a.serviceId)}) × ${a.qty}`).join("، ")}` : ""} — السبب: ${v.reason}${overridden ? " — اعتمده " + sup.name : ""}`, after.total);
          persistAll();
          renderOrderDialog();
          renderOrdersPage();
          toast(lang === "en" ? "Order updated" : "تم تعديل الطلب");
        };
        if (reduces) { setTimeout(() => requireOverride("edit_order", `تقليل قطع/قيمة الطلب #${order.number}`, apply), 80); return; }
        apply(null, false);
      },
    });
  }

  function openOrderDialog(orderId) {
    currentOrderDialogId = orderId;
    renderOrderDialog();
    orderDialog.showModal();
  }
  function flowStepsHtml(order) {
    if (order.status === "cancelled") return `<div class="flow-cancelled">✕ ملغي${order.cancelReason ? " — " + esc(order.cancelReason) : ""}</div>`;
    const idx = FLOW.indexOf(order.status);
    const n = lang === "ar" ? ["١", "٢", "٣"] : ["1", "2", "3"];
    const steps = [[n[0], "استلام الطلب"], [n[1], "دفع وجاهزية"], [n[2], "تسليم للعميل"]];
    return `<div class="flow-steps">${steps.map((st, i) => `<div class="fs ${i < idx || (i === idx && order.status === "delivered") ? "done" : i === idx ? "active" : ""}"><b>${i < idx || order.status === "delivered" ? "✓" : st[0]}</b><span>${st[1]}</span></div>`).join("")}</div>`;
  }
  function staffInfoHtml(order) {
    const rows = [];
    const when = (iso) => (iso ? ` <small class="inv-muted">${fmtDT(iso)}</small>` : "");
    if (order.createdBy) rows.push(["أنشأ الطلب", esc(order.createdBy) + when(order.createdAt)]);
    const readyH = (order.statusHistory || []).find((h) => h.status === "ready");
    const readyBy = order.readyBy || (readyH && readyH.by) || "";
    if (readyBy) rows.push(["جهّز الطلب (جاهز للتسليم)", esc(readyBy) + when(order.readyAt || (readyH && readyH.at))]);
    if (order.discountReason || order.discountApprovedBy) rows.push([order.discountCode ? "خصم بكود" : "خصم", `${money(order.payment.discount || 0)} — ${esc(order.discountReason || "")}${order.discountApprovedBy ? " (اعتمده " + esc(order.discountApprovedBy) + ")" : ""}`]);
    if (order.paymentBy) rows.push(["أكّد الدفع", esc(order.paymentBy) + (order.creditApprovedBy ? " — دين اعتمده " + esc(order.creditApprovedBy) : "") + when(order.paidAt)]);
    if (order.deliveredBy) rows.push(["سلّم الطلب للعميل", esc(order.deliveredBy) + (order.receiver ? " — المستلم: " + esc(order.receiver) : "") + when(order.deliveredAt)]);
    if (order.cancelledBy) rows.push(["ألغى الطلب", esc(order.cancelledBy) + (order.cancelApprovedBy ? " — اعتمده " + esc(order.cancelApprovedBy) : "")]);
    (order.editHistory || []).forEach((h) => rows.push([`عدّل الطلب (${fmtDT(h.at)})`, `${esc(h.by)} — ${h.before.pieces}→${h.after.pieces} قطعة، ${money(h.before.total)}→${money(h.after.total)} — ${esc(h.reason)}${h.approvedBy ? " (اعتمده " + esc(h.approvedBy) + ")" : ""}`]));
    if (!rows.length) return "";
    return `<div class="details-box full-span" style="grid-column:1/-1"><h4>سجل المسؤولية</h4>${rows.map((r) => `<div class="details-line"><span>${r[0]}</span><strong>${r[1]}</strong></div>`).join("")}</div>`;
  }
  // طلب فيه قطع مستعجلة وقطع عادية: موعدان للتجهيز
  function urgentSplitNote(order) {
    const u = order.items.filter((it) => it.urgent === true);
    if (!u.length || u.length === order.items.length) return "";
    const base = new Date((order.statusHistory && order.statusHistory[0] && order.statusHistory[0].at) || order.createdAt || Date.now()).getTime();
    const at = (h) => fmtDT(new Date(base + h * 3600e3).toISOString());
    const n = (list) => list.reduce((a, it) => a + it.qty, 0);
    return `<div class="details-line" style="background:var(--warning-soft,#fff6e0);border-radius:8px;padding:6px 8px"><span>⚡ ${n(u)} ${lang === "en" ? "urgent — ready by" : "قطعة مستعجلة — جاهزة قبل"} <b>${at(settings.urgentHours)}</b> · ${n(order.items.filter((it) => !it.urgent))} ${lang === "en" ? "normal — by" : "عادية — قبل"} <b>${at(settings.normalHours)}</b></span></div>`;
  }
  function renderOrderDialog() {
    const order = orders.find((o) => o.id === currentOrderDialogId);
    if (!order) { orderDialog.close(); return; }
    const cust = customers.find((c) => c.id === order.customerId);
    const idx = FLOW.indexOf(order.status);
    const next = order.status !== "cancelled" && idx >= 0 && idx < FLOW.length - 1 ? FLOW[idx + 1] : null;

    document.getElementById("orderDialogContent").innerHTML = `
      <div class="modal-header">
        <div><h3>${t("dlg_order_title", order.number)}</h3><p>${cust ? `<button type="button" class="link-btn cust-open" id="orderDlgCustomer">📋 ${esc(cust.name)}</button> — <span dir="ltr"><span dir="ltr">${esc(fmtPhone(cust.phone))}</span></span>` : ""}</p></div>
        <button class="icon-btn" id="closeOrderDialog">✕</button>
      </div>
      ${flowStepsHtml(order)}
      ${order.prevNumber && order.prevNumber !== order.number ? `<div class="inv-muted" style="padding:0 20px">${lang === "en" ? "Previous number (on older receipts)" : "الرقم السابق (في الإيصالات القديمة)"}: <b>#${esc(order.prevNumber)}</b></div>` : ""}
      ${dupNumber(order) ? `<div class="cloud-warn">⚠ ${lang === "en" ? "Another order has the same number." : "يوجد طلب آخر بنفس الرقم."} ${can("create_order") ? `<button class="mini-btn" id="renumberOrderBtn" type="button">🔢 ${lang === "en" ? "Give this order a new number" : "إعطاء هذا الطلب رقماً جديداً"}</button>` : ""}</div>` : ""}
      <div class="order-details-grid">
        <div class="details-box">
          <h4>${t("dlg_items")}</h4>
          ${urgentSplitNote(order)}
          ${order.items.map((it) => `<div class="details-line"><span>${it.urgent || (order.priority === "urgent" && !order.items.some((x) => x.urgent === true)) ? "⚡ " : ""}${clothingName(it.clothingId)} — ${serviceName(it.serviceId)} × ${it.qty}</span><strong>${it.fromPackageId ? `${money(pkgLineValue(it))} <small style="color:var(--success)">🎟 ${lang === "en" ? "package" : "من الباقة"}</small>` : money(it.total)}</strong></div>`).join("")}
          ${(order.extras || []).map((l) => `<div class="details-line"><span>➕ ${esc(extraLabel(l))}${l.per === "piece" ? ` × ${l.qty}` : ""}</span><strong>${extraVal(l)}</strong></div>`).join("")}${order.delivery ? `<div class="details-line"><span>🚚 ${esc(dlvStatusText(order))}</span><strong>${esc(order.delivery.address || "—")}</strong></div>` : ""}
        </div>
        <div class="details-box">
          <h4>${t("dlg_payment")}</h4>
          <div class="details-line"><span>${t("dlg_payment_method")}</span><strong>${orderPayLabel(order)}</strong></div>
          ${(() => {
            const ps = pkgSummary(order.items);
            if (!ps.n) return "";
            const en = lang === "en";
            return `<div class="details-line"><span>🎟 ${en ? "Package items at regular prices" : "قيمة قطع الباقة بالسعر العادي"}</span><strong>${money(ps.value)}</strong></div>
            <div class="details-line"><span>${en ? "Covered by the package" : "مغطاة من الباقة"} (${ps.pieces} ${en ? "pcs" : "قطعة"})</span><strong style="color:var(--success)">−${money(ps.value)}</strong></div>
            <div class="details-line"><span class="inv-muted">${en ? "Worth at package price (prepaid)" : "قيمتها بسعر الباقة (مدفوعة مسبقاً)"}</span><span>${money(ps.cost)}</span></div>
            ${orderPackageLines(order).map((x) => `<div class="details-line"><span class="inv-muted">${esc(x)}</span></div>`).join("")}`;
          })()}
          <div class="details-line"><span>${t("dlg_total")}</span><strong>${money(order.payment.total)}</strong></div>
          ${(() => {
            // المدفوع والمتبقي «الآن» — يشمل أي سداد لاحق على الطلب (لا الرقم المجمّد وقت أول دفعة)
            const owedNow = orderOwedNow(order);
            const paidNow = order.status === "cancelled" || !order.paymentConfirmed ? Number(order.payment.paid) || 0 : round3(order.payment.total - owedNow);
            const later = order.paymentConfirmed && order.status !== "cancelled" ? round3(paidNow - (order.payment.method === "balance" ? order.payment.total : Number(order.payment.paid) || 0)) : 0;
            return `<div class="details-line"><span>${t("dlg_paid")}</span><strong>${money(paidNow)}</strong></div>
            ${later > 0 ? `<div class="details-line"><span class="inv-muted">${lang === "en" ? "of which paid later" : "منها سداد لاحق"}</span><span>${money(later)}</span></div>` : ""}
            ${owedNow > 0 && cust && (bpCfg().number || bpCfg().iban || bpCfg().qr) ? `<div class="details-line"><span></span><button type="button" class="mini-btn" id="orderPayInfoBtn">💳 ${lang === "en" ? "Send BenefitPay details" : "إرسال طريقة الدفع"}</button></div>` : ""}
            <div class="details-line"><span>${t("dlg_remaining")}</span><strong style="color:${owedNow > 0 ? "var(--danger)" : "var(--success)"}">${owedNow > 0 ? money(owedNow) : order.debtRecorded && order.status !== "cancelled" ? (lang === "en" ? "Settled ✓" : "مسدَّد ✓") : money(0)}</strong></div>`;
          })()}
          ${order.refund ? `<div class="details-line"><span>${lang === "en" ? "Refunded" : "المبلغ المُرجَع"}</span><strong>${money(order.refund.amount)} — ${order.refund.mode === "balance" ? (lang === "en" ? "to balance" : "للرصيد") : paymentLabel(order.refund.method)}</strong></div>` : ""}
        </div>
        <div class="details-box full-span" style="grid-column:1/-1">
          <h4>${t("dlg_status")}</h4>
          <div class="stack-list">${order.statusHistory.map((h) => `<div class="details-line"><span>${statusLabel(h.status)}</span><strong>${fmtDT(h.at)}</strong></div>`).join("")}</div>
        </div>
        ${staffInfoHtml(order)}
        ${order.notes ? `<div class="details-box full-span" style="grid-column:1/-1"><h4>${t("dlg_notes")}</h4><p>${esc(order.notes)}</p></div>` : ""}
      </div>
      <div class="details-actions">
        ${next ? `<button class="primary-btn" id="advanceStatusBtn">${lang === "ar" ? (next === "ready" ? "✓ تجهيز الطلب (الدفع الآن أو لاحقاً)" : next === "delivered" ? (order.paymentConfirmed ? "📦 تسليم الطلب للعميل" : "💳📦 تحصيل المبلغ وتسليم الطلب") : t("dlg_advance_to", statusLabel(next))) : t("dlg_advance_to", statusLabel(next))}</button>` : ""}
        ${orderOwedNow(order) > 0 && order.paymentConfirmed && cust && can("balance_tx") ? `<button class="primary-btn" id="payOrderRemainingBtn">💵 ${lang === "en" ? `Collect remaining (${money(orderOwedNow(order))})` : `تحصيل المتبقي على الطلب (${money(orderOwedNow(order))})`}</button>` : ""}
        ${order.status === "received" && !order.paymentConfirmed && can("create_order") ? `<button class="secondary-btn" id="editOrderBtn">✏️ ${lang === "en" ? "Edit order" : "تعديل الطلب"}</button>` : ""}
        ${order.status !== "cancelled" && order.status !== "delivered" ? `<button class="secondary-btn" id="cancelOrderBtn">${t("dlg_cancel_order")}</button>` : ""}
        ${can("cancel_order") && order.status === "delivered" && order.deliveredAt && (Date.now() - new Date(order.deliveredAt).getTime() <= 24 * 3600 * 1000) ? `<button class="secondary-btn" id="revertDeliveryBtn">↩ إرجاع من التسليم (خلال 24 ساعة)</button>` : ""}
        <button class="whatsapp-btn" id="dialogWhatsappBtn">${t("dlg_send_whatsapp")}</button>
        <button class="whatsapp-btn" id="dialogReceiptPdfBtn">📄 ${lang === "en" ? "PDF receipt (WhatsApp)" : "إيصال PDF (واتساب)"}</button>
        <button class="secondary-btn" id="dialogReceiptImgBtn">🖼 ${lang === "en" ? "Receipt image" : "صورة الإيصال"}</button>
        ${cust && receiptLinksOn() && order.status !== "cancelled" ? `<button class="whatsapp-btn" id="dialogReceiptLinkBtn">🔗 ${lang === "en" ? "Receipt link on WhatsApp" : "رابط الإيصال على واتساب"}</button>` : ""}
        ${cust ? `<button class="whatsapp-btn" id="dialogReceiptWaBtn">🧾 ${lang === "en" ? "Text receipt on WhatsApp" : "إيصال نصي على واتساب"}</button>` : ""}
        <button class="ghost-btn" id="dialogPrintBtn">${t("dlg_print")}</button>
      </div>
      <div class="modal-actions"><button class="ghost-btn" id="closeOrderDialog2">${t("dlg_close")}</button></div>
    `;

    document.getElementById("closeOrderDialog")?.addEventListener("click", () => orderDialog.close());
    document.getElementById("orderPayInfoBtn")?.addEventListener("click", () => sendPayInfo(cust, orderOwedNow(order), order.number));
    document.getElementById("closeOrderDialog2")?.addEventListener("click", () => orderDialog.close());
    document.getElementById("advanceStatusBtn")?.addEventListener("click", () => {
      if (next === "ready") { openReadyPaymentForm(order); return; }
      if (next === "delivered") { openDeliveryForm(order); return; }
      const now = new Date().toISOString();
      order.status = next;
      order.statusHistory.push({ status: next, at: now });
      logActivity(`${t("dlg_advance_to", statusLabel(next))} — #${order.number}`);
      persistAll();
      renderOrderDialog();
      renderOrdersPage();
      toast(t("toast_status_updated"));
    });
    document.getElementById("editOrderBtn")?.addEventListener("click", () => openEditOrderForm(order));
    document.getElementById("payOrderRemainingBtn")?.addEventListener("click", () => balTxForm({ custId: cust.id, type: "credit", amount: orderOwedNow(order), orderId: order.id, onDone: () => { if (orderDialog.open) renderOrderDialog(); renderOrdersPage(); } }));
    document.getElementById("orderDlgCustomer")?.addEventListener("click", () => { orderDialog.close(); openCustomerProfile(cust.id); });
    document.getElementById("cancelOrderBtn")?.addEventListener("click", () => {
      if (order.payment.paid > 0 && order.payment.method !== "balance" && !shiftGuard()) return;
      requireOverride("cancel_order", `إلغاء الطلب #${order.number}`, (sup, overridden) => {
      const paidCash = order.payment.method !== "balance" && order.payment.method !== "unpaid" && order.payment.paid > 0;
      const cancelFields = [{ id: "reason", label: "سبب الإلغاء", type: "text", placeholder: "مثال: طلب مكرر، طلب العميل، خطأ إدخال" }];
      if (paidCash && cust) cancelFields.push({ id: "refund", label: `المبلغ المدفوع ${money(order.payment.paid)} — كيف يُعاد للعميل؟`, type: "select", value: "cash", options: [
        { value: "cash", label: `إرجاعه الآن (${paymentLabel(order.payment.method)}) — يُخصم من تحصيل اليوم` },
        { value: "balance", label: "إضافته لرصيد العميل (بدون إخراج نقد)" },
      ] });
      openQuickForm({
        title: "إلغاء الطلب", sub: `طلب #${order.number} — سبب الإلغاء إلزامي`,
        fields: cancelFields,
        submitLabel: "تأكيد الإلغاء",
        onSubmit: (v) => {
          if (!v.reason || !v.reason.trim()) { toast("سبب الإلغاء إلزامي"); return false; }
          if (order.status === "cancelled") return;
          const now = new Date().toISOString();
          let refundNote = "";
          // إن دُفع الطلب من رصيد العميل، تُعكَس الحركة تلقائياً (ضمن سيطرة النظام الكاملة)
          if (order.payment.method === "balance" && cust) {
            const refundAmount = order.payment.total;
            cust.balance = round3(cust.balance + refundAmount);
            ledger.unshift({ id: uid(), byId: me ? me.id : "", customerId: cust.id, type: "order_refund", amount: refundAmount, balanceAfter: cust.balance, method: "balance", orderId: order.id, note: `استرداد إلغاء طلب #${order.number} — ${v.reason}`, at: now });
            refundNote = ` — تم استرداد ${money(refundAmount)} لرصيد العميل تلقائياً`;
          }
          // مدفوع نقداً/بطاقة/تحويل: يُسجَّل الاسترداد فعلياً حتى يتطابق الصندوق والتقارير
          else if (paidCash) {
            const amt = round3(order.payment.paid);
            if (v.refund === "balance" && cust) {
              cust.balance = round3(cust.balance + amt);
              ledger.unshift({ id: uid(), byId: me ? me.id : "", customerId: cust.id, type: "order_refund", amount: amt, balanceAfter: cust.balance, method: "balance", orderId: order.id, note: `إلغاء طلب #${order.number} — المدفوع أُضيف للرصيد — ${v.reason}`, at: now });
              order.refund = { mode: "balance", method: "balance", amount: amt, at: now, by: me ? me.name : "", byId: me ? me.id : "" };
              refundNote = ` — أُضيف ${money(amt)} لرصيد العميل`;
            } else {
              order.refund = { mode: "cash", method: order.payment.method, amount: amt, at: now, by: me ? me.name : "", byId: me ? me.id : "" };
              refundNote = ` — يجب إرجاع ${money(amt)} (${paymentLabel(order.payment.method)}) للعميل الآن`;
            }
          }
          // استرجاع أي قطع مستهلكة من باقات العميل ضمن هذا الطلب
          let restoredPieces = 0;
          order.items.forEach((it) => {
            if (!it.fromPackageId) return;
            const cp = customerPackages.find((p) => p.id === it.fromPackageId);
            if (cp) { cp.remainingPieces = Math.min(cp.totalPieces, cp.remainingPieces + pkgUnits(it)); restoredPieces += pkgUnits(it); }
          });
          if (restoredPieces > 0) refundNote += ` — تم استرجاع ${restoredPieces} قطعة لباقة العميل`;
          order.status = "cancelled";
          order.cancelReason = v.reason.trim();
          order.cancelledBy = me ? me.name : "";
          order.cancelApprovedBy = overridden ? sup.name : "";
          if (order.debtRecorded && order.payment.outstanding > 0 && cust) {
            cust.balance = round3(cust.balance + order.payment.outstanding);
            ledger.unshift({ id: uid(), byId: me ? me.id : "", customerId: cust.id, type: "order_refund", amount: order.payment.outstanding, balanceAfter: cust.balance, method: "unpaid", orderId: order.id, note: `إلغاء طلب #${order.number} — إسقاط الدين`, at: now });
            refundNote += ` — أُسقط دين ${money(order.payment.outstanding)} عن العميل`;
          }
          order.statusHistory.push({ status: "cancelled", at: now });
          logActivity(`${t("toast_order_cancelled")} — #${order.number} — السبب: ${v.reason}${refundNote}`);
          persistAll();
          renderOrderDialog();
          renderOrdersPage();
          typeof renderDashboard === "function" && document.getElementById("page-dashboard").classList.contains("active") && renderDashboard();
          toast(t("toast_order_cancelled") + refundNote);
        },
      });
      });
    });
    document.getElementById("revertDeliveryBtn")?.addEventListener("click", () => {
      if (!can("cancel_order")) { denied(); return; }
      openQuickForm({
        title: "إرجاع الطلب من حالة التسليم", sub: `طلب #${order.number} — سبب الإرجاع إلزامي (خطأ إدخال، شكوى عميل، تصحيح...)`,
        fields: [{ id: "reason", label: "سبب الإرجاع", type: "text" }],
        submitLabel: "تأكيد الإرجاع",
        onSubmit: (v) => {
          if (!v.reason || !v.reason.trim()) { toast("سبب الإرجاع إلزامي"); return false; }
          const now = new Date().toISOString();
          order.status = "ready";
          order.deliveredAt = null;
          order.statusHistory.push({ status: "ready", at: now, note: `إرجاع من التسليم — ${v.reason}` });
          logActivity(`إرجاع طلب #${order.number} من حالة التسليم — السبب: ${v.reason} — بواسطة ${roleLabel()}`);
          persistAll();
          renderOrderDialog();
          renderOrdersPage();
          typeof renderDashboard === "function" && document.getElementById("page-dashboard").classList.contains("active") && renderDashboard();
          toast("تم إرجاع الطلب لحالة «جاهز للتسليم» — استخدم صفحة الأرصدة لأي تسوية مالية إن لزم");
        },
      });
    });
    document.getElementById("dialogWhatsappBtn")?.addEventListener("click", () => {
      if (order.status === "delivered") sendDeliveredMessage(order, cust);
      else if (order.status === "ready") sendReadyMessage(order, cust);
      else sendOrderConfirmation(order, cust);
      toast("تم فتح واتساب — اضغط إرسال داخل واتساب لإكمال الإرسال");
    });
    document.getElementById("renumberOrderBtn")?.addEventListener("click", () => renumberOrder(order));
    document.getElementById("dialogReceiptPdfBtn")?.addEventListener("click", () => shareReceiptFile(order, cust, "pdf"));
    document.getElementById("dialogReceiptImgBtn")?.addEventListener("click", () => shareReceiptFile(order, cust, "image"));
    if (document.getElementById("dialogReceiptImgBtn") || document.getElementById("dialogReceiptPdfBtn")) prepareReceiptFiles(order, cust);
    document.getElementById("dialogReceiptLinkBtn")?.addEventListener("click", () => {
      const link = publishReceipt(order, cust);
      if (!link) return;
      logActivity(`إرسال رابط إيصال الطلب #${order.number} على واتساب بواسطة ${me ? me.name : ""}`);
      openWhatsApp(cust.phone, waMsg("receipt", { name: cust.name, number: order.number, link }));
    });
    document.getElementById("dialogReceiptWaBtn")?.addEventListener("click", () => {
      logActivity(`إرسال إيصال الطلب #${order.number} على واتساب بواسطة ${me ? me.name : ""}`);
      openWhatsApp(cust.phone, receiptText(order, cust));
      toast("تم فتح واتساب — اضغط إرسال داخل واتساب لإكمال الإرسال");
    });
    document.getElementById("dialogPrintBtn")?.addEventListener("click", () => { logActivity(`إعادة طباعة إيصال الطلب #${order.number} بواسطة ${me ? me.name : ""}`); printOrder(order.id); });
  }

  /* ============================= صفحة العملاء ============================= */
  // حذف عميل: للمالك أو المدير فقط، ولعميل بلا أي طلب أو حركة مالية أو باقة أو رصيد (مثلاً عميل مكرر أُضيف بالخطأ) — لا يضيع أي سجل مالي
  function customerDeletable(c) {
    if (!c || (role !== "owner" && role !== "manager")) return false;
    if (round3(Number(c.balance) || 0) !== 0 || round3(Number(c.openingBalance) || 0) !== 0) return false;
    return !orders.some((o) => o.customerId === c.id) && !ledger.some((tx) => tx.customerId === c.id)
      && !customerPackages.some((p) => p.customerId === c.id) && !suspendedOrders.some((x) => x.customerId === c.id || (x.draft && x.draft.customerId === c.id));
  }
  function deleteCustomer(id) {
    const c = customers.find((x) => x.id === id);
    if (!c) return;
    if (role !== "owner" && role !== "manager") { denied(); return; }
    if (!customerDeletable(c)) { toast("لا يمكن حذف عميل له طلبات أو حركات مالية أو باقات أو رصيد — عدّل بياناته بدلاً من ذلك"); return; }
    confirmAction(`حذف العميل «${c.name}» (${c.phone || "بدون رقم"}) نهائياً؟ ليس له أي طلب أو حركة مالية.`, () => {
      customers = customers.filter((x) => x.id !== id);
      save(KEYS.customers, customers); // حفظ مباشر — الحفظ بالدمج يعيد السجل المحذوف
      if (draftCustomerId === id) draftCustomerId = null;
      logActivity(`حذف العميل: ${c.name} — ${c.phone || "بدون رقم"} (بدون طلبات أو حركات مالية) بواسطة ${roleLabel()}`);
      if (customerProfileDialog.open) customerProfileDialog.close();
      renderCustomersPage();
      toast("تم حذف العميل");
    });
  }
  function openEditCustomerForm(customerId) {
    if (!can("edit_customer")) { denied(); return; }
    const cust = customers.find((c) => c.id === customerId);
    if (!cust) return;
    openQuickForm({
      title: `تعديل بيانات العميل — ${cust.name}`, sub: "تحديث الاسم، الهاتف، المنطقة، العنوان، أو الملاحظات",
      fields: [
        { id: "name", label: t("lbl_customer_name"), type: "text", value: cust.name },
        { id: "phone", label: t("lbl_phone"), type: "text", value: cust.phone },
        { id: "area", label: t("lbl_area"), type: "text", value: cust.area || "" },
        { id: "address", label: t("lbl_address"), type: "text", value: cust.address || "" },
        { id: "notes", label: t("lbl_notes"), type: "textarea", value: cust.notes || "" },
      ],
      submitLabel: "حفظ التعديلات",
      onSubmit: (v) => {
        if (!v.name || !v.phone) { toast(t("toast_name_phone_required")); return false; }
        if (!validPhone(v.phone)) { toast(PHONE_HINT()); return false; }
        const normalizedPhone = cleanPhone(v.phone);
        const duplicate = customers.find((c) => c.id !== customerId && samePhone(c.phone, normalizedPhone));
        if (duplicate) { toast(`رقم الجوال مسجّل مسبقاً للعميل: ${duplicate.name}`); return false; }
        cust.name = v.name;
        cust.phone = normalizedPhone;
        cust.area = v.area;
        cust.address = v.address;
        cust.notes = v.notes;
        logActivity(`تعديل بيانات العميل: ${cust.name} بواسطة ${roleLabel()}`);
        persistAll();
        renderCustomersPage();
        toast("تم حفظ تعديلات العميل");
      },
    });
  }

  // ما على العميل: المبلغ، تاريخ أقدم مبلغ لم يُسدَّد، وآخر دفعة (من الطلبات أو السداد/الإيداع)
  function customerDebtInfo(c, cs) {
    const due = cs.rows.filter((r) => r.remaining > 0 && (r.state === "debt" || r.state === "partial" || r.state === "due_now"));
    const since = due.map((r) => (r.state === "due_now" ? r.order.readyAt || r.order.createdAt : FIN.orderPaidAt(r.order))).filter(Boolean).sort()[0] || null;
    const pays = [];
    orders.forEach((o) => { if (o.customerId === c.id && o.paymentConfirmed && Number(o.payment.paid) > 0 && o.payment.method !== "balance" && o.payment.method !== "unpaid") pays.push(o.paidAt); });
    ledger.forEach((tx) => { if (tx.customerId === c.id && tx.type === "credit" && Number(tx.amount) > 0 && !tx.reversedBy) pays.push(tx.at); });
    const lastPay = pays.filter(Boolean).sort().pop() || null;
    const days = (iso) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)) : null);
    return { owed: cs.totalOwed, since, sinceDays: days(since), lastPay, lastPayDays: days(lastPay) };
  }
  ["customerFilter", "customerSort"].forEach((id) => document.getElementById(id)?.addEventListener("change", () => renderCustomersPage()));
  function renderCustomersPage() {
    const body = document.getElementById("customersBody");
    const sumBox = document.getElementById("customerDebtSummary");
    if (customers.length === 0) {
      body.innerHTML = `<tr><td colspan="9" class="empty-state compact">${t("empty_customers")}</td></tr>`;
      if (sumBox) sumBox.hidden = true;
      return;
    }
    const cq = (document.getElementById("customerSearch")?.value || "").trim();
    const filter = document.getElementById("customerFilter")?.value || "all";
    const sort = document.getElementById("customerSort")?.value || "recent";
    const info = new Map(customers.map((c) => { const cs = FIN.customerSummary(c, orders, ledger); return [c.id, { cs, d: customerDebtInfo(c, cs) }]; }));
    let shown = customers.filter((c) => custMatchesQuery(c, cq) && (filter !== "owes" || info.get(c.id).d.owed > 0));
    if (sort === "oldest") shown = shown.slice().sort((a, b) => String(info.get(a.id).d.since || "9999").localeCompare(String(info.get(b.id).d.since || "9999")));
    else if (sort === "largest") shown = shown.slice().sort((a, b) => info.get(b.id).d.owed - info.get(a.id).d.owed);
    if (sumBox) {
      const owing = shown.filter((c) => info.get(c.id).d.owed > 0);
      sumBox.hidden = !owing.length;
      sumBox.innerHTML = owing.length ? `💰 ${owing.length} ${lang === "en" ? "customers owe" : "عميل عليهم مبالغ"} — ${lang === "en" ? "total" : "الإجمالي"} <b>${money(owing.reduce((a, c) => a + info.get(c.id).d.owed, 0))}</b>${owing.some((c) => info.get(c.id).d.sinceDays > 30) ? ` — <span style="color:var(--danger)">${owing.filter((c) => info.get(c.id).d.sinceDays > 30).length} ${lang === "en" ? "over 30 days" : "أكثر من 30 يوماً"}</span>` : ""}` : "";
    }
    if (shown.length === 0) { body.innerHTML = `<tr><td colspan="9" class="empty-state compact">${filter === "owes" && !cq ? (lang === "en" ? "No customer owes the shop money ✓" : "لا يوجد عميل عليه مبالغ ✓") : lang === "en" ? "No matching customers" : "لا يوجد عميل مطابق"}</td></tr>`; return; }
    const ago = (n) => (n === null ? "" : n === 0 ? (lang === "en" ? "today" : "اليوم") : lang === "en" ? `${n} day${n === 1 ? "" : "s"} ago` : `منذ ${n} يوم`);
    const ageColor = (n) => (n > 30 ? "var(--danger)" : n > 14 ? "var(--warning,#b8860b)" : "inherit");
    body.innerHTML = shown.map((c) => {
      const custOrders = orders.filter((o) => o.customerId === c.id);
      const { cs, d } = info.get(c.id);
      const lastPayCell = d.lastPay ? `${fmtDT(d.lastPay).split(/[،,]/)[0]}<div class="pos-cart-row-sub" style="color:${d.owed > 0 ? ageColor(d.lastPayDays) : "inherit"}">${ago(d.lastPayDays)}</div>` : d.owed > 0 ? `<span style="color:var(--danger)">${lang === "en" ? "never paid" : "لم يدفع بعد"}</span>` : "—";
      const sinceCell = d.owed > 0 && d.since ? `<b style="color:${ageColor(d.sinceDays)}">${d.sinceDays} ${lang === "en" ? "days" : "يوم"}</b><div class="pos-cart-row-sub">${fmtDT(d.since).split(/[،,]/)[0]}</div>` : "—";
      const last = custOrders[0];
      const activePkgs = activePackagesForCustomer(c.id);
      const pkgNote = activePkgs.length ? `<div class="pos-cart-row-sub">${activePkgs.map((p) => `${esc(p.name)}: ${p.remainingPieces}/${p.totalPieces}`).join(" · ")}</div>` : "";
      return `<tr>
        <td><button type="button" class="link-btn cust-open" data-profile="${c.id}"><strong>${esc(c.name)}</strong></button>${pkgNote}</td><td dir="ltr">${esc(fmtPhone(c.phone))}</td><td>${esc(c.area) || "—"}</td>
        <td>${cs.totalOwed > 0 ? `<span class="cust-chip debt">${lang === "en" ? "Owes" : "عليه"} ${money(cs.totalOwed)}</span>` : cs.prepaid > 0 ? `<span class="cust-chip credit">${lang === "en" ? "Credit" : "رصيد"} ${money(cs.prepaid)}</span>` : money(0)}</td><td>${lastPayCell}</td><td>${sinceCell}</td><td>${custOrders.length}</td><td>${last ? fmtDT(last.createdAt) : "—"}</td>
        <td class="row-actions">
          <button class="mini-btn" data-profile="${c.id}">📋 ${lang === "en" ? "File" : "ملف العميل"}</button>
          <button class="mini-btn" data-order-for="${c.id}">${t("nav_neworder")}</button>
          <button class="mini-btn" data-sell-package="${c.id}">＋ باقة</button>
          ${can("edit_customer") ? `<button class="mini-btn" data-edit-customer="${c.id}">${t("btn_edit")}</button>` : ""}
        </td>
      </tr>`;
    }).join("");
    body.querySelectorAll("[data-order-for]").forEach((btn) => {
      btn.addEventListener("click", () => {
        openPage("new-order");
        const cust = customers.find((c) => c.id === btn.dataset.orderFor);
        if (cust) selectCustomerForOrder(cust, true);
      });
    });
    body.querySelectorAll("[data-edit-customer]").forEach((btn) => {
      btn.addEventListener("click", () => openEditCustomerForm(btn.dataset.editCustomer));
    });
    body.querySelectorAll("[data-profile]").forEach((btn) => {
      btn.addEventListener("click", () => openCustomerProfile(btn.dataset.profile));
    });
    body.querySelectorAll("[data-sell-package]").forEach((btn) => {
      btn.addEventListener("click", () => {
        // بيع الباقة تحصيل مالي — يتطلب صلاحية عمليات الأرصدة أو موافقة مشرف
        requireOverride("balance_tx", "بيع باقة لعميل", () => { sellPackageToCustomer(btn.dataset.sellPackage); renderCustomersPage(); });
      });
    });
  }

  // بحث الرقم: جزء من الرقم، أو الرقم كاملاً بأي صيغة (+966 05… / 00966… / 0501… / 33445566)
  function phoneMatches(stored, q) {
    const full = toLatinDigits(stored || "").replace(/\D/g, "");
    const digits = toLatinDigits(q || "").replace(/\D/g, "");
    if (digits.length < 2 || !full) return false;
    const n = normPhone(q);
    if (n.ok && n.digits === full) return true;
    const local = digits.replace(/^00/, "").replace(/^973/, ""), noZero = local.replace(/^0+/, "");
    return full.includes(local) || (noZero.length >= 4 && full.includes(noZero));
  }
  window.phoneMatches997 = phoneMatches;
  function custMatchesQuery(c, q) {
    if (!q) return true;
    const s = toLatinDigits(q).toLowerCase();
    return String(c.name || "").toLowerCase().includes(s) || phoneMatches(c.phone, q);
  }
  document.getElementById("customerSearch")?.addEventListener("input", () => renderCustomersPage());

  /* ============================= ملف العميل =============================
     كل طلبات العميل مع المدفوع والمتبقي لكل طلب، وما عليه الآن (دين + طلبات جاهزة بانتظار الدفع) */
  const customerProfileDialog = document.getElementById("customerProfileDialog");
  let profileCustomerId = null;
  function openCustomerProfile(customerId) {
    profileCustomerId = customerId;
    renderCustomerProfile();
    if (!customerProfileDialog.open) customerProfileDialog.showModal();
  }
  function renderCustomerProfile() {
    const c = customers.find((x) => x.id === profileCustomerId);
    if (!c) { if (customerProfileDialog.open) customerProfileDialog.close(); return; }
    const en = lang === "en";
    const cs = FIN.customerSummary(c, orders, ledger);
    const L = en
      ? { orders: "Orders", spent: "Total purchases", paid: "Total paid", owed: "Owed now", debt: "Credit debt", due: "Pay on pickup", prog: "In progress", prepaid: "Prepaid",
          th: ["Order", "Date", "Status", "Total", "Paid", "Remaining", ""], view: "View", settle: "💵 Collect payment", stmt: "Account statement", wa: "WhatsApp reminder", neworder: "+ New order",
          st: { paid: "Paid ✓", debt: "Debt", partial: "Partly paid", due_now: "Due on pickup", in_progress: "In progress", cancelled: "Cancelled" }, none: "No orders yet", since: "Customer since",
          cnt: ["Open", "Ready", "Delivered", "Cancelled"], pays: "Payments history", payRem: "💵 Pay", noPays: "No payments yet", by: "by", reversed: "reversed" }
      : { orders: "عدد الطلبات", spent: "إجمالي المشتريات", paid: "إجمالي المدفوع", owed: "المستحق عليه الآن", debt: "دين آجل", due: "يُدفع عند الاستلام", prog: "قيد التنفيذ", prepaid: "رصيد مقدّم",
          th: ["الطلب", "التاريخ", "الحالة", "الإجمالي", "المدفوع", "المتبقي", ""], view: "عرض", settle: "💵 تحصيل دفعة", stmt: "كشف الحساب", wa: "تذكير واتساب", neworder: "+ طلب جديد",
          st: { paid: "مدفوع ✓", debt: "دين", partial: "مدفوع جزئياً", due_now: "يُدفع عند الاستلام", in_progress: "قيد التنفيذ", cancelled: "ملغي" }, none: "لا توجد طلبات بعد", since: "عميل منذ",
          cnt: ["قيد التجهيز", "جاهز للاستلام", "مُسلَّم", "ملغي"], pays: "سجل المدفوعات", payRem: "💵 سداد", noPays: "لا توجد مدفوعات بعد", by: "بواسطة", reversed: "معكوسة" };
    const pu = FIN.packageUsage(customerPackages, orders, c.id);
    const packagesHtml = pu.length ? `<div class="cp-packages"><h4>🎟 ${en ? "Packages" : "الباقات"}</h4>${pu.map((u) => {
      const pct = u.total ? Math.round((u.used / u.total) * 100) : 0;
      return `<div class="cp-pkg${u.finished ? " done" : ""}">
        <div class="cp-pkg-top"><strong>${esc(u.pkg.name)}</strong><span>${serviceName(u.pkg.serviceType)}</span><small class="inv-muted">${en ? "Bought" : "شراء"} ${fmtDT(u.pkg.purchasedAt)} · ${money(u.pkg.price)}</small></div>
        <div class="cp-pkg-garments">👕 ${esc(garmentsLabel(u.pkg.garments, 8))}</div>
        <div class="cp-pkg-terms ${pkgExpired(u.pkg) ? "expired" : ""}">${esc(pkgTermsText(u.pkg))}${role === "owner" || can("admin_settings") ? ` <button class="mini-btn" type="button" data-pkg-edit="${u.pkg.id}">✏️ ${en ? "Edit" : "تعديل"}</button>` : ""}</div>
        <div class="cp-pkg-bar"><div style="width:${pct}%"></div></div>
        <div class="cp-pkg-nums"><span>${en ? "Total" : "الإجمالي"} <b>${u.total}</b></span><span>${en ? "Used" : "المستهلك"} <b>${u.used}</b></span><span>${en ? "Left" : "المتبقي"} <b style="color:${u.finished ? "var(--muted)" : "var(--success)"}">${u.remaining}${u.finished ? (en ? " (finished)" : " (منتهية)") : ""}</b></span></div>
        ${u.consistent ? "" : `<div class="cp-pkg-warn">⚠ ${en ? `Stored balance (${u.stored}) differs from order history (${u.remaining})` : `الرصيد المحفوظ (${u.stored}) لا يطابق سجل الطلبات (${u.remaining})`}${can("admin_settings") ? ` <button class="mini-btn" type="button" data-pkg-fix="${u.pkg.id}">${en ? "Fix" : "تصحيح"}</button>` : ""}</div>`}
        ${u.uses.length ? `<details><summary>${en ? "Usage history" : "سجل الاستهلاك"} (${u.uses.length})</summary>${u.uses.map((x) => `<div class="cp-pkg-use"><button class="link-btn" type="button" data-cp-view="${x.orderId}">#${x.number}</button><span>${fmtDT(x.at)}</span><b>−${x.qty}</b></div>`).join("")}</details>` : ""}
      </div>`;
    }).join("")}</div>` : "";
    // سجل المدفوعات: ما دُفع عند تأكيد الطلبات + السداد والإيداع والاسترداد والتسويات من سجل الأرصدة
    const empNm = (id, fallback) => { const e = id ? emps().find((x) => x.id === id) : null; return e ? e.name : fallback || ""; };
    const numOf = (oid) => { const o = oid ? orders.find((x) => x.id === oid) : null; return o ? "#" + o.number : ""; };
    const pays = [];
    orders.filter((o) => o.customerId === c.id).forEach((o) => {
      const pp = o.payment || {};
      if (o.paymentConfirmed && Number(pp.paid) > 0 && pp.method !== "balance" && pp.method !== "unpaid") pays.push({ at: o.paidAt, amount: Number(pp.paid), label: en ? "Order payment" : "دفعة طلب", method: pp.method, ord: o.id, by: o.paymentBy || empNm(o.paymentById) });
      if (o.refund && o.refund.mode === "cash") pays.push({ at: o.refund.at, amount: -Number(o.refund.amount), label: en ? "Cancellation refund" : "استرداد إلغاء", method: o.refund.method, ord: o.id, by: o.refund.by });
    });
    ledger.filter((tx) => tx.customerId === c.id && tx.type !== "order_charge" && tx.type !== "package_purchase").forEach((tx) => pays.push({ at: tx.at, amount: Number(tx.amount) || 0, label: tx.settles ? (en ? "Payment on order" : "سداد على طلب") : txLabel(tx), method: tx.method, ord: tx.orderId, by: empNm(tx.byId), rev: !!tx.reversedBy }));
    pays.sort((a, b) => String(b.at).localeCompare(String(a.at)));
    const paymentsHtml = `<details class="cp-pays" open><summary><h4 style="display:inline">💳 ${L.pays} (${pays.length})</h4></summary>${pays.length ? pays.slice(0, 40).map((x) => `<div class="cp-pay-row"${x.rev ? ' style="opacity:.55;text-decoration:line-through"' : ""}><span>${fmtDT(x.at)}</span><span>${esc(x.label)}${x.ord ? ` <button class="link-btn" type="button" data-cp-view="${x.ord}">${numOf(x.ord)}</button>` : ""}</span><span>${esc(methodLabel997(x.method))}</span><span class="inv-muted">${x.by ? L.by + " " + esc(x.by) : ""}${x.rev ? " · " + L.reversed : ""}</span><b dir="ltr" style="color:${x.amount < 0 ? "var(--danger)" : "var(--success)"}">${signedMoney(x.amount)}</b></div>`).join("") : `<div class="empty-state compact">${L.noPays}</div>`}</details>`;
    const stColor = { paid: "var(--success)", debt: "var(--danger)", partial: "var(--danger)", due_now: "var(--warning)", in_progress: "var(--muted)", cancelled: "var(--muted)" };
    const card = (label, value, color) => `<div class="metric-card"><div class="metric-top"><span>${label}</span></div><div class="metric-value"${color ? ` style="color:${color}"` : ""}>${value}</div></div>`;
    const rowsHtml = cs.rows.map((r) => `<div class="cp-order"${r.state === "cancelled" ? ' style="opacity:.55"' : ""}>
        <div class="cp-order-top"><strong>#${r.order.number}</strong><span style="color:${stColor[r.state]}">${L.st[r.state]}</span><small class="inv-muted">${fmtDT(r.order.createdAt)}</small></div>
        <div class="cp-order-nums">
          <span>${L.th[3]}<b>${money(r.total)}</b></span>
          <span>${L.th[4]}<b style="color:var(--success)">${r.state === "cancelled" ? "—" : money(r.paid)}</b></span>
          <span>${L.th[5]}<b style="color:${r.remaining > 0 ? "var(--danger)" : "inherit"}">${r.state === "cancelled" ? "—" : money(r.remaining)}</b></span>
          <button class="mini-btn" type="button" data-cp-view="${r.order.id}">${L.view}</button>
          ${(r.state === "debt" || r.state === "partial") && can("balance_tx") ? `<button class="mini-btn" type="button" data-cp-pay="${r.order.id}">${L.payRem}</button>` : ""}
        </div><div class="inv-muted" style="font-size:12px">${r.order.items.map((it) => `${esc(clothingName(it.clothingId))} × ${it.qty}`).join(" · ")} — ${statusLabel(r.order.status)}</div></div>`).join("");
    document.getElementById("customerProfileContent").innerHTML = `
      <div class="modal-header">
        <div><h3>📋 ${esc(c.name)}</h3><p><span dir="ltr">${esc(fmtPhone(c.phone))}</span>${c.area ? " · " + esc(c.area) : ""}${c.address ? " · " + esc(c.address) : ""}${c.createdAt ? ` · ${L.since} ${fmtDT(c.createdAt)}` : ""}</p>${c.notes ? `<p class="inv-muted">📝 ${esc(c.notes)}</p>` : ""}</div>
        <button class="icon-btn" type="button" id="closeCustomerProfile">✕</button>
      </div>
      <div style="padding:0 20px 20px">
        <div class="metrics-grid metrics-grid-compact cp-metrics">
          ${card(L.owed, money(cs.totalOwed), cs.totalOwed > 0 ? "var(--danger)" : "var(--success)")}
          ${card(L.debt, money(cs.debt), cs.debt > 0 ? "var(--danger)" : "")}
          ${card(L.due, money(cs.dueNow), cs.dueNow > 0 ? "var(--warning)" : "")}
          ${card(L.prog, money(cs.inProgress))}
          ${card(L.orders, cs.ordersCount)}
          ${card(L.spent, money(cs.totalSpent))}
          ${card(L.paid, money(cs.totalPaid), "var(--success)")}
          ${cs.prepaid > 0 ? card(L.prepaid, money(cs.prepaid), "var(--success)") : ""}
          ${card(L.cnt[0], cs.counts.open)}${card(L.cnt[1], cs.counts.ready)}${card(L.cnt[2], cs.counts.delivered)}${card(L.cnt[3], cs.counts.cancelled)}
        </div>
        ${packagesHtml}
        ${loyaltyCardHtml(c)}
        ${dlvCfg().on ? (() => { const q = deliveryQuote(c.id, { pickup: false, drop: false }, 0); return `<p class="section-note" style="margin:10px 0 0">🚚 ${q.hasPkg ? `${tripPeriodWord(q.st)}: <b>${q.used}/${q.quota}</b> — ${en ? "left" : "متبقي"} <b>${Math.max(0, q.quota - q.used)}</b>` : `${en ? "Delivery trip fee" : "رسوم المشوار"}: <b>${money(dlvCfg().fee)}</b>${dlvCfg().freeOver > 0 ? ` (${en ? "free over" : "مجاني فوق"} ${money(dlvCfg().freeOver)})` : ""}`}</p>`; })() : ""}
        ${codesForCustomer(c.id).length ? `<p class="section-note" style="margin:10px 0 0">🏷 ${en ? "Customer codes" : "أكواد العميل"}: ${codesForCustomer(c.id).map((x) => `<b dir="ltr">${esc(x.code)}</b> (${esc(codeDesc(x))})`).join(" · ")}</p>` : ""}
        <div class="row-actions" style="margin:14px 0;flex-wrap:wrap">
          <button class="primary-btn" type="button" id="cpNewOrder">${L.neworder}</button>
          ${dlvCfg().on && can("create_order") ? `<button class="secondary-btn" type="button" id="cpPickup">🚚 ${en ? "Book pickup" : "طلب استلام من البيت"}</button>` : ""}
          ${can("edit_pricing") && (settings.discountCodes || []).some(codeRestricted) ? `<button class="secondary-btn" type="button" id="cpCodes">🏷 ${en ? "Discount codes" : "أكواد الخصم"}</button>` : ""}
          ${settings.packageDefs.length ? `<button class="secondary-btn" type="button" id="cpSellPkg">🎟 ${en ? "Sell package" : "بيع باقة"}</button>` : ""}
          ${can("balance_tx") ? `<button class="secondary-btn" type="button" id="cpSettle">${cs.debt > 0 ? L.settle : en ? "💵 Add deposit" : "💵 إيداع رصيد"}</button>` : ""}
          ${cs.totalOwed > 0 ? `<button class="whatsapp-btn" type="button" id="cpRemind">${L.wa}</button>` : ""}
          ${cs.totalOwed > 0 && (bpCfg().number || bpCfg().iban || bpCfg().qr) ? `<button class="secondary-btn" type="button" id="cpPayInfo">💳 ${en ? "Send BenefitPay details" : "إرسال طريقة الدفع (BenefitPay)"}</button>` : ""}
          ${can("view_balances") ? `<button class="ghost-btn" type="button" id="cpStatement">${L.stmt}</button>` : ""}
          ${customerDeletable(c) ? `<button class="ghost-btn danger-mini" type="button" id="cpDelete">🗑 ${en ? "Delete customer" : "حذف العميل"}</button>` : ""}
        </div>
        <div class="cp-orders">${rowsHtml || `<div class="empty-state compact">${L.none}</div>`}</div>
        ${paymentsHtml}
      </div>`;
    const q = (id) => document.getElementById(id);
    q("closeCustomerProfile").onclick = () => customerProfileDialog.close();
    q("cpNewOrder").onclick = () => { customerProfileDialog.close(); openPage("new-order"); selectCustomerForOrder(c, true); };
    if (q("cpSettle")) q("cpSettle").onclick = () => balTxForm({ custId: c.id, type: "credit", amount: cs.debt > 0 ? cs.debt : "", note: "", onDone: renderCustomerProfile });
    if (q("cpRemind")) q("cpRemind").onclick = () => sendDueReminder(c);
    if (q("cpPayInfo")) q("cpPayInfo").onclick = () => sendPayInfo(c, cs.totalOwed, "");
    if (q("cpDelete")) q("cpDelete").onclick = () => deleteCustomer(c.id);
    if (q("cpStatement")) q("cpStatement").onclick = () => { customerProfileDialog.close(); bv.stmt = c.id; openPage("balances"); };
    if (q("cpPickup")) q("cpPickup").onclick = () => { customerProfileDialog.close(); openPickupForm(c.id); };
    document.querySelectorAll("#customerProfileContent [data-pkg-edit]").forEach((b) => (b.onclick = () => { const cp = customerPackages.find((x) => x.id === b.dataset.pkgEdit); if (cp) editCustomerPackage(cp, () => setTimeout(renderCustomerProfile, 150)); }));
    if (q("cpCodes")) q("cpCodes").onclick = () => {
      const list = (settings.discountCodes || []).filter(codeRestricted);
      openQuickForm({
        title: `🏷 أكواد ${c.name}`, sub: "اختر الأكواد الخاصة التي يحق لهذا العميل استخدامها",
        fields: [{ id: "codes", label: "الأكواد", type: "checks", value: list.filter((x) => (x.customerIds || []).includes(c.id)).map((x) => x.code), options: list.map((x) => ({ value: x.code, label: `${x.code} — ${codeDesc(x)}${x.note ? " — " + x.note : ""}` })) }],
        submitLabel: "حفظ",
        onSubmit: (v) => {
          const on = new Set(v.codes), changes = [];
          list.forEach((x) => {
            const ids = new Set(x.customerIds || []), had = ids.has(c.id);
            if (on.has(x.code) && !had) { ids.add(c.id); changes.push("+" + x.code); }
            if (!on.has(x.code) && had) { ids.delete(c.id); changes.push("−" + x.code); }
            x.customerIds = [...ids];
          });
          if (changes.length) { save(KEYS.settings, settings); logActivity(`أكواد الخصم للعميل ${c.name}: ${changes.join(" ")}`); }
          toast("تم حفظ أكواد العميل"); setTimeout(renderCustomerProfile, 150);
        },
      });
    };
    wireLoyaltyCard(c);
    if (q("cpSellPkg")) q("cpSellPkg").onclick = () => requireOverride("balance_tx", "بيع باقة لعميل", () => sellPackageToCustomer(c.id));
    document.querySelectorAll("#customerProfileContent [data-pkg-fix]").forEach((b) => b.addEventListener("click", () => {
      const u = pu.find((x) => x.pkg.id === b.dataset.pkgFix); if (!u) return;
      confirmAction(`تصحيح رصيد باقة «${u.pkg.name}» من ${u.stored} إلى ${u.remaining} قطعة حسب سجل الطلبات؟`, () => {
        u.pkg.remainingPieces = u.remaining;
        logActivity(`تصحيح رصيد باقة «${u.pkg.name}» — ${c.name}: ${u.stored} → ${u.remaining}`);
        persistAll(); renderCustomerProfile();
      });
    }));
    document.querySelectorAll("#customerProfileContent [data-cp-view]").forEach((b) => b.addEventListener("click", () => openOrderDialog(b.dataset.cpView)));
    document.querySelectorAll("#customerProfileContent [data-cp-pay]").forEach((b) => b.addEventListener("click", () => {
      const r = cs.rows.find((x) => x.order.id === b.dataset.cpPay); if (!r) return;
      balTxForm({ custId: c.id, type: "credit", amount: r.remaining, orderId: r.order.id, onDone: renderCustomerProfile });
    }));
  }
  // تحديث ملف العميل تلقائياً بعد أي دفع/تسليم/سداد يتم من فوقه
  ["orderDialog", "quickFormDialog"].forEach((id) => document.getElementById(id).addEventListener("close", () => { if (customerProfileDialog.open) setTimeout(renderCustomerProfile, 150); }));
  window.openCustomerProfile997 = openCustomerProfile;

  document.getElementById("addCustomerBtn").addEventListener("click", () => {
    pendingCustomerContext = "standalone";
    openCustomerDialog();
  });

  /* -------------------------- مربع حوار عميل جديد -------------------------- */
  const customerDialog = document.getElementById("customerDialog");
  function openCustomerDialog() {
    document.getElementById("customerForm").reset();
    const typed = document.getElementById("orderCustomerPhone")?.value.trim() || "";
    if (typed && !/[a-zA-Zأ-ي]/.test(typed)) document.getElementById("customerPhone").value = typed;
    customerDialog.showModal();
  }
  document.getElementById("saveCustomerBtn").addEventListener("click", (e) => {
    e.preventDefault();
    const name = document.getElementById("customerName").value.trim();
    const phoneRaw = document.getElementById("customerPhone").value.trim();
    if (!name || !phoneRaw) { toast(t("toast_name_phone_required")); return; }
    if (!validPhone(phoneRaw)) { toast(PHONE_HINT()); return; }
    const normalizedPhone = cleanPhone(phoneRaw);
    const duplicate = customers.find((c) => samePhone(c.phone, normalizedPhone));
    if (duplicate) { toast(`رقم الجوال مسجّل مسبقاً للعميل: ${duplicate.name}`); return; }
    const cust = {
      id: uid(), name, phone: normalizedPhone,
      area: document.getElementById("customerArea").value.trim(),
      address: document.getElementById("customerAddress").value.trim(),
      notes: document.getElementById("customerNotes").value.trim(),
      balance: 0, openingBalance: 0, createdAt: new Date().toISOString(),
    };
    customers.unshift(cust);
    logActivity(`${t("toast_customer_saved")}: ${cust.name}`);
    persistAll();
    customerDialog.close();
    toast(t("toast_customer_saved"));
    if (pendingCustomerContext === "order") selectCustomerForOrder(cust);
    if (document.getElementById("page-customers").classList.contains("active")) renderCustomersPage();
    if (document.getElementById("page-balances").classList.contains("active")) renderBalancesPage();
  });

  /* ============================= صفحة الأرصدة (نسخة موسّعة) ============================= */
  const BT = {
    ar: {
      tab_customers: "العملاء", tab_ledger: "سجل العمليات", tab_debtors: "المدينون",
      m_credit_total: "إجمالي أرصدة العملاء", m_credit_cnt: "عملاء لديهم رصيد", m_debt_total: "إجمالي المديونيات", m_debt_cnt: "عملاء مدينون", m_dep_today: "إيداعات اليوم", m_dep_month: "إيداعات الشهر",
      m_credit_hint: "التزام عليك للعملاء", m_debt_hint: "مستحق لك على العملاء",
      search: "بحث بالاسم أو رقم الجوال...", f_all: "الكل", f_credit: "لديهم رصيد", f_debt: "مدينون", f_zero: "رصيد صفر",
      th_customer: "العميل", th_balance: "الرصيد", th_last: "آخر حركة", th_date: "التاريخ", th_type: "النوع", th_note: "البيان", th_method: "الطريقة", th_amount: "المبلغ", th_after: "الرصيد بعد", th_debt: "المديونية",
      b_deposit: "+ إيداع", b_op: "عملية", b_stmt: "كشف حساب", b_wa: "واتساب", b_back: "رجوع", b_print: "طباعة", b_reverse: "عكس", b_settle: "تسديد", b_remind: "تذكير", b_new_op: "+ عملية جديدة",
      owes: "عليه", none_yet: "—",
      lt_all: "الكل", lt_deposits: "الإيداعات", lt_orders: "الطلبات", lt_refunds: "الاسترداد", lt_adjust: "التسويات",
      date_from: "من", date_to: "إلى", clear: "مسح الفلتر",
      tx_credit: "إيداع رصيد", tx_refund: "استرداد نقدي", tx_debit: "خصم رصيد", tx_adjust: "تسوية", tx_reversal: "عكس عملية", tx_order: "طلب", tx_order_refund: "استرداد طلب", tx_package: "شراء باقة",
      op_credit: "إيداع رصيد (استلام مبلغ)", op_refund: "استرداد نقدي (إعادة مبلغ للعميل)", op_debit: "خصم رصيد (رسوم/تحميل بدون نقد)", op_adj_plus: "تسوية بالزيادة (تصحيح بدون نقد)", op_adj_minus: "تسوية بالنقص (تصحيح بدون نقد)",
      f_customer: "العميل", f_type: "نوع العملية", f_amount: "المبلغ (د.ب)", f_method: "طريقة الدفع / الصرف", f_note: "البيان / السبب", f_notify: "إشعار العميل عبر واتساب", yes: "نعم", no: "لا",
      m_cash: "نقداً", m_card: "بطاقة", m_bp: "Benefit Pay", m_bank: "تحويل بنكي",
      t_op: "عملية على رصيد العميل", t_confirm: "تأكيد", current_balance: "الرصيد الحالي",
      e_customer: "اختر العميل", e_amount: "أدخل مبلغاً صحيحاً أكبر من صفر", e_big: "المبلغ كبير جداً — تأكد من الأرقام", e_refund_max: "مبلغ الاسترداد أكبر من رصيد العميل", e_note: "اكتب البيان أو السبب لهذه العملية", e_rev_neg: "لا يمكن العكس: سيصبح رصيد العميل سالباً (استُخدم جزء من هذا الرصيد)", e_rev_old: "لا يمكن عكس عملية مضى عليها أكثر من 24 ساعة",
      ok_tx: "تم تسجيل العملية", ok_rev: "تم عكس العملية", now_debtor: "تنبيه: أصبح العميل مديناً",
      c_reverse: "عكس هذه العملية؟ ستُسجَّل حركة معاكسة ويبقى الأصل في السجل.", rev_note: n => `عكس عملية: ${n}`,
      empty_customers: "لا يوجد عملاء مطابقون", empty_ledger: "لا توجد عمليات مطابقة", empty_debtors: "لا يوجد عملاء مدينون 🎉", showing: (a, b) => `يُعرض ${a} من ${b} عملية`,
      st_title: "كشف حساب", st_check_ok: "الرصيد مطابق لمجموع السجل ✓", st_check_bad: d => `⚠ فرق ${d} بين الرصيد المخزّن ومجموع السجل (غالباً بيانات قديمة)`,
      st_phone: "الجوال", st_wa_title: "كشف حسابكم", reversed: "معكوسة", order_no: n => `طلب #${n}`,
      wa_debt: (n, shop, amt) => `السلام عليكم ${n}،\nنذكّركم بوجود مبلغ مستحق قدره ${amt} على حسابكم لدى ${shop}.\nنرجو التكرم بالسداد عند أقرب فرصة. شكراً لتعاونكم.`,
      wa_stmt: (n, shop, lines, bal) => `هلا والله ${n} 🌸\nهذا كشف حسابك لدى ${shop} (آخر الحركات):\n${lines}\n\n💳 ${bal}\n\nإذا عندك أي استفسار إحنا بالخدمة دايماً 💐\nفريق 997 Laundry 💙`,
      thanks: "شكراً لتعاملكم معنا", debtor_note: "⚠ الرصيد مستحق على العميل", shop_default: "مغسلة 997"
    },
    en: {
      tab_customers: "Customers", tab_ledger: "Ledger", tab_debtors: "Debtors",
      m_credit_total: "Total customer credit", m_credit_cnt: "Customers with credit", m_debt_total: "Total receivables", m_debt_cnt: "Debtor customers", m_dep_today: "Deposits today", m_dep_month: "Deposits this month",
      m_credit_hint: "You owe customers", m_debt_hint: "Customers owe you",
      search: "Search by name or phone...", f_all: "All", f_credit: "With credit", f_debt: "Debtors", f_zero: "Zero balance",
      th_customer: "Customer", th_balance: "Balance", th_last: "Last activity", th_date: "Date", th_type: "Type", th_note: "Details", th_method: "Method", th_amount: "Amount", th_after: "Balance after", th_debt: "Amount owed",
      b_deposit: "+ Deposit", b_op: "Action", b_stmt: "Statement", b_wa: "WhatsApp", b_back: "Back", b_print: "Print", b_reverse: "Reverse", b_settle: "Settle", b_remind: "Remind", b_new_op: "+ New transaction",
      owes: "owes", none_yet: "—",
      lt_all: "All", lt_deposits: "Deposits", lt_orders: "Orders", lt_refunds: "Refunds", lt_adjust: "Adjustments",
      date_from: "From", date_to: "To", clear: "Clear filter",
      tx_credit: "Balance deposit", tx_refund: "Cash refund", tx_debit: "Balance deduction", tx_adjust: "Adjustment", tx_reversal: "Reversal", tx_order: "Order", tx_order_refund: "Order refund", tx_package: "Package purchase",
      op_credit: "Deposit (receive money)", op_refund: "Cash refund (return money to customer)", op_debit: "Deduction (fee/charge, no cash)", op_adj_plus: "Adjustment + (correction, no cash)", op_adj_minus: "Adjustment − (correction, no cash)",
      f_customer: "Customer", f_type: "Transaction type", f_amount: "Amount (BD)", f_method: "Payment / payout method", f_note: "Details / reason", f_notify: "Notify customer on WhatsApp", yes: "Yes", no: "No",
      m_cash: "Cash", m_card: "Card", m_bp: "Benefit Pay", m_bank: "Bank transfer",
      t_op: "Customer balance transaction", t_confirm: "Confirm", current_balance: "Current balance",
      e_customer: "Select a customer", e_amount: "Enter a valid amount above zero", e_big: "Amount is very large — check the digits", e_refund_max: "Refund is more than the customer's balance", e_note: "Write the details or reason for this transaction", e_rev_neg: "Cannot reverse: the customer's balance would become negative (part of it was used)", e_rev_old: "Cannot reverse a transaction older than 24 hours",
      ok_tx: "Transaction recorded", ok_rev: "Transaction reversed", now_debtor: "Note: the customer now owes money",
      c_reverse: "Reverse this transaction? An opposite entry is recorded and the original stays in the ledger.", rev_note: n => `Reversal of: ${n}`,
      empty_customers: "No matching customers", empty_ledger: "No matching transactions", empty_debtors: "No debtor customers 🎉", showing: (a, b) => `Showing ${a} of ${b} transactions`,
      st_title: "Account statement", st_check_ok: "Balance matches the ledger total ✓", st_check_bad: d => `⚠ Difference of ${d} between stored balance and ledger total (likely older data)`,
      st_phone: "Phone", st_wa_title: "Your statement", reversed: "reversed", order_no: n => `Order #${n}`,
      wa_debt: (n, shop, amt) => `Hello ${n},\nThis is a reminder that an amount of ${amt} is due on your account at ${shop}.\nKindly settle it at your earliest convenience. Thank you.`,
      wa_stmt: (n, shop, lines, bal) => `Hi ${n} 🌸\nHere is your account statement at ${shop} (latest activity):\n${lines}\n\n💳 ${bal}\n\nAny questions? We're always here to help 💐\nThe 997 Laundry team 💙`,
      thanks: "Thank you for your business", debtor_note: "⚠ Amount due from customer", shop_default: "997 Laundry"
    },
    ur: {
      tab_customers: "کسٹمرز", tab_ledger: "لین دین کا ریکارڈ", tab_debtors: "مقروض",
      m_credit_total: "کسٹمرز کا کل بیلنس", m_credit_cnt: "بیلنس والے کسٹمرز", m_debt_total: "کل واجبات", m_debt_cnt: "مقروض کسٹمرز", m_dep_today: "آج کے ڈپازٹ", m_dep_month: "اس ماہ کے ڈپازٹ",
      m_credit_hint: "آپ پر کسٹمرز کا حق", m_debt_hint: "کسٹمرز پر آپ کا حق",
      search: "نام یا فون سے تلاش کریں...", f_all: "سب", f_credit: "بیلنس والے", f_debt: "مقروض", f_zero: "صفر بیلنس",
      th_customer: "کسٹمر", th_balance: "بیلنس", th_last: "آخری سرگرمی", th_date: "تاریخ", th_type: "قسم", th_note: "تفصیل", th_method: "طریقہ", th_amount: "رقم", th_after: "بعد کا بیلنس", th_debt: "واجب الادا",
      b_deposit: "+ ڈپازٹ", b_op: "عمل", b_stmt: "اسٹیٹمنٹ", b_wa: "واٹس ایپ", b_back: "واپس", b_print: "پرنٹ", b_reverse: "الٹائیں", b_settle: "ادائیگی", b_remind: "یاد دہانی", b_new_op: "+ نیا لین دین",
      owes: "واجب", none_yet: "—",
      lt_all: "سب", lt_deposits: "ڈپازٹ", lt_orders: "آرڈرز", lt_refunds: "واپسی", lt_adjust: "درستی",
      date_from: "سے", date_to: "تک", clear: "فلٹر ہٹائیں",
      tx_credit: "بیلنس ڈپازٹ", tx_refund: "نقد واپسی", tx_debit: "بیلنس کٹوتی", tx_adjust: "درستی", tx_reversal: "الٹایا گیا", tx_order: "آرڈر", tx_order_refund: "آرڈر کی واپسی", tx_package: "پیکج خریداری",
      op_credit: "ڈپازٹ (رقم وصول)", op_refund: "نقد واپسی (کسٹمر کو رقم لوٹانا)", op_debit: "کٹوتی (فیس/چارج، بغیر نقد)", op_adj_plus: "درستی + (تصحیح، بغیر نقد)", op_adj_minus: "درستی − (تصحیح، بغیر نقد)",
      f_customer: "کسٹمر", f_type: "لین دین کی قسم", f_amount: "رقم (BD)", f_method: "ادائیگی / واپسی کا طریقہ", f_note: "تفصیل / وجہ", f_notify: "کسٹمر کو واٹس ایپ اطلاع", yes: "ہاں", no: "نہیں",
      m_cash: "نقد", m_card: "کارڈ", m_bp: "Benefit Pay", m_bank: "بینک ٹرانسفر",
      t_op: "کسٹمر بیلنس پر لین دین", t_confirm: "تصدیق", current_balance: "موجودہ بیلنس",
      e_customer: "کسٹمر منتخب کریں", e_amount: "صفر سے زیادہ درست رقم لکھیں", e_big: "رقم بہت زیادہ ہے — ہندسے چیک کریں", e_refund_max: "واپسی کی رقم کسٹمر کے بیلنس سے زیادہ ہے", e_note: "اس لین دین کی تفصیل یا وجہ لکھیں", e_rev_neg: "الٹا نہیں سکتے: کسٹمر کا بیلنس منفی ہو جائے گا (کچھ بیلنس استعمال ہو چکا ہے)", e_rev_old: "24 گھنٹے سے پرانا لین دین الٹا نہیں جا سکتا",
      ok_tx: "لین دین درج ہو گیا", ok_rev: "لین دین الٹ دیا گیا", now_debtor: "نوٹ: کسٹمر اب مقروض ہے",
      c_reverse: "یہ لین دین الٹیں؟ الٹی اندراج درج ہو گا اور اصل ریکارڈ میں رہے گا۔", rev_note: n => `الٹایا گیا: ${n}`,
      empty_customers: "کوئی مماثل کسٹمر نہیں", empty_ledger: "کوئی مماثل لین دین نہیں", empty_debtors: "کوئی مقروض کسٹمر نہیں 🎉", showing: (a, b) => `${b} میں سے ${a} لین دین`,
      st_title: "اکاؤنٹ اسٹیٹمنٹ", st_check_ok: "بیلنس ریکارڈ کے مجموعے سے مطابقت رکھتا ہے ✓", st_check_bad: d => `⚠ محفوظ بیلنس اور ریکارڈ کے مجموعے میں ${d} کا فرق (غالباً پرانا ڈیٹا)`,
      st_phone: "فون", st_wa_title: "آپ کی اسٹیٹمنٹ", reversed: "الٹایا گیا", order_no: n => `آرڈر #${n}`,
      wa_debt: (n, shop, amt) => `السلام علیکم ${n}،\nیاد دہانی ہے کہ ${shop} میں آپ کے اکاؤنٹ پر ${amt} واجب الادا ہیں۔\nبراہ کرم جلد ادا کر دیں۔ شکریہ۔`,
      wa_stmt: (n, shop, lines, bal) => `السلام علیکم ${n} 🌸\n${shop} میں آپ کی اکاؤنٹ اسٹیٹمنٹ (حالیہ لین دین):\n${lines}\n\n💳 ${bal}\n\nکوئی سوال ہو تو ہم ہمیشہ حاضر ہیں 💐\n997 Laundry ٹیم 💙`,
      thanks: "ہمارے ساتھ لین دین کا شکریہ", debtor_note: "⚠ کسٹمر پر رقم واجب ہے", shop_default: "997 لانڈری"
    }
  };
  const BX = (k, ...a) => { const d = BT[lang] || BT.ar; let s = d[k]; if (s === undefined) s = BT.ar[k]; if (s === undefined) return k; return typeof s === "function" ? s(...a) : s; };
  const bv = { tab: "customers", q: "", filter: "all", lt: "all", lq: "", from: "", to: "", stmt: null };
  const TX_META = {
    credit: { k: "tx_credit", manual: true }, cash_refund: { k: "tx_refund", manual: true }, debit: { k: "tx_debit", manual: true }, adjustment: { k: "tx_adjust", manual: true },
    reversal: { k: "tx_reversal" }, order_charge: { k: "tx_order" }, balance: { k: "tx_order" }, unpaid: { k: "tx_order" }, partial: { k: "tx_order" }, order_refund: { k: "tx_order_refund" }, package_purchase: { k: "tx_package" },
  };
  const LT_GROUPS = {
    deposits: ["credit"], orders: ["order_charge", "balance", "unpaid", "partial", "order_refund", "package_purchase"], refunds: ["cash_refund"], adjust: ["debit", "adjustment", "reversal"],
  };
  const BAL_METHODS = [["cash", "m_cash"], ["card", "m_card"], ["benefitpay", "m_bp"], ["bank_transfer", "m_bank"]];
  const methodLabel997 = (m) => { const f = BAL_METHODS.find((x) => x[0] === m); return f ? BX(f[1]) : (m === "balance" ? t("opt_balance") : m === "unpaid" ? t("opt_unpaid") : m || ""); };
  const txLabel = (tx) => BX((TX_META[tx.type] || { k: "tx_adjust" }).k);
  const txCashEffect = (tx) => (tx.type === "credit" || tx.type === "cash_refund" || (tx.type === "reversal" && tx.cashRev)) && tx.method && tx.method !== "balance" && tx.method !== "unpaid" ? Number(tx.amount || 0) : 0;
  const isoDay = (iso) => FIN.localDay(iso);
  const signedMoney = (n) => `${n >= 0 ? "+" : "−"}${money(Math.abs(n))}`;
  const balSign = (n) => (n < 0 ? `<b style="color:var(--danger)">${money(Math.abs(n))} ${BX("owes")}</b>` : n > 0 ? `<b style="color:var(--success)">${money(n)}</b>` : `<b>${money(0)}</b>`);

  function lastTxMap() { const m = {}; ledger.forEach((tx) => { if (!m[tx.customerId]) m[tx.customerId] = tx.at; }); return m; }
  function balMetricsHtml() {
    const pos = customers.filter((c) => c.balance > 0), neg = customers.filter((c) => c.balance < 0);
    const today = isoDay(new Date().toISOString()), mk = today.slice(0, 7);
    let dToday = 0, dMonth = 0;
    ledger.forEach((tx) => { if (tx.type !== "credit" && !(tx.type === "reversal" && tx.cashRev)) return; const e = Number(tx.amount || 0); const d = isoDay(tx.at); if (d === today) dToday += e; if (d.slice(0, 7) === mk) dMonth += e; });
    const cards = [
      [BX("m_credit_total"), money(pos.reduce((s, c) => s + c.balance, 0)), BX("m_credit_hint")], [BX("m_credit_cnt"), pos.length, ""],
      [BX("m_debt_total"), money(neg.reduce((s, c) => s - c.balance, 0)), BX("m_debt_hint")], [BX("m_debt_cnt"), neg.length, ""],
      [BX("m_dep_today"), money(dToday), ""], [BX("m_dep_month"), money(dMonth), ""],
    ];
    return `<div class="metrics-grid">${cards.map((a) => `<div class="metric-card"><div class="metric-top">${a[0]}</div><div class="metric-value">${a[1]}</div>${a[2] ? `<small class="inv-muted">${a[2]}</small>` : ""}</div>`).join("")}</div>`;
  }
  function custMatches(c, qv) {
    if (!qv) return true;
    const s = qv.trim().toLowerCase(); if (!s) return true;
    const digits = s.replace(/\D/g, "");
    return c.name.toLowerCase().includes(s) || (digits.length >= 3 && String(c.phone || "").replace(/\D/g, "").includes(digits));
  }
  function balCustomerRowsHtml() {
    const last = lastTxMap();
    const list = customers.filter((c) => custMatches(c, bv.q) && (bv.filter === "all" || (bv.filter === "credit" && c.balance > 0) || (bv.filter === "debt" && c.balance < 0) || (bv.filter === "zero" && c.balance === 0)))
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance) || a.name.localeCompare(b.name));
    return list.map((c) => `<tr><td><b>${esc(c.name)}</b><br><span class="inv-muted" dir="ltr">${esc(fmtPhone(c.phone))}</span></td><td>${balSign(c.balance)}</td><td>${last[c.id] ? fmtDT(last[c.id]) : BX("none_yet")}</td><td><div class="row-actions"><button class="mini-btn" data-bact="dep" data-id="${c.id}">${BX("b_deposit")}</button><button class="mini-btn" data-bact="op" data-id="${c.id}">${BX("b_op")}</button><button class="mini-btn" data-bact="stmt" data-id="${c.id}">${BX("b_stmt")}</button><button class="mini-btn" data-bact="wa" data-id="${c.id}">${BX("b_wa")}</button></div></td></tr>`).join("")
      || `<tr><td colspan="4" class="empty-state compact">${BX("empty_customers")}</td></tr>`;
  }
  function balCustomersHtml() {
    const chips = [["all", "f_all"], ["credit", "f_credit"], ["debt", "f_debt"], ["zero", "f_zero"]].map(([k, l]) => `<button type="button" class="cloth-chip ${bv.filter === k ? "active" : ""}" data-bact="flt" data-id="${k}">${BX(l)}</button>`).join("");
    return `<div class="panel"><div class="panel-header"><div><h3>${BX("tab_customers")}</h3></div><button class="primary-btn" type="button" data-bact="newop">${BX("b_new_op")}</button></div><input type="search" id="balSearch" class="inv-search" placeholder="${BX("search")}" value="${esc(bv.q)}"><div class="chip-grid">${chips}</div><div class="table-wrap"><table><thead><tr><th>${BX("th_customer")}</th><th>${BX("th_balance")}</th><th>${BX("th_last")}</th><th></th></tr></thead><tbody id="balCustBody">${balCustomerRowsHtml()}</tbody></table></div></div>`;
  }
  function txDescription(tx) {
    let d = esc(tx.note || "");
    if (tx.orderId) { const o = orders.find((x) => x.id === tx.orderId); if (o && !(tx.note || "").includes("#")) d = `${BX("order_no", o.number)}${d ? " — " + d : ""}`; }
    return d;
  }
  function canReverse(tx) { return !!(can("balance_adjust") && TX_META[tx.type] && TX_META[tx.type].manual && !tx.orderId && !tx.reversedBy && Date.now() - new Date(tx.at).getTime() <= 86400000); }
  function filteredLedger() {
    const s = bv.lq.trim().toLowerCase();
    return ledger.filter((tx) => {
      if (bv.lt !== "all" && !LT_GROUPS[bv.lt].includes(tx.type)) return false;
      if (bv.from && isoDay(tx.at) < bv.from) return false;
      if (bv.to && isoDay(tx.at) > bv.to) return false;
      if (s) { const c = customers.find((x) => x.id === tx.customerId); if (!c || !custMatches(c, s)) return false; }
      return true;
    });
  }
  function ledgerRowsHtml(list, showCustomer) {
    return list.map((tx) => {
      const c = customers.find((x) => x.id === tx.customerId);
      const rev = tx.reversedBy ? ` <span class="inv-tag">${BX("reversed")}</span>` : "";
      return `<tr${tx.reversedBy ? ' style="opacity:.6"' : ""}><td>${fmtDT(tx.at)}</td>${showCustomer ? `<td>${c ? esc(c.name) : "—"}</td>` : ""}<td>${txLabel(tx)}${rev}</td><td>${txDescription(tx)}</td><td>${esc(methodLabel997(tx.method))}</td><td style="font-weight:700;color:${tx.amount >= 0 ? "var(--success)" : "var(--danger)"}" dir="ltr">${tx.amount === 0 ? money(0) : signedMoney(tx.amount)}</td><td>${tx.balanceAfter === undefined ? "" : money(tx.balanceAfter)}</td><td>${canReverse(tx) ? `<button class="mini-btn danger-mini" data-bact="rev" data-id="${tx.id}">${BX("b_reverse")}</button>` : ""}</td></tr>`;
    }).join("");
  }
  function ledgerBodyHtml() {
    const list = filteredLedger(), shown = list.slice(0, 200);
    return (ledgerRowsHtml(shown, true) || `<tr><td colspan="8" class="empty-state compact">${BX("empty_ledger")}</td></tr>`) + (list.length > 200 ? `<tr><td colspan="8" class="inv-muted">${BX("showing", 200, list.length)}</td></tr>` : "");
  }
  function balLedgerHtml() {
    const chips = [["all", "lt_all"], ["deposits", "lt_deposits"], ["orders", "lt_orders"], ["refunds", "lt_refunds"], ["adjust", "lt_adjust"]].map(([k, l]) => `<button type="button" class="cloth-chip ${bv.lt === k ? "active" : ""}" data-bact="lt" data-id="${k}">${BX(l)}</button>`).join("");
    return `<div class="panel"><div class="panel-header"><div><h3>${BX("tab_ledger")}</h3></div></div><input type="search" id="balLedgerSearch" class="inv-search" placeholder="${BX("search")}" value="${esc(bv.lq)}"><div class="chip-grid">${chips}</div><div class="bal-dates"><label>${BX("date_from")} <input type="date" id="balFrom" value="${bv.from}"></label><label>${BX("date_to")} <input type="date" id="balTo" value="${bv.to}"></label><button type="button" class="mini-btn" data-bact="clr">${BX("clear")}</button></div><div class="table-wrap"><table><thead><tr>${["th_date", "th_customer", "th_type", "th_note", "th_method", "th_amount", "th_after"].map((k) => `<th>${BX(k)}</th>`).join("")}<th></th></tr></thead><tbody id="balLedgerBody">${ledgerBodyHtml()}</tbody></table></div></div>`;
  }
  function balDebtorsHtml() {
    const last = lastTxMap();
    const list = customers.filter((c) => c.balance < 0).sort((a, b) => a.balance - b.balance);
    const rows = list.map((c) => `<tr><td><b>${esc(c.name)}</b><br><span class="inv-muted" dir="ltr">${esc(fmtPhone(c.phone))}</span></td><td><b style="color:var(--danger)">${money(-c.balance)}</b></td><td>${last[c.id] ? fmtDT(last[c.id]) : BX("none_yet")}</td><td><div class="row-actions"><button class="mini-btn" data-bact="settle" data-id="${c.id}">${BX("b_settle")}</button><button class="mini-btn" data-bact="remind" data-id="${c.id}">${BX("b_remind")}</button><button class="mini-btn" data-bact="stmt" data-id="${c.id}">${BX("b_stmt")}</button></div></td></tr>`).join("");
    return `<div class="panel"><div class="panel-header"><div><h3>${BX("tab_debtors")}</h3></div></div><div class="table-wrap"><table><thead><tr><th>${BX("th_customer")}</th><th>${BX("th_debt")}</th><th>${BX("th_last")}</th><th></th></tr></thead><tbody>${rows || `<tr><td colspan="4" class="empty-state compact">${BX("empty_debtors")}</td></tr>`}</tbody></table></div></div>`;
  }
  function ledgerSum(custId) { return round3(ledger.filter((tx) => tx.customerId === custId).reduce((s, tx) => s + Number(tx.amount || 0), 0)); }
  function balStatementHtml(c) {
    const list = ledger.filter((tx) => tx.customerId === c.id);
    const diff = round3(c.balance - ledgerSum(c.id));
    const check = Math.abs(diff) < 0.0005 ? `<span class="inv-muted">${BX("st_check_ok")}</span>` : `<span style="color:var(--warning);font-weight:700">${BX("st_check_bad", money(diff))}</span>`;
    return `<div class="panel"><div class="panel-header"><div><h3>${BX("st_title")} — ${esc(c.name)}</h3><p>${BX("st_phone")}: <span dir="ltr">${esc(fmtPhone(c.phone))}</span></p></div><div class="row-actions"><button class="primary-btn" type="button" data-bact="dep" data-id="${c.id}">${BX("b_deposit")}</button><button class="secondary-btn" type="button" data-bact="op" data-id="${c.id}">${BX("b_op")}</button><button class="whatsapp-btn" type="button" data-bact="stmtwa" data-id="${c.id}">${BX("b_wa")}</button><button class="ghost-btn" type="button" data-bact="print" data-id="${c.id}">${BX("b_print")}</button><button class="ghost-btn" type="button" data-bact="back">${BX("b_back")}</button></div></div><div class="inv-group"><div class="inv-group-head"><span>${BX("current_balance")}:</span><span style="font-size:20px">${balSign(c.balance)}</span>${check}</div></div><div class="table-wrap"><table><thead><tr>${["th_date", "th_type", "th_note", "th_method", "th_amount", "th_after"].map((k) => `<th>${BX(k)}</th>`).join("")}<th></th></tr></thead><tbody>${ledgerRowsHtml(list.slice(0, 300), false) || `<tr><td colspan="7" class="empty-state compact">${BX("empty_ledger")}</td></tr>`}</tbody></table></div></div>`;
  }
  function renderBalancesPage() {
    const root = document.getElementById("balRoot"); if (!root) return;
    if (bv.stmt && !customers.find((c) => c.id === bv.stmt)) bv.stmt = null;
    if (bv.stmt) { root.innerHTML = balStatementHtml(customers.find((c) => c.id === bv.stmt)); return; }
    const tabs = ["customers", "ledger", "debtors"].map((k) => `<button type="button" class="cloth-chip ${bv.tab === k ? "active" : ""}" data-bact="tab" data-id="${k}">${BX("tab_" + k)}${k === "debtors" && customers.some((c) => c.balance < 0) ? ` (${customers.filter((c) => c.balance < 0).length})` : ""}</button>`).join("");
    const mm = can("balance_adjust") ? balanceMismatches() : [];
    const review = mm.length ? `<div class="cloud-warn" style="margin-bottom:12px"><b>⚠ ${mm.length} ${lang === "en" ? "customer balance(s) differ from their transaction history (older data). Choose for each:" : "عميل رصيده لا يطابق سجل حركاته (بيانات قديمة). اختر لكل واحد:"}</b>
      ${mm.map((x) => `<div class="cloud-row" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:6px 0"><b>${esc(x.c.name)}</b> — ${lang === "en" ? "balance" : "الرصيد"} ${money(x.c.balance)} · ${lang === "en" ? "history" : "السجل"} ${money(x.ledgerSum)} · ${lang === "en" ? "difference" : "الفرق"} ${money(x.diff)}
        <button class="mini-btn" type="button" data-recon="ledger" data-id="${x.c.id}">${lang === "en" ? "Use history" : "اعتماد السجل"} (${money(x.ledgerSum)})</button>
        <button class="mini-btn" type="button" data-recon="keep" data-id="${x.c.id}">${lang === "en" ? "Keep balance (difference = opening balance)" : "الإبقاء على الرصيد (الفرق = رصيد افتتاحي)"}</button></div>`).join("")}</div>` : "";
    root.innerHTML = `${review}${balMetricsHtml()}<div class="chip-grid" style="margin-top:16px">${tabs}</div>${bv.tab === "customers" ? balCustomersHtml() : bv.tab === "ledger" ? balLedgerHtml() : balDebtorsHtml()}`;
  }
  document.addEventListener("click", (ev) => {
    const b = ev.target.closest && ev.target.closest("[data-recon]");
    if (!b) return;
    if (!can("balance_adjust")) { denied(); return; }
    const x = balanceMismatches().find((m) => m.c.id === b.dataset.id); if (!x) return;
    if (b.dataset.recon === "ledger") { x.c.openingBalance = 0; x.c.balance = x.ledgerSum; logActivity(`مراجعة رصيد ${x.c.name}: اعتماد سجل الحركات ${money(x.ledgerSum)} (كان ${money(x.diff + x.ledgerSum)})`); }
    else { x.c.openingBalance = x.diff; logActivity(`مراجعة رصيد ${x.c.name}: الإبقاء على ${money(x.c.balance)} — رصيد افتتاحي ${money(x.diff)}`); }
    persistAll(); renderBalancesPage(); toast(lang === "en" ? "Saved" : "تم الحفظ");
  });
  function renderLedger() { if (document.getElementById("page-balances").classList.contains("active")) renderBalancesPage(); }

  /* ---------- العمليات ---------- */
  function balTxForm(opts) {
    opts = opts || {};
    if (!customers.length) { toast(BX("empty_customers")); return; }
    const cust = customers.find((c) => c.id === opts.custId) || customers[0];
    const allowedTypes = ["credit", "cash_refund", "debit", "adj_plus", "adj_minus"].filter((ty) => (ty === "credit" ? can("balance_tx") : can("balance_adjust")));
    if (!allowedTypes.length) { denied(); return; }
    if (!shiftGuard()) return;
    const type = allowedTypes.includes(opts.type) ? opts.type : allowedTypes[0];
    // سداد مخصص لطلب: يُربط بالطلب فيظهر المتبقي عليه صحيحاً (وليس فقط على رصيد العميل)
    const forOrder = opts.orderId ? orders.find((o) => o.id === opts.orderId && o.customerId === cust.id) : null;
    let dupWarned = "";
    window.openQuickForm({
      title: forOrder ? (lang === "en" ? `💵 Payment for order #${forOrder.number}` : `💵 سداد على الطلب #${forOrder.number}`) : BX("t_op"),
      sub: `${cust.name} — ${BX("current_balance")}: ${money(cust.balance)}${forOrder ? ` — ${lang === "en" ? "remaining on this order" : "المتبقي على الطلب"}: ${money(opts.amount || 0)}` : ""}`,
      fields: [
        { id: "customerId", label: BX("f_customer"), type: "select", value: cust.id, options: customers.map((c) => ({ value: c.id, label: `${c.name} — ${c.phone || ""} (${money(c.balance)})` })) },
        { id: "type", label: BX("f_type"), type: "select", value: type, options: [["credit", "op_credit"], ["cash_refund", "op_refund"], ["debit", "op_debit"], ["adj_plus", "op_adj_plus"], ["adj_minus", "op_adj_minus"]].filter(([v]) => allowedTypes.includes(v)).map(([v, l]) => ({ value: v, label: BX(l) })) },
        { id: "amount", label: BX("f_amount"), type: "number", step: "0.001", value: opts.amount || "", min: 0 },
        { id: "method", label: BX("f_method"), type: "select", value: "cash", options: BAL_METHODS.map(([v, l]) => ({ value: v, label: BX(l) })) },
        bpRefField(),
        { id: "note", label: BX("f_note"), type: "text", value: opts.note || "" },
        { id: "notify", label: BX("f_notify"), type: "select", value: type === "credit" ? "yes" : "no", options: [{ value: "yes", label: BX("yes") }, { value: "no", label: BX("no") }] },
      ],
      onSubmit: (v) => {
        if (!allowedTypes.includes(v.type)) { denied(); return false; }
        const c = customers.find((x) => x.id === v.customerId);
        if (!c) { toast(BX("e_customer")); return false; }
        const amountRaw = round3(v.amount);
        if (!(amountRaw > 0)) { toast(BX("e_amount")); return false; }
        if (amountRaw > 50000) { toast(BX("e_big")); return false; }
        if (v.type === "cash_refund" && amountRaw > Math.max(0, c.balance)) { toast(BX("e_refund_max")); return false; }
        if (v.type !== "credit" && !v.note) { toast(BX("e_note")); return false; }
        // نفس المبلغ لنفس العميل خلال آخر 10 دقائق (من أي جهاز) — غالباً تسجيل مكرر لنفس الدفعة: تأكيد بضغطة ثانية
        if (v.type === "credit") {
          const same = ledger.find((tx) => tx.customerId === c.id && tx.type === "credit" && !tx.reversedBy && round3(tx.amount) === amountRaw && Date.now() - new Date(tx.at).getTime() < 600000);
          const key = c.id + "|" + amountRaw;
          if (same && dupWarned !== key) {
            dupWarned = key;
            const who = (emps().find((e) => e.id === same.byId) || {}).name || "";
            toast(lang === "en" ? `⚠ ${money(amountRaw)} was already recorded for ${c.name} at ${fmtDT(same.at)}${who ? " by " + who : ""}. Press again only if this is a second, separate payment.` : `⚠ سُجّلت دفعة ${money(amountRaw)} لـ${c.name} في ${fmtDT(same.at)}${who ? " بواسطة " + who : ""}. اضغط مرة أخرى فقط إن كانت دفعة ثانية مستقلة.`);
            return false;
          }
        }
        const real = v.type === "adj_plus" || v.type === "adj_minus" ? "adjustment" : v.type;
        const amount = (v.type === "cash_refund" || v.type === "debit" || v.type === "adj_minus") ? -amountRaw : amountRaw;
        const hasMethod = real === "credit" || real === "cash_refund";
        c.balance = round3(c.balance + amount);
        const settles = !!forOrder && real === "credit" && c.id === forOrder.customerId;
        ledger.unshift({ id: uid(), byId: me ? me.id : "", customerId: c.id, type: real, amount, balanceAfter: c.balance, method: hasMethod ? v.method : "", ref: hasMethod && v.method === "benefitpay" && normRef(v.ref) ? normRef(v.ref) : undefined, note: v.note || (settles ? `سداد طلب #${forOrder.number}` : ""), orderId: settles ? forOrder.id : null, settles: settles || undefined, at: new Date().toISOString() });
        logActivity(`${BX((TX_META[real] || {}).k || "tx_adjust")} — ${c.name}: ${money(Math.abs(amount))}`, Math.abs(amount));
        persistAll(); renderBalancesPage(); toast(BX("ok_tx") + (c.balance < 0 ? " — " + BX("now_debtor") : ""));
        if (v.notify === "yes") {
          const before = round3(c.balance - amount);
          const kind = real === "credit" ? (settles || before < 0 ? "payment" : "deposit") : real === "cash_refund" ? "refund" : amount < 0 ? "debit" : "plus";
          sendBalanceMessage(c, amount, kind, { orderNo: settles ? forOrder.number : "", note: real === "credit" || real === "cash_refund" ? "" : v.note });
        }
        if (opts.onDone) setTimeout(opts.onDone, 80);
      },
    });
  }
  function reverseTx(id) {
    if (!can("balance_adjust")) { denied(); return; }
    const tx = ledger.find((x) => x.id === id); if (!tx) return;
    if (Date.now() - new Date(tx.at).getTime() > 86400000) { toast(BX("e_rev_old")); return; }
    const c = customers.find((x) => x.id === tx.customerId); if (!c) return;
    confirmAction(BX("c_reverse"), () => {
      if (tx.reversedBy || !canReverse(tx)) return;
      const newBal = round3(c.balance - tx.amount);
      if (tx.type === "credit" && newBal < 0) { toast(BX("e_rev_neg")); return false; }
      c.balance = newBal;
      const r = { id: uid(), byId: me ? me.id : "", customerId: c.id, type: "reversal", amount: -tx.amount, balanceAfter: c.balance, method: tx.method || "", cashRev: tx.type === "credit" || tx.type === "cash_refund", reverses: tx.id, note: BX("rev_note", txLabel(tx) + " " + money(Math.abs(tx.amount))), orderId: null, at: new Date().toISOString() };
      tx.reversedBy = r.id; ledger.unshift(r);
      logActivity(`${BX("tx_reversal")} — ${c.name}: ${money(Math.abs(tx.amount))}`, Math.abs(tx.amount));
      persistAll(); renderBalancesPage(); toast(BX("ok_rev"));
    });
  }
  function shopName997() { try { return loadProfile().nameAr || BX("shop_default"); } catch (e) { return BX("shop_default"); } }
  function statementLines(c, n) { return ledger.filter((tx) => tx.customerId === c.id).slice(0, n).map((tx) => `• ${fmtDT(tx.at)} — ${tx.type === "credit" && round3((Number(tx.balanceAfter) || 0) - tx.amount) < 0 ? (lang === "en" ? "Payment" : "دفعة سداد") : txLabel(tx)}: ${tx.type === "package_purchase" ? money(tx.price || 0) : signedMoney(tx.amount)}`).join("\n"); }
  function printStatement(c) {
    const profile = loadProfile();
    const rows = ledger.filter((tx) => tx.customerId === c.id).slice(0, 25);
    const el = ensurePrintContainer();
    el.innerHTML = `<div class="receipt" dir="${lang === "en" ? "ltr" : "rtl"}"><div class="receipt-header"><h2>${esc(shopName997())}</h2>${profile.phone ? `<p class="receipt-sub">${esc(profile.phone)}</p>` : ""}</div><div class="receipt-divider"></div><p class="receipt-section-title">${BX("st_title")}</p><p class="receipt-meta"><span>${esc(c.name)}</span><span>${esc(c.phone || "")}</span></p><p class="receipt-meta"><span>${fmtDT(new Date().toISOString())}</span></p><div class="receipt-divider"></div><table><thead><tr><th>${BX("th_date")}</th><th>${BX("th_type")}</th><th>${BX("th_amount")}</th><th>${BX("th_after")}</th></tr></thead><tbody>${rows.map((tx) => `<tr><td>${fmtDT(tx.at)}</td><td>${txLabel(tx)}</td><td dir="ltr">${signedMoney(tx.amount)}</td><td>${tx.balanceAfter === undefined ? "" : money(tx.balanceAfter)}</td></tr>`).join("")}</tbody></table><div class="receipt-divider receipt-divider-double"></div><div class="receipt-line receipt-total"><span>${BX("current_balance")}</span><span>${money(c.balance)}</span></div>${c.balance < 0 ? `<p class="receipt-debtor">${BX("debtor_note")}</p>` : ""}<div class="receipt-divider"></div><p class="receipt-thanks">${BX("thanks")}</p></div>`;
    window.print();
  }
  (function initBalancesUI() {
    const root = document.getElementById("balRoot"); if (!root) return;
    root.addEventListener("click", (e) => {
      const b = e.target.closest("[data-bact]"); if (!b || !root.contains(b)) return;
      const a = b.dataset.bact, id = b.dataset.id, c = customers.find((x) => x.id === id);
      if (a === "tab") { bv.tab = id; renderBalancesPage(); }
      else if (a === "flt") { bv.filter = id; renderBalancesPage(); }
      else if (a === "lt") { bv.lt = id; renderBalancesPage(); }
      else if (a === "clr") { bv.lt = "all"; bv.lq = ""; bv.from = ""; bv.to = ""; renderBalancesPage(); }
      else if (a === "newop") balTxForm();
      else if (a === "dep" && c) balTxForm({ custId: c.id, type: "credit" });
      else if (a === "op" && c) balTxForm({ custId: c.id, type: "credit" });
      else if (a === "settle" && c) balTxForm({ custId: c.id, type: "credit", amount: round3(-c.balance), note: "" });
      else if (a === "stmt" && c) { bv.stmt = c.id; renderBalancesPage(); window.scrollTo({ top: 0 }); }
      else if (a === "back") { bv.stmt = null; renderBalancesPage(); }
      else if (a === "wa" && c) openWhatsApp(c.phone, BX("wa_stmt", c.name, shopName997(), statementLines(c, 5), balanceStatus(c.balance)));
      else if (a === "remind" && c) sendDueReminder(c);
      else if (a === "stmtwa" && c) openWhatsApp(c.phone, BX("wa_stmt", c.name, shopName997(), statementLines(c, 8), balanceStatus(c.balance)));
      else if (a === "print" && c) printStatement(c);
      else if (a === "rev") reverseTx(id);
    });
    root.addEventListener("input", (e) => {
      const el = e.target;
      if (el.id === "balSearch") { bv.q = el.value; document.getElementById("balCustBody").innerHTML = balCustomerRowsHtml(); }
      else if (el.id === "balLedgerSearch") { bv.lq = el.value; document.getElementById("balLedgerBody").innerHTML = ledgerBodyHtml(); }
    });
    root.addEventListener("change", (e) => {
      const el = e.target;
      if (el.id === "balFrom") { bv.from = el.value; document.getElementById("balLedgerBody").innerHTML = ledgerBodyHtml(); }
      else if (el.id === "balTo") { bv.to = el.value; document.getElementById("balLedgerBody").innerHTML = ledgerBodyHtml(); }
    });
  })();

  /* ============================= صفحة التقارير ============================= */
  let activeReportType = "overview";
  // تبويبات التقارير فقط (وليس تبويبات الإعدادات التي تستخدم نفس التنسيق — كانت تُفرغ صفحة التقارير)
  document.querySelectorAll("#reportTypeTabs .report-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeReportType = btn.dataset.report;
      document.querySelectorAll("#reportTypeTabs .report-tab").forEach((b) => b.classList.toggle("active", b === btn));
      renderReportsPage();
    });
  });
  document.getElementById("reportApplyBtn").addEventListener("click", renderReportsPage);

  /* ============================= التقرير الشهري =============================
     تقرير نهاية الشهر: الإيرادات، التحصيل، المصروفات (تشغيل / رواتب / جهات حكومية / مخزون / أخرى)،
     صافي الربح، المقارنة بالشهر السابق، الذمم، وحالة الإغلاقات — للعرض والطباعة */
  let reportMonthKey = null;
  function monthlyReportHtml(mk) {
    const en = lang === "en";
    const mb = FIN.monthBounds(mk + "-01");
    const prevKey = FIN.monthBounds(FIN.addDays(mb.from, -1)).key;
    const pb = FIN.monthBounds(prevKey + "-01");
    const d = finData();
    const s = FIN.summarize(d, mb.from, mb.to), p = FIN.summarize(d, pb.from, pb.to), snap = FIN.snapshot(d);
    const E = window.L997Enterprise ? window.L997Enterprise.data : { employees: [], closures: [] };
    const gl = (id) => { const g = FIN.EXPENSE_GROUPS.find((x) => x.id === id); return g ? (en ? g.en : g.ar) : id; };
    const cl = (id) => { const c = FIN.EXPENSE_CATEGORIES.find((x) => x.id === id); return c ? (en ? c.en : c.ar) : id; };
    const pct = (a, b) => (b ? `${a >= b ? "▲" : "▼"} ${Math.abs(Math.round(((a - b) / Math.abs(b)) * 100))}%` : "—");
    const row = (label, v, opt) => `<tr class="${opt && opt.cls ? opt.cls : ""}"><td>${label}</td><td>${typeof v === "number" ? money(v) : v}</td>${opt && opt.prev !== undefined ? `<td class="mr-prev">${money(opt.prev)}</td><td class="mr-prev">${pct(v, opt.prev)}</td>` : opt && opt.cmp ? "<td></td><td></td>" : ""}</tr>`;
    const sec = (title, rows, cmp) => `<section class="mr-sec"><h4>${title}</h4><table>${cmp ? `<tr class="mr-head"><td></td><td>${mk}</td><td class="mr-prev">${prevKey}</td><td class="mr-prev">${en ? "Change" : "التغير"}</td></tr>` : ""}${rows}</table></section>`;
    // المصروفات حسب المجموعة مع التفصيل
    const expRows = FIN.EXPENSE_GROUPS.filter((g) => s.expensesByGroup[g.id] || p.expensesByGroup[g.id]).map((g) => {
      const cats = s.expensesByGroupCat[g.id] || {};
      const detail = g.id === "salaries" && Object.keys(s.salariesByEmployee).length
        ? Object.entries(s.salariesByEmployee).map(([eid, v]) => row(`&nbsp;&nbsp;· ${esc((E.employees.find((x) => x.id === eid) || {}).name || "—")}`, v, { cls: "mr-sub", cmp: 1 })).join("")
        : Object.entries(cats).map(([cid, v]) => row(`&nbsp;&nbsp;· ${esc(cl(cid))}`, v, { cls: "mr-sub", cmp: 1 })).join("");
      return row(`<b>${gl(g.id)}</b>`, s.expensesByGroup[g.id] || 0, { prev: p.expensesByGroup[g.id] || 0 }) + detail;
    }).join("") || `<tr><td colspan="4" class="inv-muted">${en ? "No expenses recorded" : "لا توجد مصروفات مسجّلة"}</td></tr>`;
    const daily = E.closures.filter((c) => c.type === "daily" && c.forDate >= mb.from && c.forDate <= mb.to);
    const variance = FIN.r3(daily.reduce((a, c) => a + Number(c.variance || 0), 0));
    const unclosed = FIN.unclosedDays(d, E.closures, mb.from, mb.to < FIN.todayStr() ? mb.to : FIN.addDays(FIN.todayStr(), -1));
    const monthly = E.closures.find((c) => c.type === "monthly" && c.forMonth === mk);
    const margin = s.netRevenue ? Math.round((s.profit / s.netRevenue) * 100) : 0;
    const profile = loadProfile();
    return `<div class="mreport" dir="${en ? "ltr" : "rtl"}">
      <div class="mr-title"><div><h3>${esc(profile.nameAr || "997 Laundry")}</h3><p>${en ? "Monthly report" : "التقرير الشهري"} — ${mk} (${mb.from} → ${mb.to})</p></div><small>${en ? "Generated" : "أُعدّ في"} ${fmtDT(new Date().toISOString())}</small></div>
      <div class="mr-kpis">
        <div><span>${FX("net_rev")}</span><b>${money(s.netRevenue)}</b></div>
        <div><span>${en ? "Total expenses" : "إجمالي المصروفات"}</span><b>${money(s.expenses)}</b></div>
        <div class="${s.profit < 0 ? "neg" : "pos"}"><span>${en ? "Net profit" : "صافي الربح"}</span><b>${money(s.profit)}</b>${Math.abs(margin) <= 100 ? `<small>${en ? "margin" : "هامش الربح"} ${margin}%</small>` : ""}</div>
        <div><span>${FX("collected")}</span><b>${money(s.collected)}</b></div>
      </div>
      ${sec(en ? "1. Revenue" : "١. الإيرادات", [
        row(en ? "Paid orders" : "عدد الطلبات المدفوعة", String(s.salesOrders), { cmp: 1 }),
        row(en ? "Order sales (incl. VAT)" : "مبيعات الطلبات (شامل الضريبة)", s.grossOrderSales, { prev: p.grossOrderSales }),
        row(FX("pkg_sales"), s.packageSales, { prev: p.packageSales }),
        row(FX("discounts"), s.discounts, { cmp: 1 }),
        s.vat ? row("− " + FX("vat"), s.vat, { prev: p.vat }) : "",
        row(`<b>${FX("net_rev")}</b>`, s.netRevenue, { prev: p.netRevenue, cls: "mr-total" }),
      ].join(""), true)}
      ${sec(en ? "2. Money received" : "٢. المبالغ المحصّلة", [
        ...FIN.CASH_METHODS.map((m) => row(paymentLabel(m), s.collectedBy[m] || 0, { cmp: 1 })),
        row("− " + FX("refunds"), s.refunds, { cmp: 1 }),
        row(`<b>${FX("collected")}</b>`, s.collected, { prev: p.collected, cls: "mr-total" }),
        row(en ? "of which: balance deposits & debt payments" : "منها: إيداعات أرصدة وسداد ديون", s.deposits, { cls: "mr-sub", cmp: 1 }),
        row(FX("from_balance"), s.paidFromBalance, { cmp: 1 }),
        row(FX("credit"), s.creditGiven, { cmp: 1 }),
      ].join(""), true)}
      ${sec(en ? "3. Expenses" : "٣. المصروفات", expRows + row(`<b>${en ? "Total expenses" : "إجمالي المصروفات"}</b>`, s.expenses, { prev: p.expenses, cls: "mr-total" }), true)}
      ${sec(en ? "4. Result" : "٤. النتيجة", [
        row(FX("net_rev"), s.netRevenue, { prev: p.netRevenue }),
        row("− " + (en ? "Total expenses" : "إجمالي المصروفات"), s.expenses, { prev: p.expenses }),
        row(`<b>${en ? "Net profit" : "صافي الربح"}</b>`, s.profit, { prev: p.profit, cls: s.profit < 0 ? "mr-total neg" : "mr-total pos" }),
      ].join(""), true)}
      ${sec(en ? "5. Balances (as of today)" : "٥. الذمم والأرصدة (حسب الوضع الحالي)", [
        row(FX("receivables"), snap.receivables), row(FX("prepaid"), snap.prepaid), row(FX("open_value"), snap.openValue),
      ].join(""))}
      ${sec(en ? "6. Closures" : "٦. الإغلاقات", [
        row(en ? "Daily closures approved" : "أيام تم إغلاقها", String(daily.length)),
        row(en ? "Total cash difference" : "مجموع فروقات الصندوق", variance, { cls: variance ? "neg" : "" }),
        row(en ? "Days with activity not closed" : "أيام فيها حركة ولم تُغلق", unclosed.length ? unclosed.map((x) => x.slice(8)).join("، ") : "✓"),
        row(en ? "Monthly closure" : "الإغلاق الشهري", monthly ? `✓ ${esc(monthly.by || "")} — ${fmtDT(monthly.date)}` : (en ? "Not approved yet" : "لم يُعتمد بعد")),
      ].join(""))}
      ${monthCustomersHtml(mk, s, p)}
      <p class="mr-note">${en ? "Profit = revenue excl. VAT − all recorded expenses (salaries, advances, government fees, stock purchases when paid)." : "صافي الربح = الإيراد بدون ضريبة − كل المصروفات المسجّلة (الرواتب والسلف والرسوم الحكومية ومشتريات المخزون عند دفعها)."}</p>
    </div>`;
  }
  // 📊 دراسة العملاء للشهر: لكل عميل طلباته وقطعه ومبيعاته وباقاته ونقاطه والتزامه — ومقارنة بالشهر السابق
  function monthCustomerData(mk) {
    const mb = FIN.monthBounds(mk + "-01"), prevKey = FIN.monthBounds(FIN.addDays(mb.from, -1)).key, pb = FIN.monthBounds(prevKey + "-01");
    const cfg = FIN.loyaltyCfg(settings), st = FIN.customerStats(customers, orders, ledger, customerPackages, settings, mb.to < todayStr() ? mb.to : todayStr());
    const inM = (iso, b) => !!iso && FIN.inRange(iso, b.from, b.to);
    const rows = customers.map((c) => {
      const os = orders.filter((o) => o.customerId === c.id && o.status !== "cancelled");
      const created = os.filter((o) => inM(o.createdAt, mb)), createdPrev = os.filter((o) => inM(o.createdAt, pb));
      const sales = os.filter((o) => FIN.isSale(o) && inM(FIN.orderPaidAt(o), mb));
      const salesV = round3(sales.reduce((a, o) => a + (Number(o.payment && o.payment.total) || 0), 0));
      const pk = ledger.filter((t) => t.customerId === c.id && t.type === "package_purchase" && inM(t.at, mb));
      const pkV = round3(pk.reduce((a, t) => a + FIN.packagePrice(t, customerPackages), 0));
      const pkUsed = created.reduce((a, o) => a + (o.items || []).filter((it) => it.fromPackageId).reduce((b, it) => b + pkgUnits(it), 0), 0);
      const redeemed = ledger.filter((t) => t.customerId === c.id && inM(t.at, mb) && !t.reversedBy).reduce((a, t) => a + (Number(t.loyaltyPoints) || 0), 0);
      const s = st[c.id] || {};
      return { c, s, orders: created.length, ordersPrev: createdPrev.length, pieces: created.reduce((a, o) => a + piecesOf(o), 0), sales: salesV, pkgCount: pk.length, pkgValue: pkV, pkgUsed: pkUsed,
        total: round3(salesV + pkV), pointsEarned: Math.floor((salesV + pkV) * cfg.perBD), pointsRedeemed: redeemed,
        isNew: c.createdAt ? inM(c.createdAt, mb) : created.length > 0 && !os.some((o) => FIN.localDay(o.createdAt) < mb.from),
        everBefore: os.some((o) => FIN.localDay(o.createdAt) < mb.from) };
    });
    const active = rows.filter((r) => r.orders > 0 || r.pkgCount > 0), activePrev = rows.filter((r) => r.ordersPrev > 0);
    const pkgs = {};
    ledger.filter((t) => t.type === "package_purchase" && inM(t.at, mb)).forEach((t) => { const cp = customerPackages.find((p) => p.id === t.packageId); const n = (cp && cp.name) || String(t.note || "").replace(/^شراء باقة:\s*/, "").split(" — ")[0] || "—"; pkgs[n] = pkgs[n] || { n: 0, v: 0 }; pkgs[n].n++; pkgs[n].v = round3(pkgs[n].v + FIN.packagePrice(t, customerPackages)); });
    return { mk, prevKey, mb, cfg, rows, active, activePrev, pkgs,
      newCount: rows.filter((r) => r.isNew && (r.orders > 0 || r.pkgCount > 0)).length,
      returning: active.filter((r) => r.everBefore).length,
      lost: activePrev.filter((r) => r.orders === 0 && r.pkgCount === 0),
      late: rows.filter((r) => r.s.owed > 0 && r.s.overdueDays > cfg.lateDays) };
  }
  function monthCustomersHtml(mk, s, p) {
    const en = lang === "en", d = monthCustomerData(mk), E2 = (ar, e) => (en ? e : ar);
    const top = d.active.slice().sort((a, b) => b.total - a.total).slice(0, 15);
    const avg = d.active.length ? round3(d.active.reduce((a, r) => a + r.total, 0) / d.active.length) : 0;
    const retPct = d.active.length ? Math.round((d.returning / d.active.length) * 100) : 0;
    const issued = d.rows.reduce((a, r) => a + r.pointsEarned, 0), redeemed = d.rows.reduce((a, r) => a + r.pointsRedeemed, 0);
    const outstanding = d.rows.reduce((a, r) => a + (r.s.points || 0), 0);
    const lateSum = round3(d.late.reduce((a, r) => a + r.s.owed, 0));
    const growth = p.salesTotal ? Math.round(((s.salesTotal - p.salesTotal) / p.salesTotal) * 100) : null;
    const tips = [];
    if (growth !== null) tips.push(growth >= 0 ? E2(`📈 المبيعات زادت ${growth}% عن الشهر السابق — حافظ على نفس الوتيرة.`, `📈 Sales grew ${growth}% on last month — keep the pace.`) : E2(`📉 المبيعات نقصت ${-growth}% عن الشهر السابق — أرسل حملة «اشتقنا لك» للعملاء المنقطعين.`, `📉 Sales fell ${-growth}% on last month — send a “We miss you” campaign to inactive customers.`));
    if (d.lost.length) tips.push(E2(`👋 ${d.lost.length} عميل طلبوا الشهر السابق وما رجعوا هذا الشهر — حملة «اشتقنا لك» بخصم 10% تسترجع جزءاً منهم.`, `👋 ${d.lost.length} customers ordered last month but not this month — a “We miss you” 10% campaign can win some back.`));
    if (retPct < 50 && d.active.length >= 5) tips.push(E2(`🔁 ${retPct}% فقط من عملاء الشهر عملاء عائدون — ركّز على الباقات وبطاقات الولاء لرفع التكرار.`, `🔁 Only ${retPct}% of this month's customers are returning — push packages and loyalty to raise repeat visits.`));
    if (d.late.length) tips.push(E2(`⏰ ${d.late.length} عميل متأخرين بالدفع بمجموع ${money(lateSum)} — أرسل تذكير المتبقي من صفحة الولاء والحملات.`, `⏰ ${d.late.length} late payers owe ${money(lateSum)} — send payment reminders from Loyalty & campaigns.`));
    if (s.packageCount === 0) tips.push(E2("🎟 لم تُبع أي باقة هذا الشهر — اعرض الباقات على العملاء الأكثر طلباً.", "🎟 No packages were sold this month — offer them to your most frequent customers."));
    if (d.newCount) tips.push(E2(`🆕 ${d.newCount} عميل جديد هذا الشهر — أرسل لهم رسالة شكر ورابط التطبيق ليرجعوا.`, `🆕 ${d.newCount} new customers this month — send them a thank-you and the app link so they come back.`));
    if (!tips.length) tips.push(E2("✅ الأداء مستقر — استمر وتابع التقرير الشهر الجاي.", "✅ Stable month — keep going and review next month."));
    const tr = (cells) => `<tr>${cells.map((x) => `<td>${x}</td>`).join("")}</tr>`;
    return `
      <section class="mr-sec"><h4>${E2("٧. العملاء", "7. Customers")}</h4><table>
        ${tr([E2("عملاء طلبوا هذا الشهر", "Customers who ordered"), `<b>${d.active.length}</b>`, `<span class="mr-prev">${d.activePrev.length}</span>`])}
        ${tr([E2("منهم جدد", "of which new"), d.newCount, ""])}
        ${tr([E2("منهم عائدون", "of which returning"), `${d.returning} (${retPct}%)`, ""])}
        ${tr([E2("انقطعوا (طلبوا الشهر السابق فقط)", "Lost (ordered last month only)"), d.lost.length, ""])}
        ${tr([E2("متوسط صرف العميل", "Average spend per customer"), money(avg), ""])}
      </table>
      <table class="mr-wide"><tr class="mr-head"><td>#</td><td>${E2("العميل", "Customer")}</td><td>${E2("طلبات", "Orders")}</td><td>${E2("قطع", "Pcs")}</td><td>${E2("مبيعات", "Sales")}</td><td>${E2("باقات", "Packages")}</td><td>${E2("المتبقي", "Owed")}</td><td>${E2("الفئة", "Tier")}</td><td>⭐</td></tr>
        ${top.map((r, i) => tr([i + 1, esc(r.c.name), r.orders, r.pieces, money(r.sales), r.pkgCount ? `${r.pkgCount} · ${money(r.pkgValue)}` : "—", r.s.owed > 0 ? money(r.s.owed) : "—", tierLabel(r.s), fmtPts(r.s.points)])).join("") || `<tr><td colspan="9" class="inv-muted">—</td></tr>`}
      </table>${d.active.length > top.length ? `<p class="mr-note">${E2(`أعلى ${top.length} عميل — القائمة الكاملة (${d.active.length}) في ملف Excel.`, `Top ${top.length} — the full list (${d.active.length}) is in the Excel file.`)}</p>` : ""}</section>
      <section class="mr-sec"><h4>${E2("٨. الباقات", "8. Packages")}</h4><table>
        ${Object.entries(d.pkgs).map(([n, v]) => tr([esc(n), `${v.n} × `, money(v.v)])).join("") || tr([E2("لا توجد باقات مباعة هذا الشهر", "No packages sold this month"), "", ""])}
        ${tr([`<b>${E2("المجموع", "Total")}</b>`, `<b>${s.packageCount}</b>`, `<b>${money(s.packageSales)}</b>`])}
        ${tr([E2("قطع استُخدمت من الباقات هذا الشهر", "Package pieces used this month"), d.rows.reduce((a, r) => a + r.pkgUsed, 0), ""])}
      </table></section>
      <section class="mr-sec"><h4>${E2("٩. الولاء والالتزام بالدفع", "9. Loyalty & payment commitment")}</h4><table>
        ${tr([E2("نقاط اكتسبها العملاء هذا الشهر", "Points earned this month"), fmtPts(issued), ""])}
        ${tr([E2("نقاط استُبدلت", "Points redeemed"), fmtPts(redeemed), money((redeemed / d.cfg.redeemPoints) * d.cfg.redeemValue)])}
        ${tr([E2("نقاط قائمة لم تُستبدل (التزام على المحل)", "Outstanding points (shop liability)"), fmtPts(outstanding), money(Math.floor(outstanding / d.cfg.redeemPoints) * d.cfg.redeemValue)])}
        ${tr([E2("متأخرون بالدفع", "Late payers"), d.late.length, money(lateSum)])}
        ${tr([E2("متوسط الالتزام بالدفع", "Average payment commitment"), `${d.rows.filter((r) => r.s.sales).length ? Math.round(d.rows.filter((r) => r.s.sales).reduce((a, r) => a + r.s.commitment, 0) / d.rows.filter((r) => r.s.sales).length) : 0}%`, ""])}
      </table></section>
      <section class="mr-sec mr-insights"><h4>${E2("١٠. إلى أين نتجه؟ — توصيات", "10. Where are we heading? — recommendations")}</h4><ul>${tips.map((t) => `<li>${t}</li>`).join("")}</ul></section>`;
  }
  function monthCustomersCsv(mk) {
    const d = monthCustomerData(mk), en = lang === "en";
    const head = en ? ["Customer", "Phone", "Orders", "Pieces", "Sales BD", "Packages bought", "Packages BD", "Package pieces used", "Total BD", "Owed now BD", "Days overdue", "Commitment %", "Tier", "Points", "Points earned (month)", "Points redeemed (month)", "Last order", "New this month"]
      : ["العميل", "الجوال", "الطلبات", "القطع", "المبيعات د.ب", "باقات مشتراة", "قيمة الباقات د.ب", "قطع مستخدمة من الباقات", "الإجمالي د.ب", "المتبقي الآن د.ب", "أيام التأخير", "الالتزام %", "الفئة", "النقاط", "نقاط مكتسبة (الشهر)", "نقاط مستبدلة (الشهر)", "آخر طلب", "جديد هذا الشهر"];
    const rows = d.rows.filter((r) => r.orders || r.pkgCount || r.s.owed > 0 || r.s.points > 0).sort((a, b) => b.total - a.total)
      .map((r) => [r.c.name, fmtPhone(r.c.phone), r.orders, r.pieces, r.sales.toFixed(3), r.pkgCount, r.pkgValue.toFixed(3), r.pkgUsed, r.total.toFixed(3), (r.s.owed || 0).toFixed(3), r.s.overdueDays || 0, r.s.commitment, en ? r.s.tierName.en : r.s.tierName.ar, r.s.points, r.pointsEarned, r.pointsRedeemed, r.s.lastOrderAt ? FIN.localDay(r.s.lastOrderAt) : "", r.isNew ? "✓" : ""]);
    const csv = "﻿" + [head, ...rows].map((r) => r.map((c) => `"${String(c == null ? "" : c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })), a = document.createElement("a");
    a.href = url; a.download = `997-customers-${mk}.csv`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
    logActivity(`⬇ تصدير دراسة العملاء ${mk} — ${rows.length} عميل`);
  }
  function monthSummaryText(mk) {
    const en = lang === "en", mb = FIN.monthBounds(mk + "-01"), pk = FIN.monthBounds(FIN.addDays(mb.from, -1)).key, pb = FIN.monthBounds(pk + "-01");
    const s = FIN.summarize(finData(), mb.from, mb.to), p = FIN.summarize(finData(), pb.from, pb.to), d = monthCustomerData(mk);
    const ch = (a, b) => (b ? ` (${a >= b ? "▲" : "▼"}${Math.abs(Math.round(((a - b) / Math.abs(b)) * 100))}%)` : "");
    const top = d.active.slice().sort((a, b) => b.total - a.total).slice(0, 3).map((r) => `${r.c.name} ${money(r.total)}`).join("، ");
    return en
      ? `📊 997 Laundry — report ${mk}\n💰 Sales: ${money(s.salesTotal)}${ch(s.salesTotal, p.salesTotal)}\n💵 Collected: ${money(s.collected)}\n🧾 Expenses: ${money(s.expenses)}\n📈 Net profit: ${money(s.profit)}\n🧺 Paid orders: ${s.salesOrders} · 🎟 packages: ${s.packageCount} (${money(s.packageSales)})\n👥 Customers: ${d.active.length} (new ${d.newCount}, lost ${d.lost.length})\n⏰ Late payers: ${d.late.length}\n🏆 Top: ${top || "—"}`
      : `📊 مغسلة 997 — تقرير ${mk}\n💰 المبيعات: ${money(s.salesTotal)}${ch(s.salesTotal, p.salesTotal)}\n💵 المحصّل: ${money(s.collected)}\n🧾 المصروفات: ${money(s.expenses)}\n📈 صافي الربح: ${money(s.profit)}\n🧺 طلبات مدفوعة: ${s.salesOrders} · 🎟 باقات: ${s.packageCount} (${money(s.packageSales)})\n👥 العملاء: ${d.active.length} (جدد ${d.newCount}، انقطعوا ${d.lost.length})\n⏰ متأخرون بالدفع: ${d.late.length}\n🏆 الأعلى: ${top || "—"}`;
  }
  // أول أسبوع من كل شهر: تنبيه للمالك/المدير مرة واحدة على كل جهاز بأن تقرير الشهر الماضي جاهز
  function monthReportNudge() {
    if (!can("view_reports") || Number(todayStr().slice(8)) > 7) return;
    const prev = FIN.monthBounds(FIN.addDays(todayStr().slice(0, 7) + "-01", -1)).key;
    try { if (localStorage.getItem("l997_mreport_seen") === prev) return; localStorage.setItem("l997_mreport_seen", prev); } catch (e) { return; }
    if (!orders.length) return;
    openQuickForm({ title: DL(`📊 تقرير شهر ${prev} جاهز`, `📊 The ${prev} report is ready`), sub: monthSummaryText(prev), fields: [],
      submitLabel: DL("📊 افتح التقرير الكامل", "📊 Open the full report"), onSubmit: () => { setTimeout(() => window.openMonthlyReport997(prev), 60); } });
  }

  function printMonthlyReport(mk) {
    const el = ensurePrintContainer();
    el.innerHTML = monthlyReportHtml(mk);
    logActivity(`طباعة التقرير الشهري ${mk}`);
    window.print();
  }
  window.openMonthlyReport997 = (mk) => {
    reportMonthKey = mk;
    activeReportType = "monthly";
    document.querySelectorAll("#reportTypeTabs .report-tab").forEach((b) => b.classList.toggle("active", b.dataset.report === "monthly"));
    openPage("reports");
  };

  function renderReportsPage() {
    if (!document.getElementById("reportFromDate").value) {
      const to = new Date(), from = new Date(); from.setDate(from.getDate() - 29);
      document.getElementById("reportFromDate").value = fmtDateInput(from);
      document.getElementById("reportToDate").value = fmtDateInput(to);
    }
    const content = document.getElementById("reportContent");
    const dateRow = document.querySelector(".report-date-row");
    if (dateRow) dateRow.style.display = activeReportType === "monthly" ? "none" : "";
    if (activeReportType === "monthly") {
      if (!reportMonthKey) reportMonthKey = FIN.todayStr().slice(0, 7);
      content.innerHTML = `<div class="panel"><div class="panel-header"><div><h3>${lang === "en" ? "Monthly report" : "التقرير الشهري"}</h3><p>${lang === "en" ? "Revenue, collections, expenses, salaries, government fees and profit" : "الإيرادات والتحصيل والمصروفات والرواتب والجهات الحكومية وصافي الربح"}</p></div>
        <div class="row-actions"><input type="month" id="monthlyReportMonth" value="${reportMonthKey}" class="inv-search" style="width:auto;margin:0"><button class="primary-btn" type="button" id="monthlyReportPrint">🖨 ${lang === "en" ? "Print / PDF" : "طباعة / PDF"}</button><button class="secondary-btn" type="button" id="monthlyReportCsv">⬇ ${lang === "en" ? "Customers (Excel)" : "العملاء (Excel)"}</button><button class="whatsapp-btn" type="button" id="monthlyReportWa">📲 ${lang === "en" ? "Summary on WhatsApp" : "الملخص على واتساب"}</button></div></div>
        ${monthlyReportHtml(reportMonthKey)}</div>`;
      document.getElementById("monthlyReportMonth").addEventListener("change", (e) => { if (/^\d{4}-\d{2}$/.test(e.target.value)) { reportMonthKey = e.target.value; renderReportsPage(); } });
      document.getElementById("monthlyReportPrint").addEventListener("click", () => printMonthlyReport(reportMonthKey));
      document.getElementById("monthlyReportCsv").addEventListener("click", () => monthCustomersCsv(reportMonthKey));
      document.getElementById("monthlyReportWa").addEventListener("click", () => { window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(monthSummaryText(reportMonthKey))}`, "_blank", "noopener"); logActivity(`📲 مشاركة ملخص التقرير الشهري ${reportMonthKey}`); });
      return;
    }
    const fromInput = document.getElementById("reportFromDate").value, toInput = document.getElementById("reportToDate").value;
    const s = FIN.summarize(finData(), fromInput, toInput);
    const snap = FIN.snapshot(finData());
    const metric = (label, value, color) => `<div class="metric-card"><div class="metric-top"><span>${label}</span></div><div class="metric-value"${color ? ` style="color:${color}"` : ""}>${value}</div></div>`;
    const row = (label, value, color, strong) => `<div class="dash-revexp-row"><span class="label">${strong ? `<strong>${label}</strong>` : label}</span><span class="value"${color ? ` style="color:${color}"` : ""}>${strong ? `<strong>${money(value)}</strong>` : money(value)}</span></div>`;

    // 💳 مطابقة BenefitPay: كل دفعة بـ Benefit في الفترة مع رقم العملية — للمقارنة مع كشف تطبيق BenefitPay
    const bpRows = [
      ...orders.filter((o) => o.status !== "cancelled" && o.payment && o.payment.method === "benefitpay" && o.paymentConfirmed && FIN.inRange(FIN.orderPaidAt(o), fromInput, toInput))
        .map((o) => ({ at: FIN.orderPaidAt(o), who: (customers.find((c) => c.id === o.customerId) || {}).name || "—", what: `${lang === "en" ? "Order" : "طلب"} #${o.number}`, amount: round3(o.payment.paid), ref: o.payment.ref || "" })),
      ...ledger.filter((t) => t.method === "benefitpay" && !t.orderId && !t.reversedBy && FIN.inRange(t.at, fromInput, toInput) && (t.type === "credit" || t.type === "package_purchase"))
        .map((t) => ({ at: t.at, who: (customers.find((c) => c.id === t.customerId) || {}).name || "—", what: t.type === "package_purchase" ? (lang === "en" ? "Package" : "باقة") : (lang === "en" ? "Deposit / debt payment" : "إيداع / سداد دين"), amount: round3(t.type === "package_purchase" ? FIN.packagePrice(t, customerPackages) : t.amount), ref: t.ref || "" })),
    ].sort((a, b) => String(b.at).localeCompare(String(a.at)));
    const bpPanel = bpRows.length ? `<div class="panel"><div class="panel-header"><div><h3>💳 ${lang === "en" ? "BenefitPay payments — reconcile with the BenefitPay app" : "مدفوعات BenefitPay — طابقها مع كشف تطبيق BenefitPay"}</h3>
      <p>${bpRows.length} ${lang === "en" ? "payments" : "دفعة"} · <b>${money(bpRows.reduce((a, r) => a + r.amount, 0))}</b>${bpRows.some((r) => !r.ref) ? ` · <b style="color:var(--danger)">⚠ ${bpRows.filter((r) => !r.ref).length} ${lang === "en" ? "without a reference number" : "بدون رقم عملية"}</b>` : ""}</p></div></div>
      <div class="table-wrap"><table class="data-table"><thead><tr><th>${lang === "en" ? "Time" : "الوقت"}</th><th>${lang === "en" ? "Customer" : "العميل"}</th><th>${lang === "en" ? "For" : "عن"}</th><th>${lang === "en" ? "Amount" : "المبلغ"}</th><th>${lang === "en" ? "Reference" : "رقم العملية"}</th></tr></thead>
      <tbody>${bpRows.map((r) => `<tr><td>${fmtDT(r.at)}</td><td>${esc(r.who)}</td><td>${esc(r.what)}</td><td>${money(r.amount)}</td><td>${r.ref ? `<b dir="ltr">${esc(r.ref)}</b>` : `<b style="color:var(--danger)">⚠ ${lang === "en" ? "missing" : "غير مسجّل"}</b>`}</td></tr>`).join("")}</tbody></table></div></div>` : "";
    if (activeReportType === "overview") {
      content.innerHTML = `${bpPanel}
        <div class="metrics-grid" id="reportMetrics"></div>
        <div class="content-grid two-cols" style="margin-top:16px">
          <div class="panel"><div class="panel-header"><div><h3>${FX("cash_methods")}</h3></div></div><div id="paymentReport" class="report-bars"></div></div>
          <div class="panel"><div class="panel-header"><div><h3 data-i18n="report_by_service">${t("report_by_service")}</h3></div></div><div id="servicesReport" class="report-bars"></div></div>
        </div>`;
      document.getElementById("reportMetrics").innerHTML = [
        metric(FX("sales"), money(s.salesTotal)),
        metric(FX("collected"), money(s.collected)),
        metric(FX("orders_count"), s.salesOrders),
        metric(FX("avg"), money(s.avgOrder)),
        metric(FX("receivables"), money(snap.receivables), snap.receivables > 0 ? "var(--danger)" : ""),
        metric(FX("open_value"), money(snap.openValue)),
        ...(() => {
          if (!dlvCfg().on && !orders.some((o) => o.delivery)) return [];
          const inP = orders.filter((o) => o.status !== "cancelled" && o.delivery && FIN.inRange(o.createdAt, fromInput, toInput));
          const legs = inP.flatMap((o) => (o.extras || []).filter((l) => String(l.id).startsWith("dlv_")));
          const inc = round3(legs.reduce((a, l) => a + (Number(l.total) || 0), 0));
          return [metric(`🚚 ${lang === "ar" ? `التوصيل: ${legs.length} مشوار (${legs.filter((l) => l.free).length} مجاني)` : `Delivery: ${legs.length} trips (${legs.filter((l) => l.free).length} free)`}`, money(inc), inc > 0 ? "var(--success)" : "")];
        })(),
      ].join("");
      drawBarChart("paymentReport", Object.entries(s.collectedBy).filter(([, v]) => v > 0).map(([k, v]) => ({ label: paymentLabel(k), value: v })), { money: true });
      drawBarChart("servicesReport", Object.entries(s.piecesByService).map(([k, v]) => ({ label: serviceName(k), value: v })));
    }

    else if (activeReportType === "pnl") {
      content.innerHTML = `
        <div class="metrics-grid" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">
          ${metric(FX("net_rev"), money(s.netRevenue), "var(--success)")}
          ${metric(FX("expenses"), money(s.expenses), "var(--danger)")}
          ${metric(FX("salaries"), money(s.expensesByGroup.salaries || 0), "var(--danger)")}
          ${metric(FX("profit"), money(s.profit), s.profit < 0 ? "var(--danger)" : "var(--success)")}
        </div>
        <div class="content-grid two-cols" style="margin-top:16px">
          <div class="panel"><div class="panel-header"><div><h3>${FX("profit")}</h3></div></div>
            ${row(FX("gross"), s.salesTotal)}
            ${s.packageSales ? row("  · " + FX("pkg_sales"), s.packageSales) : ""}
            ${s.vat ? row("− " + FX("vat"), s.vat) : ""}
            ${row(FX("net_rev"), s.netRevenue, "var(--success)", true)}
            ${row("− " + FX("expenses"), s.expenses, "var(--danger)")}
            ${FIN.EXPENSE_GROUPS.filter((g) => s.expensesByGroup[g.id]).map((g) => row("  · " + (lang === "en" ? g.en : g.ar), s.expensesByGroup[g.id])).join("")}
            ${row(FX("profit"), s.profit, s.profit < 0 ? "var(--danger)" : "var(--success)", true)}
            <p class="inv-muted" style="margin-top:10px;font-size:12px">${FX("profit_hint")}</p>
          </div>
          <div class="panel"><div class="panel-header"><div><h3>${FX("collected")}</h3></div></div>
            ${row(FX("cash_in"), s.cashIn)}
            ${row("  · " + FX("deposits"), s.deposits)}
            ${row("− " + FX("refunds"), s.refunds, "var(--danger)")}
            ${row(FX("collected"), s.collected, "", true)}
            ${row(FX("from_balance"), s.paidFromBalance)}
            ${row(FX("credit"), s.creditGiven)}
            ${row(FX("discounts"), s.discounts)}
            ${row(FX("receivables"), snap.receivables, snap.receivables > 0 ? "var(--danger)" : "")}
            ${row(FX("prepaid"), snap.prepaid)}
          </div>
        </div>`;
    }

    else if (activeReportType === "sales") {
      const trend = salesTrendRows(s, fromInput, toInput, 14);
      content.innerHTML = `
        <div class="panel"><div class="panel-header"><div><h3>${FX("sales")} — ${trend.byMonth ? FX("by_month") : FX("by_day")}</h3></div></div><div id="salesTrendChart" class="dash-bar-chart"></div></div>
        <div class="panel" style="margin-top:16px"><div class="panel-header"><div><h3>الأصناف الأكثر مبيعاً</h3></div></div><div id="topGarmentsChart" class="dash-bar-chart"></div></div>`;
      drawBarChart("salesTrendChart", trend.rows, { money: true });
      drawBarChart("topGarmentsChart", Object.entries(s.piecesByGarment).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => ({ label: clothingName(k), value: v })));
    }
  }

  /* ============================= صفحة الإعدادات ============================= */
  document.querySelectorAll(".settings-tabs .report-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".settings-tabs .report-tab").forEach((b) => b.classList.toggle("active", b === btn));
      document.querySelectorAll("[data-settings-panel]").forEach((p) => { p.style.display = p.dataset.settingsPanel === btn.dataset.settingsTab ? "" : "none"; });
      if (btn.dataset.settingsTab === "admin") renderAdminAccountPanel();
    });
  });

  function renderAdminAccountPanel() {
    const panel = document.getElementById("adminAccountPanel");
    if (!me) { panel.innerHTML = ""; return; }
    const acct = me;
    panel.innerHTML = `
      <div class="form-grid one-col">
        <label><span>الاسم الكامل</span><input id="adminName" value="${esc(acct.name)}" /></label>
        <label><span>اسم الدخول (username)</span><input id="adminUsername" dir="ltr" value="${esc(acct.username)}" /></label>
        <label><span>البريد الإلكتروني</span><input id="adminEmail" type="email" dir="ltr" value="${esc(acct.email)}" placeholder="name@example.com" /></label>
        <label><span>رقم الهاتف</span><input id="adminPhone" value="${esc(acct.phone)}" /></label>
        <button class="primary-btn" id="saveAdminAccountBtn">حفظ بيانات الحساب</button>
        <button class="secondary-btn" id="adminChangePwBtn" type="button">🔑 تغيير كلمة المرور</button>
      </div>
      <p class="section-note" style="margin-top:10px">الدور: ${ACCESS_ROLE_AR[acct.role] || esc(acct.role)} — آخر دخول: ${(() => { const i = loginInfo(acct); return i.at ? fmtDT(i.at) : "—"; })()} — آخر تغيير لكلمة المرور: ${acct.passChangedAt ? fmtDT(acct.passChangedAt) : "—"}.<br>كلمات المرور مخزّنة مشفّرة (لا يمكن عرضها حتى للمالك). لا يُرسَل أي بريد إلكتروني؛ نسيان كلمة المرور يُعالَج برمز الاسترداد أو بإعادة التعيين من المالك.</p>`;
    document.getElementById("adminChangePwBtn").addEventListener("click", openChangePw);
    document.getElementById("saveAdminAccountBtn").addEventListener("click", () => {
      const name = document.getElementById("adminName").value.trim();
      const username = document.getElementById("adminUsername").value.trim();
      const email = document.getElementById("adminEmail").value.trim();
      if (!name) { toast(AX("e_name")); return; }
      if (username && !USERNAME_RE.test(username)) { toast(AX("e_user_fmt")); return; }
      if (email && !EMAIL_RE.test(email)) { toast(AX("e_email_fmt")); return; }
      if ((username && identTaken(username, acct.id)) || (email && identTaken(email, acct.id))) { toast(AX("e_user_taken")); return; }
      acct.name = name; acct.username = username; acct.email = email;
      acct.phone = document.getElementById("adminPhone").value.trim();
      persistEmps();
      save("l997_user", acct.name);
      refreshUserCard();
      logActivity(`تحديث بيانات الحساب: ${acct.name}`);
      toast("تم حفظ بيانات الحساب");
    });
  }

  function renderSettingsPage() {
    document.getElementById("urgentPercentageSetting").value = settings.urgentPercent;
    document.getElementById("normalHoursSetting").value = settings.normalHours;
    document.getElementById("urgentHoursSetting").value = settings.urgentHours;
    document.getElementById("shiftsRequiredSetting").checked = settings.shiftsRequired === true;
    document.getElementById("waApiSetting").checked = !!(settings.waApi && settings.waApi.enabled);
    { const b = bpCfg(); const set = (id, v) => { const el = document.getElementById(id); if (el) { if (el.type === "checkbox") el.checked = v; else el.value = v; } }; set("bpNumberSetting", b.number); set("bpNameSetting", b.name); set("bpIbanSetting", fmtIban(b.iban)); set("bpRequireRefSetting", b.requireRef);
      const pv = document.getElementById("bpQrPreview"); if (pv) pv.innerHTML = b.qr ? `<img src="${b.qr}" alt="QR" style="width:120px;height:120px;border-radius:10px;border:1px solid var(--border)"> <button type="button" class="mini-btn danger-mini" id="bpQrRemove">✕ ${lang === "en" ? "Remove" : "حذف"}</button>` : `<span class="section-note">${lang === "en" ? "No QR yet" : "لا يوجد باركود بعد"}</span>`;
      document.getElementById("bpQrRemove")?.addEventListener("click", () => { settings.benefitPay = { ...(settings.benefitPay || {}), qr: "" }; persistAll(); logActivity("💳 حذف باركود BenefitPay"); renderSettingsPage(); });
      const fi = document.getElementById("bpQrFile");
      if (fi && !fi.dataset.wired) { fi.dataset.wired = "1"; fi.addEventListener("change", () => {
        const f = fi.files && fi.files[0]; if (!f) return;
        const rd = new FileReader();
        rd.onload = () => { const img = new window.Image(); img.onload = () => {
          const n = 480, cv = document.createElement("canvas"); cv.width = n; cv.height = n; const cx = cv.getContext("2d");
          cx.fillStyle = "#fff"; cx.fillRect(0, 0, n, n); const sc = Math.min(n / img.width, n / img.height); cx.drawImage(img, (n - img.width * sc) / 2, (n - img.height * sc) / 2, img.width * sc, img.height * sc);
          settings.benefitPay = { ...(settings.benefitPay || {}), qr: cv.toDataURL("image/png") }; persistAll(); logActivity("💳 رفع باركود BenefitPay"); fi.value = ""; renderSettingsPage(); toast(lang === "en" ? "✓ QR saved" : "✓ حُفظ الباركود");
        }; img.src = rd.result; };
        rd.readAsDataURL(f);
      }); } }
    if (lang !== "ar") document.querySelectorAll(".dlv-settings-box [data-en], .wa-bot-box [data-en]").forEach((el) => { el.textContent = el.dataset.en; });
    { const b = waCfg(); const set = (id, v) => { const el = document.getElementById(id); if (el) { if (el.type === "checkbox") el.checked = v; else el.value = v; } };
      set("waBotOn", b.enabled); set("waBotStaffOn", b.staffOn); set("waBotFrom", b.staffFrom); set("waBotTo", b.staffTo); set("waBotHours", b.hoursText); set("waBotAreas", b.areas); set("waBotExtra", b.extra); }
    { const d = dlvCfg(); const set = (id, v) => { const el = document.getElementById(id); if (el) { if (el.type === "checkbox") el.checked = v; else el.value = v; } };
      set("dlvOnSetting", d.on); set("dlvFeeSetting", d.fee.toFixed(3)); set("dlvPkgFreeSetting", d.pkgFree); set("dlvPkgFeeSetting", d.pkgFee.toFixed(3)); set("dlvFreeOverSetting", d.freeOver.toFixed(3)); }

    const body = document.getElementById("pricesBody");
    body.innerHTML = allGarments().map((g) => {
      const name = g.key ? t(g.key) : g.name;
      const isActive = settings.garmentActive[g.id] !== false;
      const isCustom = !g.key;
      return `<tr style="${isActive ? "" : "opacity:.45"}">
        <td><strong>${name}</strong></td>
        ${SERVICES_DEFAULT.map((s2) => `<td><input type="number" step="0.001" min="0" value="${settings.prices[`${g.id}_${s2.id}`] ?? 0}" data-price="${g.id}_${s2.id}" style="width:80px" /></td>`).join("")}
        <td><input type="number" step="0.001" min="0" value="${urgentFixed(g.id) ?? ""}" data-urgent-price="${g.id}" placeholder="${priceFor(g.id, "washiron") ? round3(priceFor(g.id, "washiron") * (1 + settings.urgentPercent / 100)).toFixed(3) : "—"}" title="فارغ = تلقائي (ضعف السعر) — 0 = لا خدمة مستعجلة" style="width:80px" /></td>
        <td style="text-align:center"><input type="checkbox" data-garment-active="${g.id}" ${isActive ? "checked" : ""} /></td>
        <td>${isCustom ? `<button class="mini-btn danger-mini" data-del-garment="${g.id}">حذف</button>` : ""}</td>
      </tr>`;
    }).join("");
    body.querySelectorAll("[data-garment-active]").forEach((cb) => {
      cb.addEventListener("change", () => {
        if (!can("edit_pricing")) { cb.checked = !cb.checked; denied(); return; }
        // الحالة فقط تُحفظ — بدون إعادة رسم الجدول حتى لا تضيع أسعار كُتبت ولم تُحفظ بعد
        settings.garmentActive[cb.dataset.garmentActive] = cb.checked;
        save(KEYS.settings, settings);
        const tr = cb.closest("tr"); if (tr) tr.style.opacity = cb.checked ? "" : ".45";
        logActivity(`${cb.checked ? "تفعيل" : "إيقاف"} منتج: ${clothingName(cb.dataset.garmentActive)}`);
      });
    });
    const svcCol = (id) => SERVICES_DEFAULT.findIndex((x) => x.id === id) + 2; // عمود الخدمة في الجدول
    document.querySelectorAll("[data-service-active]").forEach((cb) => {
      const id = cb.dataset.serviceActive;
      cb.checked = svcOn(id);
      cb.disabled = !can("edit_pricing");
      const dim = () => document.querySelectorAll(`#pricesBody td:nth-child(${svcCol(id)})`).forEach((td) => (td.style.opacity = cb.checked ? "" : ".4"));
      dim();
      cb.onchange = () => {
        if (!can("edit_pricing")) { cb.checked = !cb.checked; denied(); return; }
        settings.serviceActive = { ...(settings.serviceActive || {}), [id]: cb.checked };
        save(KEYS.settings, settings); dim();
        logActivity(`${cb.checked ? "تفعيل" : "إيقاف"} خدمة «${serviceName(id)}» للطلبات الجديدة`);
        toast(cb.checked ? `«${serviceName(id)}» مفعّلة للطلبات الجديدة` : `«${serviceName(id)}» مطفأة — لا تظهر في الطلبات الجديدة (الأسعار محفوظة)`);
      };
    });
    body.querySelectorAll("[data-del-garment]").forEach((btn) => {
      btn.addEventListener("click", () => {
        customGarments = customGarments.filter((g) => g.id !== btn.dataset.delGarment);
        save("l997_custom_garments", customGarments);
        renderSettingsPage();
        toast("تم حذف المنتج");
      });
    });
    document.getElementById("extrasPricesBody").innerHTML = EXTRAS_DEFAULT.map((x) => {
      const c = extraCfg(x.id);
      return `<tr><td><strong>${x.icon} ${esc(t(x.key))}</strong></td>
        <td><input type="number" step="0.001" min="0" value="${c.price}" data-extra-price="${x.id}" style="width:90px" /></td>
        <td><select data-extra-per="${x.id}"><option value="order" ${c.per === "order" ? "selected" : ""}>لكل طلب</option><option value="piece" ${c.per === "piece" ? "selected" : ""}>لكل قطعة</option></select></td></tr>`;
    }).join("");
    if (!can("edit_pricing")) document.querySelectorAll("#extrasPricesBody input, #extrasPricesBody select").forEach((el) => (el.disabled = true));
    renderPackageDefs();
    renderPackageWeights();
    if (!can("edit_pricing")) document.querySelectorAll("#packageWeightsBody input, #savePackageWeightsBtn, #resetPackageWeightsBtn").forEach((el) => (el.disabled = true));
    renderDiscountCodes();
  }
  function codeCustomersLabel(c) {
    if (!codeRestricted(c)) return `<span class="section-note">كل العملاء</span>`;
    const names = (c.customerIds || []).map((id) => (customers.find((x) => x.id === id) || {}).name).filter(Boolean);
    if (!names.length) return `<span class="status-badge status-cancelled">⚠ لم تحدد العملاء — الكود لا يعمل بعد</span>`;
    return esc(names.length > 3 ? names.slice(0, 3).join("، ") + ` (+${names.length - 3})` : names.join("، "));
  }
  function renderDiscountCodes() {
    const body = document.getElementById("discountCodesBody"); if (!body) return;
    const list = settings.discountCodes || [];
    const uses = (code) => orders.filter((o) => o.discountCode === code && o.status !== "cancelled").length;
    const edit = can("edit_pricing");
    body.innerHTML = list.length ? list.map((c) => `<tr style="${c.active === false ? "opacity:.5" : ""}"><td><b dir="ltr">${esc(c.code)}</b>${c.note ? `<div class="pos-cart-row-sub">${esc(c.note)}</div>` : ""}</td><td>${esc(codeDesc(c))}<div class="pos-cart-row-sub">${esc(codeLimitsText(c))}${codeProblem(c) === "expired" ? ` · <b style="color:var(--danger)">منتهي</b>` : codeProblem(c) === "used_up" ? ` · <b style="color:var(--danger)">استُنفد</b>` : ""}</div></td><td>${codeCustomersLabel(c)}</td><td>${uses(c.code)}</td>
      <td style="text-align:center"><input type="checkbox" data-code-active="${esc(c.code)}" ${c.active === false ? "" : "checked"} ${edit ? "" : "disabled"} /></td>
      <td>${edit ? `${codeRestricted(c) ? `<button class="mini-btn" data-code-cust="${esc(c.code)}">👥 العملاء</button> ` : ""}<button class="mini-btn" data-code-edit="${esc(c.code)}">تعديل</button> <button class="mini-btn danger-mini" data-code-del="${esc(c.code)}">حذف</button>` : ""}</td></tr>`).join("")
      : `<tr><td colspan="6" class="empty-state compact">لا توجد أكواد بعد</td></tr>`;
    const saveCodes = (msg) => { save(KEYS.settings, settings); renderDiscountCodes(); if (msg) logActivity(msg); };
    body.querySelectorAll("[data-code-active]").forEach((cb) => cb.addEventListener("change", () => {
      const c = findCode(cb.dataset.codeActive); if (!c) return; c.active = cb.checked;
      saveCodes(`${cb.checked ? "تفعيل" : "إيقاف"} كود الخصم ${c.code}`);
    }));
    body.querySelectorAll("[data-code-del]").forEach((b) => b.addEventListener("click", () => {
      const code = b.dataset.codeDel;
      confirmAction(`حذف كود الخصم «${code}»؟ الطلبات السابقة تحتفظ بخصمها.`, () => {
        settings.discountCodes = (settings.discountCodes || []).filter((x) => x.code !== code);
        saveCodes(`حذف كود الخصم ${code}`);
      });
    }));
    body.querySelectorAll("[data-code-edit]").forEach((b) => b.addEventListener("click", () => openDiscountCodeForm(findCode(b.dataset.codeEdit))));
    body.querySelectorAll("[data-code-cust]").forEach((b) => b.addEventListener("click", () => openCodeCustomersForm(findCode(b.dataset.codeCust))));
  }
  // اختيار عملاء الكود الخاص — مع بحث بالاسم أو الرقم
  function openCodeCustomersForm(c, after) {
    if (!c || !can("edit_pricing")) { denied(); return; }
    const sel = new Set(c.customerIds || []);
    const opts = customers.slice().sort((a, b) => (sel.has(b.id) ? 1 : 0) - (sel.has(a.id) ? 1 : 0) || String(a.name).localeCompare(String(b.name), "ar"))
      .map((x) => ({ value: x.id, label: `${x.name} — ${fmtPhone(x.phone)}` }));
    openQuickForm({
      title: `👥 عملاء الكود ${c.code}`, sub: `${codeDesc(c)}${c.note ? " — " + c.note : ""}. الكود يعمل فقط للعملاء المختارين.`,
      fields: [{ id: "ids", label: "ابحث بالاسم أو الرقم واختر العملاء", type: "checks", search: true, value: [...sel], options: opts }],
      submitLabel: "حفظ العملاء",
      onSubmit: (v) => {
        const before = (c.customerIds || []).length;
        c.customerIds = v.ids;
        save(KEYS.settings, settings);
        const names = v.ids.map((id) => (customers.find((x) => x.id === id) || {}).name).filter(Boolean);
        logActivity(`تحديد عملاء كود الخصم ${c.code} (${codeDesc(c)}): ${names.join("، ") || "لا أحد"} (كان ${before})`);
        renderDiscountCodes(); if (after) after();
        toast(`تم — الكود ${c.code} لـ ${v.ids.length} عميل`);
      },
    });
  }
  function openDiscountCodeForm(existing) {
    if (!can("edit_pricing")) { denied(); return; }
    openQuickForm({
      title: existing ? `تعديل الكود ${existing.code}` : "🏷 كود خصم جديد",
      sub: "حروف إنجليزية وأرقام (3 إلى 20 خانة، بدون مسافات — لا فرق بين الحروف الكبيرة والصغيرة). الموظف يكتبه عند إنشاء الطلب فيُخصم تلقائياً.",
      fields: [
        { id: "code", label: "الكود", type: "text", value: existing ? existing.code : "" },
        { id: "note", label: "لمن؟ (ملاحظة لك — مثال: العميل نواف)", type: "text", value: existing ? existing.note || "" : "" },
        { id: "type", label: "نوع الخصم", type: "select", value: existing && existing.type === "piece" ? "piece" : "percent", options: [{ value: "percent", label: "نسبة % من الطلب (100% = الطلب مجاني)" }, { value: "piece", label: "سعر ثابت للقطعة (د.ب)" }] },
        { id: "percent", label: "نسبة الخصم % (لنوع النسبة)", type: "number", step: "1", min: 1, value: existing ? existing.percent || "" : 10 },
        { id: "piecePrice", label: "سعر القطعة د.ب (لنوع السعر الثابت — مثال 0.300)", type: "number", step: "0.001", min: 0, value: existing && existing.type === "piece" ? existing.piecePrice : "" },
        { id: "expiresAt", label: "📅 تاريخ الانتهاء (اتركه فارغاً = دائم)", type: "date", value: existing ? existing.expiresAt || "" : "" },
        { id: "maxUses", label: "🔢 أقصى عدد استخدامات (0 = بلا حد)", type: "number", step: "1", min: 0, value: existing ? Number(existing.maxUses) || 0 : 0 },
        { id: "scope", label: "من يستخدمه؟", type: "select", value: existing && existing.scope === "customers" ? "customers" : "all", options: [{ value: "all", label: "كل العملاء" }, { value: "customers", label: "عملاء محددين فقط (تختارهم بعد الحفظ)" }] },
      ],
      submitLabel: "حفظ",
      onSubmit: (v) => {
        const code = normDiscCode(v.code), pct = Number(normDigits(String(v.percent))), pp = round3(Number(normDigits(String(v.piecePrice))) || 0);
        if (!CODE_RE.test(code)) { toast("الكود: حروف إنجليزية وأرقام فقط، من 3 إلى 20 خانة"); return false; }
        if (v.type === "percent" && !(pct > 0 && pct <= 100)) { toast("النسبة بين 1% و 100%"); return false; }
        if (v.type === "piece" && !(pp >= 0 && String(v.piecePrice).trim() !== "")) { toast("أدخل سعر القطعة (مثال 0.300)"); return false; }
        settings.discountCodes = settings.discountCodes || [];
        const dup = settings.discountCodes.find((x) => x.code === code);
        if (v.expiresAt && !/^\d{4}-\d{2}-\d{2}$/.test(v.expiresAt)) { toast("تاريخ الانتهاء غير صحيح"); return false; }
        const data = { code, type: v.type, percent: v.type === "percent" ? round3(pct) : 0, piecePrice: v.type === "piece" ? pp : undefined, scope: v.scope, note: v.note, expiresAt: v.expiresAt || "", maxUses: Math.max(0, Math.floor(Number(v.maxUses) || 0)) };
        let target = existing;
        if (existing) {
          if (code !== existing.code && dup) { toast("هذا الكود موجود"); return false; }
          const before = `${existing.code} ${codeDesc(existing)}`;
          Object.assign(existing, data); if (!existing.customerIds) existing.customerIds = [];
          logActivity(`تعديل كود الخصم ${before} → ${code} ${codeDesc(existing)}${v.scope === "customers" ? " (عملاء محددين)" : " (كل العملاء)"}`);
        } else {
          if (dup) { toast("هذا الكود موجود"); return false; }
          target = { ...data, customerIds: [], active: true, createdAt: new Date().toISOString(), createdBy: me ? me.name : "" };
          settings.discountCodes.push(target);
          logActivity(`إضافة كود خصم ${code} — ${codeDesc(target)}${v.scope === "customers" ? " (عملاء محددين)" : " (كل العملاء)"}`);
        }
        save(KEYS.settings, settings); renderDiscountCodes();
        toast("تم حفظ الكود");
        if (target.scope === "customers" && !(target.customerIds || []).length) setTimeout(() => openCodeCustomersForm(target), 250);
      },
    });
  }
  document.getElementById("addDiscountCodeBtn")?.addEventListener("click", () => openDiscountCodeForm(null));

  document.getElementById("addCustomGarmentBtn").addEventListener("click", () => {
    openQuickForm({
      title: "منتج جديد", sub: "أضف صنفاً غير موجود بالقائمة الرسمية",
      fields: [
        { id: "name", label: "اسم الصنف", type: "text" },
        { id: "cat", label: "التصنيف", type: "select", value: "men", options: [
          { value: "men", label: "رجالي" }, { value: "women", label: "نسائي" }, { value: "home", label: "مفروشات ومنزلي" },
        ] },
        { id: "iron", label: "سعر الكي (د.ب)", type: "number", step: "0.001", value: 0, min: 0 },
        { id: "wash", label: "سعر الغسيل (د.ب)", type: "number", step: "0.001", value: 0, min: 0 },
        { id: "washiron", label: "سعر الغسيل والكي (د.ب)", type: "number", step: "0.001", value: 0, min: 0 },
        { id: "dryclean", label: "سعر الغسيل الجاف (د.ب)", type: "number", step: "0.001", value: 0, min: 0 },
      ],
      onSubmit: (v) => {
        if (!v.name) { toast("أدخل اسم الصنف"); return false; }
        const id = "custom_" + uid().slice(0, 8);
        customGarments.push({ id, name: v.name, cat: v.cat, icon: "🧺" });
        save("l997_custom_garments", customGarments);
        if (v.iron > 0) settings.prices[`${id}_iron`] = round3(v.iron);
        if (v.wash > 0) settings.prices[`${id}_wash`] = round3(v.wash);
        if (v.washiron > 0) settings.prices[`${id}_washiron`] = round3(v.washiron);
        if (v.dryclean > 0) settings.prices[`${id}_dryclean`] = round3(v.dryclean);
        persistAll();
        renderSettingsPage();
        toast("تم إضافة المنتج");
      },
    });
  });

  function savePrices() {
    if (!can("edit_pricing")) { denied(); return; }
    let changedCount = 0;
    let bad = 0;
    document.querySelectorAll("[data-price]").forEach((input) => {
      const raw = Number(normDigits(input.value)) || 0;
      if (raw < 0) bad++;
      const newVal = round3(Math.max(0, raw)); // لا أسعار سالبة
      if (settings.prices[input.dataset.price] !== newVal) changedCount++;
      settings.prices[input.dataset.price] = newVal;
    });
    document.querySelectorAll("[data-urgent-price]").forEach((input) => {
      const id = input.dataset.urgentPrice, txt = normDigits(String(input.value || "")).trim();
      const next = txt === "" ? null : round3(Math.max(0, Number(txt) || 0));
      if ((urgentFixed(id) ?? null) !== next) changedCount++;
      settings.urgentPrices = settings.urgentPrices || {};
      if (next === null) delete settings.urgentPrices[id]; else settings.urgentPrices[id] = next;
    });
    document.querySelectorAll("[data-extra-price]").forEach((input) => {
      const id = input.dataset.extraPrice;
      const raw = Number(normDigits(input.value)) || 0;
      if (raw < 0) bad++;
      const price = round3(Math.max(0, raw));
      const per = document.querySelector(`[data-extra-per="${id}"]`)?.value === "piece" ? "piece" : "order";
      const old = extraCfg(id);
      if (old.price !== price || old.per !== per) changedCount++;
      settings.extras[id] = { price, per };
    });
    if (bad) toast(`تم تصحيح ${bad} سعر سالب إلى صفر`);
    persistAll();
    renderPosExtras();
    if (changedCount > 0) logActivity(`تعديل أسعار ${changedCount} صنف/خدمة بواسطة ${roleLabel()}`);
    toast(t("toast_settings_saved"));
  }
  document.getElementById("savePricesBtn").addEventListener("click", savePrices);
  // إعدادات التشغيل فقط (نسبة المستعجل والساعات) — الأسعار تُحفظ من زرها الخاص بصلاحية edit_pricing
  document.getElementById("saveSettingsBtn").addEventListener("click", () => {
    if (!can("admin_settings")) { denied(); return; }
    const urgent = Number(normDigits(document.getElementById("urgentPercentageSetting").value));
    const normalH = Number(normDigits(document.getElementById("normalHoursSetting").value));
    const urgentH = Number(normDigits(document.getElementById("urgentHoursSetting").value));
    if (!(urgent >= 0 && urgent <= 500)) { toast("نسبة رسوم المستعجل يجب أن تكون بين 0 و 500%"); return; }
    if (!(normalH > 0) || !(urgentH > 0)) { toast("أدخل عدد ساعات صحيح أكبر من صفر"); return; }
    const before = `${settings.urgentPercent}% / ${settings.normalHours}س / ${settings.urgentHours}س`;
    settings.urgentPercent = urgent;
    settings.normalHours = normalH;
    settings.urgentHours = urgentH;
    const shiftsOn = document.getElementById("shiftsRequiredSetting").checked;
    if ((settings.shiftsRequired === true) !== shiftsOn) logActivity(`${shiftsOn ? "تفعيل" : "إيقاف"} إلزام الموظفين ببدء الوردية`);
    settings.shiftsRequired = shiftsOn;
    const waOn = document.getElementById("waApiSetting").checked;
    if (!!(settings.waApi && settings.waApi.enabled) !== waOn) logActivity(`${waOn ? "تفعيل" : "إيقاف"} الإرسال التلقائي لإيصال التسليم عبر WhatsApp Business API`);
    settings.waApi = { ...(settings.waApi || {}), enabled: waOn };
    if (document.getElementById("bpNumberSetting")) {
      const ib = toLatinDigits(document.getElementById("bpIbanSetting").value).replace(/\s+/g, "").toUpperCase();
      if (ib && !/^BH\d{2}[A-Z]{4}[A-Z0-9]{14}$/.test(ib)) { toast(lang === "en" ? "The IBAN doesn't look right (BH + 20 characters)" : "الآيبان غير صحيح — يبدأ بـ BH ومجموعه 22 خانة"); return; }
      const cur = bpCfg();
      const nb = { number: toLatinDigits(document.getElementById("bpNumberSetting").value).replace(/[^0-9+ ]/g, "").trim(), name: document.getElementById("bpNameSetting").value.trim().slice(0, 60), iban: ib, qr: cur.qr, requireRef: document.getElementById("bpRequireRefSetting").checked };
      if (JSON.stringify({ ...nb, qr: "" }) !== JSON.stringify({ ...cur, qr: "" })) logActivity(`💳 تعديل إعدادات BenefitPay — الرقم: ${nb.number || "—"} · الاسم: ${nb.name || "—"} · الآيبان: ${nb.iban ? "•••" + nb.iban.slice(-4) : "—"} · رقم العملية ${nb.requireRef ? "إلزامي" : "اختياري"}`);
      settings.benefitPay = nb;
    }
    if (document.getElementById("waBotOn")) {
      const v = (id) => (document.getElementById(id).value || "").trim();
      const nb = { enabled: document.getElementById("waBotOn").checked, staffOn: document.getElementById("waBotStaffOn").checked, staffFrom: v("waBotFrom") || "08:00", staffTo: v("waBotTo") || "23:00", hoursText: v("waBotHours") || "مفتوح 24 ساعة", areas: v("waBotAreas"), extra: v("waBotExtra").slice(0, 3000) };
      if (JSON.stringify(waCfg()) !== JSON.stringify(nb)) logActivity(`تعديل مساعد واتساب الذكي: ${nb.enabled ? "يعمل" : "متوقف"} — الموظفون ${nb.staffOn ? `${nb.staffFrom}–${nb.staffTo}` : "غير متاحين"}`);
      settings.waBot = nb;
    }
    if (document.getElementById("dlvOnSetting")) {
      const num = (id) => Math.max(0, Number(normDigits(document.getElementById(id).value)) || 0);
      const nd = { on: document.getElementById("dlvOnSetting").checked, fee: round3(num("dlvFeeSetting")), pkgFree: Math.floor(num("dlvPkgFreeSetting")), pkgFee: round3(num("dlvPkgFeeSetting")), freeOver: round3(num("dlvFreeOverSetting")) };
      const od = dlvCfg();
      if (JSON.stringify(od) !== JSON.stringify(nd)) logActivity(`تعديل إعدادات التوصيل: ${nd.on ? "مفعّل" : "متوقف"} — الرحلة ${money(nd.fee)} — الباقة ${nd.pkgFree} مجاناً/شهر ثم ${money(nd.pkgFee)} — مجاني فوق ${nd.freeOver > 0 ? money(nd.freeOver) : "لا يوجد"}`);
      settings.delivery = nd;
    }
    persistAll();
    logActivity(`تعديل إعدادات التشغيل: ${before} → ${urgent}% / ${normalH}س / ${urgentH}س`);
    toast(t("toast_settings_saved"));
  });

  // فحص ربط WhatsApp Business API وإرسال إيصال تجريبي
  const waStatus = (t0) => { const el = document.getElementById("waApiStatus"); if (el) el.textContent = t0; };
  document.getElementById("waApiCheckBtn")?.addEventListener("click", async () => {
    if (!cloudOn()) { waStatus("⚠ اربط النظام بالسحابة أولاً (ملف المنشأة ← المزامنة السحابية)."); return; }
    waStatus("… جارٍ الفحص");
    const r = await CLOUD.waSend({ ping: true });
    if (r && r.ok) waStatus(r.configured ? `✓ الربط جاهز — النموذج «${r.template}» (${r.lang}). فعّل الخيار واحفظ، ثم جرّب «إرسال إيصال تجريبي».` : "⚠ الدالة موجودة لكن رمز Meta غير مُضاف — أضف WA_TOKEN و WA_PHONE_ID في Supabase ← Edge Functions ← Secrets.");
    else waStatus(r && r.status === 404 ? "⚠ دالة whatsapp-send غير موجودة في Supabase بعد — أنشئها من Edge Functions (الملف supabase/functions/whatsapp-send/index.ts)." : `⚠ تعذّر الفحص: ${waErrHint(r) || (r && r.error) || "خطأ"}`);
  });
  document.getElementById("waApiTestBtn")?.addEventListener("click", () => {
    if (!cloudOn()) { waStatus("⚠ اربط النظام بالسحابة أولاً."); return; }
    const o = orders.find((x) => x.status !== "cancelled");
    if (!o) { waStatus("⚠ لا يوجد طلب لإرسال إيصاله كتجربة — أنشئ طلباً أولاً."); return; }
    openQuickForm({
      title: "📤 إرسال إيصال تجريبي", sub: `يُرسل إيصال الطلب #${o.number} عبر WhatsApp Business API إلى الرقم الذي تكتبه (رقمك مثلاً).`,
      fields: [{ id: "phone", label: "رقم الواتساب (بحريني 8 أرقام أو دولي يبدأ بـ +)", type: "text", value: (loadProfile().whatsapp || "") }],
      submitLabel: "إرسال",
      onSubmit: (v) => {
        if (!validPhone(v.phone)) { toast(PHONE_HINT()); return false; }
        const cust = customers.find((c) => c.id === o.customerId) || { name: "Test", phone: v.phone, balance: 0 };
        waStatus("… جارٍ الإرسال");
        CLOUD.waSend({ to: cleanPhone(v.phone), name: cust.name, orderNo: String(o.number), line: receiptPayLine(o), image: receiptPngNow(o, cust).b64 })
          .then((r) => waStatus(r && r.ok ? "✓ أُرسل — تحقق من واتساب على الرقم." : `⚠ لم يُرسل: ${waErrHint(r) || (r && r.error) || "خطأ"}${waErrHint(r) ? `  (${(r && r.error) || ""})` : ""}`));
      },
    });
  });

  /* ================================ الباقات ================================ */
  function renderPackageDefs() {
    const body = document.getElementById("packageDefsBody");
    if (settings.packageDefs.length === 0) {
      body.innerHTML = `<tr><td colspan="8" class="empty-state compact">لا توجد باقات معرّفة بعد — أضف باقتك الأولى</td></tr>`;
      return;
    }
    body.innerHTML = settings.packageDefs.map((p) => `<tr>
      <td><strong>${esc(p.name)}</strong>${p.private ? ` <span class="status-badge">🔒 ${lang === "en" ? "private" : "خاصة"}</span>` : ""}<div class="pos-cart-row-sub">👕 ${esc(garmentsLabel(p.garments, 6))}</div></td><td>${serviceName(p.serviceType)}</td><td>${p.pieceCount}</td>
      <td>${money(p.price)}</td><td>${Number(p.validDays) > 0 ? (lang === "ar" ? `${p.validDays} يوم` : `${p.validDays} days`) : (lang === "ar" ? "♾ دائمة" : "♾ No expiry")}</td><td>${(() => { const t0 = pkgTrips(p); return t0.n > 0 ? `${t0.n} ${t0.period === "total" ? (lang === "ar" ? "طوال الباقة" : "for the whole package") : (lang === "ar" ? "شهرياً" : "a month")}` : "—"; })()}</td><td>${esc(p.bonus) || "—"}</td>
      <td class="row-actions"><button class="mini-btn" data-edit-package="${p.id}">تعديل</button><button class="mini-btn danger-mini" data-del-package="${p.id}">حذف</button></td>
    </tr>`).join("");
    body.querySelectorAll("[data-del-package]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const def = settings.packageDefs.find((p) => p.id === btn.dataset.delPackage);
        confirmAction(`حذف تعريف الباقة «${def ? def.name : ""}»؟ الباقات المباعة للعملاء تبقى كما هي.`, () => {
          settings.packageDefs = settings.packageDefs.filter((p) => p.id !== btn.dataset.delPackage);
          logActivity(`حذف تعريف باقة: ${def ? def.name : ""}`);
          persistAll();
          renderPackageDefs();
          toast("تم حذف الباقة");
        });
      });
    });
    body.querySelectorAll("[data-edit-package]").forEach((btn) => btn.addEventListener("click", () => openPackageDefForm(settings.packageDefs.find((p) => p.id === btn.dataset.editPackage))));
  }

  // نموذج تعريف/تعديل باقة — مع اختيار الملابس المشمولة
  function openPackageDefForm(existing) {
    const all = allGarments();
    const selected = existing && Array.isArray(existing.garments) && existing.garments.length ? existing.garments : all.map((g) => g.id);
    const soldActive = existing ? customerPackages.filter((cp) => cp.defId === existing.id && cp.remainingPieces > 0).length : 0;
    const fields = [
      { id: "name", label: "اسم الباقة", type: "text", value: existing ? existing.name : "", placeholder: "مثال: باقة كوي ثياب 30 قطعة" },
      { id: "serviceType", label: "نوع الخدمة", type: "select", value: existing ? existing.serviceType : "washiron", options: SERVICES_DEFAULT.filter((s2) => svcOn(s2.id) || (existing && existing.serviceType === s2.id)).map((s2) => ({ value: s2.id, label: t(s2.key) })) },
      { id: "pieceCount", label: "عدد القطع", type: "number", value: existing ? existing.pieceCount : 50, min: 1 },
      { id: "price", label: "سعر الباقة الكامل (د.ب)", type: "number", step: "0.001", value: existing ? existing.price : 0, min: 0 },
      { id: "bonus", label: "هدية مجانية (اختياري)", type: "text", value: existing ? existing.bonus || "" : "", placeholder: "مثال: عباءة مجانية" },
      ...pkgTermsFields(existing, true),
      { id: "private", label: "👁 الظهور للعملاء", type: "select", value: existing && existing.private ? "yes" : "no", options: [{ value: "no", label: "عامة — يعرضها مساعد واتساب للعملاء" }, { value: "yes", label: "🔒 خاصة — لا تُعرض للعملاء (تُباع من المحل فقط)" }] },
      { id: "garments", label: "👕 الملابس المشمولة بالباقة — اختر الأصناف (أو اضغط فئة لتحديدها كلها)", type: "checks", value: selected,
        options: all.map((g) => ({ value: g.id, label: clothingName(g.id), group: g.cat || "" })),
        groups: [{ value: "men", label: "رجالي" }, { value: "women", label: "نسائي" }, { value: "home", label: "مفروشات" }] },
    ];
    if (soldActive) fields.push({ id: "apply", label: `تطبيق الملابس المختارة على ${soldActive} باقة مباعة نشطة؟`, type: "select", value: "no", options: [{ value: "no", label: "لا — للمبيعات الجديدة فقط" }, { value: "yes", label: "نعم — طبّقها على الباقات المباعة أيضاً" }] });
    openQuickForm({
      title: existing ? `تعديل باقة «${existing.name}»` : "باقة جديدة", sub: "باقة مسبقة الدفع: عدد قطع بسعر ثابت لخدمة محددة وأصناف ملابس محددة",
      fields, submitLabel: "حفظ الباقة",
      onSubmit: (v) => {
        if (!v.name) { toast("أدخل اسم الباقة"); return false; }
        if (!(v.pieceCount > 0) || !Number.isInteger(v.pieceCount)) { toast("أدخل عدد قطع صحيح"); return false; }
        if (!(v.price > 0)) { toast(t("toast_valid_amount")); return false; }
        if (!v.garments.length) { toast("اختر صنف ملابس واحد على الأقل"); return false; }
        const covered = v.garments.filter((id) => priceFor(id, v.serviceType) > 0);
        if (!covered.length) { toast("لا يوجد صنف مختار له سعر لهذه الخدمة — غيّر الخدمة أو الأصناف"); return false; }
        const garments = v.garments.length === all.length ? [] : v.garments; // الكل = بدون تقييد
        const terms = readPkgTerms(v, true); if (terms.error) { toast(terms.error); return false; }
        const data = { name: v.name, serviceType: v.serviceType, pieceCount: v.pieceCount, price: round3(v.price), bonus: v.bonus, garments, validDays: terms.validDays, dlvTrips: terms.dlvTrips, dlvPeriod: terms.dlvPeriod, private: v.private === "yes" };
        if (existing) {
          Object.assign(existing, data);
          if (v.apply === "yes") customerPackages.filter((cp) => cp.defId === existing.id && cp.remainingPieces > 0).forEach((cp) => { cp.garments = [...garments]; });
          logActivity(`تعديل باقة: ${v.name} — الأصناف: ${garmentsLabel(garments, 8)}${v.apply === "yes" ? " — طُبّق على الباقات المباعة" : ""}`);
        } else {
          settings.packageDefs.push({ id: uid(), ...data });
          logActivity(`إضافة باقة جديدة: ${v.name} — الأصناف: ${garmentsLabel(garments, 8)}`);
        }
        persistAll();
        renderPackageDefs();
        toast("تم حفظ الباقة");
      },
    });
  }
  document.getElementById("addPackageDefBtn").addEventListener("click", () => openPackageDefForm(null));
  /* ✨ توصيات الباقات (بضغطة واحدة، بعد عرض التغييرات): صلاحية ومشاوير مجانية محدودة حسب حجم الباقة،
     هدية اللحاف للباقات من 100 قطعة فقط، ووزن اللحاف 4 والشرشف الدبل 3 (حتى لا يصبح استخدام الباقة أغلى من السعر العادي).
     الباقات المباعة للعملاء سابقاً لا تتغير (التزام تجاه العميل) — تُطبّق على المبيعات الجديدة فقط. */
  function pkgTipFor(pieces) {
    const tiers = [[50, 60, 4], [80, 75, 6], [100, 90, 8], [120, 105, 10], [Infinity, 120, 12]];
    const [, days, trips] = tiers.find(([max]) => pieces <= max);
    return { validDays: days, dlvTrips: trips, dlvPeriod: "total" };
  }
  /* 🗂 قائمة الباقات المنشورة (بروشور الكوي + بروشور الغسيل والكوي) — بضغطة واحدة بعد عرض التغييرات:
     • كوي فقط «استلام من المحل»: 50/100/150 قطعة بدون مشاوير مجانية
     • كوي فقط «مع التوصيل»: نفس الأحجام بسعر أعلى ومع مشاوير مجانية للباقة كاملة
     • غسيل وكوي: 50/80/100/120/150/200 مع مشاوير مجانية، واللحاف هدية من 100 قطعة (لحافان مع 200)
     الأوزان: العباية والجلابية = قطعتان (كوي وغسيل)، اللحاف والشرشف الدبل = قطعتان في الكوي، الأحذية خارج الباقات.
     تُحدَّث الباقات الموجودة بنفس الحجم والخدمة (يبقى معرّفها)، وتُحذف التعريفات العامة غير الموجودة في القائمة
     (الباقات الخاصة بأصناف محددة تبقى). الباقات المباعة للعملاء سابقاً لا تتغير. */
  const PKGS_997 = [
    { key: "iron_pick_50", name: "كوي 50 قطعة — استلام من المحل", serviceType: "iron", pieceCount: 50, price: 8.5, validDays: 60, dlvTrips: 0, bonus: "" },
    { key: "iron_pick_100", name: "كوي 100 قطعة — استلام من المحل", serviceType: "iron", pieceCount: 100, price: 15.9, validDays: 90, dlvTrips: 0, bonus: "" },
    { key: "iron_pick_150", name: "كوي 150 قطعة — استلام من المحل", serviceType: "iron", pieceCount: 150, price: 22.5, validDays: 120, dlvTrips: 0, bonus: "" },
    { key: "iron_dlv_50", name: "كوي 50 قطعة — مع التوصيل", serviceType: "iron", pieceCount: 50, price: 10.9, validDays: 60, dlvTrips: 4, bonus: "" },
    { key: "iron_dlv_100", name: "كوي 100 قطعة — مع التوصيل", serviceType: "iron", pieceCount: 100, price: 19.9, validDays: 90, dlvTrips: 6, bonus: "" },
    { key: "iron_dlv_150", name: "كوي 150 قطعة — مع التوصيل", serviceType: "iron", pieceCount: 150, price: 27.9, validDays: 120, dlvTrips: 8, bonus: "" },
    { key: "wi_50", name: "غسيل وكوي 50 قطعة", serviceType: "washiron", pieceCount: 50, price: 16.9, validDays: 60, dlvTrips: 4, bonus: "" },
    { key: "wi_80", name: "غسيل وكوي 80 قطعة", serviceType: "washiron", pieceCount: 80, price: 25, validDays: 75, dlvTrips: 6, bonus: "" },
    { key: "wi_100", name: "غسيل وكوي 100 قطعة", serviceType: "washiron", pieceCount: 100, price: 30, validDays: 90, dlvTrips: 8, bonus: "لحاف مجاني" },
    { key: "wi_120", name: "غسيل وكوي 120 قطعة", serviceType: "washiron", pieceCount: 120, price: 35, validDays: 105, dlvTrips: 8, bonus: "لحاف مجاني" },
    { key: "wi_150", name: "غسيل وكوي 150 قطعة", serviceType: "washiron", pieceCount: 150, price: 42, validDays: 120, dlvTrips: 10, bonus: "لحاف مجاني" },
    { key: "wi_200", name: "غسيل وكوي 200 قطعة", serviceType: "washiron", pieceCount: 200, price: 54, validDays: 150, dlvTrips: 12, bonus: "لحافان مجاناً" },
  ];
  const PKG_W_997 = { abaya_plain: { washiron: 2, iron: 2 }, abaya_emb: { washiron: 2, iron: 2 }, jalabiya: { washiron: 2, iron: 2 }, duvet: { iron: 2 }, bedsheet_double: { iron: 2 }, shoes: { washiron: 0, iron: 0 } };
  function planPkgs997(defs) {
    const used = new Set(), plan = PKGS_997.map((t0) => ({ t0, ex: null }));
    // عامة = كل الأصناف أو قائمة واسعة (أكثر من 3 أصناف)؛ باقات الصنف الواحد (عبايات/ثياب) واسم خاص مثل «B-spc» لا تُمس
    const general = (p) => !(Array.isArray(p.garments) && p.garments.length > 0 && p.garments.length <= 3);
    const stdName = (p) => /package|pkg|باقة|كوي|غسيل|iron|wash|^\s*\d/i.test(p.name || "");
    const isDlv = (p) => /توصيل|deliver/i.test(p.name || "") || pkgTrips(p).n > 0;
    const pass = (test) => plan.forEach((row) => {
      if (row.ex) return;
      const ex = defs.find((p) => !used.has(p.id) && test(p, row.t0));
      if (ex) { used.add(ex.id); row.ex = ex; }
    });
    const cand = (p, t0) => general(p) && stdName(p) && !p.catalogKey && p.serviceType === t0.serviceType && Number(p.pieceCount) === t0.pieceCount;
    pass((p, t0) => p.catalogKey === t0.key);
    pass((p, t0) => cand(p, t0) && (t0.serviceType !== "iron" || isDlv(p) === t0.key.startsWith("iron_dlv")));
    pass((p, t0) => cand(p, t0));
    const drop = defs.filter((p) => !used.has(p.id) && general(p) && stdName(p) && (p.serviceType === "iron" || p.serviceType === "washiron"));
    const keep = defs.filter((p) => !used.has(p.id) && !drop.includes(p));
    return { plan, drop, keep };
  }
  document.getElementById("addIronPkgsBtn")?.addEventListener("click", () => {
    if (!can("edit_pricing")) { denied(); return; }
    settings.packageDefs = settings.packageDefs || [];
    const { plan, drop, keep } = planPkgs997(settings.packageDefs);
    // باقة باسم خاص وكل الأصناف (مثل «B-spc») = عرض خاص لعميل معيّن — لا تُعرض للعملاء
    const isSpecial = (p) => !p.private && !(Array.isArray(p.garments) && p.garments.length > 0 && p.garments.length <= 3);
    const line = (t0) => `${t0.name}: ${money(t0.price)} · ${t0.validDays} يوم · ${t0.dlvTrips ? `${t0.dlvTrips} توصيلات` : "بدون توصيل"}${t0.bonus ? ` · 🎁 ${t0.bonus}` : ""}`;
    const same = (t0, p) => p && !(Array.isArray(p.garments) && p.garments.length) && p.name === t0.name && round3(p.price) === round3(t0.price) && Number(p.validDays) === t0.validDays && pkgTrips(p).n === t0.dlvTrips && pkgTrips(p).period === "total" && (p.bonus || "") === t0.bonus;
    const changes = plan.filter(({ t0, ex }) => !same(t0, ex));
    if (!changes.length && !drop.length && !keep.some(isSpecial)) { toast("✓ الباقات مطابقة للقائمة المنشورة"); return; }
    const sub = [
      ...changes.map(({ t0, ex }) => `${ex ? "✎" : "＋"} ${line(t0)}${ex ? ` (كانت: ${money(ex.price)})` : ""}`),
      ...drop.map((p) => `✕ حذف «${p.name}» (${money(p.price)}) — غير موجودة في القائمة`),
      ...(keep.length ? [`• تبقى كما هي: ${keep.map((p) => p.name).join("، ")}`] : []),
      ...(keep.filter(isSpecial).length ? [`• 🔒 تصبح «خاصة» ولا يعرضها مساعد واتساب للعملاء: ${keep.filter(isSpecial).map((p) => p.name).join("، ")}`] : []),
      "• الأوزان: العباية والجلابية = قطعتان · اللحاف والشرشف الدبل في الكوي = قطعتان · الأحذية خارج الباقات",
      "• الباقات المباعة للعملاء سابقاً تبقى كما هي (التغيير للمبيعات الجديدة فقط).",
    ].join("\n");
    openQuickForm({
      title: "🗂 تطبيق قائمة الباقات المنشورة", sub, fields: [], submitLabel: "تطبيق",
      onSubmit: () => {
        plan.forEach(({ t0, ex }) => {
          const data = { garments: [], name: t0.name, serviceType: t0.serviceType, pieceCount: t0.pieceCount, price: round3(t0.price), bonus: t0.bonus, validDays: t0.validDays, dlvTrips: t0.dlvTrips, dlvPeriod: "total", catalogKey: t0.key };
          if (ex) Object.assign(ex, data); else settings.packageDefs.push({ id: uid(), garments: [], ...data });
        });
        keep.filter(isSpecial).forEach((p) => { p.private = true; });
        const dropIds = new Set(drop.map((p) => p.id));
        settings.packageDefs = settings.packageDefs.filter((p) => !dropIds.has(p.id));
        const order = PKGS_997.map((t0) => t0.key);
        settings.packageDefs.sort((x, y) => (order.indexOf(x.catalogKey) + 1 || 99) - (order.indexOf(y.catalogKey) + 1 || 99));
        const w = { ...(settings.packageWeights || PACKAGE_WEIGHTS_997) };
        Object.entries(PKG_W_997).forEach(([id, v]) => { w[id] = { ...(typeof w[id] === "object" && w[id] ? w[id] : {}), ...v }; });
        settings.packageWeights = w;
        persistAll();
        logActivity(`تطبيق قائمة الباقات المنشورة — ${changes.map(({ t0, ex }) => `${ex ? "تعديل" : "إضافة"} ${t0.name} ${money(t0.price)}`).join("، ")}${drop.length ? ` — حذف: ${drop.map((p) => p.name).join("، ")}` : ""}`);
        renderPackageDefs(); renderPackageWeights();
        toast(`✓ طُبّقت القائمة: ${PKGS_997.length} باقة`);
      },
    });
  });
  document.getElementById("applyPkgTipsBtn")?.addEventListener("click", () => {
    if (!can("edit_pricing")) { denied(); return; }
    const defs = (settings.packageDefs || []).filter((p) => !p.catalogKey); // باقات القائمة المنشورة لها شروطها المعلنة — لا تُغيّرها التوصيات
    if (!defs.length) { toast("لا توجد باقات لتطبيق التوصيات عليها"); return; }
    const gift = (p) => (p.pieceCount >= 100 ? p.bonus : /لحاف/.test(p.bonus || "") ? "" : p.bonus);
    const lines = defs.map((p) => { const t0 = pkgTipFor(p.pieceCount); return `• ${p.name}: صلاحية ${t0.validDays} يوم · ${t0.dlvTrips} مشاوير مجانية للباقة كاملة${gift(p) !== p.bonus ? " · بدون هدية اللحاف" : ""}`; });
    const w = settings.packageWeights || {};
    openQuickForm({
      title: "✨ تطبيق توصيات الباقات", sub: lines.join("\n") + `\n• وزن اللحاف: ${pkgWeight("duvet", "washiron")} ← 4 · الشرشف الدبل: ${pkgWeight("bedsheet_double", "washiron")} ← 3\n• الباقات المباعة للعملاء سابقاً تبقى كما هي (تُطبّق على المبيعات الجديدة).`,
      fields: [], submitLabel: "تطبيق",
      onSubmit: () => {
        const before = defs.map((p) => `${p.name}: ${Number(p.validDays) > 0 ? p.validDays + " يوم" : "دائمة"}/${pkgTrips(p).n} ${pkgTrips(p).period === "total" ? "للباقة" : "شهرياً"}/${p.bonus || "—"}`).join("، ");
        defs.forEach((p) => { Object.assign(p, pkgTipFor(p.pieceCount)); p.bonus = gift(p); });
        settings.packageWeights = { ...w, duvet: { ...(w.duvet || {}), washiron: 4, iron: (w.duvet && w.duvet.iron) || 2 }, bedsheet_double: { ...(w.bedsheet_double || {}), washiron: 3, iron: (w.bedsheet_double && w.bedsheet_double.iron) || 2 } };
        persistAll();
        logActivity(`تطبيق توصيات الباقات — قبل: ${before} — بعد: ${defs.map((p) => `${p.name}: ${p.validDays} يوم/${p.dlvTrips} مشاوير/${p.bonus || "—"}`).join("، ")} — اللحاف 4، الشرشف الدبل 3`);
        renderPackageDefs(); renderPackageWeights();
        toast("✓ طُبّقت التوصيات على الباقات");
      },
    });
  });

  // سطر توضيحي للعميل: «العباية = 2 قطع · اللحاف = 5 قطع … · خارج الباقة: الستارة، الحذاء» (للأصناف المشمولة بخدمة الباقة فقط)
  function pkgRulesText(def) {
    const ids = (Array.isArray(def.garments) && def.garments.length ? def.garments : activeGarments().map((g) => g.id)).filter((id) => priceFor(id, def.serviceType) > 0);
    const heavy = {}, out = [];
    ids.forEach((id) => { const w = pkgWeightFor(def, id, def.serviceType); if (w > 1) (heavy[w] = heavy[w] || []).push(clothingName(id)); });
    // الأصناف المستثناة تُذكر دائماً (ستارة، أحذية…) حتى لو لم يكن لها سعر بخدمة هذه الباقة — لتفادي أي سوء فهم
    activeGarments().forEach((g) => { if (pkgWeight(g.id, def.serviceType) === 0 && SERVICES_DEFAULT.some((x) => priceFor(g.id, x.id) > 0)) out.push(clothingName(g.id)); });
    const en = lang === "en";
    const pcs = (w) => (en ? `${w} pcs` : w === 2 ? "قطعتين" : `${w} قطع`);
    const parts = Object.keys(heavy).sort((a, b) => a - b).map((w) => `${heavy[w].join(en ? " / " : " و")} = ${pcs(Number(w))}`);
    if (out.length) parts.push(`${en ? "Not included" : "خارج الباقة"}: ${out.join(en ? ", " : "، ")}`);
    return parts.join(" · ");
  }
  // أوزان القطع في الباقات: لكل صنف كم قطعة يُخصم من رصيد الباقة (غسيل وكوي / كوي فقط) — 0 = خارج نظام الباقات
  function renderPackageWeights() {
    const body = document.getElementById("packageWeightsBody");
    if (!body) return;
    const list = activeGarments().filter((g) => priceFor(g.id, "washiron") > 0 || priceFor(g.id, "iron") > 0);
    const cell = (g, svc) => priceFor(g.id, svc) > 0 || ((settings.packageWeights || {})[g.id] || {})[svc] !== undefined
      ? `<input type="number" min="0" max="50" step="1" inputmode="numeric" class="pkgw-input" data-pkgw="${g.id}" data-svc="${svc}" value="${pkgWeight(g.id, svc)}" style="width:72px" />`
      : `<span class="section-note">—</span>`;
    const sorted = list.slice().sort((a, b) => {
      const wa = Math.max(pkgWeight(a.id, "washiron"), pkgWeight(a.id, "iron")), wb = Math.max(pkgWeight(b.id, "washiron"), pkgWeight(b.id, "iron"));
      const ka = wa === 1 ? 1 : 0, kb = wb === 1 ? 1 : 0; return ka - kb;
    });
    body.innerHTML = sorted.map((g) => {
      const off = pkgWeight(g.id, "washiron") === 0 && pkgWeight(g.id, "iron") === 0;
      return `<tr><td><span class="cart-icon">${gIcon(g.id, 22)}</span> <strong>${esc(clothingName(g.id))}</strong>${off ? ` <span class="status-badge status-cancelled">خارج الباقات</span>` : ""}</td><td>${cell(g, "washiron")}</td><td>${cell(g, "iron")}</td></tr>`;
    }).join("");
  }
  document.getElementById("savePackageWeightsBtn")?.addEventListener("click", () => {
    const next = {};
    document.querySelectorAll("#packageWeightsBody [data-pkgw]").forEach((inp) => {
      const n = Math.floor(Number(inp.value));
      const v = Number.isFinite(n) && n >= 0 ? Math.min(50, n) : 1;
      if (v === 1) return;
      (next[inp.dataset.pkgw] = next[inp.dataset.pkgw] || {})[inp.dataset.svc] = v;
    });
    Object.values(next).forEach((o) => { if (o.washiron === undefined) o.washiron = 1; if (o.iron === undefined) o.iron = 1; });
    const desc = Object.entries(next).map(([id, o]) => `${clothingName(id)} ${o.washiron}/${o.iron}`).join("، ") || "كل الأصناف = 1";
    settings.packageWeights = next;
    persistAll();
    logActivity(`تعديل أوزان القطع في الباقات (غسيل وكوي/كوي): ${desc}`);
    renderPackageWeights();
    toast("تم حفظ أوزان الباقات — تُطبّق على الطلبات الجديدة");
  });
  document.getElementById("resetPackageWeightsBtn")?.addEventListener("click", () => {
    confirmAction("إرجاع أوزان الباقات للوضع الافتراضي؟ (عباية 2، لحاف 5، شرشف دبل 4، جلابية 2، الكوي فقط 2، الستارة والأحذية خارج الباقات)", () => {
      settings.packageWeights = JSON.parse(JSON.stringify(PACKAGE_WEIGHTS_997));
      persistAll(); logActivity("إرجاع أوزان الباقات للوضع الافتراضي"); renderPackageWeights(); toast("تم");
    });
  });

  /* --------------------------- باقات العملاء (شراء واستخدام) --------------------------- */
  // باقة سارية = فيها قطع + لم تنتهِ صلاحيتها (expiresAt فارغ = دائمة)
  const pkgExpired = (cp) => !!cp.expiresAt && cp.expiresAt < todayStr();
  function activePackagesForCustomer(customerId) {
    return customerPackages.filter((cp) => cp.customerId === customerId && cp.remainingPieces > 0 && !pkgExpired(cp))
      .sort((a, b) => String(a.expiresAt || "9999").localeCompare(String(b.expiresAt || "9999")));
  }
  const daysLeft = (ymd) => Math.round((new Date(ymd + "T12:00:00") - new Date(todayStr() + "T12:00:00")) / 864e5);
  function pkgExpiryText(cp) {
    if (!cp.expiresAt) return lang === "ar" ? "♾ دائمة بدون تاريخ انتهاء" : "♾ No expiry";
    const d = daysLeft(cp.expiresAt);
    if (d < 0) return lang === "ar" ? `⛔ انتهت صلاحيتها في ${cp.expiresAt}` : `⛔ Expired on ${cp.expiresAt}`;
    return lang === "ar" ? `⏳ صالحة حتى ${cp.expiresAt} (${d === 0 ? "آخر يوم" : `متبقي ${d} يوم`})` : `⏳ Valid until ${cp.expiresAt} (${d === 0 ? "last day" : `${d} days left`})`;
  }
  const WEEKDAYS = { ar: ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"], en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] };
  const weekdayName = (i) => (lang === "ar" ? WEEKDAYS.ar : WEEKDAYS.en)[Number(i)] || "";
  const todayWeekday = () => new Date(todayStr() + "T12:00:00").getDay();
  // حقول مشتركة: صلاحية الباقة + مشاوير التوصيل + الموعد الثابت (عند البيع وعند التعديل)
  function pkgTermsFields(src, forDef) {
    const cfg = dlvCfg();
    const f = [];
    if (forDef) f.push({ id: "validDays", label: "⏳ مدة الصلاحية بالأيام (0 = دائمة بدون انتهاء)", type: "number", step: "1", min: 0, value: src ? Number(src.validDays) || 0 : 0 });
    else f.push({ id: "expiresAt", label: "⏳ تاريخ انتهاء الباقة (اتركه فارغاً = دائمة)", type: "date", value: src ? src.expiresAt || "" : "" });
    f.push({ id: "dlvTrips", label: `🚚 مشاوير الاستلام/التوصيل المجانية (فارغ = الافتراضي ${cfg.pkgFree} شهرياً من الإعدادات، 0 = بدون مشاوير مجانية)`, type: "text", value: src && src.dlvTrips !== undefined && src.dlvTrips !== null && src.dlvTrips !== "" ? String(src.dlvTrips) : "" });
    f.push({ id: "dlvPeriod", label: "🔁 المشاوير المجانية تُحسب", type: "select", value: src && src.dlvPeriod === "total" ? "total" : "month", options: [{ value: "month", label: "كل شهر (تتجدد أول كل شهر)" }, { value: "total", label: "مرة واحدة طوال مدة الباقة" }] });
    if (!forDef) {
      f.push({ id: "schedDay", label: "📅 موعد استلام ثابت أسبوعياً (اختياري)", type: "select", value: src && src.schedule && src.schedule.day !== undefined && src.schedule.day !== "" ? String(src.schedule.day) : "", options: [{ value: "", label: "— بدون موعد ثابت —" }].concat(WEEKDAYS.ar.map((d, i) => ({ value: String(i), label: d }))) });
      f.push({ id: "schedSlot", label: "⏰ وقت الموعد الثابت", type: "select", value: src && src.schedule ? src.schedule.slot || "evening" : "evening", options: DLV_SLOTS.map((x) => ({ value: x.v, label: x.ar })) });
    }
    return f;
  }
  function readPkgTerms(v, forDef) {
    const raw = String(v.dlvTrips || "").trim();
    const trips = raw === "" ? undefined : Math.max(0, Math.floor(Number(normDigits(raw)) || 0));
    if (raw !== "" && !/^\d+$/.test(normDigits(raw))) return { error: "عدد المشاوير: رقم صحيح أو اتركه فارغاً" };
    const out = { dlvTrips: trips, dlvPeriod: v.dlvPeriod === "total" ? "total" : "month" };
    if (forDef) out.validDays = Math.max(0, Math.floor(Number(v.validDays) || 0));
    else {
      if (v.expiresAt && !/^\d{4}-\d{2}-\d{2}$/.test(v.expiresAt)) return { error: "تاريخ الانتهاء غير صحيح" };
      out.expiresAt = v.expiresAt || "";
      out.schedule = v.schedDay !== "" && v.schedDay !== undefined ? { day: Number(v.schedDay), slot: v.schedSlot || "evening" } : null;
    }
    return out;
  }
  function pkgTermsText(cp) {
    const t0 = pkgTrips(cp), parts = [pkgExpiryText(cp)];
    parts.push(t0.n > 0 ? (lang === "ar" ? `🚚 ${t0.n} مشاوير مجانية ${t0.period === "total" ? "طوال الباقة" : "كل شهر"}` : `🚚 ${t0.n} free trips ${t0.period === "total" ? "for the whole package" : "a month"}`) : (lang === "ar" ? "🚚 بدون مشاوير مجانية" : "🚚 no free trips"));
    if (cp.schedule && cp.schedule.day !== undefined && cp.schedule.day !== null) parts.push(`📅 ${weekdayName(cp.schedule.day)} · ${slotLabel(cp.schedule.slot)}`);
    return parts.join(" · ");
  }
  function editCustomerPackage(cp, after) {
    if (!can("admin_settings") && role !== "owner") { denied(); return; }
    openQuickForm({
      title: `✏️ ${cp.name}`, sub: "تاريخ الانتهاء، المشاوير المجانية، والموعد الثابت لهذه الباقة فقط",
      fields: pkgTermsFields(cp, false), submitLabel: "حفظ",
      onSubmit: (v) => {
        const r = readPkgTerms(v, false); if (r.error) { toast(r.error); return false; }
        const before = pkgTermsText(cp);
        Object.assign(cp, r); if (r.dlvTrips === undefined) delete cp.dlvTrips;
        persistAll();
        logActivity(`تعديل باقة العميل «${cp.name}»: ${before} → ${pkgTermsText(cp)}`);
        toast("تم حفظ شروط الباقة"); if (after) after();
      },
    });
  }

  // شروط الباقة الافتراضية من تعريفها: تاريخ الانتهاء = اليوم + مدة الصلاحية (0 = دائمة)
  function defTerms(def) {
    if (!def) return {};
    return { expiresAt: Number(def.validDays) > 0 ? FIN.addDays(todayStr(), Number(def.validDays)) : "", dlvTrips: def.dlvTrips, dlvPeriod: def.dlvPeriod, schedule: null };
  }
  function sellPackageToCustomer(customerId) {
    setTimeout(() => {
      const sel = document.getElementById("qf_defId"); if (!sel) return;
      sel.addEventListener("change", () => {
        const t0 = defTerms(settings.packageDefs.find((p) => p.id === sel.value));
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
        set("qf_expiresAt", t0.expiresAt || ""); set("qf_dlvTrips", t0.dlvTrips !== undefined && t0.dlvTrips !== null && t0.dlvTrips !== "" ? String(t0.dlvTrips) : ""); set("qf_dlvPeriod", t0.dlvPeriod === "total" ? "total" : "month");
      });
    }, 0);
    const cust = customers.find((c) => c.id === customerId);
    if (!cust) return;
    if (!shiftGuard()) return;
    if (settings.packageDefs.length === 0) { toast("لا توجد باقات معرّفة — أضف باقة من الإعدادات أولاً"); return; }
    openQuickForm({
      title: `بيع باقة لـ ${cust.name}`, sub: "اختر الباقة وطريقة التحصيل",
      fields: [
        { id: "defId", label: "الباقة", type: "select", options: settings.packageDefs.map((p) => ({ value: p.id, label: `${p.name} — ${p.pieceCount} قطعة — ${money(p.price)} — ${garmentsLabel(p.garments, 3)}` })) },
        { id: "method", label: "طريقة التحصيل", type: "select", value: "cash", options: [
          { value: "cash", label: "نقداً" }, { value: "card", label: "بطاقة" },
          { value: "benefitpay", label: "Benefit Pay" }, { value: "bank_transfer", label: "تحويل بنكي" },
        ] },
        bpRefField(),
        ...pkgTermsFields(defTerms(settings.packageDefs[0]), false),
      ],
      onSubmit: (v) => {
        const def = settings.packageDefs.find((p) => p.id === v.defId);
        if (!def) return;
        const terms = readPkgTerms(v, false); if (terms.error) { toast(terms.error); return false; }
        { const bad = bpRefProblem(v.method, v.ref); if (bad) { toast(bad); return false; } }
        const now = new Date().toISOString();
        const cp = { id: uid(), customerId, defId: def.id, name: def.name, serviceType: def.serviceType, garments: Array.isArray(def.garments) ? [...def.garments] : [], totalPieces: def.pieceCount, remainingPieces: def.pieceCount, price: def.price, purchasedAt: now, ...terms };
        if (cp.dlvTrips === undefined) delete cp.dlvTrips;
        customerPackages.unshift(cp);
        ledger.unshift({ id: uid(), byId: me ? me.id : "", customerId, type: "package_purchase", amount: 0, price: round3(def.price), packageId: cp.id, balanceAfter: cust.balance, method: v.method, ref: v.method === "benefitpay" && normRef(v.ref) ? normRef(v.ref) : undefined, note: `شراء باقة: ${def.name} — ${money(def.price)}`, orderId: null, at: now });
        persistAll();
        logActivity(`${cust.name} اشترى باقة «${def.name}» (${def.pieceCount} قطعة، ${money(def.price)})`, def.price);
        toast(`تم تفعيل باقة «${def.name}» للعميل — ${def.pieceCount} قطعة متاحة`);
        waPrompt(`✓ تم تفعيل باقة «${def.name}»`, `هل ترسل تأكيد الباقة للعميل على واتساب؟`, "📲 إرسال تأكيد الباقة", () => {
          openWhatsApp(cust.phone, waMsg("package", { name: cust.name, pkg: def.name, pieces: def.pieceCount, garments: garmentsLabel(def.garments, 6), price: money(def.price), method: paymentLabel(v.method), bonus: def.bonus || "", rules: pkgRulesText(def), dlv: [dlvCfg().on && pkgTrips(cp).n > 0 ? (lang === "ar" ? `${pkgTrips(cp).n} مشاوير استلام/توصيل مجانية ${pkgTrips(cp).period === "total" ? "طوال مدة الباقة" : "كل شهر"}` : `${pkgTrips(cp).n} free pickup/delivery trips ${pkgTrips(cp).period === "total" ? "for the whole package" : "every month"}`) : "", cp.expiresAt ? (lang === "ar" ? `⏳ الباقة صالحة حتى ${cp.expiresAt}` : `⏳ Valid until ${cp.expiresAt}`) : "", cp.schedule ? (lang === "ar" ? `📅 موعد استلامك الثابت: كل ${weekdayName(cp.schedule.day)} · ${slotLabel(cp.schedule.slot)}` : `📅 Your regular pickup: every ${weekdayName(cp.schedule.day)} · ${slotLabel(cp.schedule.slot)}`) : ""].filter(Boolean).join("\n") }));
          logActivity(`إرسال تأكيد باقة واتساب — ${cust.name} — ${def.name}`);
        });
        renderCustomersPage();
        if (customerProfileDialog.open) setTimeout(renderCustomerProfile, 150);
      },
    });
  }

  /* ============================= 🚚 الاستلام والتوصيل ============================= */
  const DLV_SLOTS = [
    { v: "morning", ar: "صباحاً 8–12", en: "Morning 8–12" }, { v: "noon", ar: "ظهراً 12–4", en: "Afternoon 12–4" },
    { v: "evening", ar: "مساءً 4–8", en: "Evening 4–8" }, { v: "night", ar: "ليلاً 8–12", en: "Night 8–12" },
  ];
  const slotLabel = (v) => { const x = DLV_SLOTS.find((s2) => s2.v === v); return x ? (lang !== "ar" ? x.en : x.ar) : ""; };
  const dayLabel = (ymd) => {
    if (!ymd) return "";
    if (ymd === todayStr()) return lang !== "ar" ? "Today" : "اليوم";
    if (ymd === FIN.addDays(todayStr(), 1)) return lang !== "ar" ? "Tomorrow" : "بكرة";
    try { return new Date(ymd + "T12:00:00").toLocaleDateString(lang !== "ar" ? "en-GB" : "ar-BH", { weekday: "long", day: "numeric", month: "numeric" }); } catch (e) { return ymd; }
  };
  const whenLabel = (date, slot) => [date ? dayLabel(date) : (lang !== "ar" ? "As soon as possible" : "بأقرب وقت"), slotLabel(slot)].filter(Boolean).join(" · ");
  const monthOf = (iso) => (iso ? FIN.localDay(iso).slice(0, 7) : "");
  // المشاوير المجانية التي استخدمها عميل الباقة هذا الشهر (من الطلبات غير الملغاة)
  function freeTripsUsed(custId, month, excludeOrderId) {
    return orders.filter((o) => o.customerId === custId && o.status !== "cancelled" && o.id !== excludeOrderId && monthOf(o.createdAt) === month)
      .reduce((n, o) => n + (o.extras || []).filter((l) => String(l.id).startsWith("dlv_") && l.free === "package").length, 0);
  }
  // حصة المشاوير المجانية لكل باقة: من الباقة نفسها (أو الافتراضي من الإعدادات)، شهرياً أو مرة واحدة طوال الباقة
  function pkgTrips(cp) {
    const n = cp && cp.dlvTrips !== undefined && cp.dlvTrips !== null && cp.dlvTrips !== "" ? Math.max(0, Math.floor(Number(cp.dlvTrips) || 0)) : dlvCfg().pkgFree;
    return { n, period: cp && cp.dlvPeriod === "total" ? "total" : "month" };
  }
  function pkgTripsUsed(cp, excludeOrderId) {
    const t0 = pkgTrips(cp), month = todayStr().slice(0, 7);
    return orders.filter((o) => o.customerId === cp.customerId && o.status !== "cancelled" && o.id !== excludeOrderId
      && (t0.period === "total" ? String(o.createdAt) >= String(cp.purchasedAt || "") : monthOf(o.createdAt) === month))
      .reduce((n, o) => n + (o.extras || []).filter((l) => String(l.id).startsWith("dlv_") && l.free === "package" && (l.pkgId ? l.pkgId === cp.id : true)).length, 0);
  }
  // حالة مشاوير العميل: مجموع الحصص المتاحة من باقاته السارية
  function tripState(custId) {
    const pk = custId ? activePackagesForCustomer(custId) : [];
    const per = pk.map((cp) => { const t0 = pkgTrips(cp), used = pkgTripsUsed(cp); return { cp, n: t0.n, period: t0.period, used: Math.min(used, t0.n), left: Math.max(0, t0.n - used) }; });
    return { hasPkg: pk.length > 0, per, quota: per.reduce((a, x) => a + x.n, 0), used: per.reduce((a, x) => a + x.used, 0), left: per.reduce((a, x) => a + x.left, 0), period: per.length && per.every((x) => x.period === "total") ? "total" : "month" };
  }
  const tripPeriodWord = (st) => (st.period === "total" ? DL("المشاوير المجانية في الباقة", "Free trips in the package") : DL("المشاوير المجانية هذا الشهر", "Free trips this month"));
  // تسعير مشاوير الطلب: لكل رحلة (استلام/توصيل) — مجاني ضمن حصة الباقة، أو مجاني فوق الحد، وإلا الرسوم
  function deliveryQuote(custId, legs, orderValue) {
    const cfg = dlvCfg(), lines = [];
    const st = tripState(custId), hasPkg = st.hasPkg;
    const pool = st.per.map((x) => ({ id: x.cp.id, left: x.left }));
    if (!cfg.on || !legs) return { lines, hasPkg, used: st.used, quota: st.quota, left: st.left, st, cfg };
    ["pickup", "drop"].forEach((leg) => {
      if (!legs[leg]) return;
      let free = null, unit = hasPkg ? cfg.pkgFee : cfg.fee, pkgId;
      const src = pool.find((x) => x.left > 0);
      if (hasPkg && src) { free = "package"; src.left--; unit = 0; pkgId = src.id; }
      else if (cfg.freeOver > 0 && orderValue >= cfg.freeOver) { free = "threshold"; unit = 0; }
      else if (!(unit > 0)) free = "threshold";
      lines.push({ id: "dlv_" + leg, per: "order", qty: 1, unit: round3(unit), total: round3(unit), free: free || undefined, pkgId });
    });
    return { lines, hasPkg, used: st.used, quota: st.quota, left: pool.reduce((a, x) => a + x.left, 0), st, cfg };
  }
  function dlvStatusText(order) {
    const d = order.delivery || {}, en = lang !== "ar";
    const parts = [];
    if (d.pickup) parts.push(en ? "Picked up from home" : "استُلم من البيت");
    if (d.drop) parts.push(({ pending: en ? "Home delivery — waiting" : "توصيل للبيت — بالانتظار", onway: en ? "Out for delivery 🛵" : "خرج للتوصيل 🛵", done: en ? "Delivered home ✓" : "وُصّل للبيت ✓" })[d.dropStatus || "pending"]);
    return parts.join(" · ") + (d.date || d.slot ? ` · ${whenLabel(d.date, d.slot)}` : "");
  }
  function dlvMsgLine(order) {
    const d = order.delivery; if (!d || !d.drop) return "";
    const l = (order.extras || []).find((x) => x.id === "dlv_drop");
    const fee = l ? (l.free ? (lang === "ar" ? "مجاني" : "Free") : money(l.total)) : "—", when = d.date || d.slot ? ` (${whenLabel(d.date, d.slot)})` : "";
    return lang === "ar" ? `بنوصل طلبك لبيتك بعد التجهيز${when} — التوصيل: ${fee}` : `We'll deliver your order home when it's ready${when} — delivery: ${fee}`;
  }
  const mapsUrl = (addr) => (/^https?:\/\//i.test(String(addr || "").trim()) ? String(addr).trim() : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(String(addr || "") + " Bahrain")}`);

  // صندوق الاستلام والتوصيل في شاشة الطلب الجديد
  function renderPosDelivery() {
    let box = document.getElementById("posDelivery");
    const anchor = document.getElementById("posExtras");
    if (!box && anchor) { box = document.createElement("div"); box.id = "posDelivery"; box.className = "pos-delivery"; anchor.insertAdjacentElement("afterend", box); }
    if (!box) return;
    if (!dlvCfg().on) { box.style.display = "none"; draftDelivery.pickup = draftDelivery.drop = false; return; }
    box.style.display = "";
    const d = draftDelivery, any = d.pickup || d.drop, E = lang !== "ar";
    const linked = d.reqId ? suspendedOrders.find((x) => x.id === d.reqId) : null;
    box.innerHTML = `<div class="pos-dlv-head">🚚 ${E ? "Pickup & delivery" : "الاستلام والتوصيل"}</div>
      ${linked ? `<div class="pos-dlv-link">🔗 ${E ? `Linked to the pickup booking${linked.source === "whatsapp" ? " from WhatsApp" : linked.source === "app" ? " from the app" : ""}` : `مربوط بموعد الاستلام${linked.source === "whatsapp" ? " (من واتساب)" : linked.source === "app" ? " (من التطبيق)" : ""}`} · ${esc(whenLabel(linked.date, linked.slot))}${linked.bags ? ` · 🛍 ${linked.bags}` : ""} <button type="button" class="mini-btn" id="dlvUnlink">${E ? "Separate order" : "طلب منفصل"}</button></div>` : ""}
      <label class="pos-urgent-toggle pos-extra-toggle"><input type="checkbox" id="dlvPickup" ${d.pickup ? "checked" : ""} /> 📥 ${E ? "Picked up from the customer's home" : "استلمناها من بيت العميل"}</label>
      <label class="pos-urgent-toggle pos-extra-toggle"><input type="checkbox" id="dlvDrop" ${d.drop ? "checked" : ""} /> 📦 ${E ? "Deliver home when ready" : "توصيل للبيت بعد التجهيز"}</label>
      <div class="pos-dlv-more" style="${any ? "" : "display:none"}">
        <input id="dlvAddress" type="text" value="${esc(d.address)}" placeholder="${E ? "📍 Address: area, block, road, house — or a map link" : "📍 العنوان: المنطقة، مجمع، طريق، منزل — أو رابط الموقع"}" />
        <div class="pos-dlv-row"><input id="dlvDate" type="date" value="${esc(d.date)}" /><select id="dlvSlot"><option value="">⏰ ${E ? "Time" : "الوقت"}</option>${DLV_SLOTS.map((x) => `<option value="${x.v}" ${x.v === d.slot ? "selected" : ""}>${E ? x.en : x.ar}</option>`).join("")}</select></div>
      </div>
      <div class="pos-dlv-quote" id="dlvQuote"></div>`;
    const on = () => { d.pickup = box.querySelector("#dlvPickup").checked; d.drop = box.querySelector("#dlvDrop").checked; box.querySelector(".pos-dlv-more").style.display = d.pickup || d.drop ? "" : "none"; updateSummary(); };
    box.querySelector("#dlvPickup").addEventListener("change", on);
    box.querySelector("#dlvUnlink")?.addEventListener("click", () => { Object.assign(d, { reqId: null, noLink: draftCustomerId, pickup: false }); renderPosDelivery(); updateSummary(); });
    box.querySelector("#dlvDrop").addEventListener("change", on);
    box.querySelector("#dlvAddress").addEventListener("input", (e) => { d.address = e.target.value.trim(); });
    box.querySelector("#dlvDate").addEventListener("change", (e) => { d.date = e.target.value; });
    box.querySelector("#dlvSlot").addEventListener("change", (e) => { d.slot = e.target.value; });
    updateDeliveryQuote();
  }
  function updateDeliveryQuote() {
    const el = document.getElementById("dlvQuote"); if (!el) return;
    const cfg = dlvCfg(), E = lang !== "ar";
    if (!draftCustomerId) { el.innerHTML = `<span class="section-note">${E ? "Pick the customer to see the delivery fee" : "اختر العميل لمعرفة رسوم التوصيل"}</span>`; return; }
    const b = draftBase(), q = deliveryQuote(draftCustomerId, draftDelivery, round3(b.itemsTotal + extrasTotalOf(b.extras.filter((l) => !String(l.id).startsWith("dlv_")))));
    const head = q.hasPkg
      ? (E ? `🎟 Package customer — ${tripPeriodWord(q.st).toLowerCase()}: <b>${q.used}</b> of <b>${q.quota}</b>${q.used >= q.quota ? ` · then ${money(cfg.pkgFee)} per trip` : ""}` : `🎟 عميل باقة — ${tripPeriodWord(q.st)}: <b>${q.used}</b> من <b>${q.quota}</b>${q.used >= q.quota ? ` · بعدها ${money(cfg.pkgFee)} للمشوار` : ""}`)
      : (E ? `Small fee ${money(cfg.fee)} per trip${cfg.freeOver > 0 ? ` · 🎁 free for orders from ${money(cfg.freeOver)}` : ""}` : `رسوم رمزية ${money(cfg.fee)} للمشوار${cfg.freeOver > 0 ? ` · 🎁 مجاني للطلبات من ${money(cfg.freeOver)}` : ""}`);
    const freeTxt = (f) => (E ? (f === "package" ? "Free ✓ (package)" : "Free ✓") : f === "package" ? "مجاني ✓ (ضمن الباقة)" : "مجاني ✓");
    const lines = q.lines.map((l) => `<div class="pos-dlv-line"><span>${esc(extraName(l.id))}</span><b class="${l.free ? "free" : ""}">${l.free ? freeTxt(l.free) : money(l.total)}</b></div>`).join("");
    el.innerHTML = `<div class="pos-dlv-info">${head}</div>${lines}`;
  }

  // نصوص صفحة التوصيل بلغة الواجهة (العربية، وغيرها بالإنجليزية)
  const DL = (ar, en) => (lang === "ar" ? ar : en);
  const nowSlot = () => { const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Bahrain" }).format(new Date())); return h < 10 ? "morning" : h < 14 ? "noon" : h < 18 ? "evening" : "night"; };
  function pkgBadge(custId) {
    if (!custId || !activePackagesForCustomer(custId).length) return "";
    const cfg = dlvCfg(), left = tripState(custId).left;
    return `<span class="dlv-pkg">🎟 ${DL("باقة", "Package")} · ${left > 0 ? DL(`${left} مشاوير مجانية متبقية`, `${left} free trips left`) : DL(`انتهت المجانية — ${money(cfg.pkgFee)}`, `free trips used — ${money(cfg.pkgFee)}`)}</span>`;
  }
  const tripFeeText = (custId) => {
    const l = deliveryQuote(custId, { pickup: true }, 0).lines[0];
    if (!l) return "—";
    return l.free === "package" ? DL("مجاني ضمن باقتك 🎟", "Free — included in your package 🎟") : l.free ? DL("مجاني", "Free") : money(l.total);
  };

  // طلب استلام من البيت (قبل وجود القطع): يُحفظ مع الطلبات المعلّقة (kind = pickup) ويتزامن بين الأجهزة.
  // خطوة واحدة: ابحث عن العميل بالاسم أو الرقم (أو أضفه فوراً)، العنوان يُعبّأ من ملفه، اليوم والوقت بأزرار جاهزة.
  function openPickupForm(custId) {
    let picked = custId ? customers.find((x) => x.id === custId) : null;
    const days = [0, 1, 2, 3, 4, 5].map((n) => { const d = FIN.addDays(todayStr(), n); return { value: d, label: dayLabel(d) }; });
    openQuickForm({
      title: DL("🚚 حجز استلام من البيت", "🚚 Book a home pickup"),
      sub: DL("اختر العميل، تأكد من العنوان، واختر الوقت — ويوصل العميل تأكيد على واتساب.", "Pick the customer, check the address, choose a time — the customer gets a WhatsApp confirmation."),
      fields: [
        { id: "cust", label: DL("👤 العميل — اكتب الاسم أو رقم الجوال", "👤 Customer — type a name or phone number"), type: "text", value: picked ? picked.name : "", autocomplete: "off" },
        { id: "newname", label: DL("اسم العميل الجديد", "New customer's name"), type: "text", autocomplete: "off" },
        { id: "address", label: DL("📍 العنوان (أو الصق رابط الموقع من واتساب)", "📍 Address (or paste the location link from WhatsApp)"), type: "text", value: picked ? [picked.area, picked.address].filter(Boolean).join(" — ") : "" },
        { id: "date", label: DL("📅 اليوم", "📅 Day"), type: "select", value: days[0].value, options: days },
        { id: "slot", label: DL("⏰ الوقت", "⏰ Time"), type: "select", value: nowSlot(), options: DLV_SLOTS.map((x) => ({ value: x.v, label: lang === "ar" ? x.ar : x.en })) },
        { id: "drop", label: DL("بعد التنظيف", "After cleaning"), type: "select", value: "yes", options: [{ value: "yes", label: DL("📦 نرجّعها للبيت (توصيل)", "📦 Deliver back home") }, { value: "no", label: DL("🏪 العميل يستلم من المحل", "🏪 Customer collects from the shop") }] },
        { id: "notes", label: DL("📝 ملاحظة للمندوب (اختياري)", "📝 Note for the driver (optional)"), type: "text", placeholder: DL("مثال: اتصل قبل الوصول", "e.g. call before arriving") },
      ],
      submitLabel: DL("✓ حفظ الموعد", "✓ Save booking"), cancelLabel: DL("إلغاء", "Cancel"),
      onSubmit: (v) => {
        let c = picked;
        if (!c) {
          const typed = v.cust;
          c = customers.find((x) => phoneMatches(x.phone, typed)) || null;
          if (!c && validPhone(typed)) {
            if (!v.newname) { toast(DL("عميل جديد — اكتب اسمه", "New customer — enter the name")); document.getElementById("qf_newname")?.focus(); return false; }
            c = { id: uid(), name: v.newname, phone: cleanPhone(typed), area: "", address: v.address || "", notes: "", balance: 0, openingBalance: 0, createdAt: new Date().toISOString() };
            customers.unshift(c); logActivity(`${t("toast_customer_saved")}: ${c.name} (حجز استلام)`);
          }
        }
        if (!c) { toast(DL("اختر العميل من القائمة أو اكتب رقم جواله", "Pick the customer from the list or type their phone number")); return false; }
        if (!v.address) { toast(DL("اكتب عنوان الاستلام", "Enter the pickup address")); document.getElementById("qf_address")?.focus(); return false; }
        const dup = openPickupFor(c.id);
        if (dup) { toast(DL(`⚠ ${c.name} عنده موعد استلام مفتوح ${whenLabel(dup.date, dup.slot)}${dup.source === "whatsapp" ? " (من واتساب)" : ""} — لا حاجة لحجز ثانٍ. عدّله من صفحة التوصيل.`, `⚠ ${c.name} already has an open pickup ${whenLabel(dup.date, dup.slot)}${dup.source === "whatsapp" ? " (from WhatsApp)" : ""} — no second booking needed. Edit it on the delivery page.`)); return false; }
        const now = new Date().toISOString();
        const req = { id: uid(), kind: "pickup", customerId: c.id, customerName: c.name, address: v.address, date: v.date, slot: v.slot, drop: v.drop !== "no", notes: v.notes, status: "new",
          items: [], extras: [], createdAt: now, suspendedAt: now, createdBy: me ? me.name : "" };
        suspendedOrders.unshift(req);
        if (!c.address) c.address = v.address;
        save("l997_suspended_orders", suspendedOrders); persistAll();
        logActivity(`🚚 حجز استلام من البيت — ${c.name} — ${whenLabel(v.date, v.slot)} — ${v.address}`);
        const fee = tripFeeText(c.id);
        setTimeout(() => waPrompt(DL("✓ تم حفظ الموعد", "✓ Booking saved"), DL(`${c.name} — ${whenLabel(v.date, v.slot)} — رسوم المشوار: ${fee}. ترسل التأكيد للعميل؟`, `${c.name} — ${whenLabel(v.date, v.slot)} — trip fee: ${fee}. Send the confirmation to the customer?`), DL("📲 إرسال التأكيد على واتساب", "📲 Send confirmation on WhatsApp"), () => {
          openWhatsApp(c.phone, waMsg("pickup_booked", { name: c.name, when: whenLabel(v.date, v.slot), address: v.address, fee }));
        }), 50);
        if (currentPage === "delivery") renderDeliveryPage();
        updateDeliveryBadge();
      },
    });
    // بحث مباشر عن العميل داخل النافذة + حقل الاسم يظهر فقط لرقم جديد
    const inp = document.getElementById("qf_cust"), nn = document.getElementById("qf_newname"), addr = document.getElementById("qf_address");
    if (!inp) return;
    const nnWrap = nn.closest("label"); nnWrap.style.display = "none";
    const box = document.createElement("div"); box.className = "dlv-suggest"; inp.closest("label").insertAdjacentElement("afterend", box);
    const show = () => {
      const q = inp.value.trim(); box.innerHTML = ""; nnWrap.style.display = "none";
      if (picked && q === picked.name) { const dup = openPickupFor(picked.id); box.innerHTML = `<div class="dlv-picked">✓ ${esc(picked.name)} · <span dir="ltr">${esc(fmtPhone(picked.phone))}</span> ${pkgBadge(picked.id)}</div>${dup ? `<div class="dlv-dup">⚠ ${DL(`عنده موعد مفتوح ${esc(whenLabel(dup.date, dup.slot))}${dup.source === "whatsapp" ? " (من واتساب)" : ""} — لا تحجز مرة ثانية`, `Already booked ${esc(whenLabel(dup.date, dup.slot))}${dup.source === "whatsapp" ? " (from WhatsApp)" : ""} — don't book twice`)}</div>` : ""}`; return; }
      picked = null;
      if (q.length < 2) return;
      const ql = q.toLowerCase().replace(/\s+/g, " ");
      const hits = customers.filter((x) => String(x.name || "").toLowerCase().replace(/\s+/g, " ").includes(ql) || phoneMatches(x.phone, q) || cleanPhone(x.phone).includes(normDigits(q).replace(/\D/g, "") || "§")).slice(0, 6);
      box.innerHTML = hits.map((x) => `<button type="button" class="dlv-hit" data-cid="${x.id}"><b>${esc(x.name)}</b> <span dir="ltr">${esc(fmtPhone(x.phone))}</span>${activePackagesForCustomer(x.id).length ? " 🎟" : ""}${openPickupFor(x.id) ? " 📥" : ""}</button>`).join("")
        || (validPhone(q) ? `<div class="dlv-new">➕ ${DL("رقم جديد — اكتب اسم العميل بالأسفل ويُضاف تلقائياً", "New number — type the customer's name below and they'll be added")}</div>` : `<div class="section-note">${DL("لا يوجد عميل بهذا الاسم — اكتب رقم جواله لإضافته", "No customer by that name — type their phone number to add them")}</div>`);
      if (!hits.length && validPhone(q)) nnWrap.style.display = "";
      box.querySelectorAll("[data-cid]").forEach((b) => (b.onclick = () => {
        picked = customers.find((x) => x.id === b.dataset.cid); inp.value = picked.name;
        if (!addr.value) addr.value = [picked.area, picked.address].filter(Boolean).join(" — ");
        show(); addr.focus();
      }));
    };
    inp.addEventListener("input", show);
    show();
    if (!picked) setTimeout(() => inp.focus(), 60);
  }
  function pickupRequests() { return suspendedOrders.filter((x) => x.kind === "pickup"); }
  function dropRequests() { return suspendedOrders.filter((x) => x.kind === "dropreq"); }
  function openPickupFor(custId) { return custId ? pickupRequests().find((r) => r.customerId === custId) : null; }
  // 🧭 الملاحة: رابط اتجاهات قوقل ماب (إحداثيات من رابط الموقع إن وُجدت، أو العنوان نصاً)
  const coordsOf = (a) => { const m = String(a || "").match(/(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/); return m ? `${m[1]},${m[2]}` : ""; };
  const stopPoint = (a) => { const t = String(a || "").trim(); if (!t) return ""; const c = coordsOf(t); if (c) return c; return /^https?:\/\//i.test(t) ? "" : `${t} Bahrain`; };
  const navUrl = (a) => { const t = String(a || "").trim(), pt = stopPoint(t); return pt ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(pt)}&travelmode=driving` : mapsUrl(t); };
  function routeUrl(addrs) {
    const pts = addrs.map(stopPoint).filter(Boolean); if (!pts.length) return "";
    const dest = pts.pop();
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}${pts.length ? `&waypoints=${pts.slice(0, 9).map(encodeURIComponent).join("%7C")}` : ""}&travelmode=driving`;
  }
  const drivers = () => emps().filter((e) => e.active !== false);
  const SLOT_ORDER = { morning: 0, noon: 1, evening: 2, night: 3 };
  // 📲 تنبيه فوري بطلبات واتساب الجديدة (استلام/توصيل) على كل الأجهزة — حتى لا يحجز الموظف مرة ثانية وهو لا يدري
  function waIntakeAlert() {
    const pend = suspendedOrders.filter((r) => (r.source === "whatsapp" || r.source === "app") && r.needsConfirm);
    let chip = document.getElementById("waIntakeChip");
    if (!pend.length || currentPage === "delivery" || !me) { if (chip) chip.remove(); return; }
    let seen; try { seen = new Set(JSON.parse(localStorage.getItem("l997_wa_seen") || "[]")); } catch (e) { seen = new Set(); }
    const fresh = pend.filter((r) => !seen.has(r.id));
    if (!chip) { chip = document.createElement("button"); chip.type = "button"; chip.id = "waIntakeChip"; chip.className = "wa-intake-chip"; document.body.appendChild(chip); chip.onclick = () => openPage("delivery"); }
    chip.innerHTML = `📲 ${DL(`${pend.length} ${pend.length === 1 ? "طلب" : "طلبات"} من ${pend.every((r) => r.source === "app") ? "التطبيق" : "واتساب"} بانتظار التأكيد`, `${pend.length} ${pend.every((r) => r.source === "app") ? "app" : "WhatsApp"} request${pend.length === 1 ? "" : "s"} waiting`)} — <b>${esc(pend.map((r) => r.customerName).slice(0, 2).join("، "))}</b> · ${DL("عرض", "Open")} ›`;
    if (fresh.length) {
      toast(DL(`📲 طلب جديد من ${fresh.every((r) => r.source === "app") ? "التطبيق" : "واتساب"}: ${fresh.map((r) => `${r.kind === "dropreq" ? "توصيل" : "استلام"} — ${r.customerName}`).join("، ")}`, `📲 New WhatsApp request: ${fresh.map((r) => `${r.kind === "dropreq" ? "delivery" : "pickup"} — ${r.customerName}`).join(", ")}`));
      try { localStorage.setItem("l997_wa_seen", JSON.stringify([...seen, ...fresh.map((r) => r.id)].slice(-200))); } catch (e) { /* ignore */ }
    }
  }
  // الملابس وصلت المحل: يتحول الموعد إلى طلب جديد بنفس العميل والعنوان (المشوار يُحسب عند حفظ الطلب)
  function convertPickup(id) {
    const r = suspendedOrders.find((x) => x.id === id); if (!r) return;
    const c = customers.find((x) => x.id === r.customerId);
    if (!c) { toast(DL("العميل غير موجود", "Customer not found")); return; }
    openPage("new-order");
    resetDraft();
    selectCustomerForOrder(c, true);
    draftDelivery = { pickup: true, drop: r.drop !== false, address: r.address || "", date: "", slot: "", reqId: r.id };
    if (r.notes) document.getElementById("orderNotes").value = r.notes;
    renderPosDelivery(); updateSummary();
    toast(DL("✓ أضف قطع العميل ثم احفظ الطلب — مشوار الاستلام محسوب تلقائياً", "✓ Add the customer's items and save — the pickup trip is already included"));
  }
  function updateDeliveryBadge() {
    const btn = document.querySelector('.nav-item[data-page="delivery"]'); if (!btn) return;
    btn.style.display = dlvCfg().on ? "" : "none";
    const n = pickupRequests().length + dropRequests().length + orders.filter((o) => o.delivery && o.delivery.drop && o.status === "ready" && o.delivery.dropStatus !== "done").length;
    let b = btn.querySelector(".nav-count");
    if (!b) { b = document.createElement("span"); b.className = "nav-count"; btn.appendChild(b); }
    b.textContent = n; b.style.display = n ? "" : "none";
    try { waIntakeAlert(); } catch (e) { /* ignore */ }
  }

  function renderDeliveryPage() {
    const root = document.getElementById("deliveryRoot"); if (!root) return;
    const cfg = dlvCfg(), month = todayStr().slice(0, 7), today = todayStr();
    // فتح الصفحة = رأى الموظف طلبات واتساب الجديدة
    try { const seen = new Set(JSON.parse(localStorage.getItem("l997_wa_seen") || "[]")); suspendedOrders.forEach((r) => { if (r.source === "whatsapp" || r.source === "app") seen.add(r.id); }); localStorage.setItem("l997_wa_seen", JSON.stringify([...seen].slice(-200))); } catch (e) { /* ignore */ }
    const custOf = (id) => customers.find((c) => c.id === id) || { name: "—", phone: "" };
    const mine = (() => { try { return localStorage.getItem("l997_dlv_mine") === "1"; } catch (e) { return false; } })();
    const isMine = (drvId, drvName) => !mine || !me || drvId === me.id || (!drvId && drvName === me.name) || (!drvId && !drvName);
    const RANK = { onway: 0, collected: 1, new: 2 };
    const reqs = pickupRequests().filter((r) => isMine(r.driverId, r.driver)).sort((a, b) => (RANK[a.status] ?? 2) - (RANK[b.status] ?? 2) || String(a.date || "9").localeCompare(String(b.date || "9")) || (SLOT_ORDER[a.slot] ?? 9) - (SLOT_ORDER[b.slot] ?? 9) || String(a.createdAt).localeCompare(String(b.createdAt)));
    const dreqs = dropRequests();
    const dropOrders = orders.filter((o) => o.delivery && o.delivery.drop && o.status !== "cancelled");
    const toDeliver = dropOrders.filter((o) => o.status === "ready" && o.delivery.dropStatus !== "done" && isMine(o.delivery.driverId, o.delivery.driver)).sort((a, b) => (a.delivery.dropStatus === "onway" ? 0 : 1) - (b.delivery.dropStatus === "onway" ? 0 : 1) || String(a.delivery.date || "9").localeCompare(String(b.delivery.date || "9")) || (SLOT_ORDER[a.delivery.slot] ?? 9) - (SLOT_ORDER[b.delivery.slot] ?? 9));
    const working = dropOrders.filter((o) => !["ready", "delivered", "cancelled"].includes(o.status));
    const monthOrders = orders.filter((o) => o.status !== "cancelled" && monthOf(o.createdAt) === month);
    const legs = monthOrders.flatMap((o) => (o.extras || []).filter((l) => String(l.id).startsWith("dlv_")));
    const deliveredMonth = dropOrders.filter((o) => o.status === "delivered" && monthOf(o.deliveredAt) === month).length;
    // المواعيد الثابتة (أسبوعية) لباقات سارية — اليوم وبكرة، ما لم يُحجز لها موعد بنفس اليوم
    const regular = [];
    [0, 1].forEach((plus) => {
      const date = FIN.addDays(today, plus), wd = new Date(date + "T12:00:00").getDay();
      customerPackages.filter((cp) => cp.schedule && Number(cp.schedule.day) === wd && cp.remainingPieces > 0 && !pkgExpired(cp)).forEach((cp) => {
        const c = customers.find((x) => x.id === cp.customerId); if (!c) return;
        if (pickupRequests().some((r) => r.customerId === c.id && (r.date || today) === date)) return;
        if (orders.some((o) => o.customerId === c.id && o.delivery && o.delivery.pickup && FIN.localDay(o.createdAt) === date)) return;
        if (regular.some((x) => x.c.id === c.id && x.date === date)) return;
        regular.push({ c, cp, date });
      });
    });
    const onwayN = reqs.filter((r) => r.status === "onway").length + toDeliver.filter((o) => o.delivery.dropStatus === "onway").length;
    // 🧭 مشاوير اليوم: كل استلام/تسليم موعده اليوم أو متأخر أو بدون موعد — مرتبة حسب الوقت
    const due = (date) => !date || date <= today;
    const stops = [
      ...reqs.filter((r) => r.status !== "collected" && !r.needsConfirm && due(r.date)).map((r) => ({ type: "pickup", id: r.id, c: custOf(r.customerId), address: r.address, date: r.date, slot: r.slot, status: r.status, driver: r.driver, collect: 0 })),
      ...toDeliver.filter((o) => due(o.delivery.date)).map((o) => ({ type: "drop", id: o.id, no: o.number, c: custOf(o.customerId), address: o.delivery.address, date: o.delivery.date, slot: o.delivery.slot, status: o.delivery.dropStatus, driver: o.delivery.driver, collect: orderOwedNow(o), pcs: o.items.reduce((n, it) => n + it.qty, 0) })),
    ].sort((a, b) => (a.status === "onway" ? 0 : 1) - (b.status === "onway" ? 0 : 1) || String(a.date || "").localeCompare(String(b.date || "")) || (SLOT_ORDER[a.slot] ?? 9) - (SLOT_ORDER[b.slot] ?? 9));
    const route = routeUrl(stops.map((x) => x.address));
    const cashToCollect = round3(stops.reduce((a, x) => a + (x.collect || 0), 0));
    const kpi = (ic, lbl, v, color, note) => `<div class="metric-card"><div class="metric-top"><span>${lbl}</span><span class="metric-icon">${ic}</span></div><div class="metric-value" style="${color ? `color:${color}` : ""}">${v}</div>${note ? `<div class="metric-note">${note}</div>` : ""}</div>`;
    const icons = (phone, address, orderId, delId) => `<div class="dlv-icons">
        <a class="dlv-ic dlv-go" target="_blank" rel="noopener" href="${esc(navUrl(address))}" title="${DL("ابدأ الملاحة", "Navigate")}">🧭<small>${DL("اذهب", "Go")}</small></a>
        <a class="dlv-ic" target="_blank" rel="noopener" href="${esc(mapsUrl(address))}" title="${DL("الخريطة", "Map")}">📍<small>${DL("الخريطة", "Map")}</small></a>
        <button type="button" class="dlv-ic" data-dlv-call="${esc(phone)}">📞<small>${DL("اتصال", "Call")}</small></button>
        <button type="button" class="dlv-ic" data-dlv-wa="${esc(phone)}">💬<small>${DL("واتساب", "WhatsApp")}</small></button>
        ${orderId ? `<button type="button" class="dlv-ic" data-dlv-view="${orderId}">🧾<small>${DL("الطلب", "Order")}</small></button>` : ""}
        ${delId ? `<button type="button" class="dlv-ic danger" data-req-del="${delId}">✕<small>${DL("إلغاء", "Cancel")}</small></button>` : ""}</div>`;
    const steps = (n, labels) => `<div class="dlv-steps">${labels.map((l, i) => `<span class="${i < n ? "done" : i === n ? "now" : ""}">${i < n ? "✓" : `${i + 1}.`} ${l}</span>`).join("")}</div>`;
    const drvSel = (kind, id, cur) => `<label class="dlv-drv">🛵 ${DL("المندوب", "Driver")} <select data-drv="${kind}|${id}"><option value="">—</option>${drivers().map((e) => `<option value="${e.id}" ${e.id === cur ? "selected" : ""}>${esc(e.name)}</option>`).join("")}</select></label>`;
    const srcBadge = (r) => (r.source === "whatsapp" ? `<span class="dlv-src">📲 ${DL("واتساب", "WhatsApp")}</span>` : r.source === "app" ? `<span class="dlv-src dlv-app">📱 ${DL("التطبيق", "App")}</span>` : "");
    const tries = (x) => (x.attempts && x.attempts.length ? `<div class="dlv-line dlv-missed">⚠ ${DL(`محاولات لم تتم: ${x.attempts.length}`, `Missed attempts: ${x.attempts.length}`)} — ${esc(x.attempts[x.attempts.length - 1].reason || "")}</div>` : "");
    const reqCard = (r) => {
      const c = custOf(r.customerId), late = r.date && r.date < today, st = r.status || "new";
      const n = st === "onway" ? 1 : st === "collected" ? 2 : 0;
      return `<div class="dlv-card ${late ? "late" : ""} ${st !== "new" ? "moving" : ""}" data-card="${r.id}">
        <div class="dlv-card-top"><b>${esc(c.name)}</b>${srcBadge(r)}${pkgBadge(r.customerId)}</div>
        ${steps(n, [DL("موعد", "Booked"), DL("في الطريق", "On the way"), DL("مع المندوب", "With driver"), DL("وصلت المحل", "At the shop")])}
        <div class="dlv-line">📍 ${esc(r.address || "—")}</div>
        <div class="dlv-line">⏰ <b>${esc(whenLabel(r.date, r.slot))}</b>${late ? ` · <b style="color:var(--danger)">${DL("متأخر", "Late")}</b>` : ""} · ${r.drop !== false ? DL("📦 مع توصيل", "📦 with delivery back") : DL("🏪 يستلم من المحل", "🏪 collects at shop")}</div>
        ${r.notes ? `<div class="dlv-line section-note">📝 ${esc(r.notes)}</div>` : ""}
        ${st === "collected" ? `<div class="dlv-line">🛍 <b>${r.bags || "?"}</b> ${DL("أكياس", "bags")}${r.pcsEst ? ` · ~${r.pcsEst} ${DL("قطعة", "pcs")}` : ""} · ${esc(r.driver || "")} · ${fmtDT(r.collectedAt)}</div>` : ""}
        ${tries(r)}
        ${r.needsConfirm ? `<div class="dlv-wa">${r.source === "app" ? `📱 ${DL("طلب من تطبيق العملاء — بانتظار تأكيدك للعميل", "Request from the customer app — waiting for you to confirm")}` : `📲 ${DL("طلب من واتساب (المساعد الذكي) — بانتظار تأكيدك للعميل", "Request from WhatsApp (AI assistant) — waiting for you to confirm")}`}</div><button type="button" class="primary-btn dlv-main" data-req-confirm="${r.id}">✓ ${DL("تأكيد الموعد للعميل", "Confirm the pickup to the customer")}</button>`
          : st === "collected" ? `<button type="button" class="primary-btn dlv-main" data-req-done="${r.id}">🧺 ${DL("وصلت المحل ← أدخل القطع", "At the shop → add items")}</button>`
          : st === "onway" ? `<button type="button" class="primary-btn dlv-main" data-req-collected="${r.id}">🛍 ${DL("استلمت الملابس من العميل", "Collected from the customer")}</button>
              <div class="dlv-sub"><button type="button" class="mini-btn" data-req-done="${r.id}">🧺 ${DL("أدخل القطع الآن", "Add items now")}</button><button type="button" class="mini-btn danger-mini" data-req-miss="${r.id}">⚠ ${DL("ما حصلنا العميل", "Customer not reached")}</button></div>`
          : `<button type="button" class="primary-btn dlv-main" data-req-onway="${r.id}">🛵 ${DL("اذهب للاستلام — المندوب طالع الحين", "Go to pickup — driver leaving now")}</button>
              <div class="dlv-sub"><button type="button" class="mini-btn" data-req-edit="${r.id}">✎ ${DL("تعديل الموعد", "Change time")}</button><button type="button" class="mini-btn danger-mini" data-req-miss="${r.id}">⚠ ${DL("تأجيل / ما حصلناه", "Postpone / not reached")}</button></div>`}
        ${drvSel("req", r.id, r.driverId)}
        ${icons(c.phone, r.address, null, r.id)}</div>`;
    };
    const dreqCard = (r) => {
      const c = custOf(r.customerId), o = orders.find((x) => x.id === r.orderId) || orders.find((x) => r.orderNumber && String(x.number).replace(/^0+/, "") === String(r.orderNumber).replace(/^0+/, "") && x.customerId === r.customerId);
      return `<div class="dlv-card">
        <div class="dlv-card-top"><b>${esc(c.name)}</b>${o ? `<span class="dlv-no">#${esc(o.number)}</span>` : ""}${srcBadge(r)}</div>
        <div class="dlv-wa">${r.source === "app" ? "📱" : "📲"} ${DL("العميل طلب توصيل طلبه للبيت — بانتظار تأكيدك", "Customer asked for home delivery — waiting for you to confirm")}</div>
        <div class="dlv-line">📍 ${esc(r.address || "—")}</div>
        <div class="dlv-line">⏰ <b>${esc(whenLabel(r.date, r.slot))}</b>${o ? ` · <span class="status-badge status-${o.status}">${esc(statusLabel(o.status))}</span>` : ` · <b style="color:var(--danger)">${DL("لم يُحدد الطلب", "Order not identified")}</b>`}</div>
        ${r.notes ? `<div class="dlv-line section-note">📝 ${esc(r.notes)}</div>` : ""}
        ${o ? `<button type="button" class="primary-btn dlv-main" data-dreq-ok="${r.id}|${o.id}">✓ ${DL("تأكيد التوصيل للعميل", "Confirm delivery to the customer")}</button>` : ""}
        ${icons(c.phone, r.address, o ? o.id : null, r.id)}</div>`;
    };
    const dropCard = (o) => {
      const c = custOf(o.customerId), d = o.delivery, owe = orderOwedNow(o), onway = d.dropStatus === "onway";
      return `<div class="dlv-card ${onway ? "moving" : ""}" data-card="${o.id}">
        <div class="dlv-card-top"><b>${esc(c.name)}</b><span class="dlv-no">#${esc(o.number)}</span></div>
        ${steps(onway ? 1 : 0, [DL("جاهز", "Ready"), DL("في الطريق", "On the way"), DL("تم التسليم", "Delivered")])}
        <div class="dlv-line">📍 ${esc(d.address || "—")}</div>
        <div class="dlv-line">👕 ${o.items.reduce((n, it) => n + it.qty, 0)} ${DL("قطعة", "pcs")}${d.bags ? ` · 🛍 ${d.bags}` : ""} · ${owe > 0 ? `💰 ${DL("يُحصّل", "Collect")} <b>${money(owe)}</b>` : `✅ ${DL("مدفوع", "Paid")}`}${d.date || d.slot ? ` · ⏰ ${esc(whenLabel(d.date, d.slot))}` : ""}</div>
        ${onway ? `<div class="dlv-line section-note">🛵 ${esc(d.driver || "")} · ${fmtDT(d.onwayAt)}</div>` : ""}
        ${tries(d)}
        ${onway ? `<button type="button" class="primary-btn dlv-main" data-drop-done="${o.id}">✓ ${DL("تم التوصيل — تسليم الطلب", "Delivered — hand over")}${owe > 0 ? ` · ${money(owe)}` : ""}</button>
            <div class="dlv-sub"><button type="button" class="mini-btn danger-mini" data-drop-miss="${o.id}">⚠ ${DL("ما حصلنا العميل", "Customer not reached")}</button></div>`
          : `<button type="button" class="primary-btn dlv-main" data-drop-onway="${o.id}">🛵 ${DL("اذهب للتسليم — خرج للتوصيل", "Go to deliver — out for delivery")}</button>
            <div class="dlv-sub"><button type="button" class="mini-btn" data-drop-edit="${o.id}">✎ ${DL("تعديل الموعد/العنوان", "Change time/address")}</button></div>`}
        ${drvSel("drop", o.id, d.driverId)}
        ${icons(c.phone, d.address, o.id, null)}</div>`;
    };
    const stopRow = (x, i) => `<div class="dlv-stop ${x.status === "onway" ? "moving" : ""}">
        <span class="dlv-stop-n">${i + 1}</span>
        <div class="dlv-stop-info"><b>${x.type === "pickup" ? `📥 ${DL("استلام", "Pickup")}` : `📦 ${DL("تسليم", "Deliver")} #${esc(x.no)}`} · ${esc(x.c.name)}</b>
          <span>⏰ ${esc(whenLabel(x.date, x.slot))}${x.date && x.date < today ? ` · <b style="color:var(--danger)">${DL("متأخر", "Late")}</b>` : ""}${x.status === "onway" ? ` · 🛵 ${DL("في الطريق", "on the way")}` : ""}${x.collect > 0 ? ` · 💰 ${money(x.collect)}` : ""}${x.pcs ? ` · 👕 ${x.pcs}` : ""}</span>
          <span class="section-note">📍 ${esc(x.address || "—")}</span></div>
        <div class="dlv-stop-act"><a class="primary-btn" target="_blank" rel="noopener" href="${esc(navUrl(x.address))}">🧭 ${DL("اذهب", "Go")}</a><button type="button" class="mini-btn" data-dlv-call="${esc(x.c.phone)}">📞</button><button type="button" class="mini-btn" data-jump="${x.id}">›</button></div></div>`;
    // أداء المندوبين هذا الشهر
    const perf = {};
    const bump = (name, k) => { if (!name) return; perf[name] = perf[name] || { p: 0, d: 0, m: 0 }; perf[name][k]++; };
    orders.filter((o) => o.delivery && o.status !== "cancelled").forEach((o) => {
      if (o.delivery.pickup && o.delivery.pickupDriver && monthOf(o.delivery.pickupAt || o.createdAt) === month) bump(o.delivery.pickupDriver, "p");
      if (o.status === "delivered" && o.delivery.drop && o.delivery.driver && monthOf(o.deliveredAt) === month) bump(o.delivery.driver, "d");
      (o.delivery.attempts || []).forEach((a) => { if (monthOf(a.at) === month) bump(a.by, "m"); });
    });
    pickupRequests().forEach((r) => (r.attempts || []).forEach((a) => { if (monthOf(a.at) === month) bump(a.by, "m"); }));
    const col = (title, sub, n, body, empty) => `<div class="panel dlv-col"><div class="dlv-col-head"><h3>${title}${n ? ` <span class="nav-count">${n}</span>` : ""}</h3><p>${sub}</p></div><div class="dlv-list">${body || `<div class="empty-state compact">${empty}</div>`}</div></div>`;
    root.innerHTML = `
      ${cfg.on ? "" : `<div class="panel" style="border-color:var(--warning)"><b>⚠ ${DL("خدمة التوصيل متوقفة", "Delivery service is off")}</b> — ${DL("فعّلها من الإعدادات ← إعدادات التشغيل", "turn it on in Settings → Operating settings")}.</div>`}
      <div class="dlv-hero panel">
        <div class="dlv-hero-txt"><h3>${DL("الاستلام من البيت والتوصيل", "Home pickup & delivery")}</h3>
          <div class="dlv-policy"><span>🎟 ${DL(`عملاء الباقات: <b>${cfg.pkgFree}</b> مشاوير مجانية كل شهر${cfg.pkgFee > 0 ? ` ثم ${money(cfg.pkgFee)}` : ""}`, `Package customers: <b>${cfg.pkgFree}</b> free trips a month${cfg.pkgFee > 0 ? `, then ${money(cfg.pkgFee)}` : ""}`)}</span>
          <span>👤 ${DL(`بدون باقة: <b>${money(cfg.fee)}</b> للمشوار`, `No package: <b>${money(cfg.fee)}</b> per trip`)}</span>${cfg.freeOver > 0 ? `<span>🎁 ${DL(`مجاني للطلب من ${money(cfg.freeOver)}`, `Free for orders from ${money(cfg.freeOver)}`)}</span>` : ""}</div></div>
        <div class="dlv-hero-act"><button class="primary-btn dlv-book" id="newPickupBtn">＋ ${DL("حجز استلام من البيت", "Book a home pickup")}</button>
          <label class="dlv-mine"><input type="checkbox" id="dlvMine" ${mine ? "checked" : ""} /> 🛵 ${DL("مشاويري فقط", "My trips only")}</label></div>
      </div>
      <div class="dlv-how">${[DL("احجز الموعد", "Book"), DL("اذهب للاستلام", "Go to pickup"), DL("أدخل القطع بالمحل", "Add items at shop"), DL("جاهز ← اذهب للتسليم", "Ready → go deliver")].map((x, i) => `<span><b>${i + 1}</b>${x}</span>`).join("<i>›</i>")}</div>
      <div class="metrics-grid metrics-grid-compact dlv-kpis">
        ${kpi("📥", DL("للاستلام", "To collect"), reqs.length, reqs.length ? "var(--primary)" : "")}
        ${kpi("📦", DL("للتوصيل", "To deliver"), toDeliver.length + dreqs.length, toDeliver.length ? "var(--warning)" : "")}
        ${kpi("🛵", DL("في الطريق الآن", "On the way now"), onwayN)}
        ${kpi("📅", DL("وُصّلت هذا الشهر", "Delivered this month"), deliveredMonth, "var(--success)", `${DL("إيراد", "Income")} ${money(legs.reduce((a, l) => a + (Number(l.total) || 0), 0))} · ${legs.filter((l) => l.free).length} ${DL("مشوار مجاني", "free trips")}`)}
      </div>
      <div class="panel dlv-route">
        <div class="dlv-col-head dlv-route-head"><div><h3>🧭 ${DL("مشاوير اليوم", "Today's trips")}${stops.length ? ` <span class="nav-count">${stops.length}</span>` : ""}</h3>
          <p>${stops.length ? DL(`${stops.filter((x) => x.type === "pickup").length} استلام · ${stops.filter((x) => x.type === "drop").length} تسليم${cashToCollect > 0 ? ` · 💰 يُحصّل ${money(cashToCollect)}` : ""}`, `${stops.filter((x) => x.type === "pickup").length} pickups · ${stops.filter((x) => x.type === "drop").length} deliveries${cashToCollect > 0 ? ` · 💰 collect ${money(cashToCollect)}` : ""}`) : DL("لا مشاوير مستحقة اليوم", "No trips due today")}</p></div>
          <div class="row-actions">${route ? `<a class="primary-btn" id="dlvRouteBtn" target="_blank" rel="noopener" href="${esc(route)}">🗺 ${DL("المسار كاملاً في خرائط قوقل", "Full route in Google Maps")}</a>` : ""}${stops.length ? `<button type="button" class="secondary-btn" id="dlvPrintBtn">🖨 ${DL("كشف المشاوير", "Trip sheet")}</button>` : ""}</div></div>
        ${stops.length ? `<div class="dlv-stops">${stops.map(stopRow).join("")}</div>` : ""}
      </div>
      ${regular.length ? `<div class="panel dlv-regular"><div class="dlv-col-head"><h3>📅 ${DL("المواعيد الثابتة لعملاء الباقات", "Regular package pickups")} <span class="nav-count">${regular.length}</span></h3><p>${DL("عملاء لهم موعد استلام أسبوعي اليوم أو بكرة — احجز بضغطة", "Customers with a weekly pickup today or tomorrow — book with one tap")}</p></div>
        <div class="dlv-list dlv-list-row">${regular.map((x) => `<div class="dlv-card"><div class="dlv-card-top"><b>${esc(x.c.name)}</b>${pkgBadge(x.c.id)}</div>
          <div class="dlv-line">⏰ <b>${esc(whenLabel(x.date, x.cp.schedule.slot))}</b> · ${esc(x.cp.name)}</div><div class="dlv-line">📍 ${esc([x.c.area, x.c.address].filter(Boolean).join(" — ") || "—")}</div>
          <button type="button" class="primary-btn dlv-main" data-reg-book="${x.cp.id}|${x.date}">📥 ${DL("احجز الموعد", "Book this pickup")}</button></div>`).join("")}</div></div>` : ""}
      <div class="dlv-board">
        ${col(`📥 ${DL("للاستلام من البيوت", "Pickups to collect")}`, DL("اذهب للاستلام ← استلمت الملابس ← أدخل القطع بالمحل", "Go to pickup → collected → add items at the shop"), reqs.length, reqs.map(reqCard).join(""), DL("لا توجد مواعيد — اضغط «حجز استلام من البيت»", "No bookings — press “Book a home pickup”"))}
        ${col(`📦 ${DL("للتوصيل للبيوت", "Orders to deliver")}`, DL("الطلبات الجاهزة التي يريد أصحابها التوصيل", "Ready orders the customer wants delivered"), toDeliver.length + dreqs.length, dreqs.map(dreqCard).join("") + toDeliver.map(dropCard).join(""), DL("لا توجد طلبات جاهزة للتوصيل", "No ready orders to deliver"))}
      </div>
      ${working.length ? `<details class="panel dlv-working"><summary>⏳ ${DL(`طلبات توصيل قيد التنظيف (${working.length}) — تنتقل للتوصيل تلقائياً عندما تجهز`, `Delivery orders being cleaned (${working.length}) — move to “to deliver” automatically when ready`)}</summary>
        <div class="dlv-rows">${working.map((o) => `<button type="button" class="dlv-row" data-dlv-view="${o.id}"><b>#${esc(o.number)}</b><span>${esc(custOf(o.customerId).name)}</span><span class="status-badge status-${o.status}">${esc(statusLabel(o.status))}</span><span class="section-note">${esc(o.delivery.address || "")}</span></button>`).join("")}</div></details>` : ""}
      ${Object.keys(perf).length ? `<details class="panel dlv-working"><summary>🏁 ${DL("أداء المندوبين هذا الشهر", "Drivers this month")}</summary>
        <table class="data-table"><thead><tr><th>${DL("المندوب", "Driver")}</th><th>📥 ${DL("استلام", "Pickups")}</th><th>📦 ${DL("تسليم", "Deliveries")}</th><th>⚠ ${DL("لم تتم", "Missed")}</th></tr></thead>
        <tbody>${Object.entries(perf).map(([n, v]) => `<tr><td>${esc(n)}</td><td>${v.p}</td><td>${v.d}</td><td>${v.m}</td></tr>`).join("")}</tbody></table></details>` : ""}`;
    const q = (sel) => root.querySelectorAll(sel);
    const saveReqs = () => { save("l997_suspended_orders", suspendedOrders); persistAll(); };
    const sendWa = async (phone, msg) => {
      let sent = false;
      if (cloudOn() && CLOUD.waBot) { const res = await CLOUD.waBot({ action: "reply", to: cleanPhone(phone), text: msg, keepBot: true }).catch(() => null); sent = !!(res && res.ok); }
      if (!sent && phone) openWhatsApp(phone, msg);
      return sent;
    };
    root.querySelector("#newPickupBtn").onclick = () => openPickupForm(null);
    root.querySelector("#dlvMine").onchange = (e) => { try { localStorage.setItem("l997_dlv_mine", e.target.checked ? "1" : "0"); } catch (x) { /* ignore */ } renderDeliveryPage(); };
    root.querySelector("#dlvPrintBtn")?.addEventListener("click", () => printTripSheet(stops));
    q("[data-jump]").forEach((b) => (b.onclick = () => { const el = root.querySelector(`[data-card="${b.dataset.jump}"]`); if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1200); } }));
    q("[data-dlv-call]").forEach((b) => (b.onclick = () => { if (b.dataset.dlvCall) window.location.href = `tel:+${cleanPhone(b.dataset.dlvCall)}`; }));
    q("[data-dlv-wa]").forEach((b) => (b.onclick = () => { if (b.dataset.dlvWa) openWhatsApp(b.dataset.dlvWa, ""); }));
    q("[data-dlv-view]").forEach((b) => (b.onclick = () => openOrderDialog(b.dataset.dlvView)));
    q("[data-drv]").forEach((sel) => (sel.onchange = () => {
      const [kind, id] = sel.dataset.drv.split("|"), e = drivers().find((x) => x.id === sel.value);
      const tgt = kind === "req" ? suspendedOrders.find((x) => x.id === id) : (orders.find((x) => x.id === id) || {}).delivery;
      if (!tgt) return;
      tgt.driverId = e ? e.id : ""; tgt.driver = e ? e.name : "";
      saveReqs(); logActivity(`🛵 تعيين المندوب ${tgt.driver || "—"} — ${kind === "req" ? `استلام ${tgt.customerName || ""}` : `توصيل الطلب #${(orders.find((x) => x.id === id) || {}).number}`}`);
      toast(DL("✓ تم تعيين المندوب", "✓ Driver assigned"));
    }));
    q("[data-req-onway]").forEach((b) => (b.onclick = () => {
      const r = suspendedOrders.find((x) => x.id === b.dataset.reqOnway); if (!r) return;
      r.status = "onway"; r.onwayAt = new Date().toISOString(); if (!r.driverId && me) { r.driver = me.name; r.driverId = me.id; }
      saveReqs(); logActivity(`🛵 المندوب ${r.driver || ""} في الطريق لاستلام ملابس ${r.customerName}`);
      const c = custOf(r.customerId);
      if (c.phone) openWhatsApp(c.phone, waMsg("pickup_onway", { name: c.name, address: r.address }));
      window.open(navUrl(r.address), "_blank", "noopener");
      renderDeliveryPage();
    }));
    q("[data-req-collected]").forEach((b) => (b.onclick = () => {
      const r = suspendedOrders.find((x) => x.id === b.dataset.reqCollected); if (!r) return;
      openQuickForm({
        title: DL(`🛍 استلام ملابس ${r.customerName}`, `🛍 Collected from ${r.customerName}`), sub: DL("سجّل ما استلمته — تُدخل القطع بالتفصيل عند الوصول للمحل", "Record what you collected — the items are entered at the shop"),
        fields: [{ id: "bags", label: DL("عدد الأكياس", "Bags"), type: "number", step: "1", min: 1, value: 1 }, { id: "pcs", label: DL("عدد القطع التقريبي (اختياري)", "Approx. pieces (optional)"), type: "number", step: "1", min: 0, value: "" }, { id: "note", label: DL("ملاحظة (اختياري)", "Note (optional)"), type: "text", value: "" }],
        submitLabel: DL("✓ تم الاستلام", "✓ Collected"),
        onSubmit: (v) => {
          r.status = "collected"; r.collectedAt = new Date().toISOString(); r.bags = Math.max(1, Math.floor(Number(v.bags) || 1)); r.pcsEst = Number(v.pcs) > 0 ? Math.floor(v.pcs) : undefined;
          if (v.note) r.notes = [r.notes, v.note].filter(Boolean).join(" · ");
          if (!r.driverId && me) { r.driver = me.name; r.driverId = me.id; }
          saveReqs(); logActivity(`🛍 استلم ${r.driver || ""} ملابس ${r.customerName} — ${r.bags} أكياس${r.pcsEst ? ` (~${r.pcsEst} قطعة)` : ""}`);
          renderDeliveryPage(); toast(DL("✓ سُجّل الاستلام — أدخل القطع عند الوصول للمحل", "✓ Collected — add the items at the shop"));
        },
      });
    }));
    q("[data-req-done]").forEach((b) => (b.onclick = () => convertPickup(b.dataset.reqDone)));
    q("[data-req-confirm]").forEach((b) => (b.onclick = async () => {
      const r = suspendedOrders.find((x) => x.id === b.dataset.reqConfirm); if (!r) return;
      const c = custOf(r.customerId), fee = tripFeeText(r.customerId);
      const sent = await sendWa(c.phone, waMsg("pickup_booked", { name: c.name, when: whenLabel(r.date, r.slot), address: r.address, fee }));
      r.needsConfirm = false; r.confirmedAt = new Date().toISOString(); r.confirmedBy = me ? me.name : "";
      saveReqs();
      logActivity(`✓ تأكيد موعد استلام (من واتساب) — ${r.customerName} — ${whenLabel(r.date, r.slot)}`);
      toast(sent ? DL("✓ تأكد الموعد وأُرسل للعميل على واتساب", "✓ Confirmed and sent to the customer on WhatsApp") : DL("✓ تأكد الموعد — أرسل الرسالة من واتساب", "✓ Confirmed — send the message in WhatsApp"));
      renderDeliveryPage();
    }));
    // ✎ تعديل موعد الاستلام / التسليم
    const editWhen = (title, cur, onSave) => {
      const days = [0, 1, 2, 3, 4, 5, 6].map((n) => { const d = FIN.addDays(today, n); return { value: d, label: dayLabel(d) }; });
      if (cur.date && !days.some((d) => d.value === cur.date)) days.unshift({ value: cur.date, label: dayLabel(cur.date) });
      openQuickForm({ title, sub: "", fields: [
        { id: "date", label: DL("📅 اليوم", "📅 Day"), type: "select", value: cur.date || today, options: days },
        { id: "slot", label: DL("⏰ الوقت", "⏰ Time"), type: "select", value: cur.slot || nowSlot(), options: DLV_SLOTS.map((x) => ({ value: x.v, label: lang === "ar" ? x.ar : x.en })) },
        { id: "address", label: DL("📍 العنوان أو رابط الموقع", "📍 Address or location link"), type: "text", value: cur.address || "" },
        { id: "notify", label: DL("إبلاغ العميل على واتساب", "Tell the customer on WhatsApp"), type: "select", value: "yes", options: [{ value: "yes", label: DL("نعم", "Yes") }, { value: "no", label: DL("لا", "No") }] },
      ], submitLabel: DL("حفظ", "Save"), onSubmit: (v) => onSave(v) });
    };
    q("[data-req-edit]").forEach((b) => (b.onclick = () => {
      const r = suspendedOrders.find((x) => x.id === b.dataset.reqEdit); if (!r) return;
      editWhen(DL(`✎ موعد استلام ${r.customerName}`, `✎ ${r.customerName}'s pickup`), r, (v) => {
        Object.assign(r, { date: v.date, slot: v.slot, address: v.address || r.address });
        saveReqs(); logActivity(`✎ تعديل موعد استلام ${r.customerName} — ${whenLabel(r.date, r.slot)}`);
        const c = custOf(r.customerId);
        if (v.notify === "yes" && c.phone) sendWa(c.phone, waMsg("pickup_booked", { name: c.name, when: whenLabel(r.date, r.slot), address: r.address, fee: tripFeeText(r.customerId) }));
        renderDeliveryPage();
      });
    }));
    q("[data-drop-edit]").forEach((b) => (b.onclick = () => {
      const o = orders.find((x) => x.id === b.dataset.dropEdit); if (!o) return;
      editWhen(DL(`✎ توصيل الطلب #${o.number}`, `✎ Deliver order #${o.number}`), o.delivery, (v) => {
        Object.assign(o.delivery, { date: v.date, slot: v.slot, address: v.address || o.delivery.address });
        persistAll(); logActivity(`✎ تعديل موعد توصيل الطلب #${o.number} — ${whenLabel(v.date, v.slot)}`);
        const c = custOf(o.customerId);
        if (v.notify === "yes" && c.phone) sendWa(c.phone, waMsg("drop_booked", { name: c.name, number: o.number, when: whenLabel(v.date, v.slot), address: o.delivery.address }));
        renderDeliveryPage();
      });
    }));
    // ⚠ ما حصلنا العميل: تُسجَّل المحاولة وسببها، ويُعاد الموعد ليوم/وقت جديد مع رسالة للعميل
    const missed = (title, onSave) => {
      const days = [0, 1, 2, 3, 4].map((n) => { const d = FIN.addDays(today, n); return { value: d, label: dayLabel(d) }; });
      openQuickForm({ title, sub: DL("تُسجَّل المحاولة ويُنقل الموعد للوقت الجديد", "The attempt is recorded and the visit moves to the new time"), fields: [
        { id: "reason", label: DL("السبب", "Reason"), type: "select", value: "noanswer", options: [{ value: "noanswer", label: DL("العميل ما رد على الاتصال", "Customer didn't answer") }, { value: "away", label: DL("العميل مو موجود بالبيت", "Customer not at home") }, { value: "asked", label: DL("العميل طلب التأجيل", "Customer asked to postpone") }, { value: "address", label: DL("العنوان غير واضح/خطأ", "Unclear / wrong address") }] },
        { id: "date", label: DL("📅 الموعد الجديد", "📅 New day"), type: "select", value: FIN.addDays(today, 1), options: days },
        { id: "slot", label: DL("⏰ الوقت", "⏰ Time"), type: "select", value: nowSlot(), options: DLV_SLOTS.map((x) => ({ value: x.v, label: lang === "ar" ? x.ar : x.en })) },
        { id: "notify", label: DL("إبلاغ العميل على واتساب", "Tell the customer on WhatsApp"), type: "select", value: "yes", options: [{ value: "yes", label: DL("نعم", "Yes") }, { value: "no", label: DL("لا", "No") }] },
      ], submitLabel: DL("حفظ وإعادة الجدولة", "Save & reschedule"), onSubmit: (v) => onSave(v, { noanswer: DL("ما رد على الاتصال", "no answer"), away: DL("مو موجود", "not at home"), asked: DL("طلب التأجيل", "asked to postpone"), address: DL("العنوان غير واضح", "unclear address") }[v.reason]) });
    };
    q("[data-req-miss]").forEach((b) => (b.onclick = () => {
      const r = suspendedOrders.find((x) => x.id === b.dataset.reqMiss); if (!r) return;
      missed(DL(`⚠ استلام ${r.customerName}`, `⚠ ${r.customerName}'s pickup`), (v, why) => {
        r.attempts = [...(r.attempts || []), { at: new Date().toISOString(), by: me ? me.name : "", reason: why, from: whenLabel(r.date, r.slot) }];
        Object.assign(r, { status: "new", date: v.date, slot: v.slot });
        saveReqs(); logActivity(`⚠ لم يتم استلام ملابس ${r.customerName} (${why}) — الموعد الجديد ${whenLabel(v.date, v.slot)}`);
        const c = custOf(r.customerId);
        if (v.notify === "yes" && c.phone) sendWa(c.phone, waMsg("dlv_missed", { name: c.name, kind: "pickup", when: whenLabel(v.date, v.slot) }));
        renderDeliveryPage();
      });
    }));
    q("[data-drop-miss]").forEach((b) => (b.onclick = () => {
      const o = orders.find((x) => x.id === b.dataset.dropMiss); if (!o) return;
      missed(DL(`⚠ توصيل الطلب #${o.number}`, `⚠ Delivery of #${o.number}`), (v, why) => {
        o.delivery.attempts = [...(o.delivery.attempts || []), { at: new Date().toISOString(), by: me ? me.name : "", reason: why, from: whenLabel(o.delivery.date, o.delivery.slot) }];
        Object.assign(o.delivery, { dropStatus: "pending", date: v.date, slot: v.slot });
        persistAll(); logActivity(`⚠ لم يتم توصيل الطلب #${o.number} (${why}) — الموعد الجديد ${whenLabel(v.date, v.slot)}`);
        const c = custOf(o.customerId);
        if (v.notify === "yes" && c.phone) sendWa(c.phone, waMsg("dlv_missed", { name: c.name, kind: "drop", number: o.number, when: whenLabel(v.date, v.slot) }));
        renderDeliveryPage(); updateDeliveryBadge();
      });
    }));
    // 📲 طلب توصيل من واتساب ← يُثبَّت على الطلب نفسه ويُبلَّغ العميل
    q("[data-dreq-ok]").forEach((b) => (b.onclick = async () => {
      const [rid, oid] = b.dataset.dreqOk.split("|"), r = suspendedOrders.find((x) => x.id === rid), o = orders.find((x) => x.id === oid); if (!r || !o) return;
      o.delivery = { ...(o.delivery || { pickup: false }), drop: true, address: r.address || (o.delivery || {}).address || "", date: r.date || "", slot: r.slot || "", dropStatus: (o.delivery && o.delivery.dropStatus === "onway") ? "onway" : "pending", source: "whatsapp" };
      suspendedOrders = suspendedOrders.filter((x) => x.id !== rid);
      saveReqs(); logActivity(`✓ تأكيد توصيل الطلب #${o.number} (طلب من واتساب) — ${whenLabel(r.date, r.slot)} — ${r.address}`);
      const c = custOf(o.customerId);
      const sent = await sendWa(c.phone, waMsg("drop_booked", { name: c.name, number: o.number, when: whenLabel(r.date, r.slot), address: o.delivery.address }));
      toast(sent ? DL("✓ تأكد التوصيل وأُرسل للعميل", "✓ Delivery confirmed and sent to the customer") : DL("✓ تأكد التوصيل", "✓ Delivery confirmed"));
      renderDeliveryPage(); updateDeliveryBadge();
    }));
    q("[data-reg-book]").forEach((b) => (b.onclick = () => {
      const [cpId, date] = b.dataset.regBook.split("|"), cp = customerPackages.find((x) => x.id === cpId); if (!cp) return;
      const c = customers.find((x) => x.id === cp.customerId); if (!c) return;
      const address = [c.area, c.address].filter(Boolean).join(" — ");
      if (!address) { openPickupForm(c.id); return; }
      const now = new Date().toISOString();
      suspendedOrders.unshift({ id: uid(), kind: "pickup", customerId: c.id, customerName: c.name, address, date, slot: cp.schedule.slot, drop: true, notes: "", status: "new", regular: true, items: [], extras: [], createdAt: now, suspendedAt: now, createdBy: me ? me.name : "" });
      save("l997_suspended_orders", suspendedOrders);
      logActivity(`🚚 حجز موعد ثابت — ${c.name} — ${whenLabel(date, cp.schedule.slot)}`);
      const fee = tripFeeText(c.id);
      waPrompt(DL("✓ تم حجز الموعد الثابت", "✓ Regular pickup booked"), DL(`${c.name} — ${whenLabel(date, cp.schedule.slot)}. ترسل التذكير للعميل؟`, `${c.name} — ${whenLabel(date, cp.schedule.slot)}. Send the reminder to the customer?`), DL("📲 إرسال على واتساب", "📲 Send on WhatsApp"), () => {
        openWhatsApp(c.phone, waMsg("pickup_booked", { name: c.name, when: whenLabel(date, cp.schedule.slot), address, fee }));
      });
      renderDeliveryPage(); updateDeliveryBadge();
    }));
    q("[data-req-del]").forEach((b) => (b.onclick = () => {
      const r = suspendedOrders.find((x) => x.id === b.dataset.reqDel); if (!r) return;
      confirmAction(DL(`إلغاء ${r.kind === "dropreq" ? "طلب توصيل" : "موعد استلام"} ${r.customerName}؟`, `Cancel ${r.customerName}'s ${r.kind === "dropreq" ? "delivery request" : "pickup booking"}?`), () => {
        suspendedOrders = suspendedOrders.filter((x) => x.id !== r.id); save("l997_suspended_orders", suspendedOrders);
        logActivity(`إلغاء ${r.kind === "dropreq" ? "طلب توصيل" : "موعد استلام من البيت"} — ${r.customerName}`); renderDeliveryPage(); updateDeliveryBadge();
      });
    }));
    q("[data-drop-onway]").forEach((b) => (b.onclick = () => {
      const o = orders.find((x) => x.id === b.dataset.dropOnway); if (!o) return;
      o.delivery.dropStatus = "onway"; o.delivery.onwayAt = new Date().toISOString(); if (!o.delivery.driverId && me) { o.delivery.driver = me.name; o.delivery.driverId = me.id; }
      persistAll(); logActivity(`🛵 الطلب #${o.number} خرج للتوصيل مع ${o.delivery.driver}`);
      const c = custOf(o.customerId), owe = orderOwedNow(o);
      if (c.phone) openWhatsApp(c.phone, waMsg("drop_onway", { name: c.name, number: o.number, pieces: o.items.reduce((n, it) => n + it.qty, 0), due: owe, dueTxt: money(owe) }));
      window.open(navUrl(o.delivery.address), "_blank", "noopener");
      renderDeliveryPage(); updateDeliveryBadge();
    }));
    q("[data-drop-done]").forEach((b) => (b.onclick = () => { openOrderDialog(b.dataset.dropDone); setTimeout(() => document.getElementById("advanceStatusBtn")?.click(), 150); }));
    updateDeliveryBadge();
  }
  // 🖨 كشف مشاوير اليوم للمندوب (ورقة واحدة: الترتيب، العميل، الجوال، العنوان، الوقت، المبلغ المطلوب تحصيله)
  function printTripSheet(stops) {
    const shop = loadProfile().nameAr || "مغسلة 997";
    const rows = stops.map((x, i) => `<tr><td>${i + 1}</td><td>${x.type === "pickup" ? "📥 استلام" : `📦 تسليم #${esc(x.no)}`}</td><td><b>${esc(x.c.name)}</b><br><span dir="ltr">${esc(fmtPhone(x.c.phone))}</span></td><td>${esc(x.address || "—")}</td><td>${esc(whenLabel(x.date, x.slot))}</td><td>${x.collect > 0 ? money(x.collect) : "—"}</td><td></td></tr>`).join("");
    const total = round3(stops.reduce((a, x) => a + (x.collect || 0), 0));
    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>كشف المشاوير</title><style>body{font-family:Tahoma,Arial,sans-serif;padding:14px;color:#111}h2{margin:0 0 4px}table{width:100%;border-collapse:collapse;margin-top:10px;font-size:12px}th,td{border:1px solid #999;padding:6px;vertical-align:top;text-align:right}th{background:#eee}td:last-child{width:70px}</style></head><body>
      <h2>🧭 ${esc(shop)} — كشف مشاوير ${esc(dayLabel(todayStr()))} ${todayStr()}</h2><div>المندوب: ${esc(me ? me.name : "")} · ${stops.length} مشوار · يُحصّل: ${money(total)}</div>
      <table><thead><tr><th>#</th><th>النوع</th><th>العميل</th><th>العنوان</th><th>الوقت</th><th>يُحصّل</th><th>توقيع/ملاحظة</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
    const fr = document.createElement("iframe"); fr.style.cssText = "position:fixed;width:0;height:0;border:0;left:-9999px"; document.body.appendChild(fr);
    fr.contentDocument.open(); fr.contentDocument.write(html); fr.contentDocument.close();
    setTimeout(() => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { /* ignore */ } setTimeout(() => fr.remove(), 1500); }, 250);
    logActivity(`🖨 طباعة كشف المشاوير — ${stops.length} مشوار`);
  }
  window.renderDeliveryPage997 = renderDeliveryPage;
  window.waErrHint997 = (r) => waErrHint(r);

  /* ============================= ⭐ الولاء والحملات =============================
     • شرائح العملاء تُحسب تلقائياً من السجلات (عليهم متبقي، متأخرون، ملتزمون، مميزون، منقطعون، جدد، باقات، نقاط)
     • اختيار الكل أو بعضهم ← رسالة واتساب جاهزة لكل عميل باسمه وأرقامه: تذكير بالمتبقي، شكر، خصم خاص بكود شخصي،
       رصيد النقاط، «اشتقنا لك»، أو رسالة مخصصة — إرسال تلقائي عبر واتساب API إن أمكن، وإلا بضغطة لكل عميل
     • تحديث فوري بزر، وتحديث دوري تلقائي كل دقيقة والصفحة مفتوحة
     • بطاقة الولاء: نقاط تُكتسب تلقائياً على المبلغ المدفوع وتُستبدل رصيداً — تظهر في ملف العميل وفي تطبيق العملاء */
  let loyStats = null, loyStatsAt = 0, loySeg = "all", loyQ = "", loyTimer = null;
  const loySel = new Set();
  const LCFG = () => FIN.loyaltyCfg(settings);
  function loyCompute(force) {
    if (force || !loyStats || Date.now() - loyStatsAt > 30e3) { loyStats = FIN.customerStats(customers, orders, ledger, customerPackages, settings, todayStr()); loyStatsAt = Date.now(); }
    return loyStats;
  }
  const statsOf = (id) => loyCompute()[id] || null;
  const TIER_ICON = { bronze: "🥉", silver: "🥈", gold: "🥇", platinum: "💎" };
  const tierLabel = (st) => (st ? `${TIER_ICON[st.tier] || "⭐"} ${lang === "ar" ? st.tierName.ar : st.tierName.en || st.tierName.ar}` : "");
  const commitLabel = (st) => (st ? { excellent: DL("ممتاز", "Excellent"), good: DL("جيد", "Good"), late: DL("متأخر", "Late") }[st.commitmentLabel] : "");
  const commitColor = (st) => (st && st.commitmentLabel === "late" ? "var(--danger)" : st && st.commitmentLabel === "good" ? "var(--warning)" : "var(--success)");
  const fmtPts = (n) => Number(n || 0).toLocaleString("en-US");
  const daysAgo = (iso) => (iso ? Math.round((new Date(todayStr() + "T12:00:00Z") - new Date(FIN.localDay(iso) + "T12:00:00Z")) / 86400000) : null);
  function loySegments() {
    const cfg = LCFG();
    return [
      { id: "all", ar: "كل العملاء", en: "All customers", f: () => true },
      { id: "owes", ar: "💳 عليهم متبقي", en: "💳 Owe money", f: (s) => s.owed > 0 },
      { id: "late", ar: "⏰ متأخرون بالدفع", en: "⏰ Late payers", f: (s) => s.owed > 0 && s.overdueDays > cfg.lateDays },
      { id: "committed", ar: "💙 ملتزمون بالدفع", en: "💙 Pay on time", f: (s) => s.sales >= 2 && s.commitment >= 85 && s.owed <= 0 },
      { id: "vip", ar: "🥇 المميزون", en: "🥇 VIP", f: (s) => s.tierIndex >= 2 },
      { id: "frequent", ar: "🔥 الأكثر طلباً", en: "🔥 Most frequent", f: (s) => s.orders30 >= 3 },
      { id: "inactive", ar: "👋 انقطعوا 30+ يوم", en: "👋 Inactive 30+ days", f: (s) => s.orders > 0 && s.daysSinceLast > 30 },
      { id: "new", ar: "🆕 جدد", en: "🆕 New", f: (s) => !!s.since && s.orders > 0 && daysAgo(s.since) <= 30 },
      { id: "package", ar: "🎟 عملاء الباقات", en: "🎟 Package customers", f: (s) => s.activePackages > 0 },
      { id: "points", ar: "⭐ نقاطهم تكفي للاستبدال", en: "⭐ Can redeem points", f: (s) => s.points >= cfg.redeemPoints },
    ];
  }
  // نص الرسالة لكل عميل — بلهجة بحرينية ودودة، بأرقامه هو
  function campaignText(kind, c, st, opt) {
    const en = lang === "en", n = c.name || "", cfg = LCFG(), SIG = en ? SIGN.en : SIGN.ar;
    const pts = `${fmtPts(st.points)} ${en ? "points" : "نقطة"}${st.pointsValue > 0 ? ` (${en ? "worth" : "تساوي"} ${money(st.pointsValue)})` : ""}`;
    if (kind === "due") return waMsg("due", dueReminderData(c).data);
    if (kind === "thanks") return en
      ? `Hi ${n} 💙\nA big thank-you from all of us at 997 Laundry for your trust and for always settling on time 🙏\n🧺 Your orders with us: ${st.orders}\n${tierLabel(st)} member · ⭐ ${pts}\n\nIt's a pleasure to serve you — always at your service 🌷\n${SIG}`
      : `هلا والله ${n} 💙\nمن كل قلب شكراً لك على ثقتك فينا والتزامك الدايم ويانا 🙏\n🧺 عدد طلباتك عندنا: ${st.orders}\n${tierLabel(st)} · ⭐ رصيدك ${pts}\n\nيسعدنا نخدمك دايماً، وإنت من أغلى عملائنا 🌷\n${SIG}`;
    if (kind === "offer") return en
      ? `Hi ${n} 🎁\nAs one of our valued customers (${tierLabel(st)}), here's a special ${opt.pct}% off your next order just for you ✨\n🏷 Your personal code: *${opt.code}*\n⏳ Valid until ${opt.until}\n\nJust show this message or give the code when you drop off your clothes 😊\n${SIG}`
      : `هلا والله ${n} 🎁\nلأنك من عملائنا المميزين (${tierLabel(st)}) جهزنا لك خصم خاص ${opt.pct}% على طلبك الجاي ✨\n🏷 كودك الشخصي: *${opt.code}*\n⏳ صالح لين ${opt.until}\n\nبس قول الكود أو ورّنا الرسالة وقت تسليم الملابس 😊\n${SIG}`;
    if (kind === "points") return en
      ? `Hi ${n} ⭐\nYour 997 Laundry loyalty card: ${tierLabel(st)}\n💳 Card no. ${st.cardNo}\n⭐ Balance: ${pts}\n\nEvery ${cfg.redeemPoints} points = ${money(cfg.redeemValue)} off — ask us to redeem them anytime 🎁\n${SIG}`
      : `هلا ${n} ⭐\nبطاقة ولائك في مغسلة 997: ${tierLabel(st)}\n💳 رقم البطاقة: ${st.cardNo}\n⭐ رصيدك: ${pts}\n\nكل ${cfg.redeemPoints} نقطة = ${money(cfg.redeemValue)} خصم — اطلب استبدالها بأي وقت 🎁\n${SIG}`;
    if (kind === "winback") return en
      ? `Hi ${n} 👋\nWe've missed you at 997 Laundry! 💙\n${opt.code ? `Welcome back with ${opt.pct}% off your next order — code *${opt.code}* (until ${opt.until}) 🎁\n` : ""}We can also collect from your home — just reply here 🚚\n${SIG}`
      : `هلا والله ${n} 👋\nوحشتنا في مغسلة 997! 💙\n${opt.code ? `ترجع لنا بخصم ${opt.pct}% على طلبك الجاي — الكود *${opt.code}* (لين ${opt.until}) 🎁\n` : ""}ونقدر نستلم ملابسك من البيت بعد — بس رد علينا هنا 🚚\n${SIG}`;
    if (kind === "custom") return String(opt.text || "").replace(/\{(name|الاسم)\}/g, n).replace(/\{(points|النقاط)\}/g, fmtPts(st.points)).replace(/\{(owed|المتبقي)\}/g, money(st.owed)).replace(/\{(tier|الفئة)\}/g, tierLabel(st)) + `\n${SIG}`;
    return "";
  }
  // كود خصم شخصي: لهذا العميل فقط، مرة واحدة، بتاريخ انتهاء — يظهر في الإعدادات ← أكواد الخصم
  function personalCode(c, pct, until, label) {
    const ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    do { code = "V" + Array.from({ length: 5 }, () => ABC[Math.floor(Math.random() * ABC.length)]).join(""); } while (findCode(code));
    settings.discountCodes = settings.discountCodes || [];
    settings.discountCodes.push({ code, type: "percent", percent: round3(pct), scope: "customers", customerIds: [c.id], note: `${label} — ${c.name}`, expiresAt: until, maxUses: 1, active: true, campaign: true, createdAt: new Date().toISOString(), createdBy: me ? me.name : "" });
    return code;
  }
  const KIND_META = {
    due: { ic: "💳", ar: "تذكير بالمتبقي", en: "Payment reminder" }, thanks: { ic: "💙", ar: "رسالة شكر", en: "Thank-you" },
    offer: { ic: "🎁", ar: "خصم خاص", en: "Special discount" }, points: { ic: "⭐", ar: "رصيد النقاط", en: "Points balance" },
    winback: { ic: "👋", ar: "اشتقنا لك", en: "We miss you" }, custom: { ic: "✏️", ar: "رسالة مخصصة", en: "Custom message" },
  };
  function startCampaign(kind) {
    if (!can("campaigns")) { denied(); return; }
    const st = loyCompute(true), ids = [...loySel].filter((id) => customers.some((c) => c.id === id && c.phone));
    let list = ids.map((id) => ({ c: customers.find((x) => x.id === id), st: st[id] })).filter((x) => x.c && x.st);
    if (kind === "due") list = list.filter((x) => dueReminderData(x.c).total > 0);
    if (!list.length) { toast(kind === "due" ? DL("لا يوجد بين المختارين من عليه مبلغ متبقي", "None of the selected customers owes money") : DL("اختر عميلاً واحداً على الأقل (له رقم جوال)", "Select at least one customer with a phone number")); return; }
    const meta = KIND_META[kind], days = [7, 14, 30];
    const fields = [];
    if (kind === "offer" || kind === "winback") {
      fields.push({ id: "pct", label: DL("نسبة الخصم %", "Discount %"), type: "select", value: kind === "offer" ? "tier" : "10", options: [
        ...(kind === "offer" ? [{ value: "tier", label: DL("حسب فئة كل عميل (برونزي 5% · فضي 10% · ذهبي 15% · بلاتيني 20%)", "By each customer's tier (bronze 5% · silver 10% · gold 15% · platinum 20%)") }] : []),
        ...[5, 10, 15, 20, 25, 30].map((p) => ({ value: String(p), label: `${p}%` }))] });
      fields.push({ id: "days", label: DL("صلاحية الكود", "Code valid for"), type: "select", value: "14", options: days.map((d) => ({ value: String(d), label: DL(`${d} يوم`, `${d} days`) })) });
    }
    if (kind === "custom") fields.push({ id: "text", label: DL("نص الرسالة — استخدم {الاسم} {النقاط} {المتبقي} {الفئة}", "Message — use {name} {points} {owed} {tier}"), type: "textarea", value: DL("هلا والله {الاسم} 🌷\n", "Hi {name} 🌷\n") });
    const sample = list[0];
    openQuickForm({
      title: `${meta.ic} ${DL(meta.ar, meta.en)} — ${list.length} ${DL("عميل", "customers")}`,
      sub: DL(`مثال لأول عميل (${sample.c.name}):\n\n`, `Example for the first customer (${sample.c.name}):\n\n`) + campaignText(kind, sample.c, sample.st, { pct: sample.st.tierDiscount, code: "V•••••", until: FIN.addDays(todayStr(), 14), text: DL("هلا والله {الاسم} 🌷", "Hi {name} 🌷") }),
      fields, submitLabel: DL(`📲 إرسال لـ ${list.length}`, `📲 Send to ${list.length}`),
      onSubmit: (v) => {
        if (kind === "custom" && String(v.text || "").replace(/\{[^}]*\}/g, "").trim().length < 3) { toast(DL("اكتب نص الرسالة", "Write the message")); return false; }
        const until = v.days ? FIN.addDays(todayStr(), Number(v.days)) : "";
        const label = `${DL(meta.ar, meta.en)} ${todayStr()}`;
        const items = list.map((x) => {
          let opt = { text: v.text };
          if (kind === "offer" || kind === "winback") {
            const pct = v.pct === "tier" ? x.st.tierDiscount || 5 : Number(v.pct);
            opt = { pct, until, code: personalCode(x.c, pct, until, label) };
          }
          return { ...x, text: campaignText(kind, x.c, x.st, opt), code: opt.code || "", state: "wait" };
        });
        if (kind === "offer" || kind === "winback") save(KEYS.settings, settings);
        logActivity(`📣 حملة «${DL(meta.ar, meta.en)}» — ${items.length} عميل${kind === "offer" || kind === "winback" ? ` — أكواد شخصية: ${items.map((x) => `${x.code} (${x.c.name})`).join("، ")}` : ""}`);
        setTimeout(() => openCampaignQueue(kind, items), 80);
      },
    });
  }
  // قائمة الإرسال: تلقائي عبر واتساب API (يصل فقط لمن راسلنا خلال 24 ساعة — قاعدة Meta)، والباقي بضغطة لكل عميل
  function openCampaignQueue(kind, items) {
    let dlg = document.getElementById("campaignDialog");
    if (!dlg) { dlg = document.createElement("dialog"); dlg.id = "campaignDialog"; dlg.className = "modal"; document.body.appendChild(dlg); }
    const meta = KIND_META[kind];
    const mark = (x, state) => {
      x.state = state;
      x.c.lastCampaign = { kind, at: new Date().toISOString(), by: me ? me.name : "", auto: state === "auto" };
      persistAll();
      draw();
    };
    const draw = () => {
      const done = items.filter((x) => x.state !== "wait" && x.state !== "fail").length;
      dlg.innerHTML = `<div class="quick-add-body">
        <div class="modal-header"><div><h3>${meta.ic} ${DL(meta.ar, meta.en)}</h3><p>${DL(`أُرسلت ${done} من ${items.length}`, `${done} of ${items.length} sent`)}</p></div><button class="icon-btn" type="button" id="cqClose">✕</button></div>
        <div class="cq-progress"><span style="width:${Math.round((done / items.length) * 100)}%"></span></div>
        <div class="row-actions" style="margin:10px 0">
          ${items.some((x) => x.state === "wait" || x.state === "fail") ? `<button class="primary-btn" type="button" id="cqNext">📲 ${DL("افتح واتساب للعميل التالي", "Open WhatsApp for the next customer")}</button>` : `<b style="color:var(--success)">✓ ${DL("اكتملت الحملة", "Campaign complete")}</b>`}
          ${cloudOn() && CLOUD.waBot && items.some((x) => x.state === "wait") ? `<button class="secondary-btn" type="button" id="cqAuto">🤖 ${DL("إرسال تلقائي للجميع", "Send automatically to all")}</button>` : ""}
        </div>
        <p class="section-note">${DL("الإرسال التلقائي يصل فقط للعملاء اللي راسلوا المحل خلال آخر 24 ساعة (شرط واتساب). الباقي: اضغط «افتح واتساب» ثم «إرسال» داخل واتساب، وارجع هنا للتالي.", "Automatic sending only reaches customers who messaged the shop in the last 24 hours (a WhatsApp rule). For the rest: tap “Open WhatsApp”, press Send in WhatsApp, then come back for the next one.")}</p>
        <div class="cq-list">${items.map((x, i) => `<div class="cq-row ${x.state}"><b>${esc(x.c.name)}</b><span dir="ltr">${esc(fmtPhone(x.c.phone))}</span>${x.code ? `<span class="inv-tag">${esc(x.code)}</span>` : ""}
          <span class="cq-state">${{ wait: "⏳", auto: `✅ ${DL("تلقائي", "auto")}`, manual: `✓ ${DL("أُرسل", "sent")}`, fail: `📲 ${DL("يدوي", "manual")}`, busy: "…" }[x.state]}</span>
          ${x.state !== "auto" ? `<button type="button" class="mini-btn" data-cq="${i}">📲</button>` : ""}</div>`).join("")}</div>
      </div>`;
      dlg.querySelector("#cqClose").onclick = () => { dlg.close(); if (currentPage === "loyalty") renderLoyaltyPage(); };
      dlg.querySelector("#cqNext")?.addEventListener("click", () => { const x = items.find((y) => y.state === "wait" || y.state === "fail"); if (x) { openWhatsApp(x.c.phone, x.text); mark(x, "manual"); } });
      dlg.querySelectorAll("[data-cq]").forEach((b) => (b.onclick = () => { const x = items[Number(b.dataset.cq)]; openWhatsApp(x.c.phone, x.text); mark(x, "manual"); }));
      dlg.querySelector("#cqAuto")?.addEventListener("click", async () => {
        for (const x of items.filter((y) => y.state === "wait")) {
          x.state = "busy"; draw();
          let ok = false;
          try { const r = await CLOUD.waBot({ action: "reply", to: cleanPhone(x.c.phone), text: x.text, keepBot: true }); ok = !!(r && r.ok); } catch (e) { ok = false; }
          if (ok) mark(x, "auto"); else { x.state = "fail"; draw(); }
        }
        const a = items.filter((x) => x.state === "auto").length;
        logActivity(`📣 إرسال تلقائي: ${a} من ${items.length}`);
        toast(DL(`✅ وصل تلقائياً لـ ${a} — الباقي اضغط «افتح واتساب»`, `✅ ${a} sent automatically — tap “Open WhatsApp” for the rest`));
      });
    };
    draw();
    if (!dlg.open) dlg.showModal();
  }
  function renderLoyaltyPage(force) {
    const root = document.getElementById("loyaltyRoot"); if (!root) return;
    const st = loyCompute(force), cfg = LCFG(), segs = loySegments(), seg = segs.find((s) => s.id === loySeg) || segs[0];
    const all = customers.filter((c) => st[c.id]);
    const q = loyQ.trim().toLowerCase();
    const list = all.filter((c) => seg.f(st[c.id]) && (!q || String(c.name || "").toLowerCase().includes(q) || cleanPhone(c.phone).includes(q.replace(/\D/g, "") || "§")))
      .sort((a, b) => (loySeg === "owes" || loySeg === "late" ? st[b.id].owed - st[a.id].owed : st[b.id].spent90 - st[a.id].spent90 || st[b.id].points - st[a.id].points));
    [...loySel].forEach((id) => { if (!customers.some((c) => c.id === id)) loySel.delete(id); });
    const sum = (f) => all.reduce((a, c) => a + f(st[c.id]), 0);
    const ptsOut = sum((s) => s.points), liability = round3((ptsOut / cfg.redeemPoints) * cfg.redeemValue);
    const kpi = (ic, lbl, v, note, color) => `<div class="metric-card"><div class="metric-top"><span>${lbl}</span><span class="metric-icon">${ic}</span></div><div class="metric-value" style="${color ? `color:${color}` : ""}">${v}</div>${note ? `<div class="metric-note">${note}</div>` : ""}</div>`;
    const tierCounts = cfg.tiers.map((t) => `${TIER_ICON[t.id] || "⭐"} ${lang === "ar" ? t.ar : t.en || t.ar}: <b>${all.filter((c) => st[c.id].tier === t.id).length}</b>`).join(" · ");
    root.innerHTML = `
      <div class="panel loy-head">
        <div><h3>⭐ ${DL("الولاء والحملات", "Loyalty & campaigns")}</h3><p class="section-note">${tierCounts}</p></div>
        <div class="row-actions"><span class="section-note">${DL("آخر تحديث", "Updated")} ${new Date(loyStatsAt).toLocaleTimeString(lang === "ar" ? "ar-BH" : "en-GB", { hour: "numeric", minute: "2-digit" })} · ${DL("تحديث تلقائي كل دقيقة", "auto-refresh every minute")}</span>
          <button class="secondary-btn" type="button" id="loyRefresh">🔄 ${DL("تحديث الآن", "Refresh now")}</button></div>
      </div>
      <div class="metrics-grid metrics-grid-compact">
        ${kpi("👥", DL("العملاء", "Customers"), all.length, `${all.filter((c) => st[c.id].orders30 > 0).length} ${DL("نشطون هذا الشهر", "active this month")}`)}
        ${kpi("💳", DL("عليهم متبقي", "Owe money"), all.filter((c) => st[c.id].owed > 0).length, money(sum((s) => s.owed)), "var(--danger)")}
        ${kpi("⭐", DL("نقاط لم تُستبدل", "Unredeemed points"), fmtPts(ptsOut), `${DL("قيمتها", "worth")} ${money(liability)}`, "var(--primary)")}
        ${kpi("💙", DL("متوسط الالتزام بالدفع", "Average payment commitment"), `${all.length ? Math.round(sum((s) => s.commitment) / all.length) : 0}%`, "", "var(--success)")}
      </div>
      <div class="panel">
        <div class="loy-segs">${segs.map((s) => { const n = all.filter((c) => s.f(st[c.id])).length; return `<button type="button" class="loy-seg ${s.id === seg.id ? "on" : ""}" data-seg="${s.id}">${DL(s.ar, s.en)} <span>${n}</span></button>`; }).join("")}</div>
        <div class="loy-tools">
          <input type="search" id="loySearch" class="inv-search" placeholder="🔍 ${DL("ابحث بالاسم أو الرقم", "Search by name or number")}" value="${esc(loyQ)}" />
          <button type="button" class="mini-btn" id="loyAll">☑ ${DL(`اختيار الكل (${list.length})`, `Select all (${list.length})`)}</button>
          <button type="button" class="mini-btn" id="loyNone">✕ ${DL("إلغاء الاختيار", "Clear")}</button>
        </div>
        <div class="loy-actions ${loySel.size ? "on" : ""}">
          <b>${DL(`المختارون: ${loySel.size}`, `Selected: ${loySel.size}`)}</b>
          ${Object.entries(KIND_META).map(([k, m]) => `<button type="button" class="${k === "due" ? "primary-btn" : "secondary-btn"}" data-kind="${k}" ${loySel.size ? "" : "disabled"}>${m.ic} ${DL(m.ar, m.en)}</button>`).join("")}
        </div>
        <div class="table-wrap"><table class="data-table loy-table"><thead><tr><th></th><th>${DL("العميل", "Customer")}</th><th>${DL("الفئة", "Tier")}</th><th>⭐ ${DL("النقاط", "Points")}</th><th>${DL("الطلبات", "Orders")}</th><th>${DL("صرف 90 يوم", "Spent 90d")}</th><th>${DL("المتبقي", "Owed")}</th><th>${DL("الالتزام", "Commitment")}</th><th>${DL("آخر طلب", "Last order")}</th><th>${DL("آخر رسالة", "Last message")}</th></tr></thead>
        <tbody>${list.slice(0, 400).map((c) => { const s = st[c.id], lc = c.lastCampaign; return `<tr class="${loySel.has(c.id) ? "sel" : ""}">
          <td><input type="checkbox" data-pick="${c.id}" ${loySel.has(c.id) ? "checked" : ""} ${c.phone ? "" : "disabled"} /></td>
          <td><button type="button" class="link-btn" data-open="${c.id}">${esc(c.name)}</button><div class="section-note" dir="ltr">${esc(fmtPhone(c.phone))}</div></td>
          <td>${tierLabel(s)}</td><td><b>${fmtPts(s.points)}</b>${s.pointsValue > 0 ? `<div class="section-note">${money(s.pointsValue)}</div>` : ""}</td>
          <td>${s.orders}</td><td>${money(s.spent90)}</td><td style="color:${s.owed > 0 ? "var(--danger)" : ""}">${s.owed > 0 ? money(s.owed) : "—"}${s.overdueDays ? `<div class="section-note">${DL(`${s.overdueDays} يوم`, `${s.overdueDays} days`)}</div>` : ""}</td>
          <td><b style="color:${commitColor(s)}">${s.commitment}%</b> <span class="section-note">${commitLabel(s)}</span></td>
          <td>${s.lastOrderAt ? DL(`قبل ${s.daysSinceLast} يوم`, `${s.daysSinceLast}d ago`) : "—"}</td>
          <td>${lc ? `${KIND_META[lc.kind] ? KIND_META[lc.kind].ic : ""} ${DL(`قبل ${daysAgo(lc.at)} يوم`, `${daysAgo(lc.at)}d ago`)}` : "—"}</td></tr>`; }).join("") || `<tr><td colspan="10" class="empty-state compact">${DL("لا يوجد عملاء في هذه الشريحة", "No customers in this group")}</td></tr>`}</tbody></table></div>
      </div>
      ${can("edit_pricing") ? `<details class="panel"><summary><b>⚙ ${DL("إعدادات برنامج الولاء", "Loyalty programme settings")}</b></summary>
        <div class="loy-rules">${DL(`كل 1 د.ب مدفوعة = <b>${cfg.perBD}</b> نقطة · كل <b>${cfg.redeemPoints}</b> نقطة = <b>${money(cfg.redeemValue)}</b> رصيد · متأخر بعد <b>${cfg.lateDays}</b> يوم · الفئات حسب صرف آخر 90 يوماً: ${cfg.tiers.map((t) => `${TIER_ICON[t.id] || ""} ${t.ar} من ${money(t.min)} (خصم ${t.discount}%)`).join(" · ")}`,
          `Every 1 BD paid = <b>${cfg.perBD}</b> points · every <b>${cfg.redeemPoints}</b> points = <b>${money(cfg.redeemValue)}</b> credit · late after <b>${cfg.lateDays}</b> days · tiers by last-90-day spend: ${cfg.tiers.map((t) => `${TIER_ICON[t.id] || ""} ${t.en || t.ar} from ${money(t.min)} (${t.discount}% off)`).join(" · ")}`)}</div>
        <button type="button" class="secondary-btn" id="loyEdit">✎ ${DL("تعديل القواعد", "Edit the rules")}</button></details>` : ""}`;
    const $q = (s) => root.querySelector(s);
    $q("#loyRefresh").onclick = () => { renderLoyaltyPage(true); toast(DL("✓ تم تحديث الأرقام", "✓ Figures refreshed")); };
    $q("#loySearch").oninput = (e) => { loyQ = e.target.value; const pos = e.target.selectionStart; renderLoyaltyPage(); const el = document.getElementById("loySearch"); el.focus(); try { el.setSelectionRange(pos, pos); } catch (x) { /* ignore */ } };
    $q("#loyAll").onclick = () => { list.forEach((c) => { if (c.phone) loySel.add(c.id); }); renderLoyaltyPage(); };
    $q("#loyNone").onclick = () => { loySel.clear(); renderLoyaltyPage(); };
    root.querySelectorAll("[data-seg]").forEach((b) => (b.onclick = () => { loySeg = b.dataset.seg; loySel.clear(); renderLoyaltyPage(); }));
    root.querySelectorAll("[data-pick]").forEach((b) => (b.onchange = () => { if (b.checked) loySel.add(b.dataset.pick); else loySel.delete(b.dataset.pick); renderLoyaltyPage(); }));
    root.querySelectorAll("[data-open]").forEach((b) => (b.onclick = () => window.openCustomerProfile997(b.dataset.open)));
    root.querySelectorAll("[data-kind]").forEach((b) => (b.onclick = () => startCampaign(b.dataset.kind)));
    $q("#loyEdit")?.addEventListener("click", openLoyaltySettings);
    // تحديث دوري: كل دقيقة والصفحة مفتوحة (لا يقطع الكتابة في البحث ولا النوافذ المفتوحة)
    clearInterval(loyTimer);
    loyTimer = setInterval(() => {
      if (currentPage !== "loyalty") { clearInterval(loyTimer); return; }
      if (document.querySelector("dialog[open]") || (document.activeElement && document.activeElement.id === "loySearch")) return;
      renderLoyaltyPage(true);
    }, 60e3);
  }
  function openLoyaltySettings() {
    if (!can("edit_pricing")) { denied(); return; }
    const cfg = LCFG();
    openQuickForm({
      title: DL("⚙ قواعد برنامج الولاء", "⚙ Loyalty rules"), sub: DL("النقاط تُحسب تلقائياً من المبالغ المدفوعة فعلاً — أي تعديل هنا ينطبق على الكل فوراً.", "Points are calculated automatically from money actually paid — changes apply to everyone at once."),
      fields: [
        { id: "on", label: DL("البرنامج", "Programme"), type: "select", value: cfg.on ? "on" : "off", options: [{ value: "on", label: DL("مفعّل", "On") }, { value: "off", label: DL("متوقف", "Off") }] },
        { id: "perBD", label: DL("نقاط لكل 1 د.ب مدفوعة", "Points per 1 BD paid"), type: "number", step: "1", min: 0, value: cfg.perBD },
        { id: "redeemPoints", label: DL("عدد النقاط للاستبدال", "Points per redemption"), type: "number", step: "1", min: 1, value: cfg.redeemPoints },
        { id: "redeemValue", label: DL("قيمتها بالدينار", "Their value in BD"), type: "number", step: "0.001", min: 0, value: cfg.redeemValue },
        { id: "lateDays", label: DL("يُعتبر متأخراً بالدفع بعد (أيام)", "Late payer after (days)"), type: "number", step: "1", min: 1, value: cfg.lateDays },
        ...cfg.tiers.flatMap((t) => [
          { id: `min_${t.id}`, label: DL(`${TIER_ICON[t.id] || ""} ${t.ar}: يبدأ من صرف (د.ب / 90 يوم)`, `${TIER_ICON[t.id] || ""} ${t.en || t.ar}: from spend (BD / 90 days)`), type: "number", step: "0.001", min: 0, value: t.min },
          { id: `disc_${t.id}`, label: DL(`${TIER_ICON[t.id] || ""} ${t.ar}: خصم الحملات %`, `${TIER_ICON[t.id] || ""} ${t.en || t.ar}: campaign discount %`), type: "number", step: "1", min: 0, value: t.discount },
        ]),
      ],
      submitLabel: DL("حفظ", "Save"),
      onSubmit: (v) => {
        if (!(Number(v.redeemPoints) >= 1)) { toast(DL("عدد نقاط الاستبدال غير صحيح", "Invalid points per redemption")); return false; }
        const before = JSON.stringify(cfg);
        settings.loyalty = { on: v.on === "on", perBD: Math.max(0, Number(v.perBD) || 0), redeemPoints: Math.floor(Number(v.redeemPoints)), redeemValue: round3(Number(v.redeemValue) || 0), lateDays: Math.max(1, Math.floor(Number(v.lateDays) || 14)),
          tiers: cfg.tiers.map((t) => ({ id: t.id, ar: t.ar, en: t.en, min: round3(Number(v[`min_${t.id}`]) || 0), discount: Math.max(0, Math.min(100, Number(v[`disc_${t.id}`]) || 0)) })) };
        persistAll(); logActivity(`⭐ تعديل قواعد الولاء — قبل: ${before} — بعد: ${JSON.stringify(settings.loyalty)}`);
        renderLoyaltyPage(true); toast(DL("✓ حُفظت القواعد", "✓ Rules saved"));
      },
    });
  }
  window.renderLoyaltyPage997 = renderLoyaltyPage;
  // 💳 بطاقة الولاء في ملف العميل
  function loyaltyCardHtml(c) {
    const cfg = LCFG(); if (!cfg.on) return "";
    const s = statsOf(c.id); if (!s) return "";
    return `<div class="loy-card tier-${s.tier}">
      <div class="loy-card-top"><span>💳 ${DL("بطاقة الولاء", "Loyalty card")} · <b dir="ltr">${s.cardNo}</b></span><b>${tierLabel(s)}</b></div>
      <div class="loy-card-pts"><b>${fmtPts(s.points)}</b> ${DL("نقطة", "points")}${s.pointsValue > 0 ? ` · ${DL("تساوي", "worth")} ${money(s.pointsValue)}` : ""}</div>
      <div class="loy-card-meta">💙 ${DL("الالتزام بالدفع", "Payment commitment")}: <b>${s.commitment}%</b> (${commitLabel(s)}) · 🧺 ${s.orders} ${DL("طلب", "orders")} · ${DL("صرف 90 يوم", "spent 90d")} ${money(s.spent90)}${s.nextTier ? ` · ${DL(`باقي ${money(s.nextTier.need)} للفئة ${s.nextTier.ar}`, `${money(s.nextTier.need)} to ${s.nextTier.en || s.nextTier.ar}`)}` : ""}</div>
      <div class="row-actions">${s.points >= cfg.redeemPoints ? `<button type="button" class="primary-btn" id="cpRedeem">🎁 ${DL("استبدال النقاط برصيد", "Redeem points as credit")}</button>` : ""}<button type="button" class="secondary-btn" id="cpSendCard">📲 ${DL("إرسال البطاقة على واتساب", "Send the card on WhatsApp")}</button></div>
    </div>`;
  }
  function wireLoyaltyCard(c) {
    const s = statsOf(c.id);
    document.getElementById("cpSendCard")?.addEventListener("click", () => { if (c.phone) { openWhatsApp(c.phone, campaignText("points", c, s, {})); c.lastCampaign = { kind: "points", at: new Date().toISOString(), by: me ? me.name : "" }; persistAll(); logActivity(`⭐ إرسال بطاقة الولاء — ${c.name} — ${fmtPts(s.points)} نقطة`); } });
    document.getElementById("cpRedeem")?.addEventListener("click", () => requireOverride("balance_tx", "استبدال نقاط الولاء", () => redeemLoyalty(c)));
  }
  function redeemLoyalty(c) {
    const cfg = LCFG(), s = loyCompute(true)[c.id];
    const max = Math.floor(s.points / cfg.redeemPoints);
    if (max < 1) { toast(DL("النقاط لا تكفي للاستبدال", "Not enough points to redeem")); return; }
    openQuickForm({
      title: DL(`🎁 استبدال نقاط ${c.name}`, `🎁 Redeem ${c.name}'s points`), sub: DL(`الرصيد: ${fmtPts(s.points)} نقطة — كل ${cfg.redeemPoints} نقطة = ${money(cfg.redeemValue)} تُضاف لرصيد العميل ويستخدمها في أي طلب.`, `Balance: ${fmtPts(s.points)} points — every ${cfg.redeemPoints} points = ${money(cfg.redeemValue)} added to the customer's balance for any order.`),
      fields: [{ id: "n", label: DL("المبلغ", "Amount"), type: "select", value: String(max), options: Array.from({ length: Math.min(max, 50) }, (_, i) => ({ value: String(i + 1), label: `${fmtPts((i + 1) * cfg.redeemPoints)} ${DL("نقطة", "points")} = ${money((i + 1) * cfg.redeemValue)}` })) }],
      submitLabel: DL("استبدال", "Redeem"),
      onSubmit: (v) => {
        const k = Math.max(1, Math.min(max, Math.floor(Number(v.n) || 1))), pts = k * cfg.redeemPoints, val = round3(k * cfg.redeemValue);
        c.balance = round3((Number(c.balance) || 0) + val);
        ledger.unshift({ id: uid(), byId: me ? me.id : "", customerId: c.id, type: "adjustment", amount: val, balanceAfter: c.balance, method: "loyalty", loyaltyPoints: pts, note: `⭐ استبدال ${fmtPts(pts)} نقطة ولاء`, orderId: null, at: new Date().toISOString() });
        persistAll(); loyCompute(true);
        logActivity(`⭐ استبدال نقاط ولاء — ${c.name} — ${fmtPts(pts)} نقطة = ${money(val)} أُضيفت لرصيده`);
        toast(DL(`✓ أُضيف ${money(val)} لرصيد ${c.name}`, `✓ ${money(val)} added to ${c.name}'s balance`));
        if (c.phone) setTimeout(() => waPrompt(DL("✓ تم الاستبدال", "✓ Redeemed"), DL(`ترسل للعميل تأكيد الاستبدال؟`, `Send the customer a confirmation?`), DL("📲 إرسال على واتساب", "📲 Send on WhatsApp"), () => {
          openWhatsApp(c.phone, lang === "en" ? `Hi ${c.name} 🎁\n${fmtPts(pts)} loyalty points were redeemed — ${money(val)} added to your balance with us ✅\n💳 ${balanceStatus(c.balance)}\n${SIGN.en}` : `هلا والله ${c.name} 🎁\nتم استبدال ${fmtPts(pts)} نقطة من نقاط ولائك — أضفنا ${money(val)} لرصيدك عندنا ✅\n💳 ${balanceStatus(c.balance)}\n${SIGN.ar}`);
        }), 150);
        if (customerProfileDialog.open) renderCustomerProfile();
      },
    });
  }

  /* ============================= 💬 محادثات واتساب (المساعد الذكي) =============================
     الرسائل تصل من Meta إلى دالة whatsapp-bot في Supabase؛ المساعد يرد آلياً من بيانات المحل الفعلية.
     هنا يرى الموظف كل المحادثات، ويتولى أي محادثة (المساعد يتوقف فيها)، ويرد من نفس رقم المحل، ثم يعيدها للمساعد. */
  const waView = { phone: null, filter: "all", threads: [], msgs: [], timer: null, err: "", lastSeenWaiting: null };
  const waCfg = () => { const b = settings.waBot || {}; return { enabled: b.enabled === true, staffOn: b.staffOn !== false, staffFrom: b.staffFrom || "08:00", staffTo: b.staffTo || "23:00", hoursText: b.hoursText || "مفتوح 24 ساعة", areas: b.areas || "", extra: b.extra || "" }; };
  const waTime = (iso) => { if (!iso) return ""; const d = new Date(iso), today = FIN.localDay(new Date().toISOString()) === FIN.localDay(iso); try { return d.toLocaleString(lang === "ar" ? "ar-BH" : "en-GB", today ? { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bahrain" } : { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bahrain" }); } catch (e) { return iso.slice(11, 16); } };
  const waNeedsStaff = (t) => !!t && (t.waiting || (t.mode === "human" && t.unread > 0));
  const WA_FLAG = { human: ["🙋", "يطلب موظف", "Wants a person"], callback: ["✉️", "رسالة / اتصال", "Message / call back"], complaint: ["⚠️", "شكوى", "Complaint"], pickup: ["🚚", "طلب استلام", "Pickup request"], media: ["🎙", "صوت/صورة", "Voice/photo"] };
  async function waLoadThreads() {
    if (!cloudOn() || !CLOUD.waThreads) { waView.err = "cloud"; return; }
    const r = await CLOUD.waThreads();
    if (r.error) { waView.err = r.error; return; }
    waView.err = ""; waView.threads = r.rows || [];
    updateWaBadge();
  }
  function updateWaBadge() {
    const btn = document.querySelector('.nav-item[data-page="whatsapp"]'); if (!btn) return;
    const n = waView.threads.filter(waNeedsStaff).length;
    let b = btn.querySelector(".nav-count");
    if (!b) { b = document.createElement("span"); b.className = "nav-count"; btn.appendChild(b); }
    b.textContent = n; b.style.display = n ? "" : "none";
    const waitingIds = waView.threads.filter((t) => t.waiting).map((t) => t.phone).sort().join(",");
    if (waView.lastSeenWaiting !== null && waitingIds && waitingIds !== waView.lastSeenWaiting && waView.threads.some((t) => t.waiting && !waView.lastSeenWaiting.includes(t.phone))) {
      toast(DL("💬 عميل على واتساب يحتاج موظف", "💬 A WhatsApp customer needs a person"));
    }
    waView.lastSeenWaiting = waitingIds;
  }
  // فحص دوري خفيف (كل 30 ثانية) حتى يظهر عدد المحادثات التي تحتاج موظف في القائمة
  setInterval(() => { try { if (me && cloudOn() && can("whatsapp_inbox") && (waCfg().enabled || waView.threads.length) && currentPage !== "whatsapp") waLoadThreads(); } catch (e) { /* ignore */ } }, 30000);
  setTimeout(() => { try { if (me && cloudOn() && can("whatsapp_inbox")) waLoadThreads(); } catch (e) { /* ignore */ } }, 4000);

  async function waOpenThread(phone) {
    waView.phone = phone;
    const r = await CLOUD.waMessages(phone);
    waView.msgs = r.rows ? r.rows.slice().reverse() : [];
    const t = waView.threads.find((x) => x.phone === phone);
    if (t && t.unread) { t.unread = 0; CLOUD.waThreadPatch(phone, { unread: 0 }); updateWaBadge(); }
    renderWhatsAppPage(true);
    const box = document.getElementById("waMsgs"); if (box) box.scrollTop = box.scrollHeight;
  }
  const waSig = () => JSON.stringify(waView.threads.map((t) => [t.phone, t.last_at, t.unread, t.flag, t.mode, t.waiting]));
  function renderWhatsAppPage(keepScroll, fromPoll) {
    const root = document.getElementById("waRoot"); if (!root) return;
    // remember where the user was, so a refresh never throws them back to the top
    const prevList = root.querySelector(".wa-list"), prevMsgs = document.getElementById("waMsgs");
    const keep = { list: prevList ? prevList.scrollTop : 0, msgsBottom: prevMsgs ? prevMsgs.scrollHeight - prevMsgs.scrollTop - prevMsgs.clientHeight < 40 : true, msgs: prevMsgs ? prevMsgs.scrollTop : 0, win: window.scrollY };
    const cfg = waCfg(), adm = can("admin_settings");
    clearInterval(waView.timer);
    if (currentPage === "whatsapp") waView.timer = setInterval(async () => {
      if (currentPage !== "whatsapp") { clearInterval(waView.timer); return; }
      const typing = document.activeElement && document.activeElement.id === "waText";
      const before = waSig();
      await waLoadThreads();
      let msgsChanged = false;
      if (waView.phone) { const r = await CLOUD.waMessages(waView.phone); if (r.rows) { const fresh = r.rows.slice().reverse(); if (fresh.length !== waView.msgs.length || (fresh[fresh.length - 1] || {}).id !== (waView.msgs[waView.msgs.length - 1] || {}).id) { waView.msgs = fresh; msgsChanged = true; } } }
      // nothing new → leave the screen alone (no jumps, taps are not lost)
      if (waSig() === before && !msgsChanged) return;
      if (typing) { if (msgsChanged) renderWaMsgs(); return; }
      renderWhatsAppPage(true, true);
    }, 6000);
    const setupCard = (msg) => `<div class="panel wa-setup"><h3>💬 ${DL("مساعد واتساب الذكي", "WhatsApp AI assistant")}</h3><p>${msg}</p>
      <ol class="wa-steps">
        <li>${DL("Supabase ← SQL Editor ← شغّل الملف <b>supabase/whatsapp_bot.sql</b>", "Supabase → SQL Editor → run <b>supabase/whatsapp_bot.sql</b>")}</li>
        <li>${DL("Supabase ← Edge Functions ← أنشئ الدالة <b>whatsapp-bot</b> (الملف supabase/functions/whatsapp-bot/index.ts) وأوقف «Verify JWT»", "Supabase → Edge Functions → create <b>whatsapp-bot</b> (supabase/functions/whatsapp-bot/index.ts) and turn off “Verify JWT”")}</li>
        <li>${DL("Secrets: <b>WA_APP_SECRET</b> و <b>WA_VERIFY_TOKEN</b> و <b>ANTHROPIC_API_KEY</b> (مع WA_TOKEN و WA_PHONE_ID)", "Secrets: <b>WA_APP_SECRET</b>, <b>WA_VERIFY_TOKEN</b>, <b>ANTHROPIC_API_KEY</b> (plus WA_TOKEN, WA_PHONE_ID)")}</li>
        <li>${DL("Meta ← WhatsApp ← Configuration ← Webhook: الرابط …/functions/v1/whatsapp-bot ← اشترك في <b>messages</b>", "Meta → WhatsApp → Configuration → Webhook: …/functions/v1/whatsapp-bot → subscribe to <b>messages</b>")}</li>
        <li>${DL("هنا: فعّل المساعد من الإعدادات ← التشغيل ← «مساعد واتساب الذكي»", "Here: turn the assistant on in Settings → Operating → “WhatsApp AI assistant”")}</li>
      </ol><p class="section-note">${DL("الدليل الكامل: docs/whatsapp-ai-assistant.md", "Full guide: docs/whatsapp-ai-assistant.md")}</p></div>`;
    if (!cloudOn()) { root.innerHTML = setupCard(DL("المحادثات تعمل عبر السحابة — اربط النظام أولاً (ملف المنشأة ← المزامنة السحابية).", "Chats work through the cloud — link the system first (Company profile → Cloud sync).")); return; }
    if (waView.err === "no-table") { root.innerHTML = setupCard(DL("جداول المحادثات غير موجودة بعد في Supabase.", "The chat tables are not in Supabase yet.")); return; }
    const list = waView.threads.filter((t) => waView.filter === "all" ? true : waView.filter === "staff" ? waNeedsStaff(t) : t.flag === waView.filter);
    const counts = { staff: waView.threads.filter(waNeedsStaff).length, complaint: waView.threads.filter((t) => t.flag === "complaint").length, pickup: waView.threads.filter((t) => t.flag === "pickup").length };
    const cur = waView.threads.find((t) => t.phone === waView.phone) || null;
    const custOf = (t) => (t && t.customer_id ? customers.find((c) => c.id === t.customer_id) : null) || (t ? customers.find((c) => phoneMatches(c.phone, t.phone)) : null);
    const nameOf = (t) => { const c = custOf(t); return (c && c.name) || t.name || fmtPhone(t.phone); };
    root.innerHTML = `
      <div class="panel wa-head ${cur ? "chat-open" : ""}">
        <div class="wa-head-txt"><h3>💬 ${DL("محادثات واتساب", "WhatsApp chats")}</h3>
          <div class="dlv-policy"><span>🤖 ${DL("المساعد", "Assistant")}: <b style="color:${cfg.enabled ? "var(--success)" : "var(--danger)"}">${cfg.enabled ? DL("يعمل", "on") : DL("متوقف", "off")}</b></span>
          <span>🙋 ${DL("الموظفون", "Staff")}: <b>${cfg.staffOn ? `${cfg.staffFrom}–${cfg.staffTo}` : DL("غير متاحين", "unavailable")}</b></span>
          ${waView.err && waView.err !== "cloud" ? `<span style="color:var(--danger)">⚠ ${esc(waView.err)}</span>` : ""}</div></div>
        <div class="row-actions">${adm ? `<button type="button" class="secondary-btn" id="waToggleBot">${cfg.enabled ? DL("⏸ إيقاف المساعد", "⏸ Turn assistant off") : DL("▶ تشغيل المساعد", "▶ Turn assistant on")}</button><button type="button" class="secondary-btn" id="waToggleStaff">${cfg.staffOn ? DL("🙅 الموظفون غير متاحين الآن", "🙅 Staff unavailable now") : DL("🙋 الموظفون متاحون", "🙋 Staff available")}</button>` : ""}<button type="button" class="ghost-btn" id="waPing">🔎 ${DL("فحص الربط", "Check connection")}</button></div>
        <p class="section-note wa-ping-out" id="waPingOut"></p>
      </div>
      <div class="wa-layout ${cur ? "has-chat" : ""}">
        <div class="panel wa-list">
          <div class="wa-filters">${[["all", DL("الكل", "All"), waView.threads.length], ["staff", DL("يحتاج موظف", "Needs a person"), counts.staff], ["complaint", DL("شكاوى", "Complaints"), counts.complaint], ["pickup", DL("حجوزات", "Pickups"), counts.pickup]].map(([k, l, nn]) => `<button type="button" class="mini-btn ${waView.filter === k ? "active" : ""}" data-wa-filter="${k}">${l}${nn ? ` <b>${nn}</b>` : ""}</button>`).join("")}</div>
          ${list.length ? list.map((t) => `<button type="button" class="wa-thread ${t.phone === waView.phone ? "on" : ""} ${waNeedsStaff(t) ? "need" : ""}" data-wa-open="${esc(t.phone)}">
              <div class="wa-t-top"><b>${esc(nameOf(t))}</b><small>${esc(waTime(t.last_at))}</small></div>
              <div class="wa-t-last">${t.mode === "human" ? "👤 " : "🤖 "}${esc(String(t.last_text || "").slice(0, 70))}</div>
              <div class="wa-t-badges">${t.flag && WA_FLAG[t.flag] ? `<span class="wa-flag f-${t.flag}">${WA_FLAG[t.flag][0]} ${lang === "ar" ? WA_FLAG[t.flag][1] : WA_FLAG[t.flag][2]}</span>` : ""}${t.unread ? `<span class="nav-count">${t.unread}</span>` : ""}</div></button>`).join("")
            : `<div class="empty-state compact">${waView.threads.length ? DL("لا توجد محادثات في هذا التصنيف", "No chats in this filter") : DL("لا توجد محادثات بعد — ستظهر هنا رسائل العملاء على رقم المحل", "No chats yet — customer messages to the shop number appear here")}</div>`}
        </div>
        <div class="panel wa-chat">${cur ? `
          <div class="wa-chat-head"><button type="button" class="ghost-btn wa-back" id="waBack">→ ${DL("المحادثات", "Chats")}</button>
            <div><b>${esc(nameOf(cur))}</b> <small dir="ltr">${esc(fmtPhone(cur.phone))}</small> ${cur.mode === "human" ? `<span class="wa-flag f-human">👤 ${DL("موظف يتولى", "Staff handling")}</span>` : `<span class="wa-flag f-bot">🤖 ${DL("المساعد يرد", "Assistant replying")}</span>`}</div>
            <div class="row-actions">${cur.mode === "human" ? `<button type="button" class="mini-btn" data-wa-mode="bot">🤖 ${DL("رجوع للمساعد", "Back to assistant")}</button>` : `<button type="button" class="mini-btn" data-wa-mode="human">✋ ${DL("أتولى المحادثة", "Take over")}</button>`}
            ${cur.waiting || cur.flag ? `<button type="button" class="mini-btn" data-wa-done="1">✓ ${DL("تمت المعالجة", "Done")}</button>` : ""}
            ${custOf(cur) ? `<button type="button" class="mini-btn" data-wa-cust="${esc(custOf(cur).id)}">📋 ${DL("ملف العميل", "Customer file")}</button>` : ""}
            ${dlvCfg().on ? `<button type="button" class="mini-btn" data-wa-pickup="1">🚚 ${DL("حجز استلام", "Book pickup")}</button>` : ""}</div></div>
          <div class="wa-msgs" id="waMsgs"></div>
          <div class="wa-quick">${[DL("هلا والله 🌸 شلون أقدر أخدمك؟", "Hello! How can I help?"), DL("طلبك جاهز ✅ تقدر تستلمه أي وقت", "Your order is ready ✅"), DL("المندوب في الطريق لك 🛵", "Our driver is on the way 🛵"), DL("تم تأكيد موعد الاستلام ✅", "Your pickup is confirmed ✅")].map((q) => `<button type="button" class="mini-btn" data-wa-quick="${esc(q)}">${esc(q)}</button>`).join("")}</div>
          <div class="wa-compose"><textarea id="waText" rows="2" placeholder="${DL("اكتب ردك — يُرسل من رقم المحل (والمساعد يتوقف في هذه المحادثة)", "Type a reply — sent from the shop number (the assistant pauses in this chat)")}"></textarea><button type="button" class="primary-btn" id="waSend">${DL("إرسال", "Send")}</button></div>`
          : `<div class="empty-state">${DL("اختر محادثة من القائمة", "Pick a chat from the list")}</div>`}</div>
      </div>`;
    if (cur) renderWaMsgs();
    { const l = root.querySelector(".wa-list"); if (l) l.scrollTop = keep.list;
      const m = document.getElementById("waMsgs"); if (m && keepScroll) m.scrollTop = keep.msgsBottom ? m.scrollHeight : keep.msgs;
      if (fromPoll) window.scrollTo(0, keep.win); }
    const q = (sel) => root.querySelectorAll(sel);
    q("[data-wa-filter]").forEach((b) => (b.onclick = () => { waView.filter = b.dataset.waFilter; renderWhatsAppPage(true); }));
    q("[data-wa-open]").forEach((b) => (b.onclick = () => waOpenThread(b.dataset.waOpen)));
    const back = root.querySelector("#waBack"); if (back) back.onclick = () => { waView.phone = null; renderWhatsAppPage(true); };
    q("[data-wa-mode]").forEach((b) => (b.onclick = async () => {
      const mode = b.dataset.waMode, patch = mode === "human" ? { mode: "human", human_at: new Date().toISOString() } : { mode: "bot", waiting: false, flag: null };
      const r = await CLOUD.waThreadPatch(cur.phone, patch); if (r.error) { toast("⚠ " + r.error); return; }
      Object.assign(cur, patch); logActivity(`💬 ${mode === "human" ? "تولّى" : "أعاد للمساعد"} محادثة واتساب ${cur.phone}`); await waLoadThreads(); renderWhatsAppPage(true);
    }));
    q("[data-wa-done]").forEach((b) => (b.onclick = async () => { const patch = { waiting: false, flag: null, unread: 0 }; const r = await CLOUD.waThreadPatch(cur.phone, patch); if (r.error) { toast("⚠ " + r.error); return; } Object.assign(cur, patch); renderWhatsAppPage(true); updateWaBadge(); }));
    q("[data-wa-cust]").forEach((b) => (b.onclick = () => window.openCustomerProfile997 && window.openCustomerProfile997(b.dataset.waCust)));
    q("[data-wa-pickup]").forEach((b) => (b.onclick = () => { const c = custOf(cur); openPickupForm(c ? c.id : null); }));
    q("[data-wa-quick]").forEach((b) => (b.onclick = () => { const ta = document.getElementById("waText"); ta.value = b.dataset.waQuick; ta.focus(); }));
    const send = root.querySelector("#waSend");
    if (send) send.onclick = async () => {
      const ta = document.getElementById("waText"), txt = ta.value.trim(); if (!txt) return;
      send.disabled = true;
      const r = await CLOUD.waBot({ action: "reply", to: cur.phone, text: txt });
      send.disabled = false;
      if (!r || !r.ok) { toast(`⚠ ${waErrHint(r) || (r && r.error) || "خطأ"}`); return; }
      ta.value = ""; Object.assign(cur, { mode: "human", waiting: false, unread: 0 });
      logActivity(`💬 رد على واتساب — ${cur.phone}`);
      await waLoadThreads(); waOpenThread(cur.phone);
    };
    const bt = root.querySelector("#waToggleBot"); if (bt) bt.onclick = () => { settings.waBot = { ...(settings.waBot || {}), enabled: !cfg.enabled }; persistAll(); logActivity(`${!cfg.enabled ? "تشغيل" : "إيقاف"} مساعد واتساب الذكي`); renderWhatsAppPage(true); };
    const bs = root.querySelector("#waToggleStaff"); if (bs) bs.onclick = () => { settings.waBot = { ...(settings.waBot || {}), staffOn: !cfg.staffOn }; persistAll(); logActivity(`مساعد واتساب: الموظفون ${!cfg.staffOn ? "متاحون" : "غير متاحين"} للتحويل`); renderWhatsAppPage(true); };
    root.querySelector("#waPing").onclick = async () => {
      const out = document.getElementById("waPingOut"); out.textContent = "…";
      const r = await CLOUD.waBot({ action: "ping" });
      if (!r || !r.ok) { out.textContent = `⚠ ${r && r.status === 404 ? DL("دالة whatsapp-bot غير موجودة في Supabase بعد.", "The whatsapp-bot function is not in Supabase yet.") : waErrHint(r) || (r && r.error) || ""}`; return; }
      const ok = (b, ar, en) => `${b ? "✓" : "✗"} ${DL(ar, en)}`;
      out.textContent = [ok(r.whatsapp, "واتساب (WA_TOKEN / WA_PHONE_ID)", "WhatsApp (WA_TOKEN / WA_PHONE_ID)"), ok(r.signature, "توقيع Meta (WA_APP_SECRET)", "Meta signature (WA_APP_SECRET)"), ok(r.verify, "رمز التحقق (WA_VERIFY_TOKEN)", "Verify token (WA_VERIFY_TOKEN)"), ok(r.ai, `الذكاء الاصطناعي (ANTHROPIC_API_KEY) — ${r.model}`, `AI (ANTHROPIC_API_KEY) — ${r.model}`)].join(" · ") + (r.aiError ? `\n⚠️ ${DL("مفتاح Claude:", "Claude key:")} ${r.aiError}` : "");
    };
    if (!keepScroll) { const box = document.getElementById("waMsgs"); if (box) box.scrollTop = box.scrollHeight; }
  }
  function renderWaMsgs() {
    const box = document.getElementById("waMsgs"); if (!box) return;
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    box.innerHTML = waView.msgs.map((m) => m.dir === "note" ? `<div class="wa-note">${esc(m.body)} <small>${esc(waTime(m.at))}</small></div>`
      : `<div class="wa-bubble ${m.dir === "in" ? "in" : m.who === "bot" ? "bot" : "staff"}"><div>${esc(m.body).replace(/\n/g, "<br>")}</div><small>${m.dir === "in" ? "" : m.who === "bot" ? "🤖 " + DL("المساعد", "Assistant") + " · " : "👤 " + esc(m.who || "") + " · "}${esc(waTime(m.at))}</small></div>`).join("") || `<div class="empty-state compact">${DL("لا توجد رسائل", "No messages")}</div>`;
    if (atBottom) box.scrollTop = box.scrollHeight;
  }
  window.renderWhatsAppPage997 = renderWhatsAppPage;

  /* ============================= الورديات (حضور وانصراف + عهدة الصندوق) =============================
     كل موظف يبدأ ورديته عند الدخول (= حضور) بعدّ النقد المستلم، وكل حركة مالية يقوم بها تُسجَّل باسمه،
     وعند نهاية ورديته يُغلقها (= انصراف) بعدّ النقد الفعلي ومقارنته بالمتوقع. المالك معفى (اختياري له). */
  const SHIFT_KEY = "l997_shifts";
  let shifts = load(SHIFT_KEY, []);
  const saveShifts = () => { shifts = mergeSaveById(SHIFT_KEY, shifts); };
  const openShiftOf = (empId) => shifts.find((x) => x.employeeId === empId && !x.endAt) || null;
  const myShift = () => (me ? openShiftOf(me.id) : null);
  const lastClosedShift = () => shifts.filter((x) => x.endAt).sort((a, b) => String(b.endAt).localeCompare(String(a.endAt)))[0] || null;
  // الورديات اختيارية (الإعدادات ← إعدادات التشغيل) — مطفأة افتراضياً: الموظف يعمل مباشرة بعد الدخول
  const shiftNeeded = () => !!me && role !== "owner" && settings.shiftsRequired === true;
  const hhmm = (iso) => { const d = new Date(new Date(iso).getTime() + 3 * 3600000); return String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0"); }; // توقيت البحرين
  const durTxt = (h) => { const m = Math.round(h * 60); return `${Math.floor(m / 60)}س ${m % 60}د`; };
  // يمنع العمليات المالية بدون وردية مفتوحة (حتى تُنسب كل حركة لوردية وموظف)
  function shiftGuard() {
    if (!shiftNeeded() || myShift()) return true;
    toast(lang === "en" ? "Start your shift first — money actions are recorded on your shift" : "ابدأ ورديتك أولاً — كل عملية مالية تُسجَّل على ورديتك");
    setTimeout(() => openStartShift(), 250);
    return false;
  }
  function openStartShift(after) {
    if (!me) return;
    if (myShift()) { if (after) after(); return; }
    const last = lastClosedShift();
    openQuickForm({
      title: "▶ بدء الوردية (تسجيل حضور)",
      sub: `${me.name} — وقت البدء يُسجَّل حضوراً الآن (${hhmm(new Date().toISOString())}).${last ? ` آخر وردية: ${last.employeeName} سلّمت ${money(last.countedCash)} نقداً في الدرج.` : ""} عُدّ النقد الموجود في الدرج وأدخله.`,
      fields: [
        { id: "opening", label: "النقد الموجود في الدرج عند الاستلام (د.ب)", type: "number", step: "0.001", value: "", min: 0 },
        { id: "note", label: "ملاحظة (إلزامية إذا اختلف عن تسليم الوردية السابقة)", type: "text" },
      ],
      submitLabel: "▶ بدء الوردية", cancelLabel: "لاحقاً",
      onSubmit: (v) => {
        if (myShift()) return;
        if (v.opening < 0) { toast("المبلغ لا يمكن أن يكون سالباً"); return false; }
        const opening = round3(v.opening);
        const diff = last ? round3(opening - (Number(last.countedCash) || 0)) : 0;
        if (diff !== 0 && !v.note) { toast(`المبلغ يختلف عن تسليم الوردية السابقة (${money(last.countedCash)}) بـ ${money(diff)} — اكتب ملاحظة`); return false; }
        shifts.unshift({ id: uid(), employeeId: me.id, employeeName: me.name, startAt: new Date().toISOString(), openingCash: opening, handoverDiff: diff, startNote: v.note || "", prevShiftId: last ? last.id : null });
        saveShifts();
        logActivity(`بدء وردية — ${me.name} — نقد الاستلام ${money(opening)}${diff ? ` (فرق عن التسليم ${money(diff)}: ${v.note})` : ""}`, opening);
        refreshShiftUi();
        if (typeof window.renderClosures997 === "function" && document.getElementById("page-closures").classList.contains("active")) window.renderClosures997();
        toast("تم بدء الوردية — بالتوفيق");
        if (after) setTimeout(after, 250);
      },
    });
  }
  const methodTxt = (by) => FIN.CASH_METHODS.filter((m) => by[m]).map((m) => `${paymentLabel(m)} ${money(by[m])}`).join(" · ") || money(0);
  function openCloseShift(shift, opts) {
    opts = opts || {};
    const sum = FIN.shiftSummary(finData(), shift);
    const forced = !me || shift.employeeId !== me.id;
    openQuickForm({
      title: forced ? `⏹ إغلاق وردية ${shift.employeeName}` : "⏹ إغلاق الوردية (تسجيل انصراف)",
      sub: `من ${fmtDT(shift.startAt)} (${durTxt(sum.hours)}) — طلبات مدفوعة: ${sum.orders} بقيمة ${money(sum.sales)} — المحصّل: ${methodTxt(sum.inBy)}${sum.refunds ? ` — مرتجع ${money(sum.refunds)}` : ""}${sum.expenses ? ` — مصروفات ${money(sum.expenses)}` : ""} — نقد الاستلام ${money(sum.opening)} — 💵 النقد المتوقع في الدرج: ${money(sum.expectedCash)}`,
      fields: [
        { id: "counted", label: `النقد الذي عددته في الدرج الآن (المتوقع ${money(sum.expectedCash)})`, type: "number", step: "0.001", value: "", min: 0 },
        { id: "note", label: "سبب الفرق (إلزامي إذا اختلف عن المتوقع)", type: "text" },
      ],
      submitLabel: "⏹ إغلاق الوردية",
      onSubmit: (v) => {
        if (shift.endAt) return;
        const now = new Date().toISOString();
        const fin = FIN.shiftSummary(finData(), { ...shift, endAt: now });
        const counted = round3(Math.max(0, v.counted));
        const diff = round3(counted - fin.expectedCash);
        if (diff !== 0 && !v.note) { toast(`يوجد فرق ${money(diff)} عن المتوقع — اكتب سببه`); return false; }
        Object.assign(shift, {
          endAt: now, countedCash: counted, expectedCash: fin.expectedCash, variance: diff, endNote: v.note || "", closedBy: me ? me.name : "", forced,
          summary: { orders: fin.orders, sales: fin.sales, inBy: fin.inBy, outBy: fin.outBy, expenses: fin.expenses, refunds: fin.refunds, deposits: fin.deposits, delivered: fin.delivered, hours: fin.hours },
        });
        saveShifts();
        logActivity(`إغلاق وردية — ${shift.employeeName} — ${durTxt(fin.hours)} — المتوقع ${money(fin.expectedCash)}، الفعلي ${money(counted)}، الفرق ${money(diff)}${forced ? ` (أغلقها ${me ? me.name : ""})` : ""}`, diff);
        refreshShiftUi();
        if (typeof window.renderClosures997 === "function" && document.getElementById("page-closures").classList.contains("active")) window.renderClosures997();
        toast(diff === 0 ? "تم إغلاق الوردية — الصندوق مطابق ✓" : `تم إغلاق الوردية — فرق ${money(diff)}`);
        if (opts.then) setTimeout(opts.then, 300);
      },
    });
  }
  function refreshShiftUi() {
    const sh = myShift();
    const chip = document.getElementById("shiftChip"), box = document.getElementById("shiftBox");
    if (!me) { if (chip) chip.style.display = "none"; if (box) box.innerHTML = ""; return; }
    const label = sh ? `🟢 ${lang === "en" ? "On shift since" : "في الوردية منذ"} ${hhmm(sh.startAt)}` : (lang === "en" ? "⚪ Start shift" : "⚪ بدء الوردية");
    if (chip) {
      chip.style.display = shiftNeeded() || sh ? "" : "none";
      chip.innerHTML = `<span class="sc-full">${esc(label)}</span><span class="sc-short">${sh ? "🟢 " + hhmm(sh.startAt) : "⚪ ▶"}</span>`;
      chip.title = label;
      chip.classList.toggle("on", !!sh);
    }
    if (box) box.innerHTML = `<button type="button" class="${sh || !shiftNeeded() ? "secondary-btn" : "primary-btn"} full" id="shiftBoxBtn">${sh ? (lang === "en" ? "⏹ Close my shift" : "⏹ إغلاق ورديتي") : (lang === "en" ? "▶ Start my shift" : "▶ بدء ورديتي")}</button>${sh ? `<small class="inv-muted">${label}</small>` : ""}`;
    document.getElementById("shiftBoxBtn")?.addEventListener("click", shiftButton);
  }
  function shiftButton() { const sh = myShift(); if (sh) openCloseShift(sh); else openStartShift(); }
  document.getElementById("shiftChip")?.addEventListener("click", shiftButton);
  setInterval(() => { if (me) refreshShiftUi(); }, 60000);
  // الخروج: إن كانت الوردية مفتوحة يُسأل الموظف — إغلاقها أو خروج مؤقت (استراحة)
  function logoutClicked() {
    const sh = myShift();
    if (!sh) { doLogout("out"); return; }
    openQuickForm({
      title: "تسجيل الخروج", sub: `ورديتك مفتوحة منذ ${hhmm(sh.startAt)}. هل انتهت ورديتك؟`,
      fields: [{ id: "what", label: "اختر", type: "select", value: "close", options: [
        { value: "close", label: "⏹ نعم — أغلق الوردية (انصراف) ثم اخرج" },
        { value: "break", label: "☕ لا — خروج مؤقت (استراحة) والوردية تبقى مفتوحة" },
      ] }],
      submitLabel: "متابعة",
      onSubmit: (v) => {
        if (v.what === "close") setTimeout(() => openCloseShift(sh, { then: () => doLogout("out") }), 150);
        else { logActivity(`خروج مؤقت (الوردية مفتوحة) — ${me.name}`); setTimeout(() => doLogout("out"), 50); }
      },
    });
  }
  // صفحة الإغلاقات للعامل: ورديته فقط (المبيعات والتحصيل باسمه والنقد المتوقع) — بدون أرقام المحل اليومية أو الشهرية
  function renderMyShifts() {
    const el = document.getElementById("shiftsPanel"); if (!el || !me) return;
    const sh = myShift(), live = sh ? FIN.shiftSummary(finData(), sh) : null;
    const L = (ar, en) => (lang === "en" ? en : ar);
    const stat = (l, v, st) => `<div class="mini-stat"><span>${l}</span><b${st ? ` style="${st}"` : ""}>${v}</b></div>`;
    const mine = shifts.filter((x) => x.employeeId === me.id && x.endAt).sort((a, b) => String(b.endAt).localeCompare(String(a.endAt))).slice(0, 14);
    el.innerHTML = `<div class="panel-header"><div><h3>🕐 ${L("ورديتي", "My shift")}</h3><p>${L("ابدأ ورديتك أول الدوام، وأغلقها آخره: عُدّ النقد في الدرج وأدخله", "Start your shift when you begin and close it when you finish: count the cash in the drawer and enter it")}</p></div>
        <button type="button" class="primary-btn" id="myShiftBtn">${sh ? L("⏹ إغلاق ورديتي", "⏹ Close my shift") : L("▶ بدء ورديتي", "▶ Start my shift")}</button></div>
      ${sh ? stat(L("بدأت", "Started"), `${fmtDT(sh.startAt)} (${durTxt(live.hours)})`) + stat(L("طلبات دفعتها في ورديتي", "Orders paid on my shift"), `${live.orders} / ${money(live.sales)}`) + stat(L("المحصّل", "Collected"), methodTxt(live.inBy))
          + (live.refunds ? stat(L("مرتجع نقدي", "Cash refunds"), money(live.refunds)) : "") + (live.expenses ? stat(L("مصروفات", "Expenses"), money(live.expenses)) : "")
          + stat(L("نقد الاستلام", "Opening cash"), money(live.opening)) + stat(`<strong>${L("💵 النقد المتوقع في الدرج", "💵 Expected cash in the drawer")}</strong>`, money(live.expectedCash), "font-size:17px;color:var(--success)")
        : `<div class="empty-state compact">${L("لا توجد وردية مفتوحة — ابدأ ورديتك أول الدوام", "No open shift — start your shift when you begin work")}</div>`}
      <h4 style="margin:16px 0 6px">${L("وردياتي السابقة", "My past shifts")}</h4>
      <div class="table-wrap"><table><thead><tr><th>${L("البداية", "Start")}</th><th>${L("النهاية", "End")}</th><th>${L("طلبات / مبيعات", "Orders / sales")}</th><th>${L("المتوقع", "Expected")}</th><th>${L("الفعلي", "Counted")}</th><th>${L("الفرق", "Difference")}</th></tr></thead><tbody>
      ${mine.map((x) => { const sm = x.summary || {}; return `<tr><td>${fmtDT(x.startAt)}</td><td>${fmtDT(x.endAt)}</td><td>${sm.orders || 0} / ${money(sm.sales || 0)}</td><td>${money(x.expectedCash)}</td><td>${money(x.countedCash)}</td><td style="font-weight:800;color:${x.variance ? "var(--danger)" : "var(--success)"}">${money(x.variance)}</td></tr>`; }).join("") || `<tr><td colspan="6" class="empty-state compact">${L("لا توجد ورديات مغلقة بعد", "No closed shifts yet")}</td></tr>`}</tbody></table></div>`;
    document.getElementById("myShiftBtn").addEventListener("click", shiftButton);
  }
  // لوحة الورديات في صفحة الإغلاقات (للمدير): ورديات اليوم المختار + المفتوحة
  function renderShiftsPanel(dayStr) {
    const el = document.getElementById("shiftsPanel"); if (!el) return;
    const list = shifts.filter((x) => !x.endAt || FIN.localDay(x.startAt) === dayStr || FIN.localDay(x.endAt) === dayStr);
    const rows = list.map((x) => {
      const sm = x.endAt ? x.summary || FIN.shiftSummary(finData(), x) : FIN.shiftSummary(finData(), x);
      const exp = x.endAt ? x.expectedCash : sm.expectedCash;
      return `<tr><td><b>${esc(x.employeeName)}</b>${x.endAt ? "" : ' <span class="status-badge status-ready">مفتوحة</span>'}</td>
        <td>${fmtDT(x.startAt)}</td><td>${x.endAt ? fmtDT(x.endAt) : "—"}</td><td>${durTxt(sm.hours)}</td>
        <td>${sm.orders} / ${money(sm.sales)}</td><td>${methodTxt(sm.inBy)}</td><td>${money(x.openingCash)}</td><td>${money(exp)}</td>
        <td>${x.endAt ? money(x.countedCash) : "—"}</td>
        <td style="font-weight:800;color:${x.variance ? "var(--danger)" : "var(--success)"}">${x.endAt ? money(x.variance) + (x.endNote ? `<br><small class="inv-muted">${esc(x.endNote)}</small>` : "") : "—"}</td>
        <td>${!x.endAt && can("approve_closing") && (!me || x.employeeId !== me.id) ? `<button class="mini-btn" type="button" data-force-close="${x.id}">إغلاق</button>` : ""}</td></tr>`;
    }).join("");
    el.innerHTML = `<div class="panel-header"><div><h3>🕐 ${lang === "en" ? "Shifts" : "الورديات"}</h3><p>${lang === "en" ? "Attendance and cash custody per employee" : "الحضور والانصراف وعهدة الصندوق لكل موظف"} — ${dayStr}</p></div></div>
      <div class="table-wrap"><table><thead><tr><th>الموظف</th><th>البداية</th><th>النهاية</th><th>المدة</th><th>طلبات / مبيعات</th><th>المحصّل</th><th>نقد الاستلام</th><th>المتوقع</th><th>الفعلي</th><th>الفرق</th><th></th></tr></thead>
      <tbody>${rows || `<tr><td colspan="11" class="empty-state compact">لا توجد ورديات لهذا اليوم</td></tr>`}</tbody></table></div>`;
    el.querySelectorAll("[data-force-close]").forEach((b) => b.addEventListener("click", () => { const x = shifts.find((y) => y.id === b.dataset.forceClose); if (x) openCloseShift(x); }));
  }
  window.L997Shift = {
    guard: shiftGuard, renderPanel: renderShiftsPanel, renderMine: renderMyShifts,
    list: () => shifts,
    hoursInMonth: (empId, monthKey) => Math.round(shifts.filter((x) => x.employeeId === empId && x.endAt && FIN.localDay(x.startAt).slice(0, 7) === monthKey).reduce((a, x) => a + ((x.summary && x.summary.hours) || 0), 0) * 10) / 10,
    daysInMonth: (empId, monthKey) => new Set(shifts.filter((x) => x.employeeId === empId && FIN.localDay(x.startAt).slice(0, 7) === monthKey).map((x) => FIN.localDay(x.startAt))),
  };

  /* ============================= الإقلاع ============================= */
  applyStaticI18n();
  initAuth();
  checkStorageUsage();
  checkBackupReminder();
})();

/* ===== next module ===== */

(function(){
 function q(id){return document.getElementById(id)}; function t(k,...a){return window.t997?window.t997(k,...a):k}; function money(v){return (Number(v||0)).toFixed(3)+' '+t('currency')}; function esc(s){return String(s??'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]))}
 const CAN=(p)=>!!(window.L997Auth&&window.L997Auth.can(p));
 function orders(){try{return JSON.parse(localStorage.getItem('l997_orders')||'[]')}catch{return[]}};function ledger(){try{return JSON.parse(localStorage.getItem('l997_ledger')||'[]')}catch{return[]}};
 function within(iso,days){if(!iso)return false;return Date.now()-new Date(iso).getTime()<=days*86400000}
 function inDateRange(iso,fromStr,toStr){if(!iso)return false;if(!fromStr||!toStr)return true;const t=new Date(iso).getTime();return t>=new Date(fromStr+'T00:00:00').getTime()&&t<=new Date(toStr+'T23:59:59').getTime()}
 function pay(o){return o.payment||{}}
 const FIN=window.L997Finance; const FX=(k,...a)=>window.FX997?window.FX997(k,...a):k;
 function finData(){const E=L997Enterprise.data;const ls=k=>{try{return JSON.parse(localStorage.getItem(k)||'[]')}catch{return[]}};return{orders:orders(),ledger:ledger(),customers:ls('l997_customers'),customerPackages:ls('l997_customer_packages'),expenses:E.expenses,payroll:E.payroll}}
 // كل الأرقام المالية من المحرك الموحّد (finance.js) — نفس النتائج بالرئيسية والتقارير والإغلاق
 function calcRange(fromStr,toStr){return FIN.summarize(finData(),fromStr,toStr)}
 const L4=()=>window.getLang997?window.getLang997():'ar';
 const catLabel=c=>L4()==='en'?c.en:c.ar;
 const groupLabel=id=>{const g=FIN.EXPENSE_GROUPS.find(x=>x.id===id);return g?(L4()==='en'?g.en:g.ar):id};
 // قائمة تصنيفات المصروف مجمّعة حسب المجموعة (بدون مشتريات المخزون — تُسجَّل من صفحة المخزون)
 const catOptions=(exclude=[])=>FIN.EXPENSE_CATEGORIES.filter(c=>!exclude.includes(c.id)).map(c=>({value:c.id,label:catLabel(c),group:groupLabel(c.group)}));
 const METHOD_OPTS=[{value:'cash',label:'نقداً'},{value:'card',label:'بطاقة'},{value:'benefitpay',label:'Benefit Pay'},{value:'bank_transfer',label:'تحويل بنكي'}];
 function defaultFinanceDates(){const to=FIN.todayStr();return{from:FIN.addDays(to,-29),to}}
 function renderFinance(){
  if(!q('financeFromDate').value){const d=defaultFinanceDates();q('financeFromDate').value=d.from;q('financeToDate').value=d.to}
  const fromStr=q('financeFromDate').value, toStr=q('financeToDate').value, reportType=q('financeReportType').value;
  const x=calcRange(fromStr,toStr);
  const snap=FIN.snapshot(finData());
  q('financeMetrics').innerHTML=[[FX('sales'),money(x.salesTotal),'kpi-positive'],[FX('collected'),money(x.collected),'kpi-positive'],[FX('expenses'),money(x.expenses),'kpi-negative'],[FX('receivables'),money(snap.receivables),'kpi-warn'],[FX('profit'),money(x.profit),x.profit>=0?'kpi-positive':'kpi-negative']].map(a=>`<div class="enterprise-card"><h4>${a[0]}</h4><strong class="${a[2]}">${a[1]}</strong></div>`).join('');

  const body=q('financeReportBody');
  const ms=(label,v,cls)=>`<div class="mini-stat"><span>${label}</span><b${cls?` class="${cls}"`:''}>${money(v)}</b></div>`;
  if(reportType==='performance'){
    const pmLabels={cash:t('opt_cash'),benefitpay:'BenefitPay',card:t('opt_card'),bank_transfer:t('opt_bank_transfer')};
    body.innerHTML=`<div class="panel"><h3 style="margin:0 0 10px">${t('fin_performance_title')}</h3>${ms(FX('sales'),x.salesTotal)}${x.packageSales?ms(FX('pkg_sales'),x.packageSales):''}${ms(FX('discounts'),x.discounts)}${ms(FX('from_balance'),x.paidFromBalance)}${ms(FX('credit'),x.creditGiven)}<hr><h4 style="margin:6px 0">${FX('cash_methods')}</h4>${FIN.CASH_METHODS.map(k=>ms(pmLabels[k]||k,x.collectedBy[k]||0)).join('')}${ms('− '+FX('refunds'),x.refunds,'kpi-negative')}${ms(FX('collected'),x.collected,'kpi-positive')}</div>`;
  } else if(reportType==='pnl'){
    body.innerHTML=`<div class="panel"><h3 style="margin:0 0 10px">${t('fin_pnl_title')}</h3>
      ${ms(FX('gross'),x.salesTotal)}${x.vat?ms('− '+FX('vat'),x.vat):''}${ms(FX('net_rev'),x.netRevenue,'kpi-positive')}
      ${ms('− '+FX('expenses'),x.expenses,'kpi-negative')}${FIN.EXPENSE_GROUPS.filter(g=>x.expensesByGroup[g.id]).map(g=>ms('  · '+groupLabel(g.id),x.expensesByGroup[g.id])).join('')}
      <hr>${ms(FX('profit'),x.profit,x.profit>=0?'kpi-positive':'kpi-negative')}<p class="subtle" style="font-size:12px;margin-top:8px">${FX('profit_hint')}</p></div>`;
  } else if(reportType==='expenses'){
    const filteredExp=L997Enterprise.data.expenses.filter(e=>inDateRange(e.date,fromStr,toStr));
    const byCat={};filteredExp.forEach(e=>{byCat[e.category||'—']=(byCat[e.category||'—']||0)+Number(e.amount||0)});
    body.innerHTML=`<div class="panel"><h3 style="margin:0 0 10px">${t('fin_expenses_by_type')} (${filteredExp.length})</h3>${Object.entries(byCat).length?Object.entries(byCat).map(([k,v])=>`<div class="mini-stat"><span>${esc(k)}</span><b class="kpi-negative">${money(v)}</b></div>`).join(''):`<div class="empty-state compact">${t('no_expenses')}</div>`}</div>`;
  }

  q('expenseList').innerHTML=L997Enterprise.data.expenses.slice(0,30).map(e=>`<div class="ledger-item"${e.voided?' style="opacity:.55"':''}><div><strong${e.voided?' style="text-decoration:line-through"':''}>${esc(e.category||'—')}</strong> <span class="inv-tag">${esc(groupLabel(FIN.expenseCategory(e).group))}</span><small>${new Date(e.date).toLocaleString(window.getLang997?window.getLang997():'ar',{timeZone:'Asia/Bahrain'})} ${esc(e.note||'')}${e.voided?` — ❌ ملغي: ${esc(e.voidReason||'')}${e.voidedBy?' ('+esc(e.voidedBy)+')':''}`:''}</small></div><div class="row-actions"><b class="kpi-negative"${e.voided?' style="text-decoration:line-through"':''}>${money(e.amount)}</b>${!e.voided&&!e.purchaseId&&CAN('delete_records')?`<button class="mini-btn danger-mini" type="button" data-void-exp="${e.id}">إلغاء</button>`:''}</div></div>`).join('')||`<div class="empty-state compact">${t('no_expenses')}</div>`;
  q('expenseList').querySelectorAll('[data-void-exp]').forEach(btn=>btn.addEventListener('click',()=>{
    const ex=L997Enterprise.data.expenses.find(x=>x.id===btn.dataset.voidExp);if(!ex)return;
    const day=FIN.localDay(ex.date),closed=L997Enterprise.data.closures.some(c=>c.type==='daily'&&c.forDate===day);
    window.openQuickForm({title:'إلغاء مصروف',sub:`${ex.category||''} — ${money(ex.amount)}${closed?` ⚠ يوم ${day} مُغلق مسبقاً — سيختلف عن الإغلاق المعتمد`:''}`,fields:[{id:'reason',label:'سبب الإلغاء (إلزامي)',type:'text'}],submitLabel:'تأكيد الإلغاء',onSubmit:v=>{
      if(!v.reason){window.toast('سبب الإلغاء إلزامي');return false}
      const me=window.L997Auth?window.L997Auth.user():null;
      L997Enterprise.voidExpense(ex.id,v.reason,me?me.name:'');renderFinance();typeof renderClosures==='function'&&renderClosures();window.toast('تم إلغاء المصروف');
    }});
  }));

  const rx=L997Enterprise.data.recurringExpenses;
  q('recurringExpensesBody').innerHTML=rx.length?rx.map(r=>`<tr><td>${esc(r.name)}</td><td>${money(r.amount)}</td><td>${r.frequency==='monthly'?t('freq_monthly'):t('freq_daily')}</td><td>${r.lastAppliedPeriod||'—'}</td><td><button class="mini-btn" data-edit-recurring="${r.id}">${t('btn_edit')}</button> <button class="mini-btn danger-mini" data-del-recurring="${r.id}">${t('btn_delete')}</button></td></tr>`).join(''):`<tr><td colspan="5" class="empty-state compact">${t('no_recurring')}</td></tr>`;
  q('recurringExpensesBody').querySelectorAll('[data-del-recurring]').forEach(btn=>{
    btn.addEventListener('click',()=>{if(!CAN('delete_records')){window.toast('ليست لديك صلاحية لهذا الإجراء');return}const r=rx.find(x=>x.id===btn.dataset.delRecurring);window.confirmAction(`حذف المصروف المتكرر «${r?r.name:''}»؟`,()=>{L997Enterprise.deleteRecurringExpense(btn.dataset.delRecurring);L997Enterprise.log('حذف مصروف متكرر',r?r.amount:0,{name:r?r.name:''});renderFinance();window.toast&&window.toast('تم حذف المصروف المتكرر')})});
  });
  q('recurringExpensesBody').querySelectorAll('[data-edit-recurring]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      if(!CAN('add_expense')){window.toast('ليست لديك صلاحية لهذا الإجراء');return}
      const r=rx.find(x=>x.id===btn.dataset.editRecurring);if(!r)return;
      window.openQuickForm({
        title:t('btn_edit')+' — '+r.name, sub:r.name,
        fields:[
          {id:'name',label:t('th_recurring_name'),type:'text',value:r.name},
          {id:'amount',label:t('th_recurring_amount'),type:'number',step:'0.001',value:r.amount,min:0},
          {id:'frequency',label:t('th_recurring_freq'),type:'select',value:r.frequency,options:[{value:'daily',label:t('freq_daily')},{value:'monthly',label:t('freq_monthly')}]},
        ],
        onSubmit:(v)=>{
          if(!v.name){window.toast('أدخل اسم المصروف');return false}
          if(!(v.amount>0)){window.toast('أدخل مبلغاً صحيحاً');return false}
          L997Enterprise.updateRecurringExpense(r.id,{name:v.name,amount:v.amount,frequency:v.frequency});
          L997Enterprise.log('تعديل مصروف متكرر',v.amount,{name:v.name,from:r.amount});
          renderFinance();
          window.toast('تم تحديث المصروف المتكرر');
        }
      });
    });
  });
 }
 q('financeViewBtn')?.addEventListener('click',renderFinance);
 q('addRecurringExpenseBtn')?.addEventListener('click',()=>{
   if(!CAN('add_expense')){window.toast('ليست لديك صلاحية لهذا الإجراء');return}
   window.openQuickForm({
     title:'مصروف متكرر جديد', sub:'إيجار، رواتب، اشتراكات...',
     fields:[
       {id:'name',label:'اسم المصروف',type:'text',placeholder:'مثال: إيجار المحل'},
       {id:'catId',label:'نوع المصروف',type:'select',value:'rent',options:catOptions(['inventory','advance'])},
       {id:'amount',label:'المبلغ (د.ب)',type:'number',step:'0.001',value:0,min:0},
       {id:'frequency',label:'التكرار',type:'select',value:'monthly',options:[{value:'daily',label:'يومي'},{value:'monthly',label:'شهري'}]},
     ],
     onSubmit:(v)=>{
       if(!v.name){window.toast('أدخل اسم المصروف');return false}
       if(!(v.amount>0)){window.toast('أدخل مبلغاً صحيحاً');return false}
       L997Enterprise.addRecurringExpense({name:v.name,catId:v.catId,amount:v.amount,frequency:v.frequency});
       renderFinance();
       window.toast('تم إضافة المصروف المتكرر');
     }
   });
 });
 q('applyRecurringExpensesBtn')?.addEventListener('click',()=>{
   if(!CAN('add_expense')){window.toast('ليست لديك صلاحية لهذا الإجراء');return}
   const n=L997Enterprise.applyRecurringExpenses();
   renderFinance();
   window.toast&&window.toast(n>0?`تم تطبيق ${n} مصروف متكرر`:'لا يوجد مصروف مستحق حالياً');
 });
 /* ===================== المخزون والمشتريات (نسخة موسّعة) ===================== */
 const IT={
  ar:{tab_overview:'نظرة عامة',tab_items:'المواد',tab_purchases:'المشتريات',tab_suppliers:'الموردون',tab_moves:'الحركات',tab_count:'الجرد',
   m_items:'عدد المواد',m_low:'منخفضة',m_out:'نافدة',m_value:'قيمة المخزون',m_month:'مشتريات الشهر',m_owed:'مستحقات الموردين',
   reorder_title:'قائمة إعادة الطلب',reorder_sub:'المواد المنخفضة أو النافدة مع الكمية المقترحة للوصول للمستوى المستهدف',reorder_ok:'كل المواد فوق حد التنبيه 🎉',
   no_supplier:'بدون مورد محدد',suggested:'المقترح',est_cost:'تكلفة تقديرية',send_wa:'طلب عبر واتساب',
   value_chart:'قيمة المخزون حسب المادة',no_data:'لا توجد بيانات',
   buy:'شراء',use:'صرف',hist:'السجل',edit:'تعديل',del:'حذف',pay:'تسديد',void:'إلغاء',cancel:'إلغاء',
   search:'بحث عن مادة...',all:'الكل',
   th_material:'المادة',th_category:'التصنيف',th_stock:'المتوفر',th_min:'حد التنبيه',th_target:'المستهدف',th_cost:'متوسط التكلفة',th_value:'القيمة',th_status:'الحالة',
   th_date:'التاريخ',th_supplier:'المورد',th_qty:'الكمية',th_unitcost:'سعر الوحدة',th_total:'الإجمالي',th_invoice:'رقم الفاتورة',th_phone:'الهاتف',th_bought:'إجمالي المشتريات',th_owed:'المستحق',th_last:'آخر شراء',
   th_type:'النوع',th_balance:'الرصيد بعد',th_note:'ملاحظة',th_user:'المستخدم',th_system:'بالنظام',th_actual:'الفعلي',th_diff:'الفرق',th_diffval:'قيمة الفرق',
   st_ok:'جيد',st_low:'منخفض',st_out:'نافد',st_paid:'مدفوع',st_unpaid:'آجل',st_void:'ملغي',
   add_material:'+ مادة جديدة',add_purchase:'+ تسجيل شراء',add_supplier:'+ مورد جديد',
   f_name:'اسم المادة',f_category:'التصنيف',f_unit:'الوحدة',f_open:'الكمية الافتتاحية',f_min:'حد التنبيه',f_target:'الكمية المستهدفة (للطلب)',f_supplier:'المورد',f_none:'— بدون —',
   f_qty:'الكمية',f_unitcost:'سعر الوحدة (د.ب)',f_invoice:'رقم الفاتورة (اختياري)',f_paystatus:'حالة الدفع',f_paidnow:'مدفوع الآن',f_credit:'آجل (يُسدَّد لاحقاً)',f_method:'طريقة الدفع',
   f_reason:'السبب',f_note:'ملاحظة (اختياري)',f_sname:'اسم المورد',f_sphone:'الهاتف',f_snotes:'ملاحظات',f_material:'المادة',
   unit_hint:'كجم، لتر، حبة...',
   cat_detergent:'مواد غسيل',cat_packaging:'تغليف',cat_maint:'صيانة وقطع غيار',cat_cleaning:'أدوات نظافة',cat_other:'أخرى',
   rs_usage:'استخدام تشغيلي',rs_waste:'تالف / منتهي',rs_spill:'انسكاب / هدر',rs_internal:'استخدام داخلي',rs_other:'أخرى',
   mv_opening:'رصيد افتتاحي',mv_purchase:'شراء',mv_out:'صرف',mv_count:'تسوية جرد',mv_void:'إلغاء شراء',
   m_cash:'نقداً',m_card:'بطاقة',m_bp:'Benefit Pay',m_bank:'تحويل بنكي',
   t_material_new:'مادة جديدة',t_material_edit:'تعديل مادة',t_purchase:'تسجيل شراء',t_use:'صرف من المخزون',t_supplier_new:'مورد جديد',t_supplier_edit:'تعديل مورد',t_pay:'تسديد مشترى آجل',t_confirm:'تأكيد',
   p_all:'الكل',p_paid:'المدفوعة',p_unpaid:'الآجلة',p_voided:'الملغاة',
   mv_all:'كل الحركات',
   e_name:'أدخل اسم المادة',e_dup:'توجد مادة بنفس الاسم',e_qty:'أدخل كمية صحيحة أكبر من صفر',e_cost:'أدخل سعراً صحيحاً أكبر من صفر',e_nostock:'الكمية المطلوبة أكبر من المتوفر',e_noitems:'أضف مادة أولاً',e_sname:'أدخل اسم المورد',e_void_stock:'لا يمكن إلغاء الشراء كاملاً لأن جزءاً منه استُخدم — استخدم «تعديل» لتصحيح الكمية أو السعر',edit_pur:'تعديل',edit_pur_sub:'صحّح الكمية أو سعر الوحدة — يُعدَّل المخزون والمصروف المرتبط تلقائياً',f_edit_reason:'سبب التعديل (إلزامي)',e_reason:'اكتب سبب التعديل',e_edit_stock:n=>`لا يمكن تقليل الكمية بهذا القدر: استُخدم جزء منها — أقل كمية ممكنة الآن ${n}`,ok_edit_pur:'تم تعديل الشراء',e_min:'القيم لا يمكن أن تكون سالبة',
   ok_material:'تم حفظ المادة',ok_purchase:'تم تسجيل الشراء وتحديث المخزون',ok_use:'تم تسجيل الصرف',ok_supplier:'تم حفظ المورد',ok_pay:'تم التسديد وتسجيل المصروف',ok_void:'تم إلغاء الشراء وعكس الكمية',ok_del:'تم الحذف',ok_count:n=>`تمت تسوية ${n} مادة`,no_changes:'لا توجد فروقات للتسوية',
   c_del_material:n=>`حذف المادة «${n}» نهائياً؟ سجل حركاتها السابق يبقى محفوظاً.`,c_void:'إلغاء هذا الشراء؟ ستُخصم الكمية من المخزون ويُحذف المصروف المرتبط به.',c_del_supplier:n=>`حذف المورد «${n}»؟ تبقى مشترياته السابقة في السجل.`,
   count_hint:'اكتب الكمية الفعلية الموجودة على الرف. اترك الخانة فارغة للمواد التي لم تعدّها. ثم اضغط اعتماد الجرد.',apply_count:'اعتماد الجرد',count_note:'جرد فعلي',
   moves_empty:'لا توجد حركات بعد',purchases_empty:'لا توجد مشتريات',suppliers_empty:'لا يوجد موردون',items_empty:'لا توجد مواد',
   wa_order:(s,lines)=>`السلام عليكم ${s}،\nنرغب بطلب المواد التالية لمغسلة 997:\n${lines}\nيرجى تأكيد التوفر وموعد التوريد. شكراً لكم.`,
   hist_for:'سجل حركة',clear:'مسح الفلتر'},
  en:{tab_overview:'Overview',tab_items:'Materials',tab_purchases:'Purchases',tab_suppliers:'Suppliers',tab_moves:'Movements',tab_count:'Stock count',
   m_items:'Materials',m_low:'Low',m_out:'Out of stock',m_value:'Stock value',m_month:'This month purchases',m_owed:'Owed to suppliers',
   reorder_title:'Reorder list',reorder_sub:'Low or empty materials with the suggested quantity to reach the target level',reorder_ok:'All materials are above their alert level 🎉',
   no_supplier:'No supplier set',suggested:'Suggested',est_cost:'Est. cost',send_wa:'Order via WhatsApp',
   value_chart:'Stock value by material',no_data:'No data',
   buy:'Buy',use:'Use',hist:'History',edit:'Edit',del:'Delete',pay:'Pay',void:'Void',cancel:'Cancel',
   search:'Search material...',all:'All',
   th_material:'Material',th_category:'Category',th_stock:'In stock',th_min:'Alert level',th_target:'Target',th_cost:'Avg. cost',th_value:'Value',th_status:'Status',
   th_date:'Date',th_supplier:'Supplier',th_qty:'Qty',th_unitcost:'Unit cost',th_total:'Total',th_invoice:'Invoice #',th_phone:'Phone',th_bought:'Total purchased',th_owed:'Owed',th_last:'Last purchase',
   th_type:'Type',th_balance:'Balance after',th_note:'Note',th_user:'User',th_system:'System',th_actual:'Actual',th_diff:'Difference',th_diffval:'Diff. value',
   st_ok:'Good',st_low:'Low',st_out:'Out',st_paid:'Paid',st_unpaid:'On credit',st_void:'Voided',
   add_material:'+ New material',add_purchase:'+ Record purchase',add_supplier:'+ New supplier',
   f_name:'Material name',f_category:'Category',f_unit:'Unit',f_open:'Opening quantity',f_min:'Alert level',f_target:'Target quantity (for ordering)',f_supplier:'Supplier',f_none:'— None —',
   f_qty:'Quantity',f_unitcost:'Unit cost (BD)',f_invoice:'Invoice no. (optional)',f_paystatus:'Payment status',f_paidnow:'Paid now',f_credit:'On credit (pay later)',f_method:'Payment method',
   f_reason:'Reason',f_note:'Note (optional)',f_sname:'Supplier name',f_sphone:'Phone',f_snotes:'Notes',f_material:'Material',
   unit_hint:'kg, litre, pcs...',
   cat_detergent:'Detergents',cat_packaging:'Packaging',cat_maint:'Maintenance & parts',cat_cleaning:'Cleaning supplies',cat_other:'Other',
   rs_usage:'Operational use',rs_waste:'Damaged / expired',rs_spill:'Spill / waste',rs_internal:'Internal use',rs_other:'Other',
   mv_opening:'Opening balance',mv_purchase:'Purchase',mv_out:'Issue',mv_count:'Count adjustment',mv_void:'Purchase voided',
   m_cash:'Cash',m_card:'Card',m_bp:'Benefit Pay',m_bank:'Bank transfer',
   t_material_new:'New material',t_material_edit:'Edit material',t_purchase:'Record purchase',t_use:'Issue from stock',t_supplier_new:'New supplier',t_supplier_edit:'Edit supplier',t_pay:'Pay credit purchase',t_confirm:'Confirm',
   p_all:'All',p_paid:'Paid',p_unpaid:'On credit',p_voided:'Voided',
   mv_all:'All movements',
   e_name:'Enter the material name',e_dup:'A material with this name already exists',e_qty:'Enter a valid quantity above zero',e_cost:'Enter a valid price above zero',e_nostock:'Requested quantity exceeds stock',e_noitems:'Add a material first',e_sname:'Enter the supplier name',e_void_stock:'Cannot void the whole purchase because part of it was used — use "Edit" to correct the quantity or price',edit_pur:'Edit',edit_pur_sub:'Correct the quantity or unit price — stock and the linked expense update automatically',f_edit_reason:'Reason for the change (required)',e_reason:'Enter the reason',e_edit_stock:n=>`Cannot reduce that much: part of it was used — lowest possible quantity now ${n}`,ok_edit_pur:'Purchase updated',e_min:'Values cannot be negative',
   ok_material:'Material saved',ok_purchase:'Purchase recorded and stock updated',ok_use:'Issue recorded',ok_supplier:'Supplier saved',ok_pay:'Paid and expense recorded',ok_void:'Purchase voided and quantity reversed',ok_del:'Deleted',ok_count:n=>`${n} material(s) adjusted`,no_changes:'No differences to adjust',
   c_del_material:n=>`Permanently delete "${n}"? Its past movements stay in the log.`,c_void:'Void this purchase? The quantity is deducted from stock and its linked expense is removed.',c_del_supplier:n=>`Delete supplier "${n}"? Past purchases stay in the log.`,
   count_hint:'Enter the actual quantity on the shelf. Leave blank for materials you did not count. Then press Apply count.',apply_count:'Apply count',count_note:'Physical count',
   moves_empty:'No movements yet',purchases_empty:'No purchases',suppliers_empty:'No suppliers',items_empty:'No materials',
   wa_order:(s,lines)=>`Hello ${s},\nWe would like to order the following for 997 Laundry:\n${lines}\nPlease confirm availability and delivery time. Thank you.`,
   hist_for:'Movements for',clear:'Clear filter'},
  ur:{tab_overview:'جائزہ',tab_items:'مواد',tab_purchases:'خریداری',tab_suppliers:'سپلائرز',tab_moves:'نقل و حرکت',tab_count:'اسٹاک گنتی',
   m_items:'مواد کی تعداد',m_low:'کم',m_out:'ختم',m_value:'اسٹاک کی مالیت',m_month:'اس ماہ کی خریداری',m_owed:'سپلائرز کے واجبات',
   reorder_title:'دوبارہ آرڈر کی فہرست',reorder_sub:'کم یا ختم مواد اور ہدف تک پہنچنے کے لیے تجویز کردہ مقدار',reorder_ok:'تمام مواد الرٹ حد سے اوپر ہیں 🎉',
   no_supplier:'سپلائر مقرر نہیں',suggested:'تجویز',est_cost:'تخمینی لاگت',send_wa:'واٹس ایپ پر آرڈر',
   value_chart:'مواد کے لحاظ سے اسٹاک کی مالیت',no_data:'کوئی ڈیٹا نہیں',
   buy:'خریدیں',use:'نکالیں',hist:'ریکارڈ',edit:'ترمیم',del:'حذف',pay:'ادائیگی',void:'منسوخ',cancel:'منسوخ',
   search:'مواد تلاش کریں...',all:'سب',
   th_material:'مواد',th_category:'زمرہ',th_stock:'دستیاب',th_min:'الرٹ حد',th_target:'ہدف',th_cost:'اوسط لاگت',th_value:'مالیت',th_status:'حالت',
   th_date:'تاریخ',th_supplier:'سپلائر',th_qty:'مقدار',th_unitcost:'فی یونٹ قیمت',th_total:'کل',th_invoice:'انوائس نمبر',th_phone:'فون',th_bought:'کل خریداری',th_owed:'واجب الادا',th_last:'آخری خریداری',
   th_type:'قسم',th_balance:'بعد کا بیلنس',th_note:'نوٹ',th_user:'صارف',th_system:'سسٹم',th_actual:'اصل',th_diff:'فرق',th_diffval:'فرق کی مالیت',
   st_ok:'ٹھیک',st_low:'کم',st_out:'ختم',st_paid:'ادا شدہ',st_unpaid:'ادھار',st_void:'منسوخ',
   add_material:'+ نیا مواد',add_purchase:'+ خریداری درج کریں',add_supplier:'+ نیا سپلائر',
   f_name:'مواد کا نام',f_category:'زمرہ',f_unit:'یونٹ',f_open:'ابتدائی مقدار',f_min:'الرٹ حد',f_target:'ہدفی مقدار (آرڈر کے لیے)',f_supplier:'سپلائر',f_none:'— کوئی نہیں —',
   f_qty:'مقدار',f_unitcost:'فی یونٹ قیمت (BD)',f_invoice:'انوائس نمبر (اختیاری)',f_paystatus:'ادائیگی کی حالت',f_paidnow:'ابھی ادا',f_credit:'ادھار (بعد میں ادا)',f_method:'ادائیگی کا طریقہ',
   f_reason:'وجہ',f_note:'نوٹ (اختیاری)',f_sname:'سپلائر کا نام',f_sphone:'فون',f_snotes:'نوٹس',f_material:'مواد',
   unit_hint:'کلو، لیٹر، عدد...',
   cat_detergent:'ڈٹرجنٹ',cat_packaging:'پیکنگ',cat_maint:'مرمت اور پرزے',cat_cleaning:'صفائی کا سامان',cat_other:'دیگر',
   rs_usage:'آپریشنل استعمال',rs_waste:'خراب / ایکسپائر',rs_spill:'گرنا / ضیاع',rs_internal:'اندرونی استعمال',rs_other:'دیگر',
   mv_opening:'ابتدائی بیلنس',mv_purchase:'خریداری',mv_out:'اجرا',mv_count:'گنتی کی درستی',mv_void:'خریداری منسوخ',
   m_cash:'نقد',m_card:'کارڈ',m_bp:'Benefit Pay',m_bank:'بینک ٹرانسفر',
   t_material_new:'نیا مواد',t_material_edit:'مواد میں ترمیم',t_purchase:'خریداری درج کریں',t_use:'اسٹاک سے نکالیں',t_supplier_new:'نیا سپلائر',t_supplier_edit:'سپلائر میں ترمیم',t_pay:'ادھار خریداری کی ادائیگی',t_confirm:'تصدیق',
   p_all:'سب',p_paid:'ادا شدہ',p_unpaid:'ادھار',p_voided:'منسوخ',
   mv_all:'تمام حرکات',
   e_name:'مواد کا نام لکھیں',e_dup:'اسی نام کا مواد پہلے سے موجود ہے',e_qty:'صفر سے زیادہ درست مقدار لکھیں',e_cost:'صفر سے زیادہ درست قیمت لکھیں',e_nostock:'مطلوبہ مقدار دستیاب سے زیادہ ہے',e_noitems:'پہلے مواد شامل کریں',e_sname:'سپلائر کا نام لکھیں',e_void_stock:'منسوخ نہیں ہو سکتا: موجودہ اسٹاک خریدی گئی مقدار سے کم ہے',e_min:'قدریں منفی نہیں ہو سکتیں',
   ok_material:'مواد محفوظ ہو گیا',ok_purchase:'خریداری درج ہوئی اور اسٹاک اپڈیٹ ہوا',ok_use:'اجرا درج ہو گیا',ok_supplier:'سپلائر محفوظ ہو گیا',ok_pay:'ادائیگی ہو گئی اور اخراجات درج ہوئے',ok_void:'خریداری منسوخ اور مقدار واپس',ok_del:'حذف ہو گیا',ok_count:n=>`${n} مواد درست کیے گئے`,no_changes:'درستی کے لیے کوئی فرق نہیں',
   c_del_material:n=>`«${n}» ہمیشہ کے لیے حذف کریں؟ اس کی پرانی حرکات ریکارڈ میں رہیں گی۔`,c_void:'یہ خریداری منسوخ کریں؟ مقدار اسٹاک سے کم ہو گی اور متعلقہ خرچ ہٹ جائے گا۔',c_del_supplier:n=>`سپلائر «${n}» حذف کریں؟ پرانی خریداریاں ریکارڈ میں رہیں گی۔`,
   count_hint:'شیلف پر موجود اصل مقدار لکھیں۔ جو مواد نہیں گنا اسے خالی چھوڑ دیں۔ پھر گنتی منظور کریں دبائیں۔',apply_count:'گنتی منظور کریں',count_note:'اصل گنتی',
   moves_empty:'ابھی کوئی حرکت نہیں',purchases_empty:'کوئی خریداری نہیں',suppliers_empty:'کوئی سپلائر نہیں',items_empty:'کوئی مواد نہیں',
   wa_order:(s,lines)=>`السلام علیکم ${s}،\nہمیں 997 لانڈری کے لیے درج ذیل آرڈر کرنا ہے:\n${lines}\nبراہ کرم دستیابی اور ترسیل کا وقت بتائیں۔ شکریہ۔`,
   hist_for:'حرکات برائے',clear:'فلٹر ہٹائیں'}
 };
 const IL=()=>(window.getLang997&&window.getLang997())||'ar';
 const IX=(k,...a)=>{const d=IT[IL()]||IT.ar;let s=d[k];if(s===undefined)s=IT.ar[k];if(s===undefined)return k;return typeof s==='function'?s(...a):s};
 const CATS=['detergent','packaging','maint','cleaning','other'];
 const REASONS=['usage','waste','spill','internal','other'];
 const METHODS=[['cash','m_cash'],['card','m_card'],['benefitpay','m_bp'],['bank_transfer','m_bank']];
 const iv={tab:'overview',search:'',cat:'all',pur:'all',mvType:'all',mvSearch:''};
 const E=()=>L997Enterprise;
 const invs=()=>E().data.inventory, sups=()=>E().data.suppliers;
 const r3x=n=>+(Number(n||0)).toFixed(3);
 const qtyFmt=n=>{n=r3x(n);return String(n)};
 const itemStatus=i=>i.qty<=0?'out':(i.qty<=i.minQty?'low':'ok');
 const itemTarget=i=>(i.targetQty>i.minQty?i.targetQty:Math.max(i.minQty*3,1));
 const itemSuggest=i=>r3x(Math.max(0,itemTarget(i)-i.qty));
 const stBadge=s=>s==='out'?`<span class="priority-badge priority-urgent">${IX('st_out')}</span>`:s==='low'?`<span class="priority-badge priority-high">${IX('st_low')}</span>`:`<span class="status-badge status-ready">${IX('st_ok')}</span>`;
 const catName=c=>IX('cat_'+(CATS.includes(c)?c:'other'));
 const supName=id=>{const s=sups().find(x=>x.id===id);return s?s.name:''};
 const waNum=p=>{if(window.normPhone997){const n=window.normPhone997(p);return n.ok?n.digits:''}let d=String(p||'').replace(/\D/g,'');if(d.startsWith('00'))d=d.slice(2);if(d.length===8)d='973'+d;return d};
 const fmtDate=iso=>{try{return new Date(iso).toLocaleString(IL(),{timeZone:'Asia/Bahrain'})}catch{return iso||''}};
 const activePurchases=()=>E().data.purchases.filter(p=>!p.voided);
 const supplierOptions=sel=>[{value:'',label:IX('f_none')},...sups().map(s=>({value:s.id,label:s.name}))].map(o=>({...o,sel}));
 function invConfirm(message,onYes){window.openQuickForm({title:IX('t_confirm'),sub:message,fields:[],submitLabel:IX('t_confirm'),onSubmit:()=>onYes()})}
 const tbl=(heads,body,empty)=>`<div class="table-wrap"><table><thead><tr>${heads.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${body||`<tr><td colspan="${heads.length}" class="empty-state compact">${empty}</td></tr>`}</tbody></table></div>`;

 function invMetrics(){
  const inv=invs();const mk=window.L997Finance.todayStr().slice(0,7);
  const month=activePurchases().filter(p=>window.L997Finance.localDay(p.date).slice(0,7)===mk).reduce((s,p)=>s+Number(p.total||0),0);
  const owed=activePurchases().filter(p=>p.paid===false).reduce((s,p)=>s+Number(p.total||0),0);
  const cards=[[IX('m_items'),inv.length],[IX('m_low'),inv.filter(i=>itemStatus(i)==='low').length],[IX('m_out'),inv.filter(i=>itemStatus(i)==='out').length],[IX('m_value'),money(inv.reduce((s,i)=>s+i.qty*(i.avgCost||0),0))],[IX('m_month'),money(month)],[IX('m_owed'),money(owed)]];
  return `<div class="metrics-grid">${cards.map(a=>`<div class="metric-card"><div class="metric-top">${a[0]}</div><div class="metric-value">${a[1]}</div></div>`).join('')}</div>`;
 }
 function reorderHtml(){
  const need=invs().filter(i=>itemStatus(i)!=='ok');
  if(!need.length)return `<div class="empty-state compact">${IX('reorder_ok')}</div>`;
  const groups={};need.forEach(i=>{(groups[i.supplierId||'']=groups[i.supplierId||'']||[]).push(i)});
  return Object.keys(groups).map(k=>{
   const list=groups[k];const sup=sups().find(s=>s.id===k);
   const total=list.reduce((s,i)=>s+itemSuggest(i)*(i.lastCost||i.avgCost||0),0);
   const rows=list.map(i=>`<tr><td>${esc(i.name)}</td><td>${qtyFmt(i.qty)} ${esc(i.unit)}</td><td>${stBadge(itemStatus(i))}</td><td><b>${qtyFmt(itemSuggest(i))}</b> ${esc(i.unit)}</td><td>${money(itemSuggest(i)*(i.lastCost||i.avgCost||0))}</td><td><button class="mini-btn" data-act="buy" data-id="${i.id}">${IX('buy')}</button></td></tr>`).join('');
   const wa=sup&&waNum(sup.phone)?`<button class="whatsapp-btn" type="button" data-act="wa" data-id="${k}">${IX('send_wa')}</button>`:'';
   return `<div class="inv-group"><div class="inv-group-head"><strong>${sup?esc(sup.name):IX('no_supplier')}</strong><span class="inv-muted">${IX('est_cost')}: ${money(total)}</span>${wa}</div>${tbl([IX('th_material'),IX('th_stock'),IX('th_status'),IX('suggested'),IX('est_cost'),''],rows,'')}</div>`;
  }).join('');
 }
 function overviewHtml(){
  const inv=invs();const valMax=Math.max(1,...inv.map(i=>i.qty*(i.avgCost||0)));
  const chart=inv.length?inv.map(i=>{const v=i.qty*(i.avgCost||0);return `<div class="dash-bar-row"><span class="dash-bar-label">${esc(i.name)}</span><div class="dash-bar-track"><div class="dash-bar-fill" style="width:${Math.max(3,Math.round(v/valMax*100))}%"></div></div><span class="dash-bar-value">${money(v)}</span></div>`}).join(''):`<div class="empty-state compact">${IX('no_data')}</div>`;
  return `<div class="panel"><div class="panel-header"><div><h3>${IX('reorder_title')}</h3><p>${IX('reorder_sub')}</p></div></div>${reorderHtml()}</div><div class="panel" style="margin-top:16px"><div class="panel-header"><div><h3>${IX('value_chart')}</h3></div></div><div class="dash-bar-chart">${chart}</div></div>`;
 }
 function itemsRowsHtml(){
  const s=iv.search.trim().toLowerCase();
  const list=invs().filter(i=>(iv.cat==='all'||(i.category||'other')===iv.cat)&&(!s||i.name.toLowerCase().includes(s)));
  return list.map(i=>`<tr><td><b>${esc(i.name)}</b><br><span class="inv-tag">${catName(i.category)}</span></td><td>${qtyFmt(i.qty)} ${esc(i.unit)}</td><td>${qtyFmt(i.minQty)}</td><td>${qtyFmt(itemTarget(i))}</td><td>${money(i.avgCost)}</td><td>${money(i.qty*(i.avgCost||0))}</td><td>${stBadge(itemStatus(i))}</td><td><div class="row-actions"><button class="mini-btn" data-act="buy" data-id="${i.id}">${IX('buy')}</button><button class="mini-btn" data-act="use" data-id="${i.id}">${IX('use')}</button><button class="mini-btn" data-act="hist" data-id="${i.id}">${IX('hist')}</button><button class="mini-btn" data-act="edit" data-id="${i.id}">${IX('edit')}</button>${CAN('delete_records')?`<button class="mini-btn danger-mini" data-act="delm" data-id="${i.id}">${IX('del')}</button>`:''}</div></td></tr>`).join('')||`<tr><td colspan="8" class="empty-state compact">${IX('items_empty')}</td></tr>`;
 }
 function itemsHtml(){
  const chips=['all',...CATS].map(c=>`<button type="button" class="cloth-chip ${iv.cat===c?'active':''}" data-act="cat" data-id="${c}">${c==='all'?IX('all'):IX('cat_'+c)}</button>`).join('');
  return `<div class="panel"><div class="panel-header"><div><h3>${IX('tab_items')}</h3></div><button class="primary-btn" type="button" data-act="addm">${IX('add_material')}</button></div><input type="search" id="invSearch" class="inv-search" placeholder="${IX('search')}" value="${esc(iv.search)}"><div class="chip-grid">${chips}</div><div class="table-wrap"><table><thead><tr>${[IX('th_material'),IX('th_stock'),IX('th_min'),IX('th_target'),IX('th_cost'),IX('th_value'),IX('th_status'),''].map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody id="invItemsBody">${itemsRowsHtml()}</tbody></table></div></div>`;
 }
 function purchasesHtml(){
  const chips=[['all','p_all'],['paid','p_paid'],['unpaid','p_unpaid'],['void','p_voided']].map(([k,l])=>`<button type="button" class="cloth-chip ${iv.pur===k?'active':''}" data-act="pur" data-id="${k}">${IX(l)}</button>`).join('');
  const list=E().data.purchases.filter(p=>iv.pur==='all'||(iv.pur==='void'?p.voided:(!p.voided&&(iv.pur==='paid'?p.paid!==false:p.paid===false)))).slice(0,300);
  const rows=list.map(p=>{
   const badge=p.voided?`<span class="priority-badge priority-urgent">${IX('st_void')}</span>`:p.paid===false?`<span class="priority-badge priority-high">${IX('st_unpaid')}</span>`:`<span class="status-badge status-ready">${IX('st_paid')}</span>`;
   const acts=p.voided?'':`<div class="row-actions">${p.paid===false?`<button class="mini-btn" data-act="paypur" data-id="${p.id}">${IX('pay')}</button>`:''}${CAN('delete_records')?`<button class="mini-btn" data-act="editpur" data-id="${p.id}">✏️ ${IX('edit_pur')}</button><button class="mini-btn danger-mini" data-act="voidpur" data-id="${p.id}">${IX('void')}</button>`:''}</div>`;
   return `<tr${p.voided?' style="opacity:.55"':''}><td>${fmtDate(p.date)}</td><td>${esc(p.itemName||'—')}</td><td>${esc(p.supplier||'')}</td><td>${qtyFmt(p.qty)} ${esc(p.unit||'')}</td><td>${money(p.unitCost)}</td><td><b>${money(p.total)}</b></td><td>${esc(p.invoiceNo||'')}</td><td>${badge}</td><td>${acts}</td></tr>`}).join('');
  return `<div class="panel"><div class="panel-header"><div><h3>${IX('tab_purchases')}</h3></div><button class="primary-btn" type="button" data-act="addp">${IX('add_purchase')}</button></div><div class="chip-grid">${chips}</div>${tbl([IX('th_date'),IX('th_material'),IX('th_supplier'),IX('th_qty'),IX('th_unitcost'),IX('th_total'),IX('th_invoice'),IX('th_status'),''],rows,IX('purchases_empty'))}</div>`;
 }
 function suppliersHtml(){
  const rows=sups().map(s=>{
   const ps=activePurchases().filter(p=>p.supplierId===s.id);
   const bought=ps.reduce((a,p)=>a+Number(p.total||0),0),owed=ps.filter(p=>p.paid===false).reduce((a,p)=>a+Number(p.total||0),0);
   const last=ps.length?fmtDate(ps[0].date):'—';
   return `<tr><td><b>${esc(s.name)}</b><br><span class="inv-muted">${esc(s.notes||'')}</span></td><td dir="ltr" style="text-align:right">${esc(s.phone||'')}</td><td>${money(bought)}</td><td${owed>0?' style="color:var(--danger);font-weight:700"':''}>${money(owed)}</td><td>${last}</td><td><div class="row-actions"><button class="mini-btn" data-act="edits" data-id="${s.id}">${IX('edit')}</button>${CAN('delete_records')?`<button class="mini-btn danger-mini" data-act="dels" data-id="${s.id}">${IX('del')}</button>`:''}</div></td></tr>`}).join('');
  return `<div class="panel"><div class="panel-header"><div><h3>${IX('tab_suppliers')}</h3></div><button class="primary-btn" type="button" data-act="adds">${IX('add_supplier')}</button></div>${tbl([IX('th_supplier'),IX('th_phone'),IX('th_bought'),IX('th_owed'),IX('th_last'),''],rows,IX('suppliers_empty'))}</div>`;
 }
 function movesRowsHtml(){
  const s=iv.mvSearch.trim().toLowerCase();
  return E().data.stockMoves.filter(m=>(iv.mvType==='all'||m.type===iv.mvType)&&(!s||(m.itemName||'').toLowerCase().includes(s))).slice(0,300).map(m=>{
   const lbl=IX('mv_'+m.type)+(m.reason?` — ${IX('rs_'+m.reason)}`:'');const pos=m.qty>0;
   return `<tr><td>${fmtDate(m.at)}</td><td>${esc(m.itemName)}</td><td>${lbl}</td><td style="font-weight:700;color:${pos?'var(--success)':'var(--danger)'}" dir="ltr">${pos?'+':''}${qtyFmt(m.qty)} ${esc(m.unit||'')}</td><td>${qtyFmt(m.balanceAfter)}</td><td>${esc(m.note||'')}</td><td>${esc(m.user||'')}</td></tr>`}).join('')||`<tr><td colspan="7" class="empty-state compact">${IX('moves_empty')}</td></tr>`;
 }
 function movesHtml(){
  const chips=['all','opening','purchase','out','count','void'].map(k=>`<button type="button" class="cloth-chip ${iv.mvType===k?'active':''}" data-act="mvt" data-id="${k}">${k==='all'?IX('mv_all'):IX('mv_'+k)}</button>`).join('');
  return `<div class="panel"><div class="panel-header"><div><h3>${IX('tab_moves')}</h3></div></div><input type="search" id="invMvSearch" class="inv-search" placeholder="${IX('search')}" value="${esc(iv.mvSearch)}"><div class="chip-grid">${chips}</div><div class="table-wrap"><table><thead><tr>${[IX('th_date'),IX('th_material'),IX('th_type'),IX('th_qty'),IX('th_balance'),IX('th_note'),IX('th_user')].map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody id="invMovesBody">${movesRowsHtml()}</tbody></table></div></div>`;
 }
 function countHtml(){
  const rows=invs().map(i=>`<tr><td><b>${esc(i.name)}</b></td><td>${qtyFmt(i.qty)} ${esc(i.unit)}</td><td><input type="number" step="0.001" min="0" class="inv-count-in" data-id="${i.id}" placeholder="${qtyFmt(i.qty)}"></td><td id="cdiff_${i.id}">—</td><td id="cval_${i.id}">—</td></tr>`).join('');
  return `<div class="panel"><div class="panel-header"><div><h3>${IX('tab_count')}</h3><p>${IX('count_hint')}</p></div><button class="primary-btn" type="button" data-act="applycount">${IX('apply_count')}</button></div>${tbl([IX('th_material'),IX('th_system'),IX('th_actual'),IX('th_diff'),IX('th_diffval')],rows,IX('items_empty'))}</div>`;
 }
 function renderInventory(){
  const root=q('invRoot');if(!root)return;
  const tabs=['overview','items','purchases','suppliers','moves','count'].map(k=>`<button type="button" class="cloth-chip ${iv.tab===k?'active':''}" data-act="tab" data-id="${k}">${IX('tab_'+k)}</button>`).join('');
  const body=iv.tab==='overview'?overviewHtml():iv.tab==='items'?itemsHtml():iv.tab==='purchases'?purchasesHtml():iv.tab==='suppliers'?suppliersHtml():iv.tab==='moves'?movesHtml():countHtml();
  root.innerHTML=`${invMetrics()}<div class="chip-grid inv-tabs" style="margin-top:16px">${tabs}</div>${body}`;
 }

 /* ---------- النماذج ---------- */
 function materialForm(item){
  const isEdit=!!item;
  const fields=[
   {id:'name',label:IX('f_name'),type:'text',value:item?item.name:''},
   {id:'category',label:IX('f_category'),type:'select',value:item?(item.category||'other'):'detergent',options:CATS.map(c=>({value:c,label:IX('cat_'+c)}))},
   {id:'unit',label:IX('f_unit'),type:'text',value:item?item.unit:'',placeholder:IX('unit_hint')},
   ...(isEdit?[]:[{id:'qty',label:IX('f_open'),type:'number',step:'0.001',value:0,min:0},{id:'avgCost',label:IX('f_unitcost'),type:'number',step:'0.001',value:0,min:0}]),
   {id:'minQty',label:IX('f_min'),type:'number',step:'0.001',value:item?item.minQty:5,min:0},
   {id:'targetQty',label:IX('f_target'),type:'number',step:'0.001',value:item?(item.targetQty||0):0,min:0},
   {id:'supplierId',label:IX('f_supplier'),type:'select',value:item?(item.supplierId||''):'',options:supplierOptions().map(o=>({value:o.value,label:o.label}))},
  ];
  window.openQuickForm({title:isEdit?IX('t_material_edit'):IX('t_material_new'),sub:isEdit?item.name:'',fields,onSubmit:v=>{
   if(!v.name){window.toast(IX('e_name'));return false}
   if(invs().some(i=>i.id!==(item&&item.id)&&i.name.trim().toLowerCase()===v.name.trim().toLowerCase())){window.toast(IX('e_dup'));return false}
   if(!(v.minQty>=0)||!(v.targetQty>=0)||(!isEdit&&(!(v.qty>=0)||!(v.avgCost>=0)))){window.toast(IX('e_min'));return false}
   const patch={name:v.name,category:v.category,unit:v.unit||'—',minQty:v.minQty,targetQty:v.targetQty,supplierId:v.supplierId};
   if(isEdit)E().updateMaterial(item.id,patch);else E().addMaterial({...patch,qty:v.qty,avgCost:v.avgCost});
   renderInventory();window.toast(IX('ok_material'));
  }});
 }
 function purchaseForm(itemId){
  const inv=invs();if(!inv.length){window.toast(IX('e_noitems'));return}
  const it=inv.find(i=>i.id===itemId)||inv[0];
  window.openQuickForm({title:IX('t_purchase'),sub:'',submitLabel:undefined,fields:[
   {id:'inventoryId',label:IX('f_material'),type:'select',value:it.id,options:inv.map(i=>({value:i.id,label:`${i.name} (${i.unit})`}))},
   {id:'qty',label:IX('f_qty'),type:'number',step:'0.001',value:'',min:0},
   {id:'unitCost',label:IX('f_unitcost'),type:'number',step:'0.001',value:it.lastCost||it.avgCost||'',min:0},
   {id:'supplierId',label:IX('f_supplier'),type:'select',value:it.supplierId||'',options:supplierOptions().map(o=>({value:o.value,label:o.label}))},
   {id:'invoiceNo',label:IX('f_invoice'),type:'text'},
   {id:'pstatus',label:IX('f_paystatus'),type:'select',value:'paid',options:[{value:'paid',label:IX('f_paidnow')},{value:'credit',label:IX('f_credit')}]},
   {id:'method',label:IX('f_method'),type:'select',value:'cash',options:METHODS.map(([v,l])=>({value:v,label:IX(l)}))},
  ],onSubmit:v=>{
   if(!(v.qty>0)){window.toast(IX('e_qty'));return false}
   if(!(v.unitCost>0)){window.toast(IX('e_cost'));return false}
   const sp=sups().find(s=>s.id===v.supplierId);
   const p=E().addPurchase({inventoryId:v.inventoryId,qty:v.qty,unitCost:v.unitCost,supplierId:v.supplierId,supplier:sp?sp.name:'',invoiceNo:v.invoiceNo,paid:v.pstatus!=='credit',method:v.method});
   if(!p){window.toast(IX('e_qty'));return false}
   if(sp&&!invs().find(i=>i.id===p.inventoryId).supplierId)E().updateMaterial(p.inventoryId,{supplierId:sp.id});
   renderInventory();typeof renderFinance==='function'&&renderFinance();typeof renderClosures==='function'&&renderClosures();window.toast(IX('ok_purchase'));
  }});
 }
 function editPurchaseForm(p){
  const item=invs().find(i=>i.id===p.inventoryId);
  window.openQuickForm({title:`✏️ ${IX('edit_pur')} — ${p.itemName||''}`,sub:`${IX('edit_pur_sub')} ${item?`(${IX('th_stock')}: ${qtyFmt(item.qty)} ${item.unit})`:''}`,submitLabel:IX('edit_pur'),fields:[
   {id:'qty',label:IX('f_qty'),type:'number',step:'0.001',value:p.qty,min:0},
   {id:'unitCost',label:IX('f_unitcost'),type:'number',step:'0.001',value:p.unitCost,min:0},
   {id:'reason',label:IX('f_edit_reason'),type:'text',value:''},
  ],onSubmit:v=>{
   if(!(Number(v.qty)>0)){window.toast(IX('e_qty'));return false}
   if(!(Number(v.unitCost)>0)){window.toast(IX('e_cost'));return false}
   if(!String(v.reason||'').trim()){window.toast(IX('e_reason'));return false}
   const r=E().editPurchase(p.id,{qty:Number(v.qty),unitCost:Number(v.unitCost),reason:String(v.reason).trim()});
   if(!r.ok){window.toast(r.reason==='stock'?IX('e_edit_stock',r.max):IX('e_qty'));return false}
   renderInventory();typeof renderFinance==='function'&&renderFinance();typeof renderClosures==='function'&&renderClosures();window.toast(IX('ok_edit_pur'));
  }});
 }
 function useForm(item){
  window.openQuickForm({title:IX('t_use'),sub:`${item.name} — ${qtyFmt(item.qty)} ${item.unit}`,fields:[
   {id:'qty',label:IX('f_qty'),type:'number',step:'0.001',value:'',min:0},
   {id:'reason',label:IX('f_reason'),type:'select',value:'usage',options:REASONS.map(r=>({value:r,label:IX('rs_'+r)}))},
   {id:'note',label:IX('f_note'),type:'text'},
  ],onSubmit:v=>{
   if(!(v.qty>0)){window.toast(IX('e_qty'));return false}
   if(!E().consumeStock(item.id,v.qty,v.reason,v.note)){window.toast(IX('e_nostock'));return false}
   renderInventory();window.toast(IX('ok_use'));
  }});
 }
 function payForm(p){
  window.openQuickForm({title:IX('t_pay'),sub:`${p.itemName} — ${money(p.total)}`,fields:[{id:'method',label:IX('f_method'),type:'select',value:'cash',options:METHODS.map(([v,l])=>({value:v,label:IX(l)}))}],onSubmit:v=>{
   E().payPurchase(p.id,v.method);renderInventory();typeof renderFinance==='function'&&renderFinance();typeof renderClosures==='function'&&renderClosures();window.toast(IX('ok_pay'));
  }});
 }
 function supplierForm(s){
  window.openQuickForm({title:s?IX('t_supplier_edit'):IX('t_supplier_new'),sub:'',fields:[
   {id:'name',label:IX('f_sname'),type:'text',value:s?s.name:''},
   {id:'phone',label:IX('f_sphone'),type:'text',value:s?s.phone:'',placeholder:'3xxxxxxx'},
   {id:'notes',label:IX('f_snotes'),type:'text',value:s?(s.notes||''):''},
  ],onSubmit:v=>{
   if(!v.name){window.toast(IX('e_sname'));return false}
   if(s)E().updateSupplier(s.id,{name:v.name,phone:v.phone,notes:v.notes});else E().addSupplier({name:v.name,phone:v.phone,notes:v.notes});
   renderInventory();window.toast(IX('ok_supplier'));
  }});
 }
 function applyCount(){
  let n=0;
  document.querySelectorAll('.inv-count-in').forEach(inp=>{
   if(inp.value==='')return;const val=Number(inp.value);if(!(val>=0))return;
   const it=invs().find(i=>i.id===inp.dataset.id);if(!it||r3x(val)===r3x(it.qty))return;
   if(E().adjustStock(it.id,val,IX('count_note')))n++;
  });
  if(!n){window.toast(IX('no_changes'));return}
  renderInventory();window.toast(IX('ok_count',n));
 }
 function sendOrderWa(supId){
  const sup=sups().find(s=>s.id===supId);if(!sup)return;
  const lines=invs().filter(i=>(i.supplierId||'')===supId&&itemStatus(i)!=='ok').map(i=>`- ${i.name}: ${qtyFmt(itemSuggest(i))} ${i.unit}`).join('\n');
  window.open(`https://api.whatsapp.com/send?phone=${waNum(sup.phone)}&text=${encodeURIComponent(IX('wa_order',sup.name,lines))}`,'_blank','noopener');
 }
 (function initInventoryUI(){
  const root=q('invRoot');if(!root)return;
  root.addEventListener('click',e=>{
   const b=e.target.closest('[data-act]');if(!b||!root.contains(b))return;
   const act=b.dataset.act,id=b.dataset.id;const item=invs().find(i=>i.id===id);
   if(act==='tab'){iv.tab=id;renderInventory()}
   else if(act==='cat'){iv.cat=id;renderInventory()}
   else if(act==='pur'){iv.pur=id;renderInventory()}
   else if(act==='mvt'){iv.mvType=id;renderInventory()}
   else if(act==='addm')materialForm(null);
   else if(act==='addp')purchaseForm(null);
   else if(act==='adds')supplierForm(null);
   else if(act==='buy')purchaseForm(id);
   else if(act==='use'&&item)useForm(item);
   else if(act==='edit'&&item)materialForm(item);
   else if(act==='hist'&&item){iv.tab='moves';iv.mvType='all';iv.mvSearch=item.name;renderInventory()}
   else if((act==='delm'||act==='voidpur'||act==='editpur'||act==='dels')&&!CAN('delete_records'))window.toast('ليست لديك صلاحية لهذا الإجراء');
   else if(act==='delm'&&item)invConfirm(IX('c_del_material',item.name),()=>{E().deleteMaterial(item.id);renderInventory();window.toast(IX('ok_del'))});
   else if(act==='paypur'){const p=E().data.purchases.find(x=>x.id===id);if(p)payForm(p)}
   else if(act==='editpur'){const p=E().data.purchases.find(x=>x.id===id);if(p)editPurchaseForm(p)}
   else if(act==='voidpur')invConfirm(IX('c_void'),()=>{const r=E().voidPurchase(id);if(!r.ok){window.toast(IX('e_void_stock'));return false}renderInventory();typeof renderFinance==='function'&&renderFinance();typeof renderClosures==='function'&&renderClosures();window.toast(IX('ok_void'))});
   else if(act==='edits'){const s=sups().find(x=>x.id===id);if(s)supplierForm(s)}
   else if(act==='dels'){const s=sups().find(x=>x.id===id);if(s)invConfirm(IX('c_del_supplier',s.name),()=>{E().deleteSupplier(s.id);renderInventory();window.toast(IX('ok_del'))})}
   else if(act==='wa')sendOrderWa(id);
   else if(act==='applycount')applyCount();
  });
  root.addEventListener('input',e=>{
   const t2=e.target;
   if(t2.id==='invSearch'){iv.search=t2.value;q('invItemsBody').innerHTML=itemsRowsHtml()}
   else if(t2.id==='invMvSearch'){iv.mvSearch=t2.value;q('invMovesBody').innerHTML=movesRowsHtml()}
   else if(t2.classList.contains('inv-count-in')){
    const it=invs().find(i=>i.id===t2.dataset.id);if(!it)return;
    const d=q('cdiff_'+it.id),v=q('cval_'+it.id);
    if(t2.value===''){d.textContent='—';v.textContent='—';return}
    const diff=r3x(Number(t2.value)-it.qty);d.textContent=(diff>0?'+':'')+qtyFmt(diff);d.style.color=diff<0?'var(--danger)':diff>0?'var(--success)':'';v.textContent=money(diff*(it.avgCost||0));
   }
  });
 })();
 const ROLE_AR={owner:'مالك',manager:'مدير',accountant:'محاسب',worker:'عامل'};
 function roleLabel997(r){return t('role_'+r+'_ar')}
 function renderEmployees(){
  const all=L997Enterprise.data.employees,es=all.filter(e=>e.active!==false),os=orders(),att=L997Enterprise.data.attendance,pr=L997Enterprise.data.payroll;
  const P=window.L997People||{};const mb=FIN.monthBounds(FIN.todayStr());
  const inMonth=d=>FIN.inRange(d,mb.from,mb.to);
  q('employeeMetrics').innerHTML=[[t('emp_count'),es.length],[t('emp_base_salaries'),money(es.reduce((s,e)=>s+Number(e.salary||0),0))],[t('emp_today_attendance'),att.filter(a=>FIN.localDay(a.date)===FIN.todayStr()).length],[t('emp_commissions'),money(es.reduce((s,e)=>s+Number(e.commission||0),0))]].map(a=>`<div class="metric-card"><div class="metric-top">${a[0]}</div><div class="metric-value">${a[1]}</div></div>`).join('');
  const acct=e=>e.active===false?'<span class="status-badge status-cancelled">معطّل</span>':(e.passHash||e.cloudUserId||(e.username&&e.lastLogin))?'<span class="status-badge status-ready">🔑 له حساب دخول</span>':'<span class="nopw-tag">بدون دخول</span>';
  const rows=[...es,...all.filter(e=>e.active===false)];
  q('employeesBody').innerHTML=rows.length?rows.map(e=>{let mine=os.filter(o=>o.employeeId===e.id&&o.status!=='cancelled'),sales=mine.reduce((s,o)=>s+Number(pay(o).total||0),0);return `<tr${e.active===false?' style="opacity:.55"':''}><td><b>${esc(e.name)}</b><br><small class="inv-muted">#${esc(e.employeeNumber||'—')}</small> ${acct(e)}</td><td>${roleLabel997(e.role)||esc(e.role)}</td><td>${money(e.salary)}</td><td>${money(e.commission)}</td><td>${mine.length}</td><td>${money(sales)}</td><td>${P.canEdit&&P.canEdit(e.id)?`<button class="mini-btn" type="button" data-emp-edit="${e.id}">تعديل</button>`:''}</td></tr>`}).join(''):`<tr><td colspan="7" class="empty-state compact">${t('no_employees')}</td></tr>`;
  q('employeesBody').querySelectorAll('[data-emp-edit]').forEach(b=>b.addEventListener('click',()=>P.edit(b.dataset.empEdit)));
  // صافي مستحق هذا الشهر (نفس حساب «صرف الرواتب») مع حالة الصرف
  q('payrollSummary').innerHTML=es.length?`<div class="inv-muted" style="margin-bottom:6px">صافي المستحق لشهر ${mb.key}</div>`+es.map(e=>{const d=FIN.salaryDue(e,pr,L997Enterprise.data.expenses,mb.key);const SH=window.L997Shift;const days=SH?SH.daysInMonth(e.id,mb.key):new Set();att.filter(a=>a.employeeId===e.id&&inMonth(a.date)&&a.status!=='absent').forEach(a=>days.add(FIN.localDay(a.date)));const attCount=days.size;const hrs=SH?SH.hoursInMonth(e.id,mb.key):0;return `<div class="mini-stat"><span>${esc(e.name)} <small class="subtle">(${t('attendance_days_30').replace('{0}',attCount)}${hrs?` · ${hrs} ساعة`:''}${d.bonuses?` · +${money(d.bonuses)}`:''}${d.deductions?` · خصم ${money(d.deductions)}`:''}${d.advances?` · سلف ${money(d.advances)}`:''})</small></span><b>${money(d.net)} ${d.paid?'<span class="status-badge status-ready">✓ صُرف</span>':''}</b></div>`}).join(''):`<div class="empty-state compact">${t('no_payroll_data')}</div>`;
 }
 function closureFor(type,key){return L997Enterprise.data.closures.find(c=>c.type===type&&(type==='daily'?c.forDate===key:c.forMonth===key))}
 let clsMonth=null;
 function renderClosures(){
  // بدون صلاحية «اعتماد الإغلاق»: لا أرقام المحل (اليومية/الشهرية/السجل) — فقط وردية الموظف نفسه
  const mgr=CAN('approve_closing'), pgc=document.getElementById('page-closures');
  if(pgc) pgc.querySelectorAll(':scope > .content-grid, :scope > .panel:not(#shiftsPanel)').forEach(e=>{e.style.display=mgr?'':'none'});
  if(!mgr){ if(window.L997Shift&&window.L997Shift.renderMine) window.L997Shift.renderMine(); return; }
  if(!q('closureDate').value) q('closureDate').value=FIN.todayStr();
  const selDate=q('closureDate').value;
  if(!clsMonth)clsMonth=FIN.todayStr().slice(0,7);
  const mb=FIN.monthBounds(clsMonth+'-01');
  const d=calcRange(selDate,selDate), m=calcRange(mb.from,mb.to), snap=FIN.snapshot(finData());
  const lang997=window.getLang997?window.getLang997():'ar';
  const ms=(label,v,style)=>`<div class="mini-stat"><span>${label}</span><b${style?` style="${style}"`:''}>${typeof v==='number'?money(v):v}</b></div>`;
  const done=closureFor('daily',selDate), mdone=closureFor('monthly',mb.key);
  const doneNote=c=>c?`<div class="mini-stat" style="color:var(--success)"><span>✓ ${lang997==='en'?'Closed by':'اعتمده'} ${esc(c.by||'')}</span><b>${new Date(c.date).toLocaleString(lang997,{timeZone:'Asia/Bahrain'})}</b></div>`:'';
  const today=FIN.todayStr(),monthStart=today.slice(0,8)+'01';
  const pending=FIN.unclosedDays(finData(),L997Enterprise.data.closures,FIN.addDays(monthStart,-31),FIN.addDays(today,-1));
  const steps=done?'':`<ol class="cls-steps"><li>عُدّ النقد الموجود في الدرج</li><li>قارنه بـ «الصندوق المتبقي المتوقع» بالأسفل</li><li>اضغط «اعتماد إغلاق اليوم» وأدخل المبلغ الذي عددته</li></ol>`;
  const chips=pending.length?`<div class="cls-pending">⚠ أيام فيها حركة ولم تُغلق: ${pending.map(x=>`<button type="button" class="cloth-chip${x===selDate?' active':''}" data-cls-day="${x}">${x.slice(5)}</button>`).join('')}</div>`:'';
  q('dailyClosurePreview').innerHTML=chips+steps+`
    ${ms(FX('sales'),d.salesTotal)}${ms(FX('collected'),d.collected)}${ms('  · '+FX('deposits'),d.deposits)}${ms(FX('expenses'),d.expenses)}
    ${ms(t('cls_open_orders'),String(snap.openCount))}
    <hr>
    <div class="mini-stat" style="font-size:15px"><span><strong>${t('cls_remaining_cash')}</strong></span><b style="font-size:17px;${d.expectedCash<0?'color:var(--danger)':'color:var(--success)'}">${money(d.expectedCash)}</b></div>
    ${done?ms(lang997==='en'?'Counted cash / difference':'النقد الفعلي / الفرق',`${money(done.cashActual)} / ${money(done.variance)}`,done.variance?'color:var(--danger)':''):''}${doneNote(done)}`;
  q('monthlyClosurePreview').innerHTML=`<div class="cls-month-bar"><input type="month" id="closureMonth" value="${mb.key}" class="inv-search" style="width:auto;margin:0"><button type="button" class="secondary-btn" id="openMonthlyReportBtn">📄 ${lang997==='en'?'Full monthly report':'التقرير الشهري الكامل'}</button></div><div class="mini-stat"><span><strong>${mb.key}</strong></span><b>${mb.from} → ${mb.to}</b></div>${ms(FX('sales'),m.salesTotal)}${m.vat?ms(FX('net_rev'),m.netRevenue):''}${ms(FX('expenses'),m.expenses)}${ms(groupLabel('salaries'),m.expensesByGroup.salaries||0)}${ms(groupLabel('government'),m.expensesByGroup.government||0)}${ms(lang997==='en'?'Net profit':'صافي الربح',m.profit,m.profit<0?'color:var(--danger)':'color:var(--success)')}${ms(FX('collected'),m.collected)}${doneNote(mdone)}`;
  q('closuresList').innerHTML=L997Enterprise.data.closures.length?L997Enterprise.data.closures.slice(0,30).map(c=>`<div class="ledger-item"><div><strong>${c.type==='daily'?t('cls_daily_label'):t('cls_monthly_label')}</strong><small>${c.forDate?(t('cls_for_date')+' '+c.forDate+' — '):c.forMonth?(c.forMonth+' — '):''}${new Date(c.date).toLocaleString(lang997,{timeZone:'Asia/Bahrain'})}${c.by?' — '+esc(c.by):''}${c.variance?` — ${lang997==='en'?'difference':'فرق'} ${money(c.variance)}`:''}</small></div><b>${money(c.revenue||0)}</b></div>`).join(''):`<div class="empty-state compact">${t('no_closures')}</div>`;
  const methods={cash:t('opt_cash'),card:t('opt_card'),benefitpay:'Benefit Pay',bank_transfer:t('opt_bank_transfer')};
  const allMethods=Array.from(new Set([...Object.keys(methods),...Object.keys(d.salesCashBy),...Object.keys(d.expensesBy),...Object.keys(d.depositsBy),...Object.keys(d.refundsBy)]));
  const cell=v=>v?money(v):'--';
  q('registerDetailsBody').innerHTML=allMethods.map(m2=>`<tr><td>${methods[m2]||esc(m2)}</td><td>${money(d.salesCashBy[m2]||0)}</td><td>${cell(d.depositsBy[m2])}</td><td>${cell(d.expensesBy[m2])}</td><td>${cell(d.refundsBy[m2])}</td></tr>`).join('')+`<tr style="font-weight:800;background:var(--panel-soft)"><td>${t('th_total_row')}</td><td>${money(d.orderPayments+d.packageSales)}</td><td>${money(d.deposits)}</td><td>${money(d.expenses)}</td><td>${money(d.refunds)}</td></tr>`;
  if(window.L997Shift)window.L997Shift.renderPanel(selDate);
  q('dailyClosurePreview').querySelectorAll('[data-cls-day]').forEach(b=>b.addEventListener('click',()=>{q('closureDate').value=b.dataset.clsDay;renderClosures()}));
  q('closureMonth')?.addEventListener('change',e=>{if(/^\d{4}-\d{2}$/.test(e.target.value)){clsMonth=e.target.value;renderClosures()}});
  q('openMonthlyReportBtn')?.addEventListener('click',()=>window.openMonthlyReport997&&window.openMonthlyReport997(clsMonth));
 }
 q('closureDate')?.addEventListener('change',renderClosures);
 /* ===================== سجل النشاط والتدقيق (نسخة موسّعة) ===================== */
 const AUDIT_MAX=4000;
 const classifyAction=(s)=>window.L997Enterprise.classify(s),isSensitiveAction=(s)=>window.L997Enterprise.isSensitive(s);
 const AT={
  ar:{m_today:'عمليات اليوم',m_week:'عمليات آخر 7 أيام',m_sens:'عمليات حساسة (7 أيام)',m_users:'مستخدمون نشطون اليوم',m_value:'إجمالي قيم عمليات اليوم',
   search:'بحث في العمليات...',cat_all:'الكل',cat_orders:'الطلبات',cat_customers:'العملاء والأرصدة',cat_money:'المالية',cat_inventory:'المخزون',cat_staff:'الموظفون',cat_system:'النظام والأمان',cat_other:'أخرى',
   only_sens:'⚠ الحساسة فقط',p_today:'اليوم',p_7:'7 أيام',p_30:'30 يوماً',p_all:'الكل',from:'من',to:'إلى',user_all:'كل المستخدمين',export:'تصدير CSV',clear:'مسح الفلاتر',
   th_time:'الوقت',th_user:'المستخدم',th_cat:'التصنيف',th_action:'العملية',th_value:'القيمة',
   day_today:'اليوم',day_yesterday:'أمس',more:(a,b)=>`عرض المزيد (${a} من ${b})`,count:(a,b)=>`${a} عملية من أصل ${b}`,
   empty:'لا توجد عمليات مطابقة',details:'تفاصيل',hide:'إخفاء',no_details:'لا توجد تفاصيل إضافية',sens_badge:'حساسة',
   keep:n=>`يحتفظ السجل بآخر ${n} عملية فقط توفيراً للمساحة — صدّر نسخة CSV دورياً للأرشفة.`,
   export_ok:'تم تنزيل ملف السجل',role_default:'مدير',
   keys:{amount:'المبلغ',total:'الإجمالي',qty:'الكمية',name:'الاسم',note:'ملاحظة',method:'الطريقة',supplier:'المورد',category:'التصنيف',itemName:'المادة',unitCost:'سعر الوحدة',role:'الدور',salary:'الراتب',type:'النوع',net:'الصافي',phone:'الجوال',unit:'الوحدة',minQty:'حد التنبيه',avgCost:'متوسط التكلفة',revenue:'الإيرادات',expenses:'المصروفات',profit:'الربح',diff:'الفرق',reason:'السبب',patch:'التعديلات',email:'البريد'}},
  en:{m_today:'Actions today',m_week:'Actions (7 days)',m_sens:'Sensitive actions (7 days)',m_users:'Active users today',m_value:'Total value today',
   search:'Search actions...',cat_all:'All',cat_orders:'Orders',cat_customers:'Customers & balances',cat_money:'Finance',cat_inventory:'Inventory',cat_staff:'Staff',cat_system:'System & security',cat_other:'Other',
   only_sens:'⚠ Sensitive only',p_today:'Today',p_7:'7 days',p_30:'30 days',p_all:'All',from:'From',to:'To',user_all:'All users',export:'Export CSV',clear:'Clear filters',
   th_time:'Time',th_user:'User',th_cat:'Category',th_action:'Action',th_value:'Value',
   day_today:'Today',day_yesterday:'Yesterday',more:(a,b)=>`Show more (${a} of ${b})`,count:(a,b)=>`${a} of ${b} actions`,
   empty:'No matching actions',details:'Details',hide:'Hide',no_details:'No additional details',sens_badge:'Sensitive',
   keep:n=>`The log keeps only the latest ${n} actions to save space — export a CSV regularly for archiving.`,
   export_ok:'Log file downloaded',role_default:'Manager',
   keys:{amount:'Amount',total:'Total',qty:'Qty',name:'Name',note:'Note',method:'Method',supplier:'Supplier',category:'Category',itemName:'Material',unitCost:'Unit cost',role:'Role',salary:'Salary',type:'Type',net:'Net',phone:'Phone',unit:'Unit',minQty:'Alert level',avgCost:'Avg. cost',revenue:'Revenue',expenses:'Expenses',profit:'Profit',diff:'Difference',reason:'Reason',patch:'Changes',email:'Email'}},
  ur:{m_today:'آج کی سرگرمیاں',m_week:'سرگرمیاں (7 دن)',m_sens:'حساس سرگرمیاں (7 دن)',m_users:'آج فعال صارفین',m_value:'آج کی کل مالیت',
   search:'سرگرمیاں تلاش کریں...',cat_all:'سب',cat_orders:'آرڈرز',cat_customers:'کسٹمرز اور بیلنس',cat_money:'مالیات',cat_inventory:'انوینٹری',cat_staff:'ملازمین',cat_system:'سسٹم اور سیکیورٹی',cat_other:'دیگر',
   only_sens:'⚠ صرف حساس',p_today:'آج',p_7:'7 دن',p_30:'30 دن',p_all:'سب',from:'سے',to:'تک',user_all:'تمام صارفین',export:'CSV ایکسپورٹ',clear:'فلٹر ہٹائیں',
   th_time:'وقت',th_user:'صارف',th_cat:'زمرہ',th_action:'عمل',th_value:'قدر',
   day_today:'آج',day_yesterday:'کل',more:(a,b)=>`مزید دکھائیں (${a} از ${b})`,count:(a,b)=>`${b} میں سے ${a} سرگرمیاں`,
   empty:'کوئی مماثل سرگرمی نہیں',details:'تفصیل',hide:'چھپائیں',no_details:'کوئی اضافی تفصیل نہیں',sens_badge:'حساس',
   keep:n=>`جگہ بچانے کے لیے لاگ صرف آخری ${n} سرگرمیاں رکھتا ہے — آرکائیو کے لیے باقاعدگی سے CSV ایکسپورٹ کریں۔`,
   export_ok:'لاگ فائل ڈاؤن لوڈ ہو گئی',role_default:'مینیجر',
   keys:{amount:'رقم',total:'کل',qty:'مقدار',name:'نام',note:'نوٹ',method:'طریقہ',supplier:'سپلائر',category:'زمرہ',itemName:'مواد',unitCost:'فی یونٹ قیمت',role:'کردار',salary:'تنخواہ',type:'قسم',net:'خالص',phone:'فون',unit:'یونٹ',minQty:'الرٹ حد',avgCost:'اوسط لاگت',revenue:'آمدنی',expenses:'اخراجات',profit:'منافع',diff:'فرق',reason:'وجہ',patch:'تبدیلیاں',email:'ای میل'}}
 };
 const AL=()=>(window.getLang997&&window.getLang997())||'ar';
 const AX=(k,...a)=>{const d=AT[AL()]||AT.ar;let s=d[k];if(s===undefined)s=AT.ar[k];if(s===undefined)return k;return typeof s==='function'?s(...a):s};
 const CAT_LIST=['orders','customers','money','inventory','staff','system'];
 const av={cat:'all',sens:false,period:'7',from:'',to:'',user:'all',q:'',limit:100,open:{}};
 const aDay=iso=>window.L997Finance.localDay(iso);
 const auditCat=e=>e.cat||classifyAction(e.action);
 const auditSens=e=>e.sens!==undefined?!!e.sens:isSensitiveAction(e.action);
 const auditUser=e=>{const cl=s=>String(s||'').replace(/^"|"$/g,'');return (e.who?cl(e.who)+' — ':'')+(cl(e.user)||AX('role_default'))};
 function auditFilterList(){
  const all=L997Enterprise.data.audit,now=Date.now();let cutoff=0;
  if(av.period==='today')cutoff=new Date(aDay(new Date().toISOString())+'T00:00:00').getTime();
  else if(av.period==='7')cutoff=now-7*86400000;else if(av.period==='30')cutoff=now-30*86400000;
  const s=av.q.trim().toLowerCase();
  return all.filter(e=>{
   const ts=new Date(e.at).getTime();
   if(av.period!=='custom'&&cutoff&&ts<cutoff)return false;
   if(av.from&&aDay(e.at)<av.from)return false;if(av.to&&aDay(e.at)>av.to)return false;
   if(av.cat!=='all'&&auditCat(e)!==av.cat)return false;
   if(av.sens&&!auditSens(e))return false;
   if(av.user!=='all'&&auditUser(e)!==av.user)return false;
   if(s&&!(String(e.action||'').toLowerCase().includes(s)||auditUser(e).toLowerCase().includes(s)))return false;
   return true;
  });
 }
 function auditMetrics(){
  const all=L997Enterprise.data.audit,today=aDay(new Date().toISOString()),wk=Date.now()-7*86400000;
  const td=all.filter(e=>aDay(e.at)===today),w=all.filter(e=>new Date(e.at).getTime()>=wk);
  const cards=[[AX('m_today'),td.length],[AX('m_week'),w.length],[AX('m_sens'),w.filter(auditSens).length],[AX('m_users'),new Set(td.map(auditUser)).size],[AX('m_value'),money(td.reduce((s,e)=>s+Math.abs(Number(e.value)||0),0))]];
  return `<div class="metrics-grid">${cards.map(a=>`<div class="metric-card"><div class="metric-top">${a[0]}</div><div class="metric-value">${a[1]}</div></div>`).join('')}</div>`;
 }
 function auditDayLabel(iso){
  const d=aDay(iso),today=aDay(new Date().toISOString()),y=aDay(new Date(Date.now()-86400000).toISOString());
  if(d===today)return AX('day_today');if(d===y)return AX('day_yesterday');
  try{return new Date(iso).toLocaleDateString(AL(),{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'Asia/Bahrain'})}catch(e){return d}
 }
 function auditDetailsHtml(e){
  const m=e.meta||{},keys=AX('keys');const rows=[];
  const fmt=v=>v===null||v===undefined?'':typeof v==='object'?JSON.stringify(v):String(v);
  Object.keys(m).forEach(k=>{if(k==='id'||/Id$/.test(k)||k==='_truncated'||k==='date'||k==='createdAt')return;const v=m[k];if(v===''||v===null||v===undefined)return;rows.push(`<span class="inv-tag">${esc(keys[k]||k)}</span> ${esc(fmt(v))}`)});
  return rows.length?rows.join(' &nbsp; '):`<span class="inv-muted">${AX('no_details')}</span>`;
 }
 function auditRowsHtml(list){
  let lastDay='',out='';
  list.slice(0,av.limit).forEach(e=>{
   const d=aDay(e.at);
   if(d!==lastDay){lastDay=d;out+=`<tr class="audit-day"><td colspan="6">${auditDayLabel(e.at)}</td></tr>`}
   const sens=auditSens(e),cat=auditCat(e),open=!!av.open[e.id];
   let tm='';try{tm=new Date(e.at).toLocaleTimeString(AL(),{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bahrain'})}catch(x){tm=e.at}
   out+=`<tr><td>${tm}</td><td>${esc(auditUser(e))}</td><td><span class="inv-tag">${AX('cat_'+(CAT_LIST.includes(cat)?cat:'other'))}</span></td><td>${sens?`<span class="priority-badge priority-urgent" title="${AX('sens_badge')}">⚠</span> `:''}${esc(e.action)}</td><td>${Number(e.value)?money(e.value):''}</td><td><button class="mini-btn" data-aact="det" data-id="${e.id}">${open?AX('hide'):AX('details')}</button></td></tr>`;
   if(open)out+=`<tr class="audit-det"><td colspan="6">${auditDetailsHtml(e)}</td></tr>`;
  });
  return out||`<tr><td colspan="6" class="empty-state compact">${AX('empty')}</td></tr>`;
 }
 function auditUsers(){const s=new Set(L997Enterprise.data.audit.map(auditUser));return [...s].sort()}
 function renderAudit(){
  const root=q('auditRoot');if(!root)return;
  const list=auditFilterList();
  const catChips=['all',...CAT_LIST].map(c=>`<button type="button" class="cloth-chip ${av.cat===c?'active':''}" data-aact="cat" data-id="${c}">${AX('cat_'+c)}</button>`).join('');
  const perChips=[['today','p_today'],['7','p_7'],['30','p_30'],['all','p_all']].map(([k,l])=>`<button type="button" class="cloth-chip ${av.period===k?'active':''}" data-aact="per" data-id="${k}">${AX(l)}</button>`).join('');
  const users=auditUsers();if(av.user!=='all'&&!users.includes(av.user))av.user='all';
  root.innerHTML=`${auditMetrics()}<div class="panel" style="margin-top:16px"><div class="panel-header"><div><h3>${t('audit_title')}</h3><p>${AX('count',Math.min(av.limit,list.length),list.length)}</p></div><button class="primary-btn" type="button" data-aact="export">${AX('export')}</button></div>
   <input type="search" id="auditSearch" class="inv-search" placeholder="${AX('search')}" value="${esc(av.q)}">
   <div class="chip-grid">${catChips}</div>
   <div class="chip-grid">${perChips}<button type="button" class="cloth-chip ${av.sens?'active':''}" data-aact="sens">${AX('only_sens')}</button></div>
   <div class="bal-dates"><label>${AX('from')} <input type="date" id="auditFrom" value="${av.from}"></label><label>${AX('to')} <input type="date" id="auditTo" value="${av.to}"></label><select id="auditUser" class="inv-search" style="width:auto;margin:0"><option value="all">${AX('user_all')}</option>${users.map(u=>`<option value="${esc(u)}" ${av.user===u?'selected':''}>${esc(u)}</option>`).join('')}</select><button type="button" class="mini-btn" data-aact="clr">${AX('clear')}</button></div>
   <div class="table-wrap"><table><thead><tr><th>${AX('th_time')}</th><th>${AX('th_user')}</th><th>${AX('th_cat')}</th><th>${AX('th_action')}</th><th>${AX('th_value')}</th><th></th></tr></thead><tbody id="auditBody">${auditRowsHtml(list)}</tbody></table></div>
   ${list.length>av.limit?`<div style="text-align:center;margin-top:12px"><button class="secondary-btn" type="button" data-aact="more">${AX('more',av.limit,list.length)}</button></div>`:''}
   <p class="inv-muted" style="margin-top:12px">${AX('keep',AUDIT_MAX)}</p></div>`;
 }
 function exportAuditCsv(){
  const list=auditFilterList();
  const esc2=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const rows=[['Time','User','Role','Category','Sensitive','Action','Value','Details'].map(esc2).join(',')];
  list.forEach(e=>rows.push([e.at,e.who||'',e.user||'',auditCat(e),auditSens(e)?'1':'0',e.action,Number(e.value)||0,JSON.stringify(e.meta||{})].map(esc2).join(',')));
  const blob=new Blob(['﻿'+rows.join('\r\n')],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='997-audit-'+aDay(new Date().toISOString())+'.csv';document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(()=>URL.revokeObjectURL(url),1000);
  window.toast&&window.toast(AX('export_ok'));
 }
 (function initAuditUI(){
  const root=q('auditRoot');if(!root)return;
  root.addEventListener('click',e=>{
   const b=e.target.closest('[data-aact]');if(!b||!root.contains(b))return;
   const a=b.dataset.aact,id=b.dataset.id;
   if(a==='cat'){av.cat=id;av.limit=100;renderAudit()}
   else if(a==='per'){av.period=id;av.from='';av.to='';av.limit=100;renderAudit()}
   else if(a==='sens'){av.sens=!av.sens;av.limit=100;renderAudit()}
   else if(a==='clr'){Object.assign(av,{cat:'all',sens:false,period:'7',from:'',to:'',user:'all',q:'',limit:100});renderAudit()}
   else if(a==='more'){av.limit+=200;renderAudit()}
   else if(a==='det'){av.open[id]=!av.open[id];renderAudit()}
   else if(a==='export')exportAuditCsv();
  });
  root.addEventListener('input',e=>{if(e.target.id==='auditSearch'){av.q=e.target.value;av.limit=100;const list=auditFilterList();q('auditBody').innerHTML=auditRowsHtml(list)}});
  root.addEventListener('change',e=>{
   const el=e.target;
   if(el.id==='auditFrom'){av.from=el.value;av.period=(av.from||av.to)?'custom':'7';av.limit=100;renderAudit()}
   else if(el.id==='auditTo'){av.to=el.value;av.period=(av.from||av.to)?'custom':'7';av.limit=100;renderAudit()}
   else if(el.id==='auditUser'){av.user=el.value;av.limit=100;renderAudit()}
  });
 })();
 window.renderFinance997=renderFinance; window.renderInventory997=renderInventory; window.renderEmployees997=renderEmployees; window.renderClosures997=renderClosures; window.renderAudit997=renderAudit;

 q('addExpenseBtn')?.addEventListener('click',()=>{
   if(!CAN('add_expense')){window.toast('ليست لديك صلاحية لهذا الإجراء');return}
   if(window.L997Shift&&!window.L997Shift.guard())return;
   window.openQuickForm({
     title: 'إضافة مصروف', sub: 'اختر نوع المصروف من القائمة — الرواتب تُصرف من صفحة الموظفين، ومشتريات المخزون من صفحة المخزون',
     fields: [
       { id:'catId', label:'نوع المصروف', type:'select', value:'rent', options:catOptions(['inventory','salary']) },
       { id:'amount', label:'المبلغ (د.ب)', type:'number', step:'0.001', value:'', min:0 },
       { id:'method', label:'طريقة الدفع', type:'select', value:'cash', options:METHOD_OPTS },
       { id:'date', label:'تاريخ الدفع', type:'date', value:FIN.todayStr() },
       { id:'note', label:'تفاصيل (مثال: فاتورة كهرباء شهر 10، تجديد سجل)', type:'text' },
     ],
     onSubmit: (v) => {
       const cat=FIN.EXPENSE_CATEGORIES.find(c=>c.id===v.catId);
       if (!cat){window.toast('اختر نوع المصروف');return false}
       if (!(v.amount>0)){window.toast('أدخل مبلغاً صحيحاً');return false}
       if (!v.date||v.date>FIN.todayStr()){window.toast('تاريخ الدفع غير صحيح');return false}
       const date=v.date===FIN.todayStr()?new Date().toISOString():new Date(v.date+'T12:00:00').toISOString();
       L997Enterprise.addExpense({catId:cat.id,group:cat.group,category:cat.ar,amount:FIN.r3(v.amount),method:v.method,note:v.note,date});
       renderFinance(); typeof renderClosures==='function'&&renderClosures();
       window.toast('تم تسجيل المصروف');
     }
   });
 });
 q('closeDayBtn')?.addEventListener('click',()=>{
   if(!CAN('approve_closing')){window.toast('ليست لديك صلاحية لهذا الإجراء');return}
   const selDate=q('closureDate').value||FIN.todayStr();
   if(selDate>FIN.todayStr()){window.toast('لا يمكن إغلاق يوم لم يأتِ بعد');return}
   const prev=closureFor('daily',selDate);
   if(prev){window.toast(`تم اعتماد إغلاق يوم ${selDate} مسبقاً بواسطة ${prev.by||'—'} — لا يمكن تكراره`);return}
   let x=calcRange(selDate,selDate);
   window.openQuickForm({
     title:'اعتماد الإغلاق اليومي', sub:`ليوم ${selDate} — أدخل النقد الفعلي الموجود بالصندوق`,
     fields:[{ id:'cash', label:`النقد الذي عددته في الدرج (د.ب) — المتوقع ${money(x.expectedCash)}`, type:'number', step:'0.001', value:'', min:0 },
       { id:'note', label:'سبب الفرق (إلزامي إذا اختلف المبلغ عن المتوقع)', type:'text' }],
     submitLabel:'اعتماد الإغلاق',
     onSubmit:(v)=>{
       if(closureFor('daily',selDate))return;
       const diff=FIN.r3(v.cash-x.expectedCash);
       if(diff!==0&&!v.note){window.toast(`يوجد فرق ${money(diff)} عن المتوقع — اكتب سببه قبل الاعتماد`);return false}
       const me=window.L997Auth?window.L997Auth.user():null;
       L997Enterprise.closeDay({revenue:x.salesTotal,sales:x.salesTotal,collected:x.collected,collectedBy:x.collectedBy,expenses:x.expenses,profit:x.profit,deposits:x.deposits,refunds:x.refunds,cashExpected:x.expectedCash,cashActual:FIN.r3(v.cash),variance:diff,varianceNote:v.note||'',forDate:selDate,by:me?me.name:''});
       renderClosures();
       window.toast('تم اعتماد الإغلاق اليومي');
     }
   });
 });
 q('closeMonthBtn')?.addEventListener('click',()=>{
   if(!CAN('approve_closing')){window.toast('ليست لديك صلاحية لهذا الإجراء');return}
   const mb=FIN.monthBounds((clsMonth||FIN.todayStr().slice(0,7))+'-01');
   const prev=closureFor('monthly',mb.key);
   if(prev){window.toast(`تم اعتماد إغلاق شهر ${mb.key} مسبقاً — لا يمكن تكراره`);return}
   if(mb.to>=FIN.todayStr()){window.toast(`شهر ${mb.key} لم ينتهِ بعد — يُعتمد إغلاقه من أول يوم في الشهر التالي`);return}
   let x=calcRange(mb.from,mb.to);
   const open=FIN.unclosedDays(finData(),L997Enterprise.data.closures,mb.from,mb.to);
   window.confirmAction(`اعتماد الإغلاق الشهري لشهر ${mb.key}: صافي الإيراد ${money(x.netRevenue)} − المصروفات ${money(x.expenses)} = صافي الربح ${money(x.profit)}.${open.length?` ⚠ يوجد ${open.length} يوم لم يُغلق (${open.map(d=>d.slice(8)).join('، ')}) — يُفضّل إغلاقها أولاً.`:''}`, ()=>{
     if(closureFor('monthly',mb.key))return;
     const me=window.L997Auth?window.L997Auth.user():null;
     L997Enterprise.closeMonth({revenue:x.salesTotal,sales:x.salesTotal,netRevenue:x.netRevenue,expenses:x.expenses,expensesByGroup:x.expensesByGroup,payroll:x.expensesByGroup.salaries||0,government:x.expensesByGroup.government||0,profit:x.profit,unclosedDays:open,collected:x.collected,forMonth:mb.key,by:me?me.name:''});
     renderClosures();
     window.toast('تم اعتماد الإغلاق الشهري');
   });
 });
 q('addEmployeeBtn')?.addEventListener('click',()=>{
   const P=window.L997People;
   if(P&&P.canManageUsers()){P.add();return}
   window.toast('إضافة الموظفين تتطلب صلاحية «المستخدمون وكلمات المرور» — اطلبها من المدير');
 });
 q('addAttendanceBtn')?.addEventListener('click',()=>{
   let es=L997Enterprise.data.employees.filter(e=>e.active!==false);
   if(!es.length){window.toast('أضف موظفاً أولاً');return}
   window.openQuickForm({
     title:'تسجيل حضور', sub:'اختر الموظف والحالة',
     fields:[
       { id:'employeeId', label:'الموظف', type:'select', options: es.map(e=>({value:e.id,label:e.name})) },
       { id:'status', label:'الحالة', type:'select', value:'present', options:[{value:'present',label:'حاضر'},{value:'absent',label:'غائب'},{value:'late',label:'متأخر'}] },
       { id:'hours', label:'عدد ساعات العمل', type:'number', value:8, min:0 },
     ],
     onSubmit:(v)=>{
       L997Enterprise.addAttendance({employeeId:v.employeeId,status:v.status,hours:v.hours});
       renderEmployees();
       window.toast('تم تسجيل الحضور');
     }
   });
 });
 q('addPayrollTxBtn')?.addEventListener('click',()=>{
   let es=L997Enterprise.data.employees.filter(e=>e.active!==false);
   if(!es.length){window.toast('أضف موظفاً أولاً');return}
   window.openQuickForm({
     title:'حركة راتب', sub:'سلفة، خصم، مكافأة، أو عمولة',
     fields:[
       { id:'employeeId', label:'الموظف', type:'select', options: es.map(e=>({value:e.id,label:e.name})) },
       { id:'type', label:'النوع', type:'select', value:'bonus', options:[{value:'advance',label:'سلفة'},{value:'deduction',label:'خصم'},{value:'bonus',label:'مكافأة'},{value:'commission',label:'عمولة'}] },
       { id:'amount', label:'المبلغ (د.ب)', type:'number', step:'0.001', value:0, min:0 },
       { id:'method', label:'طريقة الصرف (للسلفة فقط — تخرج من الصندوق الآن)', type:'select', value:'cash', options:METHOD_OPTS },
       { id:'note', label:'ملاحظة (اختياري)', type:'text' },
     ],
     onSubmit:(v)=>{
       if(!(v.amount>0)){window.toast('أدخل مبلغاً صحيحاً');return false}
       const emp=es.find(e=>e.id===v.employeeId);
       const amount=FIN.r3(v.amount),period=FIN.todayStr().slice(0,7);
       L997Enterprise.addPayrollTx({employeeId:v.employeeId,type:v.type,amount,note:v.note});
       // السلفة نقد يخرج الآن: تُسجَّل مصروفاً (رواتب) وتُخصم من راتب الشهر عند الصرف
       if(v.type==='advance')L997Enterprise.addExpense({catId:'advance',group:'salaries',category:'سلفة راتب — '+(emp?emp.name:''),amount,method:v.method,employeeId:v.employeeId,period,note:v.note});
       renderEmployees(); typeof renderFinance==='function'&&renderFinance(); typeof renderClosures==='function'&&renderClosures();
       window.toast(v.type==='advance'?'تم تسجيل السلفة وخصمها من الصندوق':'تم تسجيل حركة الراتب');
     }
   });
 });
 // صرف رواتب الشهر دفعة واحدة: صافي كل موظف نشط يُسجَّل مصروف «رواتب» مرتبطاً بالموظف والشهر (لا يُصرف مرتين)
 q('payMonthSalariesBtn')?.addEventListener('click',()=>{
   if(!CAN('payroll')||!CAN('add_expense')){window.toast('صرف الرواتب يتطلب صلاحية الرواتب والمصروفات');return}
   if(window.L997Shift&&!window.L997Shift.guard())return;
   const es=L997Enterprise.data.employees.filter(e=>e.active!==false);
   if(!es.length){window.toast('أضف موظفاً أولاً');return}
   const E2=L997Enterprise.data;
   const preview=mk=>es.map(e=>{const d=FIN.salaryDue(e,E2.payroll,E2.expenses,mk);return `${e.name}: ${d.paid?'✓ مصروف مسبقاً':money(d.net)}`}).join(' · ');
   const mk0=FIN.todayStr().slice(0,7);
   window.openQuickForm({
     title:'💵 صرف رواتب الشهر', sub:`صافي كل موظف = الراتب + العمولة + المكافآت − الخصومات − السلف. شهر ${mk0}: ${preview(mk0)}`,
     fields:[
       {id:'month',label:'شهر الرواتب',type:'month',value:mk0},
       {id:'method',label:'طريقة الصرف',type:'select',value:'bank_transfer',options:METHOD_OPTS},
     ],
     submitLabel:'صرف الرواتب',
     onSubmit:v=>{
       if(!/^\d{4}-\d{2}$/.test(v.month||'')){window.toast('اختر الشهر');return false}
       const me=window.L997Auth?window.L997Auth.user():null;
       let n=0,total=0;
       es.forEach(e=>{
         const d=FIN.salaryDue(e,E2.payroll,E2.expenses,v.month);
         if(d.paid||!(d.net>0))return;
         L997Enterprise.addExpense({catId:'salary',group:'salaries',category:'رواتب — '+e.name,amount:d.net,method:v.method,employeeId:e.id,period:v.month,
           note:`راتب ${v.month}: أساسي ${money(d.salary)}${d.commission?` + عمولة ${money(d.commission)}`:''}${d.bonuses?` + مكافآت ${money(d.bonuses)}`:''}${d.deductions?` − خصومات ${money(d.deductions)}`:''}${d.advances?` − سلف ${money(d.advances)}`:''}`,paidBy:me?me.name:''});
         n++;total+=d.net;
       });
       if(!n){window.toast(`لا توجد رواتب مستحقة غير مصروفة لشهر ${v.month}`);return false}
       L997Enterprise.log(`صرف رواتب شهر ${v.month} — ${n} موظف`,total,{month:v.month});
       renderEmployees(); typeof renderFinance==='function'&&renderFinance(); typeof renderClosures==='function'&&renderClosures();
       window.toast(`تم صرف رواتب ${n} موظف — الإجمالي ${money(total)}`);
     }
   });
 });
 // refresh enterprise dashboard cards by appending financial snapshot to existing dashboard
 window.renderFinance997 = renderFinance;
 window.renderInventory997 = renderInventory;
 window.renderEmployees997 = renderEmployees;
 window.renderClosures997 = renderClosures;
 window.renderAudit997 = renderAudit;
 const obs=new MutationObserver(()=>{});document.addEventListener('DOMContentLoaded',()=>{renderFinance();renderInventory();renderEmployees();renderClosures();renderAudit()});
})();
// Offline app: once opened from the site link, the phone keeps a copy that works without internet
(function(){
  if (!("serviceWorker" in navigator) || !/^https?:$/.test(location.protocol)) return;
  window.addEventListener("load", () => { navigator.serviceWorker.register("sw.js").catch(() => {}); });
})();
