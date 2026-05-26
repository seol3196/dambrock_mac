import { ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { db } from '../lib/firebase';
import { wallTone } from '../lib/ui';

export default function StudentPage() {
  const { profile, displayId } = useAuth();
  const [walls, setWalls] = useState([]);

  useEffect(() => {
    if (!profile?.teacherId) return undefined;
    const q = query(collection(db, 'walls'), where('ownerId', '==', profile.teacherId));
    return onSnapshot(q, (snapshot) => setWalls(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))));
  }, [profile?.teacherId]);

  return (
    <Layout badge="학생 모드" title={`안녕, ${displayId}!`} userLabel={displayId}>
      <section className="rounded-[8px] bg-white/90 p-5 shadow-soft">
        <h2 className="text-xl font-bold">참여할 담벼락</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {walls.map((wall) => (
            <Link key={wall.id} to={`/wall/${wall.id}`} className={`block rounded-[8px] border border-stone-200 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft ${wallTone(wall.id)}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-stone-950">{wall.title}</h3>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-stone-600">{wall.description}</p>
                </div>
                <ExternalLink size={18} className="shrink-0 text-stone-500" />
              </div>
            </Link>
          ))}
          {!walls.length && <p className="text-stone-600">아직 열린 담벼락이 없습니다.</p>}
        </div>
      </section>
    </Layout>
  );
}
