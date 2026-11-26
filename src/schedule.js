/**
 * 강의계획서 텍스트 → 일정(이벤트) 목록 → .ics 파일
 * 화면과 분리된 순수 함수 모음 (Node 로 테스트 가능)
 */

// ---------------------------------------------------------------- 일정 종류
const TYPES = {
  exam:    { label: "시험", pattern: /중간고사|기말고사|중간시험|기말시험|시험|퀴즈|quiz/i },
  present: { label: "발표", pattern: /발표/ },
  task:    { label: "과제", pattern: /과제|레포트|리포트|보고서|제출|마감/ },
  off:     { label: "휴강", pattern: /휴강|공휴일|휴일|추석|설날|개천절|한글날|성탄절|보강/ },
};
const TYPE_ORDER = ["exam", "present", "task", "off"];
const CLASS_LABEL = "수업";

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

// ---------------------------------------------------------------- 날짜 도우미
/** "2026-09-01" → 로컬 Date (시간 0시) */
function parseDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Date → "2026-09-01" */
function fmtDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date, n) {
  const r = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  r.setDate(r.getDate() + n);
  return r;
}

/** 그 주의 월요일 */
function mondayOf(date) {
  const day = date.getDay(); // 0=일
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(date, diff);
}

/**
 * N주차 수업 날짜 = 개강 주 월요일 + (N-1)주 + 수업 요일
 * @param {string} semesterStart  개강일 "YYYY-MM-DD" (아무 요일이어도 그 주가 1주차)
 * @param {number} week           주차 (1부터)
 * @param {number} classDay       수업 요일 (1=월 ... 5=금)
 */
function weekToDate(semesterStart, week, classDay) {
  const mon = mondayOf(parseDate(semesterStart));
  const offset = classDay === 0 ? 6 : classDay - 1; // 일요일은 그 주 마지막
  return fmtDate(addDays(mon, (week - 1) * 7 + offset));
}

/**
 * 문장 속 날짜 찾기: "10/15", "10.15", "10월 15일"
 * 연도는 개강일 기준으로 정함 (개강이 9월인데 1월이 나오면 다음 해)
 */
function findExplicitDate(text, semesterStart) {
  const m = text.match(/(?<![\d.])(1[0-2]|0?[1-9])\s*(?:\/|\.|월)\s*(3[01]|[12]\d|0?[1-9])\s*일?(?![\d.])/);
  if (!m) return null;
  const start = parseDate(semesterStart);
  const month = Number(m[1]);
  const day = Number(m[2]);
  let year = start.getFullYear();
  if (month < start.getMonth() + 1 - 6) year += 1;
  return fmtDate(new Date(year, month - 1, day));
}

// ---------------------------------------------------------------- 파싱
/** 줄 맨 앞의 주차 표시 찾기: "1주차", "제3주", "3주", "3 | 내용", "3\t내용" */
function matchWeekHeader(line) {
  const m = line.match(/^\s*(?:제\s*)?(\d{1,2})\s*(?:주차|주)?\s*(?:[|:.)\]\t-]|\s)\s*(.*)$/);
  if (!m) return null;
  const week = Number(m[1]);
  if (week < 1 || week > 20) return null;
  // "10/15 ..." 처럼 날짜로 시작하는 줄은 주차가 아님
  if (/^\s*\d{1,2}\s*[/.월]\s*\d/.test(line)) return null;
  return { week, rest: m[2].trim() };
}

/** 문구 하나의 종류 */
function detectType(phrase) {
  for (const key of TYPE_ORDER) {
    if (TYPES[key].pattern.test(phrase)) return key;
  }
  return null;
}

/**
 * 강의계획서 텍스트를 주차별 내용으로 묶는다.
 * @returns {Array<{week:number, text:string}>}
 */
function splitWeeks(text) {
  const weeks = [];
  let current = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const head = matchWeekHeader(line);
    if (head) {
      current = { week: head.week, text: head.rest };
      weeks.push(current);
    } else if (current) {
      current.text += " / " + line;
    }
  }
  return weeks;
}

/** 주차 내용을 의미 단위 문구로 쪼갠다 */
function splitPhrases(text) {
  return text
    .split(/\s*(?:(?<!\d)\/|\/(?!\d)|,|·|;|\||\t|※|▶|-\s)\s*/) // "9/18" 같은 날짜의 / 는 자르지 않음
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function shorten(s, n = 40) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/**
 * 강의계획서 → 일정 목록
 * @param {string} text
 * @param {{course:string, semesterStart:string, classDay:number, includeClasses?:boolean}} opt
 * @returns {Array<{date:string, title:string, type:string, course:string, week:number}>}
 */
function parseSyllabus(text, opt) {
  const { course, semesterStart, classDay } = opt;
  const includeClasses = opt.includeClasses !== false;
  const events = [];

  for (const { week, text: body } of splitWeeks(text)) {
    const classDate = weekToDate(semesterStart, week, classDay);
    const phrases = splitPhrases(body);
    let weekIsOff = false;

    for (const p of phrases) {
      const type = detectType(p);
      if (!type) continue;

      // 날짜 정하기: ① 문구 속 날짜 → ② "N주차까지/마감" → ③ 이번 주 수업일
      let date = findExplicitDate(p, semesterStart);
      if (!date) {
        const due = p.match(/(\d{1,2})\s*주차?\s*(?:까지|마감|제출)/);
        if (due) date = weekToDate(semesterStart, Number(due[1]), classDay);
      }
      if (!date) date = classDate;
      if (type === "off" && date === classDate) weekIsOff = true; // 그 주 수업일이 휴강일 때만

      events.push({ date, title: shorten(p), type, course, week });
    }

    // 수업 주제가 따로 있을 때만 '수업' 일정 추가 (시험만 있는 주, 휴강 주는 제외)
    const topic = phrases.find((p) => !detectType(p));
    if (includeClasses && !weekIsOff && topic) {
      events.push({
        date: classDate,
        title: shorten(`${week}주차 ${topic}`),
        type: "class",
        course,
        week,
      });
    }
  }

  return dedupe(events).sort(compareEvents);
}

function dedupe(events) {
  const seen = new Set();
  return events.filter((e) => {
    const key = `${e.date}|${e.course}|${e.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function compareEvents(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return a.course.localeCompare(b.course);
}

function typeLabel(type) {
  return type === "class" ? CLASS_LABEL : TYPES[type].label;
}

// ---------------------------------------------------------------- .ics 내보내기
function icsEscape(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** 한 줄이 75바이트를 넘으면 접기 (iCalendar 규칙) */
function foldLine(line) {
  const out = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const b = new TextEncoder().encode(ch).length;
    if (bytes + b > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}

/**
 * 일정 목록 → .ics 문자열 (하루 종일 일정)
 * @param {Array} events
 * @param {{calName?:string, now?:Date}} opt
 */
function toICS(events, opt = {}) {
  const calName = opt.calName || "DMU 학기 일정";
  const now = opt.now || new Date();
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DMU-OSS//Syllabus Calendar//KO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(calName)}`,
    "X-WR-TIMEZONE:Asia/Seoul",
  ];
  events.forEach((e, i) => {
    const start = e.date.replace(/-/g, "");
    const end = fmtDate(addDays(parseDate(e.date), 1)).replace(/-/g, "");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${start}-${i}-${hash(e.course + e.title)}@dmu-oss`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${end}`,
      `SUMMARY:${icsEscape(`[${e.course}] ${typeLabel(e.type)}: ${e.title}`)}`,
      `CATEGORIES:${icsEscape(typeLabel(e.type))}`,
      `DESCRIPTION:${icsEscape(`${e.week}주차 · ${e.course}`)}`,
      "END:VEVENT"
    );
  });
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** 일정 목록 → CSV 문자열 (엑셀용 BOM 포함) */
function toCSV(events) {
  const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
  const rows = [["날짜", "요일", "과목", "종류", "주차", "내용"].map(q).join(",")];
  for (const e of events) {
    const day = DAY_NAMES[parseDate(e.date).getDay()];
    rows.push([e.date, day, e.course, typeLabel(e.type), e.week, e.title].map(q).join(","));
  }
  return "\uFEFF" + rows.join("\r\n");
}

function hash(s) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return h.toString(36);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    TYPES, DAY_NAMES, parseDate, fmtDate, addDays, mondayOf, weekToDate, findExplicitDate,
    matchWeekHeader, detectType, splitWeeks, splitPhrases, parseSyllabus, typeLabel,
    toICS, toCSV, foldLine,
  };
}
