import {
  ArrowLeft,
  Copy,
  Plus,
  QrCode,
  Send,
  Settings2,
  Share2,
  Trash2,
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
  deleteWallColumn,
  updatePostLayouts,
  updateWall,
  wallBackgroundOptions
} from '../lib/firestore';
import { db } from '../lib/firebase';

function homePath(role) {
  if (role === 'teacher') return '/teacher';
  if (role === 'student') return '/student';
  return '/';
}

function clampColumnCount(value) {
  const count = Number(value);
  if (!Number.isInteger(count)) return 4;
  return Math.min(5, Math.max(1, count));
}

function backgroundSwatch(value) {
  return (
    wallBackgroundOptions.find((option) => option.value === value)?.swatch ||
    wallBackgroundOptions[0].swatch
  );
}

function postSortValue(post, fallbackOrder) {
  return Number.isFinite(post.order) ? post.order : fallbackOrder;
}

function columnName(wall, column) {
  return wall?.columnNames?.[column] || '';
}

function nextPostPlacement(postsByColumn, columnNumbers) {
  const placement = columnNumbers
    .map((column) => {
      const columnPosts = postsByColumn[column] || [];
      const lastOrder = columnPosts.reduce(
        (maxOrder, post, index) => Math.max(maxOrder, postSortValue(post, index)),
        -1
      );

      return {
        column,
        count: columnPosts.length,
        order: lastOrder + 1
      };
    })
    .sort((a, b) => a.count - b.count || a.column - b.column)[0];

  return {
    column: placement.column,
    order: placement.order
  };
}

function nextColumnPostPlacement(postsByColumn, column) {
  const columnPosts = postsByColumn[column] || [];
  const lastOrder = columnPosts.reduce(
    (maxOrder, post, index) => Math.max(maxOrder, postSortValue(post, index)),
    -1
  );

  return {
    column,
    order: lastOrder + 1
  };
}

export default function WallPage() {
  const { wallId } = useParams();
  const location = useLocation();
  const { user, role, profile, displayId, loading } = useAuth();
  const [wall, setWall] = useState(null);
  const [wallMissing, setWallMissing] = useState(false);
  const [posts, setPosts] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draggingPost, setDraggingPost] = useState(null);
  const [columnNameDrafts, setColumnNameDrafts] = useState({});
  const [wallError, setWallError] = useState('');
  const [viewportWidth, setViewportWidth] = useState(
    typeof window === 'undefined' ? 1600 : window.innerWidth
  );
  const [form, setForm] = useState({
    content: '',
    color: colorOptions[0].value
  });
  const [settingsForm, setSettingsForm] = useState(null);
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const shareUrl = `${origin}/wall/${wallId}`;
  const canManageWall = Boolean(user && role === 'teacher' && wall?.ownerId === user.uid);
  const columnCount = clampColumnCount(wall?.columnCount ?? 4);
  const requestedColumn = Number(new URLSearchParams(location.search).get('column'));
  const columnNumbers = useMemo(
    () => Array.from({ length: columnCount }, (_, index) => index + 1),
    [columnCount]
  );
  const sharedColumn = columnNumbers.includes(requestedColumn) ? requestedColumn : null;
  const visibleColumns =
    viewportWidth >= 1280 ? columnCount : viewportWidth >= 768 ? Math.min(columnCount, 2) : 1;
  const boardGridStyle = useMemo(
    () => ({
      gridTemplateColumns: `repeat(${visibleColumns}, minmax(0, 1fr))`
    }),
    [visibleColumns]
  );
  const corkStyle = useMemo(
    () => ({
      backgroundColor: backgroundSwatch(wall?.backgroundTone)
    }),
    [wall?.backgroundTone]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (loading) return undefined;

    const unsubscribe = onSnapshot(
      doc(db, 'walls', wallId),
      (snapshot) => {
        setWallError('');
        setWallMissing(!snapshot.exists());
        const nextWall = snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
        setWall(nextWall);

        if (nextWall) {
          setColumnNameDrafts(nextWall.columnNames || {});
          setSettingsForm({
            title: nextWall.title || '',
            description: nextWall.description || '',
            accessMode: nextWall.accessMode || 'login',
            commentsEnabled: nextWall.commentsEnabled ?? true,
            likesEnabled: nextWall.likesEnabled ?? true,
            backgroundTone: nextWall.backgroundTone || wallBackgroundOptions[0].value
          });
        }
      },
      (error) => {
        setWall(null);
        setWallMissing(false);
        setWallError(error?.code === 'permission-denied' ? 'permission-denied' : 'load-failed');
      }
    );

    return unsubscribe;
  }, [loading, wallId]);

  useEffect(() => {
    if (loading || !wall) return undefined;
    if (wall.accessMode === 'login' && !user) return undefined;

    const postsQuery = query(collection(db, 'posts'), where('wallId', '==', wallId));
    const unsubscribe = onSnapshot(
      postsQuery,
      (snapshot) => {
        setWallError('');
        setPosts(
          snapshot.docs
            .map((item) => ({ id: item.id, ...item.data() }))
            .sort((a, b) => {
              const aOrder = postSortValue(a, -(a.createdAt?.seconds || 0));
              const bOrder = postSortValue(b, -(b.createdAt?.seconds || 0));
              return aOrder - bOrder;
            })
        );
      },
      (error) => {
        setPosts([]);
        setWallError(error?.code === 'permission-denied' ? 'permission-denied' : 'load-failed');
      }
    );

    return unsubscribe;
  }, [loading, user, wall, wallId]);

  const postsByColumn = useMemo(() => {
    const grouped = Object.fromEntries(columnNumbers.map((column) => [column, []]));
    let fallbackIndex = 0;

    for (const post of posts) {
      const column =
        post.column && grouped[post.column]
          ? post.column
          : columnNumbers[fallbackIndex++ % columnNumbers.length];
      grouped[column].push(post);
    }

    for (const column of columnNumbers) {
      grouped[column].sort((a, b) => {
        const aOrder = postSortValue(a, -(a.createdAt?.seconds || 0));
        const bOrder = postSortValue(b, -(b.createdAt?.seconds || 0));
        return aOrder - bOrder;
      });
    }

    return grouped;
  }, [columnNumbers, posts]);

  if (!loading && wall?.accessMode === 'login' && !user) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  async function submitPost(event) {
    event.preventDefault();
    if (!form.content.trim()) return;
    if (loading) return;
    if (wall?.accessMode === 'login' && !user) {
      alert('로그인이 필요한 담벼락입니다. 다시 로그인해 주세요.');
      return;
    }

    await createPost({
      wallId,
      authorId: user?.uid || 'anonymous',
      authorName: profile?.displayName || displayId || '익명',
      content: form.content.trim(),
      color: form.color,
      ...(sharedColumn
        ? nextColumnPostPlacement(postsByColumn, sharedColumn)
        : nextPostPlacement(postsByColumn, columnNumbers))
    });

    setForm({ content: '', color: colorOptions[0].value });
    setModalOpen(false);
  }

  function columnShareUrl(column) {
    return `${shareUrl}?column=${column}`;
  }

  async function copyShareUrl(url = shareUrl) {
    await navigator.clipboard.writeText(url);
  }

  async function saveSettings() {
    if (!settingsForm) return;
    await updateWall(wallId, settingsForm);
    setSettingsOpen(false);
  }

  async function addColumn() {
    if (columnCount >= 5) {
      alert('\uCEEC\uB7FC\uC740 \uCD5C\uB300 5\uAC1C\uAE4C\uC9C0 \uAC00\uB2A5\uD569\uB2C8\uB2E4.');
      return;
    }

    const nextColumn = columnCount + 1;
    await updateWall(wallId, {
      columnCount: nextColumn
    });
  }

  async function saveColumnName(column) {
    const nextName = (columnNameDrafts[column] || '').trim();
    const currentName = columnName(wall, column);
    const nextColumnNames = { ...(wall?.columnNames || {}) };

    if (nextName) {
      nextColumnNames[column] = nextName;
    } else {
      delete nextColumnNames[column];
    }

    setColumnNameDrafts(nextColumnNames);
    if (nextName === currentName) return;

    await updateWall(wallId, {
      columnNames: nextColumnNames
    });
  }

  async function removeColumn(column) {
    if (columnCount <= 1) {
      alert('\uCEEC\uB7FC\uC740 \uCD5C\uC18C 1\uAC1C \uC774\uC0C1 \uD544\uC694\uD569\uB2C8\uB2E4.');
      return;
    }

    const ok = window.confirm(
      '\uC774 \uCEEC\uB7FC\uACFC \uC548\uC758 \uBAA8\uB4E0 \uD3EC\uC2A4\uD2B8\uC787\uC774 \uC0AD\uC81C\uB429\uB2C8\uB2E4. \uACC4\uC18D\uD560\uAE4C\uC694?'
    );
    if (!ok) return;

    await deleteWallColumn(wallId, column, columnCount, wall?.columnNames || {});
  }

  async function movePostToColumn(column, targetPostId = null, placement = 'after') {
    if (!draggingPost) return;

    const nextByColumn = Object.fromEntries(
      columnNumbers.map((columnNumber) => [
        columnNumber,
        postsByColumn[columnNumber].filter((post) => post.id !== draggingPost.id)
      ])
    );
    const targetColumnPosts = nextByColumn[column] || [];
    const targetIndex = targetPostId
      ? targetColumnPosts.findIndex((post) => post.id === targetPostId)
      : -1;
    const insertIndex =
      targetIndex === -1 ? targetColumnPosts.length : targetIndex + (placement === 'after' ? 1 : 0);

    targetColumnPosts.splice(insertIndex, 0, { ...draggingPost, column });

    const updates = [];
    for (const columnNumber of columnNumbers) {
      nextByColumn[columnNumber].forEach((post, index) => {
        if (post.column !== columnNumber || post.order !== index) {
          updates.push({ id: post.id, column: columnNumber, order: index });
        }
      });
    }

    if (updates.length) {
      await updatePostLayouts(updates);
    }
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

  if (!loading && wallError === 'permission-denied' && !user) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  if (!loading && wallError === 'permission-denied') {
    return (
      <main className="felt-bg grid min-h-screen place-items-center px-4">
        <section className="rounded-[8px] bg-white/90 p-6 shadow-soft text-center">
          <p className="font-bold text-stone-900">담벼락을 불러올 권한이 없습니다.</p>
          <p className="mt-2 text-sm text-stone-600">
            로그인 상태를 확인한 뒤 다시 들어와 주세요.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="cork-bg min-h-screen" style={corkStyle}>
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
                onClick={() => setSettingsOpen(true)}
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
        <div data-testid="wall-board">
          {canManageWall && (
            <div className="mb-4 flex justify-end">
              <button
                type="button"
                onClick={addColumn}
                className="inline-flex items-center gap-1 rounded-full border border-stone-900/10 bg-white/55 px-3 py-1.5 text-xs font-bold text-stone-700 shadow-sm transition hover:bg-white/80"
              >
                <Plus size={14} />
                {'\uCEEC\uB7FC \uCD94\uAC00'}
              </button>
            </div>
          )}
          <div className="grid gap-5" style={boardGridStyle}>
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
                className={`min-h-[300px] rounded-[16px] p-3 transition ${
                  draggingPost && canManageWall
                    ? 'bg-white/22 outline outline-2 outline-offset-2 outline-dashed outline-stone-400'
                    : ''
                }`}
              >
                <div className="mb-3 flex min-h-10 items-center gap-2 px-1">
                  {canManageWall ? (
                    <input
                      value={columnNameDrafts[column] ?? columnName(wall, column)}
                      onChange={(event) =>
                        setColumnNameDrafts((drafts) => ({
                          ...drafts,
                          [column]: event.target.value
                        }))
                      }
                      onBlur={() => saveColumnName(column)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.currentTarget.blur();
                        }
                      }}
                      maxLength={24}
                      placeholder={'\uCEEC\uB7FC\uBA85 \uC785\uB825'}
                      className="min-w-0 flex-1 rounded-[8px] border border-transparent bg-white/60 px-3 py-2 text-sm font-bold text-stone-800 outline-none transition hover:bg-white/75 focus:border-stone-300 focus:bg-white"
                    />
                  ) : columnName(wall, column) ? (
                    <h2 className="min-w-0 flex-1 truncate px-1 text-sm font-bold text-stone-800">
                      <span className="inline-block max-w-full truncate rounded-[8px] bg-white/50 px-3 py-2">
                        {columnName(wall, column)}
                      </span>
                    </h2>
                  ) : (
                    <div className="min-w-0 flex-1" />
                  )}
                  {canManageWall && (
                    <button
                      type="button"
                      onClick={() => removeColumn(column)}
                      aria-label={'\uCEEC\uB7FC \uC0AD\uC81C'}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-stone-500 transition hover:bg-white/70 hover:text-red-600"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
                <div className="space-y-4">
                  {postsByColumn[column].map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      wall={wall || {}}
                      isTeacherView={canManageWall}
                      onDragStart={setDraggingPost}
                      onDragEnd={() => setDraggingPost(null)}
                      onDropOnPost={(targetPost, placement) =>
                        movePostToColumn(column, targetPost.id, placement)
                      }
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {!posts.length && (
            <div className="mt-5 rounded-[16px] border border-dashed border-white/70 bg-white/55 p-10 text-center text-stone-700">
              아직 포스트잇이 없습니다. 첫 글을 남겨보세요.
            </div>
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

      {settingsOpen && canManageWall && settingsForm && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-stone-950/45 px-4">
          <section className="w-full max-w-lg overflow-hidden rounded-[18px] bg-white p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-stone-950">담벼락 설정</h2>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="rounded-full p-2 hover:bg-stone-100"
                aria-label="설정 닫기"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-stone-700">제목</label>
                <input
                  value={settingsForm.title}
                  onChange={(e) => setSettingsForm({ ...settingsForm, title: e.target.value })}
                  className="h-11 w-full rounded-[8px] border border-stone-200 px-3"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-stone-700">설명</label>
                <textarea
                  value={settingsForm.description}
                  onChange={(e) => setSettingsForm({ ...settingsForm, description: e.target.value })}
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
                <span className="text-sm font-bold text-stone-800">댓글 사용</span>
                <input
                  type="checkbox"
                  checked={settingsForm.commentsEnabled}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, commentsEnabled: e.target.checked })
                  }
                />
              </label>
              <label className="flex items-center justify-between rounded-[10px] border border-stone-200 px-4 py-3">
                <span className="text-sm font-bold text-stone-800">좋아요 사용</span>
                <input
                  type="checkbox"
                  checked={settingsForm.likesEnabled}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, likesEnabled: e.target.checked })
                  }
                />
              </label>
              <div>
                <p className="mb-2 text-sm font-bold text-stone-700">코르크 배경 색상</p>
                <div className="grid grid-cols-3 gap-2">
                  {wallBackgroundOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        setSettingsForm({ ...settingsForm, backgroundTone: option.value })
                      }
                      className={`rounded-[12px] border p-3 text-sm font-bold text-stone-700 ${
                        settingsForm.backgroundTone === option.value
                          ? 'border-stone-900'
                          : 'border-transparent'
                      }`}
                      style={{ backgroundColor: option.swatch }}
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
          </section>
        </div>
      )}

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
              placeholder="생각이나 링크를 자유롭게 적어보세요."
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
          <section className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[18px] bg-white p-5 shadow-paper">
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

            <div className="mt-4 rounded-[12px] border border-stone-200 bg-stone-50 p-3">
              <p className="text-sm font-bold text-stone-900">
                {'\uCEEC\uB7FC\uBCC4 \uACF5\uC720 \uB9C1\uD06C'}
              </p>
              <div className="mt-3 space-y-2">
                {columnNumbers.map((column) => (
                  <div
                    key={column}
                    className="flex items-center gap-2 rounded-[10px] bg-white/70 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-stone-800">
                        {columnName(wall, column) || `${column}\uBC88 \uCEEC\uB7FC`}
                      </p>
                      <p className="truncate text-xs text-stone-500">{columnShareUrl(column)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyShareUrl(columnShareUrl(column))}
                      className="inline-flex shrink-0 items-center gap-1 rounded-[8px] border border-stone-200 px-2.5 py-1.5 text-xs font-bold text-stone-700 hover:bg-stone-50"
                    >
                      <Copy size={13} />
                      {'\uBCF5\uC0AC'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => copyShareUrl()}
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
