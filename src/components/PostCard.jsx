import {
  Check,
  ExternalLink,
  GripVertical,
  Heart,
  MessageCircle,
  Pencil,
  Trash2,
  X
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { deletePost, toggleLike, updatePost } from '../lib/firestore';
import { dateText, parseTextSegments } from '../lib/ui';
import CommentBox from './CommentBox.jsx';

export default function PostCard({
  post,
  wall,
  isTeacherView = false,
  dropPreview,
  onDragStart,
  onDragEnd,
  onDragPreview,
  onEditWorksheet,
  onDropOnPost
}) {
  const { user, role } = useAuth();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.content);
  const liked = Boolean(user && post.likedBy?.[user.uid]);
  const likeCount = post.likeCount || Object.keys(post.likedBy || {}).length;
  const canDelete =
    user && (post.authorId === user.uid || (role === 'teacher' && wall.ownerId === user.uid));
  const canEdit = Boolean(
    user && (post.authorId === user.uid || (role === 'teacher' && wall.ownerId === user.uid))
  );
  const canDrag = Boolean(isTeacherView && role === 'teacher' && wall.ownerId === user.uid);
  const isWorksheetPost = wall.postMode === 'worksheet';
  const worksheetFields = Array.isArray(wall.postTemplate?.fields) ? wall.postTemplate.fields : [];

  useEffect(() => {
    setDraft(post.content);
  }, [post.content]);

  async function handleLike() {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }
    await toggleLike(post.id);
  }

  async function saveEdit() {
    const next = draft.trim();
    if (!next) return;
    await updatePost(post.id, { content: next });
    setEditing(false);
  }

  return (
    <article
      draggable={canDrag}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', post.id);
        onDragStart?.(post);
      }}
      onDragEnd={() => onDragEnd?.()}
      onDragOver={(event) => {
        if (!canDrag) return;
        event.preventDefault();
        event.stopPropagation();
        const { top, height } = event.currentTarget.getBoundingClientRect();
        const placement = event.clientY < top + height / 2 ? 'before' : 'after';
        onDragPreview?.(post, placement);
      }}
      onDrop={(event) => {
        if (!canDrag) return;
        event.preventDefault();
        event.stopPropagation();
        const { top, height } = event.currentTarget.getBoundingClientRect();
        const placement = event.clientY < top + height / 2 ? 'before' : 'after';
        onDropOnPost?.(post, placement);
      }}
      className={`paper-edge fade-pop relative w-full rounded-[10px] border border-stone-900/5 ${
        post.color || 'bg-yellow-100'
      } p-4 shadow-paper ${canDrag ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      {dropPreview === 'before' && (
        <div className="pointer-events-none absolute -top-2 left-2 right-2 h-1 rounded-full bg-stone-500/45 shadow-sm" />
      )}
      {dropPreview === 'after' && (
        <div className="pointer-events-none absolute -bottom-2 left-2 right-2 h-1 rounded-full bg-stone-500/45 shadow-sm" />
      )}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-1 text-stone-500">
          {canDrag && (
            <>
              <GripVertical size={16} />
              <span className="text-xs font-bold">드래그 이동</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          {canEdit && !editing && (
            <button
              type="button"
              aria-label="게시글 수정"
              onClick={() => {
                if (isWorksheetPost) onEditWorksheet?.(post);
                else setEditing(true);
              }}
              className="rounded-full bg-white/75 p-1.5 text-stone-600 hover:text-stone-950"
            >
              <Pencil size={15} />
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              aria-label="게시글 삭제"
              onClick={() => deletePost(post.id)}
              className="rounded-full bg-white/75 p-1.5 text-stone-500 hover:text-red-600"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      {editing && !isWorksheetPost ? (
        <div>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="min-h-40 w-full rounded-[8px] border border-stone-200 bg-white/80 p-3 text-base leading-7 outline-none focus:border-amber-500"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={saveEdit}
              className="inline-flex items-center gap-1 rounded-[8px] bg-stone-900 px-3 py-2 text-sm font-bold text-white"
            >
              <Check size={15} />
              저장
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(post.content);
                setEditing(false);
              }}
              className="inline-flex items-center gap-1 rounded-[8px] bg-white/80 px-3 py-2 text-sm font-bold text-stone-700"
            >
              <X size={15} />
              취소
            </button>
          </div>
        </div>
      ) : isWorksheetPost ? (
        <div className="space-y-3">
          {worksheetFields.map((field) => (
            <section key={field.id} className="rounded-[8px] bg-white/45 px-3 py-2">
              <h3 className="text-xs font-black text-stone-500">
                {field.label}
              </h3>
              <p className="mt-1 whitespace-pre-wrap break-words text-[1.02rem] font-semibold leading-7 text-stone-900">
                {post.templateAnswers?.[field.id] || '-'}
              </p>
            </section>
          ))}
        </div>
      ) : (
        <div>
          <p className="whitespace-pre-wrap break-words text-[1.03rem] font-medium leading-7 text-stone-900">
            {parseTextSegments(post.content).map((segment, index) =>
              segment.type === 'link' ? (
                <a
                  key={`${segment.value}-${index}`}
                  href={segment.value}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 break-all font-semibold text-sky-800 underline underline-offset-2"
                >
                  {segment.value}
                  <ExternalLink size={14} />
                </a>
              ) : (
                <span key={`${segment.value}-${index}`}>{segment.value}</span>
              )
            )}
          </p>
        </div>
      )}

      <footer className="mt-5 flex items-center justify-between gap-3 text-sm text-stone-700">
        {wall.showAuthorNames !== false ? (
          <span className="font-semibold">{post.authorName || '익명'}</span>
        ) : (
          <span className="font-semibold text-stone-500">작성자 비공개</span>
        )}
        <span>{dateText(post.createdAt)}</span>
      </footer>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-stone-900/10 pt-3">
        {wall.likesEnabled && (
          <button
            type="button"
            onClick={handleLike}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold ${
              liked ? 'bg-rose-500 text-white' : 'bg-white/75 text-stone-700'
            }`}
          >
            <Heart size={15} fill={liked ? 'currentColor' : 'none'} />
            {likeCount}
          </button>
        )}
        {wall.commentsEnabled && (
          <button
            type="button"
            onClick={() => setCommentsOpen((value) => !value)}
            className="inline-flex items-center gap-1 rounded-full bg-white/75 px-3 py-1.5 text-sm font-bold text-stone-700"
          >
            <MessageCircle size={15} />
            댓글
          </button>
        )}
      </div>
      {commentsOpen && (
        <CommentBox postId={post.id} showAuthorNames={wall.showAuthorNames !== false} />
      )}
    </article>
  );
}
