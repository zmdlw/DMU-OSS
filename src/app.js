/**
 * 화면(DOM) 처리 — 계산·파싱은 schedule.js 담당
 */

const STORAGE_KEY = "dmu-syllabus-calendar";

const SAMPLE = {
  name: "자바프로그래밍",
  start: "2026-09-01",
  day: "3",
  text: `1주차	오리엔테이션, 자바 개발 환경 설치(JDK, Eclipse)
2주차	변수와 타입
3주차	연산자 / 실습과제 1 제출(9/18까지)
4주차	조건문과 반복문
5주차	참조 타입과 배열
6주차	클래스와 객체 / 실습과제 2 제출
7주차	상속, 중간 프로젝트 주제 발표
8주차	중간고사
9주차	인터페이스
10주차	개교기념일 휴강 (보강 영상으로 대체)
11주차	예외처리
12주차	라이브러리 모듈 / 기말 프로젝트 보고서 15주차까지 제출
13주차	제네릭, 퀴즈
14주차	람다식과 스트림
15주차	기말 프로젝트 발표
16주차	기말고사`,
};

const TYPE_STYLE = {
  exam: "t-exam",
  task: "t-task",
  present: "t-present",
  off: "t-off",
  class: "t-class",
};

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- 상태
let state = load();
let viewMonth = firstMonth();
let hidden = new Set(); // 숨긴 일정 종류

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (s && Array.isArray(s.courses)) return s;
  } catch (e) {
    /* 저장소를 못 쓰면 무시 */
  }
  return { courses: [] };
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    /* 무시 */
  }
}

function allEvents() {
  return state.courses
    .flatMap((c) => c.events.map((e, i) => ({ ...e, courseId: c.id, index: i })))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.course.localeCompare(b.course)));
}

function visibleEvents() {
  return allEvents().filter((e) => !hidden.has(e.type));
}

function firstMonth() {
  const ev = allEvents();
  const d = ev.length ? parseDate(ev[0].date) : new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// ---------------------------------------------------------------- 과목 추가
function showMessage(text, isError) {
  const m = $("message");
  m.textContent = text;
  m.classList.toggle("error", !!isError);
}

$("load-sample").addEventListener("click", () => {
  $("course-name").value = SAMPLE.name;
  $("semester-start").value = SAMPLE.start;
  $("class-day").value = SAMPLE.day;
  $("syllabus").value = SAMPLE.text;
  showMessage("예시를 불러왔어요. '일정 만들기'를 눌러 보세요.");
});

$("add-course").addEventListener("click", () => {
  const name = $("course-name").value.trim();
  const start = $("semester-start").value;
  const day = Number($("class-day").value);
  const text = $("syllabus").value;

  if (!name) return showMessage("과목명을 입력해 주세요.", true);
  if (!start) return showMessage("개강일을 선택해 주세요.", true);
  if (!text.trim()) return showMessage("강의계획서 내용을 붙여 넣어 주세요.", true);

  const events = parseSyllabus(text, {
    course: name,
    semesterStart: start,
    classDay: day,
    includeClasses: $("include-classes").checked,
  });

  if (!events.length) {
    return showMessage("주차를 찾지 못했어요. 각 줄이 '1주차', '2주' 처럼 주차로 시작하는지 확인해 주세요.", true);
  }

  // 같은 이름 과목이 있으면 교체
  state.courses = state.courses.filter((c) => c.name !== name);
  state.courses.push({ id: Date.now().toString(36), name, start, day, events });
  save();

  const key = events.filter((e) => e.type !== "class").length;
  showMessage(`'${name}' 일정 ${events.length}개를 만들었어요 (시험·과제·발표·휴강 ${key}개).`);
  $("syllabus").value = "";
  $("course-name").value = "";
  viewMonth = firstMonth();
  renderAll();
});

// ---------------------------------------------------------------- 과목 목록
function renderCourses() {
  const box = $("course-list");
  box.innerHTML = "";
  for (const c of state.courses) {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = `${c.name} · ${DAY_NAMES[c.day]}요일 · ${c.events.length}개`;
    const x = document.createElement("button");
    x.className = "chip-x";
    x.setAttribute("aria-label", `${c.name} 삭제`);
    x.textContent = "×";
    x.addEventListener("click", () => {
      state.courses = state.courses.filter((k) => k.id !== c.id);
      save();
      renderAll();
    });
    chip.appendChild(x);
    box.appendChild(chip);
  }
}

// ---------------------------------------------------------------- 종류 필터
function renderFilters() {
  const box = $("filters");
  box.innerHTML = "";
  for (const type of ["exam", "task", "present", "off", "class"]) {
    const label = document.createElement("label");
    label.className = `filter ${TYPE_STYLE[type]}`;
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !hidden.has(type);
    cb.addEventListener("change", () => {
      cb.checked ? hidden.delete(type) : hidden.add(type);
      renderCalendar();
      renderTable();
    });
    label.append(cb, " ", typeLabel(type));
    box.appendChild(label);
  }
}

// ---------------------------------------------------------------- 달력
function renderCalendar() {
  const y = viewMonth.getFullYear();
  const m = viewMonth.getMonth();
  $("month-label").textContent = `${y}년 ${m + 1}월`;

  const byDate = {};
  for (const e of visibleEvents()) (byDate[e.date] ||= []).push(e);

  const cal = $("calendar");
  cal.innerHTML = "";
  for (const d of DAY_NAMES) {
    const h = document.createElement("div");
    h.className = "dow" + (d === "일" ? " sun" : d === "토" ? " sat" : "");
    h.textContent = d;
    cal.appendChild(h);
  }

  const first = new Date(y, m, 1);
  const start = addDays(first, -first.getDay());
  const today = fmtDate(new Date());
  for (let i = 0; i < 42; i++) {
    const day = addDays(start, i);
    if (i >= 35 && day.getMonth() !== m) break; // 6번째 줄이 필요 없으면 생략
    const key = fmtDate(day);
    const cell = document.createElement("div");
    cell.className = "cell" + (day.getMonth() !== m ? " other" : "") + (key === today ? " today" : "");
    const num = document.createElement("div");
    num.className = "num";
    num.textContent = day.getDate();
    cell.appendChild(num);
    for (const e of byDate[key] || []) {
      const ev = document.createElement("div");
      ev.className = `ev ${TYPE_STYLE[e.type]}`;
      ev.textContent = `${e.type === "class" ? "" : typeLabel(e.type) + " "}${e.course}`;
      ev.title = `[${e.course}] ${typeLabel(e.type)}: ${e.title}`;
      cell.appendChild(ev);
    }
    cal.appendChild(cell);
  }
}

$("prev-month").addEventListener("click", () => {
  viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1);
  renderCalendar();
});
$("next-month").addEventListener("click", () => {
  viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1);
  renderCalendar();
});

// ---------------------------------------------------------------- 목록
function renderTable() {
  const body = $("event-body");
  body.innerHTML = "";
  const events = visibleEvents();
  $("empty").style.display = allEvents().length ? "none" : "block";

  for (const e of events) {
    const tr = document.createElement("tr");
    const day = DAY_NAMES[parseDate(e.date).getDay()];

    const dateTd = document.createElement("td");
    const dateInput = document.createElement("input");
    dateInput.type = "date";
    dateInput.value = e.date;
    dateInput.setAttribute("aria-label", "날짜 수정");
    dateInput.addEventListener("change", () => {
      if (!dateInput.value) return;
      updateEvent(e, { date: dateInput.value });
    });
    const dayTag = document.createElement("span");
    dayTag.className = "day";
    dayTag.textContent = `(${day})`;
    dateTd.append(dateInput, dayTag);

    const courseTd = document.createElement("td");
    courseTd.textContent = e.course;

    const typeTd = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = `badge ${TYPE_STYLE[e.type]}`;
    badge.textContent = typeLabel(e.type);
    typeTd.appendChild(badge);

    const titleTd = document.createElement("td");
    titleTd.textContent = e.title;

    const delTd = document.createElement("td");
    const del = document.createElement("button");
    del.className = "delete";
    del.textContent = "삭제";
    del.addEventListener("click", () => removeEvent(e));
    delTd.appendChild(del);

    tr.append(dateTd, courseTd, typeTd, titleTd, delTd);
    body.appendChild(tr);
  }
}

function findCourse(e) {
  return state.courses.find((c) => c.id === e.courseId);
}

function updateEvent(e, patch) {
  const c = findCourse(e);
  c.events[e.index] = { ...c.events[e.index], ...patch };
  save();
  renderAll();
}

function removeEvent(e) {
  const c = findCourse(e);
  c.events.splice(e.index, 1);
  save();
  renderAll();
}

// ---------------------------------------------------------------- 내보내기
function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

$("export-ics").addEventListener("click", () => {
  const ev = visibleEvents();
  if (!ev.length) return alert("내보낼 일정이 없어요.");
  download("학기일정.ics", toICS(ev, { calName: "DMU 학기 일정" }), "text/calendar;charset=utf-8");
});

$("export-csv").addEventListener("click", () => {
  const ev = visibleEvents();
  if (!ev.length) return alert("내보낼 일정이 없어요.");
  download("학기일정.csv", toCSV(ev), "text/csv;charset=utf-8");
});

$("reset").addEventListener("click", () => {
  if (!confirm("모든 과목과 일정을 지울까요?")) return;
  state = { courses: [] };
  save();
  showMessage("");
  viewMonth = firstMonth();
  renderAll();
});

// ---------------------------------------------------------------- 시작
function renderAll() {
  renderCourses();
  renderFilters();
  renderCalendar();
  renderTable();
}

renderAll();
