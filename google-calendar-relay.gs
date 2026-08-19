/**
 * 아이 습관 앱 — 구글 캘린더 중계
 *
 * 캘린더 "우리딸일정"과 "하교시간"을 읽어 JSON으로 돌려줍니다.
 *
 * ── 설치 방법 ──────────────────────────────────────────
 *  1. script.google.com 접속 → [새 프로젝트]
 *  2. 이 파일 내용을 전부 붙여넣기
 *  3. 아래 SECRET 을 원하는 암호로 바꾸기 (아무 문자열이나)
 *  4. (선택) 툴바 함수 목록에서 runTest 를 골라 ▶ 실행 → 로그로 결과 확인
 *  5. 오른쪽 위 [배포] → [새 배포] → 유형은 [웹 앱]
 *       · 실행 계정  : 나
 *       · 액세스 권한: 모든 사용자
 *  6. [배포] 누르고 권한 승인 (본인 캘린더 읽기 허용)
 *  7. 나오는 "웹 앱 URL"(.../exec)을 복사해서
 *     앱의 부모 모드 → 구글 캘린더 연결에 붙여넣기
 * ──────────────────────────────────────────────────────
 */

var SECRET       = 'change-me';        // ← 반드시 바꾸세요
var CAL_SCHEDULE = '우리딸일정';
var CAL_DISMISS  = '하교시간';
var TZ           = 'Asia/Seoul';

function doGet(e) {
  var p = (e && e.parameter) || {};

  if (SECRET && p.key !== SECRET) {
    return json({ error: '암호가 맞지 않아요' });
  }

  var from = p.from || today_();
  var to   = p.to   || from;

  try {
    var days = {};
    var d    = parseDate_(from);
    var last = parseDate_(to);

    while (d <= last) {
      var key = fmt_(d, 'yyyy-MM-dd');
      days[key] = { dismissal: null, dismissalTitle: null, events: [] };
      d.setDate(d.getDate() + 1);
    }

    var dbg = {};
    collect_(CAL_SCHEDULE, from, to, days, false, dbg);
    collect_(CAL_DISMISS,  from, to, days, true,  dbg);

    // 시간순 정렬
    Object.keys(days).forEach(function (k) {
      days[k].events.sort(function (a, b) {
        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
        return a.start < b.start ? -1 : 1;
      });
    });

    return json({
      from: from, to: to, days: days,
      '진단': {
        '스크립트시간대': Session.getScriptTimeZone(),
        '기준시간대': TZ,
        '캘린더': dbg,
        '내캘린더목록': CalendarApp.getAllCalendars().map(function (c) { return c.getName(); })
      }
    });

  } catch (err) {
    return json({ error: String(err) });
  }
}

/**
 * 제목 앞머리에 적힌 시각을 뽑아냅니다.
 * 플래너 앱이 "2:00 피아노" 처럼 종일 일정으로 넣기 때문에 필요합니다.
 *
 *   "2:00 피아노"   → { hm:'14:00', title:'피아노' }
 *   "오전 9시 병원"  → { hm:'09:00', title:'병원' }
 *   "태권도"        → null
 *
 * 오전/오후 표시가 없으면 1~7시는 오후로 봅니다 (하교 후 일정이라서).
 */
function parseTitleTime_(raw) {
  var m = String(raw).match(
    /^\s*(오전|오후|AM|PM)?\s*(\d{1,2})\s*[:시]\s*(\d{1,2})?\s*분?\s*(오전|오후|AM|PM)?\s*[-–~]?\s*(.*)$/i
  );
  if (!m) return null;

  var ap = String(m[1] || m[4] || '').toLowerCase();
  var h  = Number(m[2]);
  var mi = Number(m[3] || 0);
  if (h > 23 || mi > 59) return null;

  if (ap === '오후' || ap === 'pm')      { if (h < 12) h += 12; }
  else if (ap === '오전' || ap === 'am') { if (h === 12) h = 0; }
  else if (h >= 1 && h <= 7)             { h += 12; }   // 1~7시는 오후로 해석

  var rest = String(m[5] || '').trim();
  return { hm: pad2_(h) + ':' + pad2_(mi), title: rest || String(raw).trim() };
}
function pad2_(n) { return (n < 10 ? '0' : '') + n; }

/** "14:00" → "15:00" */
function addHour_(hm) {
  var a = hm.split(':');
  var h = Math.min(23, Number(a[0]) + 1);
  return pad2_(h) + ':' + a[1];
}

/**
 * 캘린더를 읽어 days 에 채워 넣습니다.
 * 이름이 같은 캘린더가 여러 개일 수 있으므로 전부 읽고 중복만 걸러냅니다.
 */
function collect_(name, from, to, days, isDismissal, dbg) {
  var cals = CalendarApp.getCalendarsByName(name);

  dbg[name] = { '찾은캘린더': cals.length, '읽은일정': 0, '담은일정': 0, '범위밖': [] };

  if (!cals.length) {
    if (isDismissal) return;                       // 하교시간 캘린더는 없어도 넘어감
    throw new Error('"' + name + '" 캘린더를 찾을 수 없어요');
  }

  var start = parseDate_(from);
  var end   = parseDate_(to);
  end.setDate(end.getDate() + 1);                  // 마지막 날 포함

  var seen = {};

  cals.forEach(function (cal) {
    cal.getEvents(start, end).forEach(function (ev) {
      dbg[name]['읽은일정']++;

      var s      = ev.getStartTime();
      var e      = ev.getEndTime();
      var raw    = ev.getTitle();
      var allDay = ev.isAllDayEvent();

      // 같은 일정이 두 번 들어오는 것 방지
      var sig = raw + '|' + s.getTime() + '|' + allDay;
      if (seen[sig]) return;
      seen[sig] = true;

      // 종일 일정은 걸쳐 있는 날짜를 모두 채웁니다
      var keys = [];
      if (allDay) {
        var c = new Date(s.getTime());
        while (c < e) { keys.push(fmt_(c, 'yyyy-MM-dd')); c.setDate(c.getDate() + 1); }
      }
      if (!keys.length) keys = [fmt_(s, 'yyyy-MM-dd')];

      var picked = parseTitleTime_(raw);           // 제목에서 시각 뽑기

      keys.forEach(function (key) {
        if (!days[key]) {                          // 요청한 주 바깥이면 기록만 남김
          dbg[name]['범위밖'].push(key + ' ' + raw);
          return;
        }

        if (isDismissal) {
          var hm = picked ? picked.hm : (allDay ? null : fmt_(s, 'HH:mm'));
          days[key].dismissalTitle = raw;          // 확인용
          if (hm && (!days[key].dismissal || hm < days[key].dismissal)) {
            days[key].dismissal = hm;
          }
          dbg[name]['담은일정']++;
          return;
        }

        var title = raw, startStr, endStr, isAll = allDay;

        if (picked) {
          // 제목에 시각이 있으면 그걸 진짜 시각으로 씁니다
          title    = picked.title;
          startStr = key + 'T' + picked.hm + ':00';
          endStr   = key + 'T' + addHour_(picked.hm) + ':00';   // 기본 1시간
          isAll    = false;
        } else if (allDay) {
          startStr = key + 'T00:00:00';
          endStr   = key + 'T23:59:59';
        } else {
          startStr = fmt_(s, "yyyy-MM-dd'T'HH:mm:ss");
          endStr   = fmt_(e, "yyyy-MM-dd'T'HH:mm:ss");
        }

        days[key].events.push({
          title:    title,
          start:    startStr,
          end:      endStr,
          location: ev.getLocation() || '',
          allDay:   isAll,
          raw:      raw
        });
        dbg[name]['담은일정']++;
      });
    });
  });
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function fmt_(d, pattern)  { return Utilities.formatDate(d, TZ, pattern); }
function today_()          { return fmt_(new Date(), 'yyyy-MM-dd'); }
function parseDate_(s) {
  var a = s.split('-');
  return new Date(Number(a[0]), Number(a[1]) - 1, Number(a[2]));
}

/**
 * 배포 전 확인용.
 * 상단 툴바의 함수 드롭다운에서 runTest 를 골라 ▶ 실행을 누르면
 * 아래 "실행 로그"에 이번 주 일정이 JSON 으로 찍힙니다.
 */
function runTest() {
  // 앱이 요청하는 것과 똑같이 이번 주 월요일~일요일을 봅니다
  var d   = new Date();
  var dow = (d.getDay() + 6) % 7;                 // 월=0
  d.setDate(d.getDate() - dow);
  var from = fmt_(d, 'yyyy-MM-dd');
  d.setDate(d.getDate() + 6);
  var to   = fmt_(d, 'yyyy-MM-dd');

  var out = doGet({ parameter: { key: SECRET, from: from, to: to } });
  Logger.log(out.getContent());
}
