# 기여 방법 (팀원용)

모든 팀원은 **자기 GitHub 계정으로** 작업하고 커밋합니다. 커밋 기록이 곧 각자의 기여 기록이에요.

## 1. 처음 한 번만
```bash
git clone https://github.com/zmdlw/DMU-OSS.git
cd DMU-OSS

# 커밋에 찍힐 이름/이메일 설정 (GitHub 계정 이메일과 같아야 잔디가 심어져요)
git config user.name "본인 이름"
git config user.email "GitHub에 등록한 이메일"
```
> 팀장이 저장소 Settings → Collaborators 에서 팀원을 초대해야 push 할 수 있습니다.

## 2. 작업할 때마다
```bash
git checkout main
git pull                              # 최신 코드 받기

git checkout -b feature/alarm         # 내 작업용 브랜치 만들기

# ... 코드 수정 ...

git add .
git commit -m "feat: 시험 3일 전 알림(VALARM) 추가"
git push origin feature/alarm
```
그다음 GitHub 저장소 페이지에서 **Compare & pull request** 버튼 → 설명 작성 → PR 생성.
다른 팀원 1명이 확인(리뷰)하고 **Merge** 합니다.

## 3. 커밋 메시지 규칙

| 머리말 | 언제 | 예시 |
|---|---|---|
| `feat:` | 기능 추가 | `feat: 공휴일 자동 휴강 처리` |
| `fix:` | 버그 수정 | `fix: "9/18" 날짜가 둘로 잘리는 문제 수정` |
| `style:` | 디자인/CSS | `style: 캘린더 칸 높이 조정` |
| `docs:` | 문서 수정 | `docs: README 에 배포 주소 추가` |
| `test:` | 테스트 | `test: 공휴일 처리 테스트 추가` |

작은 단위로 자주 커밋하는 게 좋아요. (기능 하나 = 커밋 여러 개 OK)

## 4. 수정 후 확인
- `index.html`을 브라우저로 열어서 동작 확인
- `src/schedule.js`를 고쳤다면 `node test/schedule.test.js`가 통과하는지 확인
