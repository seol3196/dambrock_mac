import { ArrowLeft, Plus, Send, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { Link, Navigate, useParams } from 'react-router-dom';
import PostCard from '../components/PostCard.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { colorOptions, createPost } from '../lib/firestore';
import { db } from '../lib/firebase';

export default function WallPage() {
  const { wallId } = useParams();
  const { user, profile, loading } = useAuth();
  const [wall, setWall] = useState(null);
  const [wallMissing, setWallMissing] = useState(false);
  const [posts, setPosts] = useState([]);
  const [likes, setLikes] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ content: '', color: colorOptions[0].value });

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'walls', wallId), (snapshot) => {
      setWallMissing(!snapshot.exists());
      setWall(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
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

  if (!loading && wall?.accessMode === 'login' && !user) return <Navigate to="/" replace />;

  async function submitPost(event) {
    event.preventDefault();
    if (!form.content.trim()) return;
    await createPost({
      wallId,
      authorId: user?.uid || 'anonymous',
      authorName: profile?.id || '익명',
      content: form.content.trim(),
      color: form.color
    });
    setForm({ content: '', color: colorOptions[0].value });
    setModalOpen(false);
  }

  if (wallMissing) {
    return (
      <main className="felt-bg grid min-h-screen place-items-center px-4">
        <section className="rounded-[8px] bg-white/90 p-6 shadow-soft">담벼락을 찾을 수 없습니다.</section>
      </main>
    );
  }

  return (
    <main className="cork-bg min-h-screen">
      <header className="sticky top-0 z-10 border-b border-stone-900/10 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4">
          <div className="min-w-0">
            <Link to={user ? '/student' : '/'} className="mb-2 inline-flex items-center gap-1 text-sm font-bold text-stone-600">
              <ArrowLeft size={16} />
              돌아가기
            </Link>
            <h1 className="truncate text-2xl font-bold text-stone-950">{wall?.title || '담벼락'}</h1>
            <p className="mt-1 text-sm text-stone-600">{wall?.ownerName} · 게시글 {posts.length}개</p>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6">
        {wall?.description && <p className="mb-5 rounded-[8px] bg-white/75 p-4 text-stone-700 shadow-sm">{wall.description}</p>}
        <div className="columns-1 gap-5 sm:columns-2 xl:columns-3">
          {posts.map((post) => (
            <div key={post.id} className="mb-5">
              <PostCard post={post} wall={wall || {}} likes={likesByPost[post.id] || []} />
            </div>
          ))}
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
          <form onSubmit={submitPost} className="w-full max-w-lg rounded-[8px] bg-white p-5 shadow-paper">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">글 남기기</h2>
              <button type="button" aria-label="닫기" onClick={() => setModalOpen(false)} className="rounded-full p-2 hover:bg-stone-100">
                <X size={18} />
              </button>
            </div>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              className="mt-4 min-h-40 w-full resize-y rounded-[8px] border border-stone-200 p-3 text-lg outline-none focus:border-amber-500"
              placeholder="생각을 적어 보세요."
            />
            <div className="mt-4 flex flex-wrap gap-2">
              {colorOptions.map((color) => (
                <button
                  type="button"
                  key={color.value}
                  onClick={() => setForm({ ...form, color: color.value })}
                  className={`h-9 w-9 rounded-full border-2 ${form.color === color.value ? 'border-stone-900' : 'border-white'}`}
                  style={{ background: color.swatch }}
                  aria-label={color.name}
                />
              ))}
            </div>
            <button type="submit" className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-stone-900 font-bold text-white">
              <Send size={18} />
              올리기
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
