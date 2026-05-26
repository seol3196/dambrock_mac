import { Heart, MessageCircle, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { deletePost, toggleLike } from '../lib/firestore';
import { dateText, hashNumber } from '../lib/ui';
import CommentBox from './CommentBox.jsx';

export default function PostCard({ post, wall, likes }) {
  const { user, role, profile } = useAuth();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const liked = Boolean(user && likes.some((like) => like.userId === user.uid));
  const canDelete = user && (post.authorId === user.uid || (role === 'teacher' && wall.ownerId === user.uid));
  const rotate = hashNumber(post.id, -2, 2);

  async function handleLike() {
    if (!user) {
      alert('로그인이 필요해요.');
      return;
    }
    await toggleLike(post.id, user.uid);
  }

  return (
    <article
      className={`paper-edge fade-pop relative break-inside-avoid rounded-[6px] ${post.color || 'bg-yellow-100'} p-5 shadow-paper`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <p className="whitespace-pre-wrap break-words font-hand text-3xl leading-9 text-stone-900">{post.content}</p>
      <footer className="mt-5 flex items-center justify-between gap-3 text-sm text-stone-600">
        <span>{post.authorName || profile?.id || '익명'}</span>
        <span>{dateText(post.createdAt)}</span>
      </footer>
      {canDelete && (
        <button
          type="button"
          aria-label="글 삭제"
          onClick={() => deletePost(post.id)}
          className="absolute right-2 top-2 rounded-full bg-white/70 p-1 text-stone-500 hover:text-red-600"
        >
          <Trash2 size={16} />
        </button>
      )}
      <div className="mt-4 flex gap-2 border-t border-stone-900/10 pt-3">
        {wall.likesEnabled && (
          <button
            type="button"
            onClick={handleLike}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold ${
              liked ? 'bg-rose-500 text-white' : 'bg-white/65 text-stone-700'
            }`}
          >
            <Heart size={15} fill={liked ? 'currentColor' : 'none'} />
            {likes.length}
          </button>
        )}
        {wall.commentsEnabled && (
          <button
            type="button"
            onClick={() => setCommentsOpen((value) => !value)}
            className="inline-flex items-center gap-1 rounded-full bg-white/65 px-3 py-1 text-sm font-bold text-stone-700"
          >
            <MessageCircle size={15} />
            댓글
          </button>
        )}
      </div>
      {commentsOpen && <CommentBox postId={post.id} />}
    </article>
  );
}
