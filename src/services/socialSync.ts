import { useAppStore } from '../store/useAppStore';
import { addComment, createPost, createStory, toggleFollow, toggleLike } from './social';

let installed = false;
const persistedUploads = new Set<string>();
const persistedComments = new Set<string>();

function isBackendId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(value);
}

export function installSocialPersistence() {
  if (installed) return;
  installed = true;

  useAppStore.subscribe((state, previous) => {
    const likedNow = new Set(state.likedVideoIds);
    const likedBefore = new Set(previous.likedVideoIds);
    for (const id of likedNow) {
      if (!likedBefore.has(id) && isBackendId(id)) void toggleLike(id, false);
    }
    for (const id of likedBefore) {
      if (!likedNow.has(id) && isBackendId(id)) void toggleLike(id, true);
    }

    const followedNow = new Set(state.followedCreatorIds);
    const followedBefore = new Set(previous.followedCreatorIds);
    for (const id of followedNow) {
      if (!followedBefore.has(id) && isBackendId(id)) void toggleFollow(id, false);
    }
    for (const id of followedBefore) {
      if (!followedNow.has(id) && isBackendId(id)) void toggleFollow(id, true);
    }

    for (const [postId, comments] of Object.entries(state.commentsByVideoId)) {
      if (!isBackendId(postId)) continue;
      const previousComments = previous.commentsByVideoId[postId] ?? [];
      for (const comment of comments) {
        if (previousComments.includes(comment)) continue;
        const key = `${postId}:${comment}`;
        if (persistedComments.has(key)) continue;
        persistedComments.add(key);
        void addComment(postId, comment);
      }
    }

    for (const upload of state.uploadedVideos) {
      if (!upload.id.startsWith('upload-') || persistedUploads.has(upload.id)) continue;
      persistedUploads.add(upload.id);
      const draft = {
        id: upload.id,
        title: upload.title,
        caption: upload.caption,
        tags: upload.tags,
        imageUrl: upload.imageUrl,
        sound: upload.sound,
        privacy: upload.privacy ?? 'public',
        type: upload.type ?? 'photo'
      } as const;
      if (draft.type === 'story') {
        void createStory(draft.imageUrl, draft.caption);
      } else {
        void createPost(draft);
      }
    }
  });
}

installSocialPersistence();
