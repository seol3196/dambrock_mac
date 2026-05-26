import {
  ArrowLeft,
  Copy,
  Palette,
  Plus,
  QrCode,
  Send,
  Settings2,
  Share2,
  X
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import PostCard from '../components/PostCard.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import {
  colorOptions,
  createPost,
  updatePost,
  updateWall,
  wallBackgroundOptions
} from '../lib/firestore';
import { db } from '../lib/firebase';

function homePath(role) {
  if (role === 'teacher') return '/teacher';
  if (role === 'student') return '/student';
  return '/';
}

const columnNumbers = [1, 2, 3, 4];

export default function WallPage() {
  const { wallId } = useParams();
  const location = useLocation();
  const { user, role, profile, displayId, loading } = useAuth();
  const [wall, setWall] = useState(null);
  const [wallMissing, setWallMissing] = useState(false);
  const [posts, setPosts] = useState([]);
  const [likes, setLikes] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draggingPost, setDraggingPost] = useState(null);
  const [form, setForm] = useState({
    content: '',
    color: colorOptions[0].value
  });
  const [settingsForm, setSettingsForm] = useState(null);
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const shareUrl = `${origin}/wall/${wallId}`;
  const canManageWall = Boolean(user && role === 'teacher' && wall?.ownerId === user.uid);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'walls', wallId), (snapshot) => {
      setWallMissing(!snapshot.exists());
      const nextWall = snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
      setWall(nextWall);
      if (nextWall) {
        setSettingsForm({
          title: nextWall.title || '',
          description: nextWall.description || '',
          accessMode: nextWall.accessMode || 'login',
          commentsEnabled: nextWall.commentsEnabled ?? true,
          likesEnabled: nextWall.likesEnabled ?? true,
          backgroundTone: nextWall.backgroundTone || wallBackgroundOptions[0].value
        });
      }
    });
    return unsubscribe;
  }, [wallId]);

  useEffect(() => {
    const postsQuery = query(collection(db, 'posts'), where('wallId', '==', wallId));
    const unsubPosts = onSnapshot(postsQuery, (snapshot) => {
      setPosts(
        snapshot.docs
          .map((item) => ({ id: item.id, ...item.data() }))
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      );
    });
    return () => {
      unsubPosts();
    };
  }, [wallId]);

  useEffect(() => {
    if (!posts.length) {
      setLikes([]);
      return undefined;
    }

    const unsubscribes = posts.map((post) => {
      const likesQuery = query(collection(db, 'likes'), where('postId', '==', post.id));
      return onSnapshot(likesQuery, (snapshot) => {
        setLikes((current) => {
          const others = current.filter((like) => like.postId !== post.id);
          return [...others, ...snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))];
        });
      });
    });

    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [posts]);

  const likesByPost = useMemo(() => {
    const grouped = {};
    for (const like of likes) {
      grouped[like.postId] ||= [];
      grouped[like.postId].push(like);
    }
    return grouped;
  }, [likes]);

  const postsByColumn = useMemo(() => {
    const grouped = { 1: [], 2: [], 3: [], 4: [] };
    const fallbackColumns = [1, 2, 3, 4];
    let fallbackIndex = 0;

    for (const post of posts) {
      const column =
        post.column && grouped[post.column]
          ? post.column
          : fallbackColumns[fallbackIndex++ % fallbackColumns.length];
      grouped[column].push(post);
    }

    return grouped;
  }, [posts]);

  if (!loading && wall?.accessMode === 'login' && !user) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  async function submitPost(event) {
    event.preventDefault();
    if (!form.content.trim()) return;

    await createPost({
      wallId,
      authorId: user?.uid || 'anonymous',
      authorName: profile?.displayName || displayId || '익명',
      content: form.content.trim(),
      color: form.color
    });

    setForm({ content: '', color: colorOptions[0].value });
    setModalOpen(false);
  }

  async function copyShareUrl() {
    await navigator.clipboard.writeText(shareUrl);
  }

  async function saveSettings() {
    if (!settingsForm) return;
    await updateWall(wallId, settingsForm);
    setSettingsOpen(false);
  }

  async function movePostToColumn(column) {
    if (!draggingPost) return;
    await updatePost(draggingPost.id, { column });
    setDraggingPost(null);
  }

  if (wallMissing) {
    return (
      <main className="felt-bg grid min-h-screen place-items-center px-4">
        <section className="rounded-[8px] bg-white/90 p-6 shadow-soft">
          담벼락을 찾을 수 없습니다.
        </section>
      </main>
    );
  }

  return (
    <main className="cork-bg min-h-screen">
      <header className="sticky top-0 z-10 border-b border-stone-900/10 bg-white/88 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <Link
              to={homePath(role)}
              className="mb-2 inline-flex items-center gap-1 text-sm font-bold text-stone-600"
            >
              <ArrowLeft size={16} />
              돌아가기
            </Link>
            <h1 className="truncate text-2xl font-bold text-stone-950 sm:text-4xl">
              {wall?.title || '담벼락'}
            </h1>
            <p className="mt-1 text-sm text-stone-600">
              {wall?.ownerName} 선생님 · 게시글 {posts.length}개
            </p>
          </div>

          {canManageWall && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSettingsOpen((value) => !value)}
                className="inline-flex items-center gap-2 rounded-[10px] border border-stone-300 bg-white px-4 py-2 text-sm font-bold text-stone-800 shadow-sm"
              >
                <Settings2 size={16} />
                설정
              </button>
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                className="inline-flex items-center gap-2 rounded-[10px] border border-stone-300 bg-white px-4 py-2 text-sm font-bold text-stone-800 shadow-sm"
              >
                <Share2 size={16} />
                공유
              </button>
            </div>
          )}
        </div>
      </header>

      <section className="mx-auto w-full max-w-[1600px] px-5 py-6">
        <div className={`grid gap-6 ${canManageWall && settingsOpen ? 'xl:grid-cols-[minmax(0,1fr)_360px]' : ''}`}>
          <div
            data-testid="wall-board"
            className={`rounded-[22px] border border-white/60 p-5 shadow-soft ${
              wall?.backgroundTone || wallBackgroundOptions[0].value
            }`}
          >
            {wall?.description && (
              <p className="mb-5 rounded-[14px] bg-white/75 p-4 text-stone-700 shadow-sm">
                {wall.description}
              </p>
            )}

            {canManageWall ? (
              <div className="grid gap-5 xl:grid-cols-4">
                {columnNumbers.map((column) => (
                  <div
                    key={column}
                    data-testid={`wall-column-${column}`}
                    onDragOver={(event) => {
                      if (canManageWall) event.preventDefault();
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (canManageWall) movePostToColumn(column);
                    }}
                    className={`min-h-[220px] rounded-[18px] border border-dashed p-3 ${
                      draggingPost && canManageWall
                        ? 'border-stone-400 bg-white/35'
                        : 'border-transparent'
                    }`}
                  >
                    <div className="mb-3 flex items-center justify-between px-1">
                      <span className="text-xs font-bold uppercase tracking-[0.2em] text-stone-500">
                        Column {column}
                      </span>
                      <span className="text-xs text-stone-500">여기로 드래그</span>
                    </div>
                    <div className="space-y-4">
                      {postsByColumn[column].map((post) => (
                        <PostCard
                          key={post.id}
                          post={post}
                          wall={wall || {}}
                          likes={likesByPost[post.id] || []}
                          isTeacherView={canManageWall}
                          onDragStart={setDraggingPost}
                          onDragEnd={() => setDraggingPost(null)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
                {posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    wall={wall || {}}
                    likes={likesByPost[post.id] || []}
                  />
                ))}
              </div>
            )}

            {!posts.length && (
              <div className="mt-5 rounded-[16px] border border-dashed border-white/70 bg-white/70 p-10 text-center text-stone-700">
                아직 포스트잇이 없습니다. 첫 글을 남겨보세요.
              </div>
            )}
          </div>

          {canManageWall && settingsOpen && settingsForm && (
            <aside className="rounded-[18px] bg-white/90 p-5 shadow-soft">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-700">
                    Wall Settings
                  </p>
                  <h2 className="mt-2 text-2xl font-bold text-stone-950">담벼락 설정</h2>
                </div>
                <Palette className="text-stone-500" size={20} />
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-bold text-stone-700">제목</label>
                  <input
                    value={settingsForm.title}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, title: e.target.value })
                    }
                    className="h-11 w-full rounded-[8px] border border-stone-200 px-3"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-stone-700">설명</label>
                  <textarea
                    value={settingsForm.description}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, description: e.target.value })
                    }
                    className="min-h-24 w-full rounded-[8px] border border-stone-200 p-3"
                  />
                </div>
                <label className="flex items-center justify-between rounded-[10px] border border-stone-200 px-4 py-3">
                  <span className="text-sm font-bold text-stone-800">로그인 필요</span>
                  <input
                    type="checkbox"
                    checked={settingsForm.accessMode === 'login'}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        accessMode: e.target.checked ? 'login' : 'public'
                      })
                    }
                  />
                </label>
                <label className="flex items-center justify-between rounded-[10px] border border-stone-200 px-4 py-3">
                  <span className="text-sm font-bold text-stone-800">댓글 허용</span>
                  <input
                    type="checkbox"
                    checked={settingsForm.commentsEnabled}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        commentsEnabled: e.target.checked
                      })
                    }
                  />
                </label>
                <label className="flex items-center justify-between rounded-[10px] border border-stone-200 px-4 py-3">
                  <span className="text-sm font-bold text-stone-800">좋아요 허용</span>
                  <input
                    type="checkbox"
                    checked={settingsForm.likesEnabled}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        likesEnabled: e.target.checked
                      })
                    }
                  />
                </label>

                <div>
                  <p className="mb-2 text-sm font-bold text-stone-700">배경 색상</p>
                  <div className="grid grid-cols-3 gap-2">
                    {wallBackgroundOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setSettingsForm({
                            ...settingsForm,
                            backgroundTone: option.value
                          })
                        }
                        className={`rounded-[12px] border p-3 text-sm font-bold text-stone-700 ${option.value} ${
                          settingsForm.backgroundTone === option.value
                            ? 'border-stone-900'
                            : 'border-transparent'
                        }`}
                      >
                        {option.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={saveSettings}
                  className="flex-1 rounded-[10px] bg-stone-900 px-4 py-3 text-sm font-bold text-white"
                >
                  설정 저장
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  className="rounded-[10px] border border-stone-300 px-4 py-3 text-sm font-bold text-stone-700"
                >
                  닫기
                </button>
              </div>
            </aside>
          )}
        </div>
      </section>

      <button
        type="button"
        aria-label="글쓰기"
        onClick={() => setModalOpen(true)}
        className="fixed bottom-6 right-6 grid h-16 w-16 place-items-center rounded-full bg-rose-500 text-white shadow-paper transition hover:scale-105"
      >
        <Plus size={30} />
      </button>

      {modalOpen && (
        <div className="fixed inset-0 z-20 grid place-items-center bg-stone-950/45 px-4">
          <form
            onSubmit={submitPost}
            className="w-full max-w-xl rounded-[18px] bg-white p-5 shadow-paper"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">포스트잇 작성</h2>
              <button
                type="button"
                aria-label="닫기"
                onClick={() => setModalOpen(false)}
                className="rounded-full p-2 hover:bg-stone-100"
              >
                <X size={18} />
              </button>
            </div>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              className="mt-4 min-h-40 w-full resize-y rounded-[10px] border border-stone-200 p-3 text-base leading-7 outline-none focus:border-amber-500"
              placeholder="생각이나 링크를 자유롭게 남겨보세요."
            />
            <div className="mt-4 flex flex-wrap gap-2">
              {colorOptions.map((color) => (
                <button
                  type="button"
                  key={color.value}
                  onClick={() => setForm({ ...form, color: color.value })}
                  className={`h-9 w-9 rounded-full border-2 ${
                    form.color === color.value ? 'border-stone-900' : 'border-white'
                  }`}
                  style={{ background: color.swatch }}
                  aria-label={color.name}
                />
              ))}
            </div>
            <button
              type="submit"
              className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-stone-900 font-bold text-white"
            >
              <Send size={18} />
              올리기
            </button>
          </form>
        </div>
      )}

      {shareOpen && canManageWall && (
        <div className="fixed inset-0 z-20 grid place-items-center bg-stone-950/45 px-4">
          <section className="w-full max-w-md rounded-[18px] bg-white p-5 shadow-paper">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">담벼락 공유</h2>
              <button
                type="button"
                onClick={() => setShareOpen(false)}
                className="rounded-full p-2 hover:bg-stone-100"
                aria-label="공유 닫기"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 grid place-items-center rounded-[16px] bg-stone-50 p-4">
              <QRCodeSVG value={shareUrl} size={180} />
            </div>

            <div className="mt-4 rounded-[12px] border border-stone-200 bg-stone-50 p-3 text-sm text-stone-700">
              <p className="font-bold text-stone-900">공유 링크</p>
              <p className="mt-2 break-all">{shareUrl}</p>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={copyShareUrl}
                className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-stone-900 px-4 py-3 text-sm font-bold text-white"
              >
                <Copy size={16} />
                링크 복사
              </button>
              <button
                type="button"
                onClick={() => setShareOpen(false)}
                className="inline-flex items-center justify-center gap-2 rounded-[10px] border border-stone-300 px-4 py-3 text-sm font-bold text-stone-700"
              >
                <QrCode size={16} />
                닫기
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
