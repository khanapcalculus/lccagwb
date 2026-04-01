import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import { db } from '../../../firebase';

export const useWhiteboardVersions = ({ roomId, socketRef }) => {
  const [versions, setVersions] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    if (!roomId) return undefined;
    const versionsQuery = query(
      collection(db, 'whiteboards', roomId, 'versions'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(versionsQuery, (snapshot) => {
      setVersions(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
    });

    return () => unsubscribe();
  }, [roomId]);

  const loadVersion = useCallback((versionId) => {
    if (!versionId) return;
    socketRef.current?.emit('load-version', { versionId });
    setHistoryOpen(false);
  }, [socketRef]);

  return {
    state: {
      versions,
      historyOpen,
    },
    actions: {
      setHistoryOpen,
      loadVersion,
    },
  };
};
