// 실행: node test/schedule.test.js
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const S = require("../src/schedule.js");

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log("  ✓", name);
}

// 2026-09-01(화) 개강 → 1주차 월요일은 2026-08-31
test("주차 → 날짜 변환", () => {
  assert.strictEqual(S.weekToDate("2026-09-01", 1, 1), "2026-08-31"); // 1주차 월
  assert.strictEqual(S.weekToDate("2026-09-01", 1, 3), "2026-09-02"); // 1주차 수
  assert.strictEqual(S.weekToDate("2026-09-01", 8, 3), "2026-10-21"); // 8주차 수
  assert.strictEqual(S.weekToDate("2026-09-06", 1, 1), "2026-08-31"); // 일요일 개강도 같은 주
});

test("문장 속 날짜 찾기", () => {
  assert.strictEqual(S.findExplicitDate("10.9 한글날 휴강", "2026-09-01"), "2026-10-09");
  assert.strictEqual(S.findExplicitDate("11/20 보고서 제출", "2026-09-01"), "2026-11-20");
  assert.strictEqual(S.findExplicitDate("12월 3일 발표", "2026-09-01"), "2026-12-03");
  assert.strictEqual(S.findExplicitDate("1월 5일 성적 확인", "2026-09-01"), "2027-01-05"); // 다음 해
  assert.strictEqual(S.findExplicitDate("JDK 21 설치", "2026-09-01"), null);
});

test("주차 머리말 인식", () => {
  assert.deepStrictEqual(S.matchWeekHeader("1주차\t오리엔테이션"), { week: 1, rest: "오리엔테이션" });
  assert.deepStrictEqual(S.matchWeekHeader("제3주: 연산자"), { week: 3, rest: "연산자" });
  assert.deepStrictEqual(S.matchWeekHeader("12 | 라이브러리"), { week: 12, rest: "라이브러리" });
  assert.strictEqual(S.matchWeekHeader("10/15 중간고사"), null);
  assert.strictEqual(S.matchWeekHeader("교재: 이것이 자바다"), null);
});

test("일정 종류 판별", () => {
  assert.strictEqual(S.detectType("중간고사"), "exam");
  assert.strictEqual(S.detectType("퀴즈"), "exam");
  assert.strictEqual(S.detectType("기말 프로젝트 발표"), "present");
  assert.strictEqual(S.detectType("실습과제 1 제출"), "task");
  assert.strictEqual(S.detectType("한글날 휴강"), "off");
  assert.strictEqual(S.detectType("상속"), null);
});

const sample = fs.readFileSync(path.join(__dirname, "../samples/java_syllabus.txt"), "utf8");
const opt = { course: "자바프로그래밍", semesterStart: "2026-09-01", classDay: 3 };

test("샘플 강의계획서 전체 파싱", () => {
  const ev = S.parseSyllabus(sample, opt);
  const key = ev.filter((e) => e.type !== "class");
  const find = (t) => key.find((e) => e.title.includes(t));

  assert.strictEqual(find("중간고사").date, "2026-10-21");          // 8주차 수
  assert.strictEqual(find("기말고사").date, "2026-12-16");          // 16주차 수
  assert.strictEqual(find("실습과제 1").type, "task");
  assert.strictEqual(find("실습과제 1").date, "2026-09-18");        // 문장 속 날짜 우선
  assert.strictEqual(find("휴강").date, "2026-11-04");              // 10주차 수
  assert.strictEqual(find("보고서").date, "2026-12-09");            // "15주차까지" → 15주차 수
  assert.strictEqual(find("퀴즈").type, "exam");
  assert.strictEqual(key.filter((e) => e.type === "present").length, 2);

  const classes = ev.filter((e) => e.type === "class");
  // 16주 중 휴강(10) · 시험만 있는 주(8, 16) · 발표만 있는 주(15) 제외 → 12개
  assert.strictEqual(classes.length, 12);
  assert.ok(!classes.some((e) => [8, 10, 15, 16].includes(e.week)));
});

test("수업 일정 빼기 옵션", () => {
  const ev = S.parseSyllabus(sample, { ...opt, includeClasses: false });
  assert.ok(ev.every((e) => e.type !== "class"));
});

test(".ics 형식", () => {
  const ev = S.parseSyllabus(sample, { ...opt, includeClasses: false });
  const ics = S.toICS(ev, { now: new Date(Date.UTC(2026, 10, 26)) });
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.ok(ics.trimEnd().endsWith("END:VCALENDAR"));
  assert.strictEqual((ics.match(/BEGIN:VEVENT/g) || []).length, ev.length);
  assert.ok(ics.includes("DTSTART;VALUE=DATE:20261021"));
  for (const line of ics.split("\r\n")) {
    assert.ok(Buffer.byteLength(line, "utf8") <= 75, "75바이트 초과: " + line);
  }
});

test("CSV 형식", () => {
  const csv = S.toCSV([{ date: "2026-10-21", title: "중간고사", type: "exam", course: "자바", week: 8 }]);
  assert.ok(csv.includes('"2026-10-21","수","자바","시험","8","중간고사"'));
});

console.log(`\n모든 테스트 통과 ✅ (${passed}개)`);
