import { useState, useEffect, useCallback } from 'react';
import type * as Y from 'yjs';

interface UseYjsCommentsResult {
  /** Current comment text */
  comments: string;
  /** Set comments - updates both local state and Y.Text */
  setComments: (text: string) => void;
}

/**
 * Hook to bind a Y.Text CRDT to React state for collaborative comment editing.
 * Updates are bidirectional: local changes update Y.Text, remote changes update state.
 */
export function useYjsComments(yComments: Y.Text | null): UseYjsCommentsResult {
  const [comments, setLocalComments] = useState('');

  // Sync from Y.Text to React state on mount and on remote changes
  useEffect(() => {
    if (!yComments) return;

    // Initial sync
    setLocalComments(yComments.toString());

    // Listen for remote changes
    const observer = () => {
      setLocalComments(yComments.toString());
    };

    yComments.observe(observer);

    return () => {
      yComments.unobserve(observer);
    };
  }, [yComments]);

  // Set comments - update Y.Text which will trigger the observer
  const setComments = useCallback(
    (text: string) => {
      if (!yComments) {
        // Fallback to local-only state if no Y.Text available
        setLocalComments(text);
        return;
      }

      // Get the Y.Doc and perform the update in a transaction
      const doc = yComments.doc;
      if (doc) {
        doc.transact(() => {
          // Delete all existing content and insert new text
          yComments.delete(0, yComments.length);
          yComments.insert(0, text);
        });
      }
    },
    [yComments]
  );

  return { comments, setComments };
}
