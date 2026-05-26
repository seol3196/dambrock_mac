---

# 📋 Codex용 프롬프트 모음 — "담벼락" 프로젝트

## 🔧 프롬프트 1: 프로젝트 초기 설정

```
React + Vite + Firebase로 "담벼락"이라는 학급용 패들렛 클론 웹앱을 만들 거야.

[프로젝트 초기 설정]
1. Vite + React (JavaScript, JSX) 프로젝트 생성
2. 필수 패키지 설치:
   - firebase
   - react-router-dom
   - tailwindcss (PostCSS 방식)
3. 폴더 구조:
   src/
     pages/        (AdminPage, TeacherPage, StudentPage, LoginPage, WallPage)
     components/   (PostCard, CommentBox, WallSettings 등)
     lib/          (firebase.js - Firebase 초기화, auth.js - 로그인 헬퍼)
     contexts/     (AuthContext.jsx)
     App.jsx, main.jsx, index.css
4. Tailwind 설정 완료 (index.css에 @tailwind 지시문 포함)
5. react-router-dom으로 라우팅 설정:
   - / → 로그인 페이지
   - /admin → 어드민 페이지 (어드민만)
   - /teacher → 교사 페이지 (교사만)
   - /student → 학생 페이지 (학생만)
   - /wall/:wallId → 담벼락 보기 페이지
6. 역할(role)에 따라 자동 리다이렉트하는 ProtectedRoute 컴포넌트 만들기
7. .env 파일로 Firebase config 관리 (VITE_FIREBASE_API_KEY 등)
8. .gitignore에 .env 추가

netlify 배포를 염두에 두고 netlify.toml도 만들어줘 (SPA 라우팅을 위한 redirect 포함).
```

---

## 🔧 프롬프트 2: Firebase 연결 + 로그인 시스템

```
앞서 만든 담벼락 프로젝트에 Firebase 연결과 로그인 시스템을 구현해줘.

[Firebase 설정]
- src/lib/firebase.js: Firebase 앱 초기화, auth와 db(Firestore) export
- Authentication: 이메일/비밀번호 방식 사용

[중요: ID 변환 규칙]
사용자는 "kim123" 같은 짧은 ID를 입력하지만, 내부적으로는 
"kim123@damvyeorak.local" 이메일로 Firebase Auth에 저장.
입력 → 변환 → Firebase 전달, 표시할 땐 @damvyeorak.local 제거.

src/lib/auth.js에 헬퍼 함수 만들기:
- toEmail(id) → `${id}@damvyeorak.local`
- toId(email) → @damvyeorak.local 제거한 값
- login(id, password)
- logout()
- createUser(id, password, role, extraData)

[로그인 페이지 (LoginPage.jsx)]
- "담벼락" 큰 타이틀 (한글 폰트 예쁘게)
- ID 입력 (placeholder: "아이디")
- 비밀번호 입력
- 로그인 버튼
- 디자인: 따뜻하고 친근한 학교 느낌 (포스트잇/메모지 모티프, 살짝 기울어진 카드, 부드러운 그림자)
- 색감: 크림색 배경 + 노란 포스트잇 액센트
- 폰트: 한글은 "Gowun Dodum" 또는 "Hi Melody" 같은 손글씨 느낌

[AuthContext (contexts/AuthContext.jsx)]
- 로그인 상태 전역 관리
- 현재 user, role, displayId 제공
- 로그인 시 Firestore의 users/{uid} 문서에서 role 읽어와서 저장
- 로그인 후 role에 따라 /admin, /teacher, /student로 자동 이동

[Firestore users 컬렉션 구조]
users/{uid} = {
  id: "kim123",
  role: "admin" | "teacher" | "student",
  displayName: "김선생님",
  teacherId: "교사uid" (학생의 경우만),
  createdAt: timestamp
}

[초기 어드민 계정 생성 방법 안내]
README에 적어줘:
1. Firebase 콘솔 Authentication에서 직접 admin@damvyeorak.local 계정 수동 생성
2. Firestore에 users/{해당uid} 문서 직접 추가 (role: "admin")
```

---

## 🔧 프롬프트 3: 어드민 페이지 (교사 계정 발급)

```
담벼락 프로젝트의 어드민 페이지를 구현해줘.

[AdminPage.jsx - 어드민 전용]
기능:
1. 교사 계정 발급 폼
   - 교사 ID 입력 (예: "teacher_kim")
   - 비밀번호 입력 (자동 생성 버튼도 추가 - 랜덤 8자리)
   - 교사 이름 입력 (예: "김선생님")
   - "교사 계정 발급" 버튼 → Firebase Auth에 createUserWithEmailAndPassword + Firestore users/{uid} 문서 생성

2. 등록된 교사 목록
   - users 컬렉션에서 role==="teacher" 인 문서 실시간 조회 (onSnapshot)
   - 각 교사 카드에 ID, 이름, 가입일, 학생 수, 담벼락 수 표시
   - 삭제 버튼 (Firestore 문서만 삭제, Auth는 클라이언트에서 못 지움 → 비활성화 처리)
   - 비밀번호 초기화 버튼은 일단 안내 문구만 ("Firebase 콘솔에서 직접 변경")

3. ⚠️ 중요한 함정:
   createUserWithEmailAndPassword를 호출하면 자동으로 그 계정으로 로그인됨!
   따라서 교사 생성 후에는:
   a) Firebase Auth의 secondary app 인스턴스를 만들어서 거기서 계정 생성 (어드민 로그인 유지)
   b) initializeApp으로 별도 인스턴스 생성하고 작업 후 deleteApp
   이 방식으로 처리해줘. (이 부분이 핵심이니 꼭 구현해줘)

[디자인]
- 어드민 상단에 "관리자 모드" 배지 (빨간색 강조)
- 좌측: 교사 발급 폼 (카드)
- 우측: 교사 목록 (그리드)
- 로그아웃 버튼 우측 상단
- 전체 톤은 깔끔한 화이트 + 다크 그레이 액센트 (관리자 느낌)
```

---

## 🔧 프롬프트 4: 교사 페이지 (학생 발급 + 담벼락 관리)

```
담벼락 프로젝트의 교사 페이지를 구현해줘.

[TeacherPage.jsx - 교사 전용]
탭 또는 좌측 메뉴로 2개 섹션:

[섹션 1: 학생 관리]
1. 학생 일괄 생성 폼
   - ID 접두사 (예: "class3_") + 시작 번호 + 끝 번호 입력
   - 비밀번호 (모두 동일하게 또는 ID와 동일하게 옵션)
   - "한번에 생성" 버튼 → 30명 일괄 생성 (loop)
   - ⚠️ 어드민 페이지와 동일하게 secondary Firebase app 사용해서 교사 로그인 유지

2. 학생 목록
   - 본인이 만든 학생만 표시 (users where teacherId == 현재 교사 uid)
   - 각 학생: ID, 이름(있으면), 비밀번호 보기 토글, 삭제 버튼
   - 비밀번호는 Firestore에 추가로 저장해둠 (학급용이라 OK)
   - 학생 목록 인쇄 버튼 (window.print) - 비번 적어서 나눠줄 수 있게

[섹션 2: 담벼락 관리]
1. 담벼락 생성 폼
   - 제목, 설명
   - 접근 모드:
     ◯ 로그인 필요 (학생만 가능)
     ◯ 링크만 있으면 누구나 (비로그인 OK)
   - 댓글 허용 on/off
   - 좋아요 허용 on/off
   - "생성" 버튼

2. 담벼락 목록
   - 본인 담벼락만 (walls where ownerId == 현재 교사 uid)
   - 각 카드: 제목, 게시글 수, 공유 링크 복사 버튼, 설정 변경 버튼, 들어가기 버튼
   - 설정 변경: 댓글 on/off, 좋아요 on/off, 접근 모드 토글이 즉시 반영 (Firestore update)

[Firestore walls 컬렉션 구조]
walls/{wallId} = {
  ownerId: "교사uid",
  title: "3학년 1반 봄소풍 소감",
  description: "...",
  accessMode: "login" | "public",
  commentsEnabled: true,
  likesEnabled: true,
  createdAt: timestamp
}

[디자인]
- 사이드바 (좌측, 200px) + 메인 영역
- 사이드바: "학생 관리" / "담벼락 관리" 메뉴
- 메인: 선택된 섹션 내용
- 담벼락 카드는 다양한 파스텔 색 (랜덤 또는 wallId hash로 결정)
- 따뜻하고 정돈된 느낌
```

---

## 🔧 프롬프트 5: 학생 페이지 + 담벼락 보기 (핵심!)

```
담벼락 프로젝트의 학생 페이지와 담벼락 보기 화면을 구현해줘. 이게 핵심 기능이야.

[StudentPage.jsx - 학생 로그인 후 첫 화면]
- 본인의 교사가 만든 담벼락 목록 표시
- walls where ownerId == (이 학생의 teacherId)
- 각 담벼락 카드 클릭 → /wall/:wallId 이동
- 상단에 "안녕, [학생ID]!" 인사말
- 로그아웃 버튼

[WallPage.jsx - 담벼락 보기 (메인 기능!)]
URL: /wall/:wallId

접근 제어:
- 담벼락 데이터 먼저 로드
- accessMode === "public" → 누구나 접근 OK (비로그인도 글쓰기 가능, 작성자명은 "익명")
- accessMode === "login" → 로그인 안 했으면 /login으로 리다이렉트

레이아웃:
- 상단 헤더: 담벼락 제목, 작성자(교사), 게시글 수
- 메인: 포스트잇 그리드 (CSS Grid, masonry 느낌 - column-count: 3 또는 react-masonry-css)
- 우측 하단 고정: 큰 "+" 플로팅 버튼 → 클릭 시 글쓰기 모달

글쓰기 모달:
- textarea (자동 높이 조절)
- 색상 선택 (노랑/분홍/하늘/연두/주황 5가지 포스트잇 색)
- "올리기" 버튼 → Firestore posts 컬렉션에 추가

포스트잇 카드 (PostCard.jsx):
- 선택한 색의 배경
- 살짝 기울어진 회전 (rotate(-2deg) ~ rotate(2deg) 랜덤, postId hash 기반)
- 그림자 효과
- 본문 텍스트 (손글씨 느낌 폰트)
- 하단: 작성자 ID, 작성 시각
- 우측 상단: 본인 글이거나 교사면 삭제(x) 버튼
- 하단 액션 영역 (담벼락 설정에 따라 표시):
  - 댓글 버튼 (commentsEnabled === true 일 때만)
  - 좋아요 버튼 (likesEnabled === true 일 때만)

댓글 (CommentBox.jsx):
- 댓글 버튼 클릭 시 카드 아래 펼쳐짐
- 기존 댓글 목록 + 입력창
- Firestore: comments where postId == this.postId, orderBy createdAt

좋아요:
- 버튼 클릭 시 likes 컬렉션에 {postId, userId} 추가/삭제
- 실시간 카운트 표시 (현재 좋아요 수 + 본인이 눌렀는지 여부)
- 비로그인은 좋아요 못 누름 (버튼 클릭 시 "로그인이 필요해요" 토스트)

실시간 업데이트:
- posts 컬렉션을 onSnapshot으로 실시간 구독
- 다른 학생이 글 올리면 즉시 화면에 나타남
- 댓글/좋아요도 onSnapshot

[Firestore 구조]
posts/{postId} = {
  wallId, authorId (또는 "anonymous"), authorName, 
  content, color, createdAt
}
comments/{commentId} = {
  postId, authorId, authorName, text, createdAt
}
likes/{likeId} = {
  postId, userId, createdAt
}
// likeId = `${postId}_${userId}` 로 만들면 중복 방지 쉬움

[디자인 - 가장 중요!]
- 배경: 코르크보드 질감 (CSS로 흙갈색 + subtle noise)
  또는 격자 노트 배경
- 포스트잇: 진짜 종이 느낌 (살짝 그라데이션, 가장자리 그림자)
- 글씨체: 한글 손글씨 폰트 (Gowun Dodum, Nanum Pen Script 등)
- 플로팅 + 버튼: 큰 원형, 약간 통통 튀는 호버 애니메이션
- 새 글이 추가될 때 fade-in + slight bounce 애니메이션
- 전체적으로 따뜻하고 즐거운 분위기
```

---

## 🔧 프롬프트 6: Firestore 보안 규칙 + 배포

```
담벼락 프로젝트의 Firestore 보안 규칙과 Netlify 배포 설정을 완성해줘.

[firestore.rules]
역할 확인은 users/{uid} 문서의 role 필드를 읽어서 처리.
보안 수준: 학급용 (초등학생 대상, 외부 공격 위험 낮음) - 기본적인 검증만.

규칙:
- users: 본인 문서는 읽기 가능, 어드민은 모두 읽기/쓰기, 교사는 본인이 만든 학생만 읽기/쓰기
- walls: 
  - read: accessMode가 public이면 누구나, login이면 인증된 사용자만
  - write (생성/수정/삭제): role이 teacher이고 ownerId가 본인일 때
- posts:
  - read: 해당 wallId의 wall 접근 권한과 동일
  - create: wall의 accessMode가 public이면 누구나, login이면 인증된 사용자만
  - delete: 작성자 본인 또는 wall 소유자(교사)
- comments: wall의 commentsEnabled가 true일 때만 create 가능
- likes: wall의 likesEnabled가 true이고 인증된 사용자만

(get()으로 다른 문서 참조하는 헬퍼 함수 만들어서 깔끔하게 작성)

[netlify.toml]
- build command: npm run build
- publish: dist
- SPA fallback: /* → /index.html (200)
- 환경변수는 Netlify 대시보드에서 설정한다고 README에 안내

[README.md 작성]
다음 내용 포함:
1. 프로젝트 소개
2. 기술 스택
3. 로컬 실행 방법
4. Firebase 프로젝트 셋업 단계 (스크린샷 위치만 표시)
   - 프로젝트 생성
   - Authentication > 이메일/비밀번호 활성화
   - Firestore 활성화 (테스트 모드로 시작 → 규칙 배포)
   - .env 파일에 config 붙여넣기
5. 초기 어드민 계정 만드는 법
6. Netlify 배포 방법
7. Firestore 보안 규칙 배포 방법 (Firebase CLI)
8. 사용 흐름 (어드민 → 교사 → 학생)
```

---

## 💡 사용 팁

이 프롬프트들을 **순서대로** Codex에 하나씩 주세요. 한 번에 다 주면 Codex가 헷갈려서 빼먹는 게 생겨요.

각 단계 끝나면:
- `npm run dev`로 돌려보고
- 문제 있는 부분만 추가 프롬프트로 수정 요청

특히 **프롬프트 3, 4의 secondary Firebase app** 부분과 **프롬프트 5의 실시간 onSnapshot** 부분은 Codex가 종종 실수하니까 결과 나오면 잘 확인하세요.

