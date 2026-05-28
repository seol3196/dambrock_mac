import {
  ArrowLeft,
  Copy,
  Download,
  MoreHorizontal,
  Plus,
  QrCode,
  Send,
  Settings2,
  Share2,
  Trash2,
  X
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import PostCard from '../components/PostCard.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import {
  colorOptions,
  createPost,
  deleteWallColumn,
  exportWallCsv,
  subscribePosts,
  subscribeWall,
  updatePostLayouts,
  updatePost,
  updateWall,
  wallBackgroundOptions
} from '../lib/firestore';

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
  const name = wall?.columnNames?.[column] || '';
  const trimmedName = String(name).trim();
  if (
    trimmedName === String(column) ||
    trimmedName === `${column}번` ||
    trimmedName === `${column}번 컬럼`
  ) {
    return '';
  }
  return name;
}

function columnTitle(wall, column) {
  return columnName(wall, column) || `${column}번 컬럼`;
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

function worksheetFields(wall) {
  return wall?.postMode === 'worksheet' && Array.isArray(wall?.postTemplate?.fields)
    ? wall.postTemplate.fields
    : [];
}

function emptyWorksheetAnswers(fields) {
  return Object.fromEntries(fields.map((field) => [field.id, '']));
}

function worksheetSummary(fields, answers) {
  return fields
    .map((field) => `${field.label}\n${answers[field.id] || ''}`.trim())
    .filter(Boolean)
    .join('\n\n');
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
  const [shareMessage, setShareMessage] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [draggingPost, setDraggingPost] = useState(null);
  const [dragPreview, setDragPreview] = useState(null);
  const [columnNameDrafts, setColumnNameDrafts] = useState({});
  const [editingColumnName, setEditingColumnName] = useState(null);
  const [wallError, setWallError] = useState('');
  const [viewportWidth, setViewportWidth] = useState(
    typeof window === 'undefined' ? 1600 : window.innerWidth
  );
  const [form, setForm] = useState({
    content: '',
    color: colorOptions[0].value,
    templateAnswers: {}
  });
  const [settingsForm, setSettingsForm] = useState(null);
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const shareUrl = `${origin}/wall/${wallId}`;
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const readOnlyMode = searchParams.get('view') === 'readonly';
  const readOnlyAuthorMode = searchParams.get('authors');
  const effectiveShowAuthorNames =
    readOnlyMode && readOnlyAuthorMode
      ? readOnlyAuthorMode !== 'hidden'
      : wall?.showAuthorNames !== false;
  const displayWall = useMemo(
    () => (wall ? { ...wall, showAuthorNames: effectiveShowAuthorNames } : wall),
    [effectiveShowAuthorNames, wall]
  );
  const canManageWall = Boolean(!readOnlyMode && user && role === 'teacher' && wall?.ownerId === user.uid);
  const columnCount = clampColumnCount(wall?.columnCount ?? 4);
  const requestedColumn = Number(searchParams.get('column'));
  const columnNumbers = useMemo(
    () => Array.from({ length: columnCount }, (_, index) => index + 1),
    [columnCount]
  );
  const sharedColumn = columnNumbers.includes(requestedColumn) ? requestedColumn : null;
  const displayedColumnNumbers = useMemo(
    () => (sharedColumn ? [sharedColumn] : columnNumbers),
    [columnNumbers, sharedColumn]
  );
  const displayedColumnCount = displayedColumnNumbers.length;
  const visibleColumns =
    sharedColumn ? 1 : viewportWidth >= 1280 ? columnCount : viewportWidth >= 768 ? Math.min(columnCount, 2) : 1;
  const boardGridStyle = useMemo(
    () => {
      const shouldConstrainColumns = viewportWidth >= 768 && displayedColumnCount <= 2;
      return {
        gridTemplateColumns: shouldConstrainColumns
          ? `repeat(${displayedColumnCount}, minmax(300px, 440px))`
          : `repeat(${visibleColumns}, minmax(0, 1fr))`,
        justifyContent: shouldConstrainColumns ? 'center' : 'stretch'
      };
    },
    [displayedColumnCount, viewportWidth, visibleColumns]
  );
  const corkStyle = useMemo(
    () => ({
      backgroundColor: backgroundSwatch(wall?.backgroundTone)
    }),
    [wall?.backgroundTone]
  );
  const templateFields = useMemo(() => worksheetFields(wall), [wall]);
  const isWorksheetWall = wall?.postMode === 'worksheet';

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (loading) return undefined;

    const unsubscribe = subscribeWall(
      wallId,
      (nextWall) => {
        setWallError('');
        setWallMissing(false);
        setWall(nextWall);

        if (nextWall) {
          setColumnNameDrafts((currentDrafts) => {
            if (!editingColumnName) return nextWall.columnNames || {};
            return {
              ...(nextWall.columnNames || {}),
              [editingColumnName]: currentDrafts[editingColumnName] ?? nextWall.columnNames?.[editingColumnName] ?? ''
            };
          });
          if (!settingsOpen) {
            setSettingsForm({
              title: nextWall.title || '',
              description: nextWall.description || '',
              accessMode: nextWall.accessMode || 'login',
              commentsEnabled: nextWall.commentsEnabled ?? true,
              likesEnabled: nextWall.likesEnabled ?? true,
              showAuthorNames: nextWall.showAuthorNames ?? true,
              postMode: nextWall.postMode || 'free',
              postTemplate: nextWall.postTemplate || { fields: [] },
              backgroundTone: nextWall.backgroundTone || wallBackgroundOptions[0].value
            });
          }
        }
      },
      (error) => {
        setWall(null);
        setWallMissing(error?.status === 404);
        setWallError(error?.status === 401 || error?.status === 403 ? 'permission-denied' : 'load-failed');
      },
      readOnlyMode ? { view: 'readonly' } : {}
    );

    return unsubscribe;
  }, [editingColumnName, loading, readOnlyMode, settingsOpen, wallId]);

  useEffect(() => {
    if (loading || !wall) return undefined;
    if (wall.accessMode === 'login' && !user && !readOnlyMode) return undefined;

    const unsubscribe = subscribePosts(
      wallId,
      (items) => {
        setWallError('');
        setPosts(
          items
            .sort((a, b) => {
              const aOrder = postSortValue(a, -new Date(a.createdAt || 0).getTime());
              const bOrder = postSortValue(b, -new Date(b.createdAt || 0).getTime());
              return aOrder - bOrder;
            })
        );
      },
      (error) => {
        setPosts([]);
        setWallError(error?.status === 401 || error?.status === 403 ? 'permission-denied' : 'load-failed');
      },
      readOnlyMode ? { view: 'readonly' } : {}
    );

    return unsubscribe;
  }, [loading, readOnlyMode, user, wall, wallId]);

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
        const aOrder = postSortValue(a, -new Date(a.createdAt || 0).getTime());
        const bOrder = postSortValue(b, -new Date(b.createdAt || 0).getTime());
        return aOrder - bOrder;
      });
    }

    return grouped;
  }, [columnNumbers, posts]);
  const displayedPostCount = useMemo(
    () =>
      displayedColumnNumbers.reduce(
        (count, column) => count + (postsByColumn[column]?.length || 0),
        0
      ),
    [displayedColumnNumbers, postsByColumn]
  );

  if (!loading && wall?.accessMode === 'login' && !user && !readOnlyMode) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  async function submitPost(event) {
    event.preventDefault();
    if (readOnlyMode) return;
    if (loading) return;
    if (wall?.accessMode === 'login' && !user) {
      alert('로그인이 필요한 담벼락입니다. 다시 로그인해 주세요.');
      return;
    }

    const templateAnswers = Object.fromEntries(
      templateFields.map((field) => [field.id, String(form.templateAnswers?.[field.id] || '').trim()])
    );
    if (isWorksheetWall) {
      const missingField = templateFields.find(
        (field) => field.required !== false && !templateAnswers[field.id]
      );
      if (missingField) {
        alert(`${missingField.label} 항목을 입력해 주세요.`);
        return;
      }
    } else if (!form.content.trim()) {
      return;
    }

    await createPost({
      wallId,
      authorId: user?.uid || 'anonymous',
      authorName: profile?.displayName || displayId || '익명',
      content: isWorksheetWall ? worksheetSummary(templateFields, templateAnswers) : form.content.trim(),
      templateAnswers: isWorksheetWall ? templateAnswers : undefined,
      color: form.color,
      ...(sharedColumn
        ? nextColumnPostPlacement(postsByColumn, sharedColumn)
        : nextPostPlacement(postsByColumn, columnNumbers))
    });

    setForm({ content: '', color: colorOptions[0].value, templateAnswers: emptyWorksheetAnswers(templateFields) });
    setModalOpen(false);
  }

  function openCreatePostModal() {
    if (readOnlyMode) return;
    setEditingPost(null);
    setForm({
      content: '',
      color: colorOptions[0].value,
      templateAnswers: emptyWorksheetAnswers(templateFields)
    });
    setModalOpen(true);
  }

  function openEditPostModal(post) {
    if (readOnlyMode) return;
    setEditingPost(post);
    setForm({
      content: post.content || '',
      color: post.color || colorOptions[0].value,
      templateAnswers: {
        ...emptyWorksheetAnswers(templateFields),
        ...(post.templateAnswers || {})
      }
    });
    setModalOpen(true);
  }

  async function savePostEdit(event) {
    event.preventDefault();
    if (!editingPost) return;

    if (!isWorksheetWall) {
      const nextContent = form.content.trim();
      if (!nextContent) return;

      await updatePost(editingPost.id, {
        content: nextContent,
        color: form.color
      });
      setEditingPost(null);
      setForm({ content: '', color: colorOptions[0].value, templateAnswers: emptyWorksheetAnswers(templateFields) });
      setModalOpen(false);
      return;
    }

    const templateAnswers = Object.fromEntries(
      templateFields.map((field) => [field.id, String(form.templateAnswers?.[field.id] || '').trim()])
    );
    const missingField = templateFields.find(
      (field) => field.required !== false && !templateAnswers[field.id]
    );
    if (missingField) {
      alert(`${missingField.label} 항목을 입력해 주세요.`);
      return;
    }

    await updatePost(editingPost.id, {
      color: form.color,
      templateAnswers
    });
    setEditingPost(null);
    setForm({ content: '', color: colorOptions[0].value, templateAnswers: emptyWorksheetAnswers(templateFields) });
    setModalOpen(false);
  }

  function columnShareUrl(column) {
    return `${shareUrl}?column=${column}`;
  }

  function publicViewShareUrl(authors) {
    const params = new URLSearchParams({
      view: 'readonly',
      authors
    });
    return `${shareUrl}?${params.toString()}`;
  }

  async function copyShareUrl(url = shareUrl, label = '링크') {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setShareMessage(`${label}를 복사했습니다.`);
      window.setTimeout(() => setShareMessage(''), 1600);
    } catch {
      setShareMessage('복사하지 못했습니다. 링크를 직접 선택해 복사해 주세요.');
    }
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
    setEditingColumnName(null);
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

    targetColumnPosts.splice(insertIndex, 0, draggingPost);

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
    setDragPreview(null);
  }

  function showColumnDropPreview(column) {
    if (!draggingPost) return;
    setDragPreview({ column, targetPostId: null, placement: 'after' });
  }

  function showPostDropPreview(targetPost, placement, column) {
    if (!draggingPost || draggingPost.id === targetPost.id) {
      setDragPreview(null);
      return;
    }
    setDragPreview({ column, targetPostId: targetPost.id, placement });
  }

  async function downloadCsv() {
    try {
      const { blob, filename } = await exportWallCsv(wallId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      alert('CSV 파일을 추출하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
  }

  function closeActions() {
    setActionsOpen(false);
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

  if (!loading && wallError === 'permission-denied' && !user && !readOnlyMode) {
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
        <div className="mx-auto flex w-full max-w-[1600px] items-start justify-between gap-3 px-4 py-3 sm:items-center sm:px-5 sm:py-4">
          <div className="min-w-0">
            <Link
              to={homePath(role)}
              className="mb-2 inline-flex items-center gap-1 text-sm font-bold text-stone-600"
            >
              <ArrowLeft size={16} />
              돌아가기
            </Link>
            <h1 className="line-clamp-2 text-2xl font-bold leading-tight text-stone-950 sm:truncate sm:text-4xl">
              {wall?.title || '담벼락'}
            </h1>
            <p className="mt-1 text-sm text-stone-600">
              {wall?.ownerName} 선생님 · 게시글 {posts.length}개
            </p>
          </div>

          {canManageWall && (
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setActionsOpen((value) => !value)}
                className="grid h-10 w-10 place-items-center rounded-[10px] border border-stone-300 bg-white text-stone-800 shadow-sm sm:hidden"
                aria-label="담벼락 메뉴"
              >
                <MoreHorizontal size={18} />
              </button>
              {actionsOpen && (
                <div className="absolute right-0 top-12 z-20 w-36 overflow-hidden rounded-[12px] border border-stone-200 bg-white shadow-soft sm:hidden">
                  <button
                    type="button"
                    onClick={() => {
                      closeActions();
                      downloadCsv();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-3 text-left text-sm font-bold text-stone-800 hover:bg-stone-50"
                  >
                    <Download size={15} />
                    CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      closeActions();
                      setSettingsOpen(true);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-3 text-left text-sm font-bold text-stone-800 hover:bg-stone-50"
                  >
                    <Settings2 size={15} />
                    설정
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      closeActions();
                      setShareOpen(true);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-3 text-left text-sm font-bold text-stone-800 hover:bg-stone-50"
                  >
                    <Share2 size={15} />
                    공유
                  </button>
                </div>
              )}
            <div className="hidden items-center gap-2 sm:flex">
              <button
                type="button"
                onClick={downloadCsv}
                className="inline-flex items-center gap-2 rounded-[10px] border border-stone-300 bg-white px-4 py-2 text-sm font-bold text-stone-800 shadow-sm"
              >
                <Download size={16} />
                CSV
              </button>
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
            {displayedColumnNumbers.map((column) => (
              <div
                key={column}
                data-testid={`wall-column-${column}`}
                onDragOver={(event) => {
                  if (!canManageWall || !draggingPost) return;
                  event.preventDefault();
                  showColumnDropPreview(column);
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
                <div className="mb-4 px-1">
                  {canManageWall ? (
                    <div className="flex min-h-12 items-center gap-2 rounded-[10px] border border-white/75 bg-white/68 px-3 py-2 shadow-sm backdrop-blur-[2px]">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-100 text-sm font-black text-stone-800 shadow-inner">
                        {column}
                      </span>
                      <input
                        value={columnNameDrafts[column] ?? columnName(wall, column)}
                        onChange={(event) =>
                          setColumnNameDrafts((drafts) => ({
                            ...drafts,
                            [column]: event.target.value
                          }))
                        }
                        onBlur={() => saveColumnName(column)}
                        onFocus={() => setEditingColumnName(column)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.currentTarget.blur();
                          }
                        }}
                        maxLength={24}
                        placeholder={`${column}번 컬럼`}
                        className="min-w-0 flex-1 bg-transparent text-base font-extrabold text-stone-900 outline-none placeholder:text-stone-500"
                      />
                      <button
                        type="button"
                        onClick={() => removeColumn(column)}
                        aria-label={'\uCEEC\uB7FC \uC0AD\uC81C'}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-stone-500 transition hover:bg-white/70 hover:text-red-600"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ) : columnName(wall, column) ? (
                    <h2 className="flex min-h-12 items-center gap-2 rounded-[10px] border border-white/75 bg-white/68 px-3 py-2 text-stone-900 shadow-sm backdrop-blur-[2px]">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-100 text-sm font-black text-stone-800 shadow-inner">
                        {column}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-base font-extrabold">
                        {columnTitle(wall, column)}
                      </span>
                    </h2>
                  ) : (
                    <div className="min-h-12" />
                  )}
                </div>
                <div className="space-y-4">
                  {postsByColumn[column].map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      wall={displayWall || {}}
                      isTeacherView={canManageWall}
                      readOnly={readOnlyMode}
                      onDragStart={setDraggingPost}
                      onEditPost={openEditPostModal}
                      dropPreview={
                        dragPreview?.column === column && dragPreview?.targetPostId === post.id
                          ? dragPreview.placement
                          : null
                      }
                      onDragEnd={() => {
                        setDraggingPost(null);
                        setDragPreview(null);
                      }}
                      onDragPreview={(targetPost, placement) =>
                        showPostDropPreview(targetPost, placement, column)
                      }
                      onDropOnPost={(targetPost, placement) =>
                        movePostToColumn(column, targetPost.id, placement)
                      }
                    />
                  ))}
                  {dragPreview?.column === column && dragPreview.targetPostId == null && (
                    <div className="h-1 rounded-full bg-stone-500/45 shadow-sm" />
                  )}
                </div>
              </div>
            ))}
          </div>

          {!displayedPostCount && (
            <div className="mt-5 rounded-[16px] border border-dashed border-white/70 bg-white/55 p-10 text-center text-stone-700">
              아직 포스트잇이 없습니다. 첫 글을 남겨보세요.
            </div>
          )}
        </div>
      </section>

      {!readOnlyMode && (
        <button
          type="button"
          aria-label="글쓰기"
          onClick={openCreatePostModal}
          className="fixed bottom-6 right-6 grid h-16 w-16 place-items-center rounded-full bg-rose-500 text-white shadow-paper transition hover:scale-105"
        >
          <Plus size={30} />
        </button>
      )}

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
              <label className="flex items-center justify-between rounded-[10px] border border-stone-200 px-4 py-3">
                <span>
                  <b className="block text-sm text-stone-800">작성자 이름 표시</b>
                  <span className="text-xs text-stone-500">
                    끄면 학생 포스트잇과 댓글 작성자 이름을 숨깁니다.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={settingsForm.showAuthorNames}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, showAuthorNames: e.target.checked })
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
            onSubmit={editingPost ? savePostEdit : submitPost}
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[18px] bg-white p-5 shadow-paper"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">
                {isWorksheetWall ? '학습지 포스트잇 작성' : '포스트잇 작성'}
              </h2>
              <button
                type="button"
                aria-label="닫기"
                onClick={() => {
                  setModalOpen(false);
                  setEditingPost(null);
                }}
                className="rounded-full p-2 hover:bg-stone-100"
              >
                <X size={18} />
              </button>
            </div>
            {isWorksheetWall ? (
              <div className="mt-4 space-y-4">
                {templateFields.map((field) => (
                  <label key={field.id} className="block">
                    <span className="mb-2 block text-sm font-bold text-stone-800">
                      {field.label}
                      {field.required !== false && <span className="text-rose-500"> *</span>}
                    </span>
                    {field.type === 'longText' ? (
                      <textarea
                        value={form.templateAnswers?.[field.id] || ''}
                        maxLength={1000}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            templateAnswers: {
                              ...(form.templateAnswers || {}),
                              [field.id]: event.target.value
                            }
                          })
                        }
                        className="min-h-28 w-full resize-y rounded-[10px] border border-stone-200 p-3 text-base leading-7 outline-none focus:border-amber-500"
                      />
                    ) : (
                      <input
                        value={form.templateAnswers?.[field.id] || ''}
                        maxLength={100}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            templateAnswers: {
                              ...(form.templateAnswers || {}),
                              [field.id]: event.target.value
                            }
                          })
                        }
                        className="h-11 w-full rounded-[10px] border border-stone-200 px-3 text-base outline-none focus:border-amber-500"
                      />
                    )}
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                className="mt-4 min-h-40 w-full resize-y rounded-[10px] border border-stone-200 p-3 text-base leading-7 outline-none focus:border-amber-500"
                placeholder="생각이나 링크를 자유롭게 적어보세요."
              />
            )}
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
              {editingPost ? '수정 저장' : '올리기'}
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
              <div className="mt-2 flex items-center gap-2">
                <p className="min-w-0 flex-1 break-all">{shareUrl}</p>
                <button
                  type="button"
                  onClick={() => copyShareUrl(shareUrl, '메인 링크')}
                  className="inline-flex shrink-0 items-center gap-1 rounded-[8px] bg-stone-900 px-3 py-2 text-xs font-bold text-white"
                >
                  <Copy size={13} />
                  복사
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-[12px] border border-stone-200 bg-stone-50 p-3 text-sm text-stone-700">
              <p className="font-bold text-stone-900">공개보기 링크</p>
              <p className="mt-1 text-xs text-stone-500">이 링크에서는 글쓰기 없이 보기만 가능합니다.</p>
              <div className="mt-3 space-y-2">
                {[
                  ['visible', '작성자 표시'],
                  ['hidden', '작성자 숨김']
                ].map(([authors, label]) => {
                  const url = publicViewShareUrl(authors);
                  return (
                    <div
                      key={authors}
                      className="flex items-center gap-2 rounded-[10px] bg-white/70 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-stone-800">{label}</p>
                        <p className="truncate text-xs text-stone-500">{url}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyShareUrl(url, `${label} 공개보기 링크`)}
                        className="inline-flex shrink-0 items-center gap-1 rounded-[8px] border border-stone-200 px-2.5 py-1.5 text-xs font-bold text-stone-700 hover:bg-stone-50"
                      >
                        <Copy size={13} />
                        복사
                      </button>
                    </div>
                  );
                })}
              </div>
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
                      onClick={() => copyShareUrl(columnShareUrl(column), `${columnName(wall, column) || `${column}번 컬럼`} 링크`)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-[8px] border border-stone-200 px-2.5 py-1.5 text-xs font-bold text-stone-700 hover:bg-stone-50"
                    >
                      <Copy size={13} />
                      {'\uBCF5\uC0AC'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {shareMessage && (
              <p className="mt-3 rounded-[8px] bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">
                {shareMessage}
              </p>
            )}

            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShareOpen(false)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] border border-stone-300 px-4 py-3 text-sm font-bold text-stone-700"
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
