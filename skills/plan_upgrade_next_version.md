# แผนอัปเกรด Next Version: ลดเวลาเปิดหน้าแรก (GitHub Pages + GAS + Google Sheets)

## 1. วัตถุประสงค์และขอบเขต

เอกสารนี้เป็นคู่มือทำงานทีละขั้นสำหรับโปรแกรมเมอร์ที่เพิ่งรับช่วงโครงการ `trip1day` โดยเป้าหมายคือ **ทำให้หน้าแรกเปิดเร็วขึ้น โดยไม่เปลี่ยน infrastructure**:

- Frontend: GitHub Pages, HTML/CSS/Vanilla JavaScript
- Backend: Google Apps Script (GAS) Web App
- Database: Google Sheets
- Authentication: LINE LIFF

### ปัญหาปัจจุบัน

ลำดับที่เกิดขึ้นเมื่อเปิดแอปใหม่คือ:

```text
โหลด LIFF และอ่าน LINE profile
        ↓
เรียก getDataOnLoad เพื่อรับ master data
        ↓
วาดหน้า summary
        ↓
เรียก listTransactionsByDate เพื่อรับรายการของวันนี้
```

จึงมี API สองรอบแบบต่อเนื่องก่อนผู้ใช้เห็นข้อมูลครบถ้วน แม้ข้อมูล master จะถูกเก็บ cache อยู่แล้ว

### เป้าหมายของ vNext

1. ลดการเรียก API หน้าแรกจาก 2 รอบเหลือ 1 รอบ
2. รักษาหน้าจอและกฎธุรกิจเดิมทั้งหมด
3. ไม่ย้ายไป Supabase, Firebase, Cloud Run หรือฐานข้อมูลใหม่
4. ออกแบบให้ทำต่อเป็น lazy loading ได้ในรุ่นถัดไป

### เกณฑ์ความสำเร็จ

- หน้าแรกยังแสดงรายการของวันปัจจุบันได้ถูกต้อง
- ผู้ใช้เห็นเฉพาะรายการของ `lineUserId` ของตนเองเหมือนเดิม
- การสร้าง, แก้ไข, ลบรายการยังทำงานได้
- ไม่มี API เดิมหายไป เพราะหน้าจอหรือระบบอื่นอาจเรียกใช้
- การเปิดหน้าแรกใช้ API สำหรับข้อมูลธุรกิจเพียง 1 ครั้ง (ไม่นับ LIFF SDK)
- วัดเวลาเปิดครั้งแรกและเปิดซ้ำก่อน/หลัง แล้วบันทึกผลไว้ใน Pull Request หรือ commit note

## 2. ข้อควรรู้ก่อนเริ่ม

### ไฟล์ที่เกี่ยวข้อง

| หน้าที่ | ไฟล์ |
|---|---|
| API entry point และ route action | `code.js` |
| อ่าน master data และ transactions | `Api_Read.js` |
| cache ของ GAS | `Repository_Cache.js` |
| อ่าน Google Sheets | `Repository_Sheets.js` |
| HTTP client ของ frontend | `index.html` (embedded `ApiClient`) |
| ลำดับเริ่มแอปและ LocalStorage | `index.html` (embedded `window.App`) |
| หน้า summary และการโหลดรายการ | `index.html` (embedded `DaySummaryListComponent`) |
| URL ของ GAS production | `config_api.js` |

> หมายเหตุ: มีไฟล์ component แยก เช่น `Js_App.html` และ `Js_DaySummaryList.html` แต่ GitHub Pages ใช้ `index.html` ที่รวมโค้ดไว้แล้วใน repository นี้ ให้แก้ `index.html` เป็นแหล่งจริงสำหรับ frontend production เว้นแต่ทีมตัดสินใจทำกระบวนการ build/merge ให้ชัดเจนก่อน

### กฎที่ห้ามละเมิด

- ห้ามใช้ `getValue()` หรือ `setValue()` ใน loop กับ Google Sheets
- ต้องใช้ `Repository_Sheets.bulkReadAsObjects()` สำหรับการอ่านชุดข้อมูล
- ห้ามลบหรือเปลี่ยนชื่อ action เดิม: `getDataOnLoad`, `listTransactionsByDate`, `getTransactionDetail`, `submitTransaction`, `deleteTransaction`
- ห้ามเปลี่ยน `Content-Type: text/plain;charset=utf-8` ใน fetch เพราะจะเสี่ยง CORS preflight กับ GAS
- ห้าม deploy ด้วย `clasp deploy`; กระบวนการเดิมใช้ `python gas_sync.py push` แล้วให้เจ้าของระบบสร้าง New Deployment ใน Apps Script เอง
- อย่า log ข้อมูลส่วนบุคคลเต็มรูปแบบ เช่น LINE user ID หรือชื่อผู้ใช้ ลง console

## 3. แผนงานที่แนะนำ

ทำตาม Phase 0 → Phase 1 ก่อน แล้วหยุดวัดผล หากผู้ใช้ยังน้อยและความเร็วเป็นที่ยอมรับได้ **ไม่จำเป็นต้องทำ Phase 2**

| Phase | ความเสี่ยง | ผลที่คาดหวัง | ทำเมื่อ |
|---|---:|---|---|
| 0: Baseline | ต่ำมาก | รู้ปัญหาจริงเป็นตัวเลข | ต้องทำก่อนแก้เสมอ |
| 1: Bootstrap API เดียว | ต่ำ | ลดเวลา API รอคอยประมาณ 20–30% | แนะนำให้ทำเมื่อพร้อมอัปเดตเล็กน้อย |
| 2: Lazy-load master data | กลาง | เร็วขึ้นรวมประมาณ 40–60% ใน cold path | ทำเมื่อยังรู้สึกช้า หรือผู้ใช้เพิ่ม |
| 3: ย้าย infrastructure | สูง | ลด cold-start variability ได้มาก | ยังไม่ต้องทำสำหรับผู้ใช้น้อย |

## 4. Phase 0: เก็บ baseline ก่อนแก้

### 4.1 ตรวจ working tree

1. เปิด terminal ที่ root ของ repository
2. รัน `git status --short`
3. ถ้ามีไฟล์ที่แก้ค้างอยู่ ให้จดชื่อไฟล์ก่อน ห้ามลบหรือ reset งานของคนอื่น

### 4.2 วัดจาก browser จริง

ใช้โทรศัพท์หรือ Chrome profile ที่ใช้งานจริงกับ LIFF และทำอย่างน้อย 3 รอบต่อกรณี:

1. เปิดแอปครั้งแรกหลังล้าง Site Data/LocalStorage
2. ปิดและเปิดแอปซ้ำโดยไม่ล้าง LocalStorage
3. กดปุ่มซิงค์ข้อมูล (force sync)

จดเวลาโดยเริ่มนับตั้งแต่เปิด URL จนเห็น "รายการเบิกตาม Site งาน" หรือข้อความว่าไม่มีรายการ แล้วใช้ตารางนี้:

| วันที่ | กรณี | รอบที่ 1 | รอบที่ 2 | รอบที่ 3 | ค่าเฉลี่ย | เครือข่าย/อุปกรณ์ |
|---|---|---:|---:|---:|---:|---|
| YYYY-MM-DD | first open |  |  |  |  |  |
| YYYY-MM-DD | repeat open |  |  |  |  |  |
| YYYY-MM-DD | force sync |  |  |  |  |  |

### 4.3 เพิ่ม timing ชั่วคราว (เฉพาะ development)

ถ้าต้องหาสาเหตุละเอียด ให้เพิ่ม `performance.mark()` รอบ `initLiff`, `getAppBootstrap` และ `renderScreen` แล้วแสดงเฉพาะเวลาเป็นตัวเลขใน `console.debug` ห้าม commit LINE UID หรือ response เต็มลง log

เมื่อวัดเสร็จ ให้ลบ timing ชั่วคราวออก หรือเก็บเฉพาะ helper ที่ไม่ log ข้อมูลส่วนตัว

## 5. Phase 1: รวม API หน้าแรกเป็น Bootstrap API เดียว

### 5.1 หลักการออกแบบ

เพิ่ม action ใหม่ชื่อ `getAppBootstrap` โดย action นี้ต้อง:

1. รับ `lineUserId` และ `dateStr` (date เป็น optional)
2. โหลด master data ด้วย cache เดิม
3. หา profile ของผู้ใช้ด้วย cache เดิม
4. โหลด `TRANSACTIONS_ALL` เพียงครั้งเดียวด้วย cache เดิม
5. filter transaction ตามวันที่และ user เดียวกับ logic เดิม
6. คืนข้อมูลทั้งหมดใน response เดียว

**ห้าม** ให้ `getAppBootstrap` เรียก `getDataOnLoad()` แล้วเรียก `listTransactionsByDate()` ต่อ เพราะจะทำให้อ่าน `TRANSACTIONS_ALL` และสร้าง response ซ้ำโดยไม่จำเป็น ให้แยก helper ที่ใช้ร่วมกันแทน

### 5.2 รูปแบบ request และ response

Frontend ต้องส่ง:

```javascript
window.ApiClient.call('getAppBootstrap', {
  lineUserId: window.AppState.lineUserId,
  dateStr: window.AppState.selectedDate || ''
});
```

Backend ต้องคืนรูปแบบนี้เสมอเมื่อสำเร็จ:

```javascript
{
  success: true,
  data: {
    today_th: 'YYYY-MM-DD',
    userProfile: {
      requester_name: '',
      car_no: '',
      group_car: 1
    },
    masterData: {
      masterSite: [],
      masterRoutes: [],
      masterConfig: {},
      rateCar: [],
      approveUsers: []
    },
    dailyTransactions: []
  }
}
```

กติกา:

- หากหา profile ไม่พบ ให้ใช้ `userProfile: null` เช่นพฤติกรรมเดิม
- หากไม่มีรายการในวันนั้น ให้คืน `dailyTransactions: []` และต้องเป็น success
- หาก `dateStr` ว่าง ให้ใช้วันที่ Bangkok จาก `Util_Date.getTodayBangkok()`
- response error ต้องใช้ `Util_Response.buildError()` เช่นเดิม

### 5.3 ขั้นตอนแก้ backend

#### A. แก้ `Api_Read.js`

1. สร้าง helper private เช่น `buildTransactionSummaries(allTx, dateStr, lineUserId)`
2. ย้าย logic filter/map ที่อยู่ใน `listTransactionsByDate()` มาไว้ใน helper โดยผลลัพธ์ต้องเหมือนเดิมทุก field
3. แก้ `listTransactionsByDate()` ให้ยังอ่าน cache และเรียก helper นี้ เพื่อไม่ทำให้ endpoint เดิมเปลี่ยนผลลัพธ์
4. สร้าง `getAppBootstrap(request)`
5. ใน `getAppBootstrap` ให้อ่าน master data ตาม logic ของ `getDataOnLoad()` และอ่าน transactions cache เพียงหนึ่งครั้ง
6. คืน object ตามหัวข้อ 5.2

ตัวอย่างโครงร่าง (ไม่ใช่โค้ด copy-paste ทั้งหมด):

```javascript
function getAppBootstrap(request) {
  try {
    const lineUserId = String((request && request.lineUserId) || '').trim();
    const todayTh = Util_Date.getTodayBangkok();
    const dateStr = (request && request.dateStr) || todayTh;

    const masterData = loadMasterDataForApp(lineUserId);
    const allTx = Repository_Cache.getCached('TRANSACTIONS_ALL', function() {
      return Repository_Sheets.bulkReadAsObjects(CONFIG.SHEETS.TRANSACTIONS);
    });

    return Util_Response.buildSuccess({
      today_th: todayTh,
      userProfile: masterData.userProfile,
      masterData: masterData,
      dailyTransactions: buildTransactionSummaries(allTx, dateStr, lineUserId)
    });
  } catch (error) {
    Logger.log('getAppBootstrap Error: ' + error.message);
    return Util_Response.buildError('SERVER_ERROR', 'ไม่สามารถโหลดข้อมูลเริ่มต้นได้');
  }
}
```

> ข้อสำคัญ: ถ้า `loadMasterDataForApp` คืน `userProfile` อยู่แล้ว อย่าส่ง `userProfile` ซ้ำซ้อนใน `masterData` ใน response สุดท้าย ให้เลือกโครงสร้างเดียวและแก้ frontend ให้ตรงกัน

#### B. แก้ `code.js`

เพิ่ม case ใน `handleApiRequest`:

```javascript
case 'getAppBootstrap':
  return getAppBootstrap(data || {});
```

ตรวจให้แน่ใจว่า `data` ที่มาจาก POST เป็น object ตามที่ frontend ส่งมา

#### C. ตรวจ backend แบบ manual

ใน Apps Script editor ให้ใช้ Executions หรือ temporary test function เรียก `getAppBootstrap({ lineUserId: 'USER-LOCAL-TEST', dateStr: 'YYYY-MM-DD' })` แล้วตรวจว่า:

- ไม่มี exception
- keys ใน response ครบ
- `dailyTransactions` ของ user/date ถูกต้องเทียบกับ `listTransactionsByDate`
- `getDataOnLoad` และ `listTransactionsByDate` ยังทำงานได้

### 5.4 ขั้นตอนแก้ frontend ใน `index.html`

1. หาตำแหน่ง `window.App.loadMasterData`
2. เปลี่ยนการเรียก `getDataOnLoad` ใน cold path เป็น `getAppBootstrap`
3. เมื่อ response สำเร็จ ให้ทำตามลำดับนี้:
   - นำ `data.masterData` เข้า `window.AppState.masterData`
   - set `window.AppState.selectedDate` จากวันที่ที่เลือกอยู่ หรือ `data.today_th`
   - นำ `data.dailyTransactions` เข้า `window.AppState.dailyTransactions`
   - บันทึกเฉพาะ `masterData` ลง LocalStorage ตามพฤติกรรมเดิม
   - เรียก `App.navigateTo('summary_list')`
4. แก้ `DaySummaryListComponent.renderScreen` ให้รับรู้ว่า `state.dailyTransactions` เพิ่งมาจาก bootstrap แล้ว และ render ได้เลยโดยไม่ยิง `listTransactionsByDate` ซ้ำ
5. สำหรับกรณีเปลี่ยนวันที่จาก date picker ให้คง `listTransactionsByDate` ไว้ตามเดิม เพราะเป็นการโหลดข้อมูลใหม่ตามการกระทำของผู้ใช้
6. สำหรับกรณีเปิดซ้ำและ master data มาจาก LocalStorage ให้ยิง `listTransactionsByDate` เพียงครั้งเดียวตามเดิม ห้ามแสดงรายการของ user คนก่อนจาก LocalStorage

แนวทางที่ปลอดภัยที่สุดคือเพิ่ม method ใหม่:

```javascript
DaySummaryListComponent.renderScreen(container, initialTransactions);
```

โดย:

- ถ้า `initialTransactions` เป็น array ให้ render list โดยตรง
- ถ้าไม่ได้ส่งมา ให้เรียก `loadList(currentDate)` เหมือนเดิม
- อย่าใช้ truthy check ธรรมดา เพราะ `[]` เป็นข้อมูลที่ถูกต้องและต้อง render empty state

### 5.5 กรณี error ที่ต้องรักษาไว้

- LIFF ไม่พร้อม: ยังคง fallback `USER-LOCAL-TEST` เฉพาะ local testing ตามโค้ดเดิม
- Bootstrap error: แสดงปุ่ม "ลองใหม่" และปุ่มนั้นต้องเรียก bootstrap ซ้ำได้
- API response ไม่ครบ: อย่าให้หน้าแตก; ใช้ `[]`, `{}` หรือ `null` เป็น default ที่เหมาะสม
- Network timeout: ให้ใช้ retry ของ `ApiClient` เดิม ห้ามสร้าง retry ซ้อนหลายชั้น

## 6. Phase 1: รายการทดสอบก่อน deploy

### 6.1 Regression checklist

- [ ] เปิดแอปครั้งแรกแล้วเห็น summary list หรือ empty state
- [ ] เปิดแอปซ้ำแล้วไม่เห็นข้อมูลของผู้ใช้คนอื่น
- [ ] เปลี่ยนวันที่แล้วรายการเปลี่ยนถูกต้อง
- [ ] กดเพิ่มรายการแล้ว master site, route, rate และ approver ยังครบ
- [ ] สร้างรายการใหม่แล้วกลับ summary และเห็นรายการใหม่
- [ ] แก้ไขรายการเดิมได้
- [ ] ลบรายการแล้วไม่เห็น ghost data
- [ ] กดซิงค์ข้อมูลแล้วได้ข้อมูลใหม่
- [ ] ปิดอินเทอร์เน็ตแล้วเห็น error ที่เข้าใจได้ ไม่ค้าง spinner ตลอดไป
- [ ] เปิดผ่าน LINE LIFF และ browser ปกติ

### 6.2 ตรวจจำนวน API call

เปิด DevTools > Network แล้ว refresh หนึ่งครั้ง:

- ต้องเห็น request `getAppBootstrap` เพียง 1 request สำหรับข้อมูลหน้าแรก
- ต้อง **ไม่** เห็น `getDataOnLoad` ตามด้วย `listTransactionsByDate` ใน cold path เดียวกัน
- หากใช้ LocalStorage ได้ อาจเห็น `listTransactionsByDate` หรือ background revalidation ตาม design เดิมได้ แต่ต้องไม่เกิดรายการซ้ำโดยไม่มีเหตุผล

### 6.3 เปรียบเทียบผลก่อน/หลัง

ใช้ตาราง baseline เดิมอีกครั้ง แล้วรายงานอย่างตรงไปตรงมา:

```text
improvementPercent = ((averageBefore - averageAfter) / averageBefore) * 100
```

เป้าหมาย Phase 1 คือประมาณ 20–30% ในกรณีที่เดิมต้องรอ API สองรอบ ไม่ต้องถือเป็น bug หากผลต่ำกว่านี้ในวันที่ GAS/เครือข่ายตอบสนองไม่คงที่

## 7. Deploy และ rollback

### 7.1 เตรียม deploy

1. ตรวจ `git diff --check` เพื่อหา whitespace error
2. ตรวจ `git diff` ว่าแก้เฉพาะ `Api_Read.js`, `code.js`, `index.html` และเอกสารที่เกี่ยวข้อง
3. commit เป็นก้อนเดียวที่อธิบายได้ เช่น `perf: combine initial app data into bootstrap endpoint`
4. push frontend ไป branch ที่ GitHub Pages ใช้งาน
5. push GAS source ด้วย `python gas_sync.py push`
6. ให้เจ้าของ Apps Script เข้า Apps Script > Deploy > Manage deployments > Edit/New version แล้ว deploy ด้วย URL เดิม
7. ตรวจว่า `config_api.js` ยังชี้ GAS Web App URL เดิม

### 7.2 ลำดับ deploy ที่ลดความเสี่ยง

1. Deploy backend ที่เพิ่ม `getAppBootstrap` ก่อน (API เก่ายังอยู่ จึง backward compatible)
2. ทดสอบ endpoint ใหม่บน deployment นั้น
3. Deploy frontend หลัง backend ผ่านแล้ว

### 7.3 Rollback

หากหน้าแรกใช้งานไม่ได้:

1. rollback GitHub Pages ไป commit ก่อนหน้า
2. หาก backend มีปัญหา ให้เลือก Apps Script deployment version ก่อนหน้า
3. ห้ามแก้ `GAS_API_URL` แบบสุ่มหรือสร้าง deployment URL ใหม่โดยไม่บันทึก
4. บันทึก error, เวลา และ action ที่ทำให้เกิดปัญหา ก่อนเริ่มแก้รอบถัดไป

## 8. Phase 2: Lazy-load master data (ทำเฉพาะเมื่อยังช้า)

ทำ Phase 2 หลัง Phase 1 วัดผลแล้วเท่านั้น เพราะมีความเสี่ยงต่อหน้า form มากกว่า

### แนวคิด

หน้า summary ต้องใช้เพียง:

- วันที่ปัจจุบัน
- profile ผู้ใช้
- daily transactions

ส่วนต่อไปนี้ค่อยจำเป็นเมื่อต้องสร้างหรือแก้ไขรายการ:

- `masterSite`
- `masterRoutes`
- `masterConfig`
- `rateCar`
- `approveUsers`

ให้เพิ่ม endpoint เช่น `getFormMasterData` และเรียกเฉพาะตอนผู้ใช้กด "เพิ่ม Site ใหม่" หรือเปิดรายละเอียดรายการ

### เงื่อนไขสำเร็จ Phase 2

- หน้า summary ไม่รอ master route/rate/approver
- เมื่อเข้าสู่ form ต้องมี loading state ที่ชัดเจน และ disable ปุ่มบันทึกจนข้อมูลพร้อม
- ไม่ใช้ master data เก่าผิด version หากผู้ใช้กดปุ่มซิงค์
- หาก form master โหลดไม่สำเร็จ ผู้ใช้กลับ summary ได้และไม่เกิดการบันทึกข้อมูลไม่ครบ

## 9. สิ่งที่ยังไม่ควรทำ

- ไม่เพิ่ม scheduled ping เพื่อพยายาม keep GAS warm; ไม่รับประกันผลและใช้ quota
- ไม่ย้ายฐานข้อมูลเพียงเพราะ cold start ครั้งคราว หากผู้ใช้ยังน้อย
- ไม่ลด cache TTL แบบสุ่ม เพราะจะทำให้ Google Sheets ถูกอ่านบ่อยขึ้น
- ไม่ใส่ retry มากกว่า 1–2 รอบโดยไม่มี backoff เพราะอาจเพิ่มภาระตอน service ช้า
- ไม่ cache รายการ transaction ของผู้ใช้อื่นใน LocalStorage

## 10. เกณฑ์ตัดสินใจหลังจบงาน

| อาการหลัง Phase 1 | ข้อเสนอ |
|---|---|
| เปิดซ้ำส่วนใหญ่ไม่เกิน 3 วินาที และผู้ใช้น้อย | หยุดที่ Phase 1, ใช้ infra เดิมต่อ |
| Cold open เป็นบางครั้ง 4–7 วินาที แต่ไม่ timeout | ยอมรับได้สำหรับ GAS/Sheets; พิจารณา Phase 2 เมื่อมีเวลา |
| เกิน 10 วินาทีบ่อย, timeout หรือหลายคนช้าพร้อมกัน | ทำ Phase 2 และเริ่มวางแผนย้าย backend/data |
| ต้องการ SLA เปิดสม่ำเสมอต่ำกว่า 1–2 วินาที | ต้องประเมิน infra ใหม่; GAS + Sheets ไม่เหมาะเป็นเป้าหมาย SLA นี้ |

## 11. Definition of Done

งานนี้ถือว่าเสร็จเมื่อครบทุกข้อ:

- [ ] มี endpoint `getAppBootstrap` และ API เก่ายังใช้ได้
- [ ] หน้าแรก cold path ไม่ยิง API ข้อมูลธุรกิจซ้ำสองรอบ
- [ ] ผ่าน regression checklist ทุกข้อ
- [ ] มีตัวเลข before/after อย่างน้อย 3 รอบต่อกรณี
- [ ] deploy frontend และ GAS ด้วย URL เดิม
- [ ] มี rollback commit/version ที่ระบุได้
- [ ] ไม่มีการย้าย infrastructure หรือเปลี่ยน schema Google Sheets โดยไม่ได้รับอนุมัติ
