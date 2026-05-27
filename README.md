# 담벼락

맥미니에서 실행하는 React + SQLite 학급 담벼락 앱입니다.

## 기술 스택

- React + Vite
- Node.js + Express
- SQLite (`better-sqlite3`)
- React Router
- Tailwind CSS

## 포트

기본 실행 포트는 `47831`입니다.

서버 시작 시 해당 포트가 이미 사용 중이면 `47832`, `47833`처럼 다음 포트를 자동으로 시도합니다. 현재 맥미니에서 흔히 쓰이는 `3000`, `3001`, `5173` 같은 포트와 겹치지 않도록 기본값을 높게 잡았습니다.

원하는 포트가 있으면 아래처럼 지정할 수 있습니다.

```bash
PORT=47840 npm start
```

## 설치 및 실행

```bash
npm install
npm run build
npm start
```

브라우저에서 서버 로그에 표시되는 주소로 접속합니다. 기본값은 다음과 같습니다.

```text
http://localhost:47831
```

SQLite 파일은 기본적으로 `data/dambrock.sqlite`에 만들어집니다. 다른 위치를 쓰려면 `SQLITE_PATH`를 지정합니다.

```bash
SQLITE_PATH=/Users/seoljaeho/data/dambrock.sqlite npm start
```

## 초기 관리자 계정

DB가 비어 있으면 서버가 자동으로 관리자 계정을 만듭니다.

```text
ID: admin
PW: admin123
```

운영 전에 비밀번호를 바꾸는 것을 권장합니다.

```bash
npm run create-admin -- admin 새비밀번호 관리자
```

## 개발 실행

API 서버와 Vite 개발 서버를 각각 실행합니다.

```bash
npm run dev:server
npm run dev
```

개발 서버 주소는 `http://localhost:47832`이고, `/api` 요청은 `47831`의 로컬 API 서버로 프록시됩니다.

## 사용 흐름

관리자는 `/admin`에서 교사 계정을 발급합니다.
교사는 `/teacher`에서 학생 계정을 일괄 발급하고 담벼락을 만듭니다.
학생은 `/student`에서 교사가 만든 담벼락에 들어가 글을 남깁니다.
공개 담벼락은 `/wall/:wallId` 링크만 있으면 로그인 없이 읽고 작성할 수 있습니다.
