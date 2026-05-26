# 담벼락

초등 학급에서 교사와 학생이 짧은 글, 댓글, 좋아요를 실시간으로 나누는 React + Firebase 담벼락 앱입니다.

## 기술 스택

- React + Vite
- Firebase Authentication
- Cloud Firestore
- React Router
- Tailwind CSS
- Netlify 배포 설정

## 로컬 실행

```bash
npm install
cp .env.example .env
npm run dev
```

`.env`에는 Firebase 콘솔에서 만든 웹 앱 설정값을 넣습니다.

## Firebase 설정

1. Firebase 프로젝트를 만듭니다.
2. Authentication에서 이메일/비밀번호 로그인을 활성화합니다.
3. Firestore Database를 생성합니다.
4. 웹 앱을 추가하고 `.env`에 설정값을 복사합니다.
5. `firestore.rules`를 Firebase 콘솔 또는 CLI로 배포합니다.

## 초기 관리자 계정

Firebase 콘솔에서 직접 만듭니다.

1. Authentication에서 `admin@damvyeorak.local` 계정을 생성합니다.
2. 생성된 uid를 확인합니다.
3. Firestore `users/{uid}` 문서를 추가합니다.

```json
{
  "id": "admin",
  "role": "admin",
  "displayName": "관리자",
  "createdAt": "server timestamp"
}
```

앱 로그인 화면에서는 이메일이 아니라 `admin`을 ID로 입력합니다.

## 사용 흐름

관리자는 `/admin`에서 교사 계정을 발급합니다.
교사는 `/teacher`에서 학생 계정을 일괄 발급하고 담벼락을 만듭니다.
학생은 `/student`에서 교사가 만든 담벼락에 들어가 글을 남깁니다.
공개 담벼락은 `/wall/:wallId` 링크만 있으면 로그인 없이 읽고 작성할 수 있습니다.

## Netlify 배포

Netlify에서 빌드 명령은 `npm run build`, 배포 폴더는 `dist`로 설정합니다.
SPA 라우팅은 `netlify.toml`의 redirect 설정으로 처리됩니다.
환경 변수는 Netlify 대시보드의 Site configuration > Environment variables에 등록합니다.

## 보안 규칙 배포

Firebase CLI를 사용할 경우:

```bash
firebase deploy --only firestore:rules
```
