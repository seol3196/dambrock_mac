import { Send, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { createComment, deleteComment, subscribeComments } from '../lib/firestore';
import { dateText } from '../lib/ui';

export default function CommentBox({ postId, showAuthorNames = true }) {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');

  useEffect(() => {
    return subscribeComments(postId, (items) => {
      setComments(
        items.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
      );
    });
  }, [postId]);

  async function submit(event) {
    event.preventDefault();
    if (!text.trim()) return;
    await createComment({
      postId,
      authorId: user?.uid || 'anonymous',
      authorName: profile?.id || '익명',
      text: text.trim()
    });
    setText('');
  }

  return (
    <div className="mt-4 rounded-[8px] bg-white/60 p-3">
      <div className="space-y-2">
        {comments.map((comment) => (
          <div key={comment.id} className="flex items-start justify-between gap-2 text-sm">
            <p className="break-words">
              {showAuthorNames && <b>{comment.authorName} </b>}
              {comment.text}
              <span className="ml-2 text-xs text-stone-500">{dateText(comment.createdAt)}</span>
            </p>
            {user?.uid === comment.authorId && (
              <button
                type="button"
                aria-label="댓글 삭제"
                onClick={() => deleteComment(comment.id)}
                className="text-stone-500 hover:text-red-600"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="min-w-0 flex-1 rounded-[8px] border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500"
          placeholder="댓글 쓰기"
        />
        <button type="submit" className="rounded-[8px] bg-stone-800 px-3 text-white">
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
