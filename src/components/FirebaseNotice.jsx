export default function FirebaseNotice() {
  return (
    <main className="felt-bg flex min-h-screen items-center justify-center px-4">
      <section className="max-w-xl rounded-[8px] border border-amber-200 bg-white/88 p-6 shadow-soft">
        <h1 className="text-2xl font-bold text-stone-900">Firebase 설정이 필요합니다</h1>
        <p className="mt-3 leading-7 text-stone-700">
          `.env` 파일에 Firebase 웹 앱 설정값을 넣은 뒤 개발 서버를 다시 시작하세요. 예시는
          `.env.example`에 있습니다.
        </p>
      </section>
    </main>
  );
}
