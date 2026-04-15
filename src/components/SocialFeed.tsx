import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, ChevronLeft, ChevronRight, Heart, ImagePlus, Pencil, Plus, Send, Share2, Smile, Trash2, Video, X } from "lucide-react";

type SocialPost = {
  id: string;
  user_id: string;
  clan: string | null;
  content: string;
  media_url: string | null;
  media_type: "image" | "video" | null;
  created_at: string;
};

type SocialStory = {
  id: string;
  user_id: string;
  clan: string | null;
  media_url: string;
  media_type: "image" | "video";
  caption: string | null;
  created_at: string;
  expires_at: string;
};

type FeedUser = {
  id: string;
  nickname: string;
  avatar_url: string | null;
  clan: string | null;
};

type FeedItem = SocialPost & {
  author: FeedUser | null;
  like_count: number;
  share_count: number;
  liked_by_me: boolean;
};

type StoryItem = SocialStory & {
  author: FeedUser | null;
  mine: boolean;
};

type StoryReaction = {
  story_id: string;
  user_id: string;
  reaction: string;
  created_at: string;
};

type StoryComment = {
  id: string;
  story_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  author: FeedUser | null;
};

type PostComment = {
  id: string;
  post_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  author: FeedUser | null;
};

export function SocialFeed() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [posts, setPosts] = useState<FeedItem[]>([]);
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [content, setContent] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [storyFile, setStoryFile] = useState<File | null>(null);
  const [storyPreview, setStoryPreview] = useState<string | null>(null);
  const [storyCaption, setStoryCaption] = useState("");
  const [publishingStory, setPublishingStory] = useState(false);
  const [storyModalOpen, setStoryModalOpen] = useState(false);
  const [storyCreateOpen, setStoryCreateOpen] = useState(false);
  const [storyIndex, setStoryIndex] = useState(0);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [showPostEmoji, setShowPostEmoji] = useState(false);
  const [showStoryEmoji, setShowStoryEmoji] = useState(false);
  const [showEditEmoji, setShowEditEmoji] = useState(false);
  const [storyReactions, setStoryReactions] = useState<StoryReaction[]>([]);
  const [storyComments, setStoryComments] = useState<StoryComment[]>([]);
  const [postComments, setPostComments] = useState<Record<string, PostComment[]>>({});
  const [postCommentInput, setPostCommentInput] = useState<Record<string, string>>({});
  const [sendingPostCommentId, setSendingPostCommentId] = useState<string | null>(null);
  const [storyCommentText, setStoryCommentText] = useState("");
  const [sendingStoryComment, setSendingStoryComment] = useState(false);
  const [loadingStoryDetails, setLoadingStoryDetails] = useState(false);
  const [expandedFeedImage, setExpandedFeedImage] = useState<{ url: string; authorName: string } | null>(null);

  const quickEmojis = ["😀", "😎", "🔥", "💪", "🎯", "⚔️", "🏆", "🎮", "🚀", "✅", "❤️", "😂", "👏", "🤝", "📢", "🛡️"];
  const storyReactionEmojis = ["👍", "❤️", "🥰", "😆", "😮", "😢", "😡"];

  const sb = useMemo(() => supabase as any, []);

  const fetchFeed = useCallback(async () => {
    if (!profile?.id) return;

    const nowIso = new Date().toISOString();
    const [postRowsRes, storyRowsRes] = await Promise.all([
      sb
        .from("social_posts")
        .select("id, user_id, clan, content, media_url, media_type, created_at")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(40),
      sb
        .from("social_stories")
        .select("id, user_id, clan, media_url, media_type, caption, created_at, expires_at")
        .eq("is_active", true)
        .gt("expires_at", nowIso)
        .order("created_at", { ascending: false })
        .limit(80),
    ]);

    if (postRowsRes.error || storyRowsRes.error) {
      setLoading(false);
      return;
    }

    const rawPosts = (postRowsRes.data || []) as SocialPost[];
    const rawStories = (storyRowsRes.data || []) as SocialStory[];

    const postIds = rawPosts.map((p) => p.id);
    const userIds = Array.from(new Set([...rawPosts.map((p) => p.user_id), ...rawStories.map((s) => s.user_id)]));

    const [likesRes, sharesRes, postCommentsRes] = await Promise.all([
      postIds.length ? sb.from("social_post_likes").select("post_id, user_id").in("post_id", postIds) : Promise.resolve({ data: [] }),
      postIds.length ? sb.from("social_post_shares").select("post_id, user_id").in("post_id", postIds) : Promise.resolve({ data: [] }),
      postIds.length
        ? sb
            .from("social_post_comments")
            .select("id, post_id, user_id, comment, created_at")
            .in("post_id", postIds)
            .eq("is_active", true)
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [] }),
    ]);

    const commenterIds = Array.from(new Set((postCommentsRes.data || []).map((c: any) => c.user_id)));
    const allUserIds = Array.from(new Set([...userIds, ...commenterIds]));
    const usersRes = allUserIds.length
      ? await sb.from("users").select("id, nickname, avatar_url, clan").in("id", allUserIds)
      : { data: [] };

    const usersMap = new Map<string, FeedUser>((usersRes.data || []).map((u: FeedUser) => [u.id, u]));
    const likes = likesRes.data || [];
    const shares = sharesRes.data || [];
    const commentsRaw = postCommentsRes.data || [];

    const likeCountMap = new Map<string, number>();
    const shareCountMap = new Map<string, number>();
    const likedByMeSet = new Set<string>();

    likes.forEach((row: any) => {
      likeCountMap.set(row.post_id, (likeCountMap.get(row.post_id) || 0) + 1);
      if (row.user_id === profile.id) likedByMeSet.add(row.post_id);
    });

    shares.forEach((row: any) => {
      shareCountMap.set(row.post_id, (shareCountMap.get(row.post_id) || 0) + 1);
    });

    setPosts(
      rawPosts.map((p) => ({
        ...p,
        author: usersMap.get(p.user_id) || null,
        like_count: likeCountMap.get(p.id) || 0,
        share_count: shareCountMap.get(p.id) || 0,
        liked_by_me: likedByMeSet.has(p.id),
      }))
    );

    const commentsByPost: Record<string, PostComment[]> = {};
    commentsRaw.forEach((c: any) => {
      const row: PostComment = {
        id: c.id,
        post_id: c.post_id,
        user_id: c.user_id,
        comment: c.comment,
        created_at: c.created_at,
        author: usersMap.get(c.user_id) || null,
      };
      if (!commentsByPost[row.post_id]) commentsByPost[row.post_id] = [];
      commentsByPost[row.post_id].push(row);
    });
    setPostComments(commentsByPost);

    const mappedStories = rawStories.map((s) => ({
      ...s,
      author: usersMap.get(s.user_id) || null,
      mine: s.user_id === profile.id,
    }));
    setStories(mappedStories);
    setLoading(false);
  }, [profile?.id, sb]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const onSelectMedia = (file?: File | null) => {
    if (!file) return;
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
  };

  const publishPost = async () => {
    if (!profile?.id) return;
    if (!content.trim() && !mediaFile) {
      toast.error("Escreva algo ou adicione uma mídia.");
      return;
    }

    setPublishing(true);
    try {
      let media_url: string | null = null;
      let media_type: "image" | "video" | null = null;

      if (mediaFile) {
        const ext = mediaFile.name.split(".").pop() || "file";
        const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const path = `${profile.id}/${safeName}`;
        const { error: uploadError } = await supabase.storage.from("social-posts").upload(path, mediaFile, {
          upsert: true,
          contentType: mediaFile.type || undefined,
        });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("social-posts").getPublicUrl(path);
        media_url = urlData.publicUrl;
        media_type = mediaFile.type.startsWith("video/") ? "video" : "image";
      }

      const { error } = await sb.from("social_posts").insert({
        user_id: profile.id,
        clan: profile.clan || null,
        content: content.trim(),
        media_url,
        media_type,
      });
      if (error) throw error;

      setContent("");
      setMediaFile(null);
      setMediaPreview(null);
      await fetchFeed();
      toast.success("Post publicado!");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao publicar post");
    }
    setPublishing(false);
  };

  const publishStory = async () => {
    if (!profile?.id) return;
    if (!storyFile) {
      toast.error("Selecione uma foto ou vídeo para o story.");
      return;
    }

    setPublishingStory(true);
    try {
      const ext = storyFile.name.split(".").pop() || "file";
      const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const path = `${profile.id}/${safeName}`;
      const { error: uploadError } = await supabase.storage.from("social-stories").upload(path, storyFile, {
        upsert: true,
        contentType: storyFile.type || undefined,
      });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("social-stories").getPublicUrl(path);

      const { error } = await sb.from("social_stories").insert({
        user_id: profile.id,
        clan: profile.clan || null,
        media_url: urlData.publicUrl,
        media_type: storyFile.type.startsWith("video/") ? "video" : "image",
        caption: storyCaption.trim() || null,
      });
      if (error) throw error;

      setStoryFile(null);
      setStoryPreview(null);
      setStoryCaption("");
      setStoryCreateOpen(false);
      await fetchFeed();
      toast.success("Story publicado!");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao publicar story");
    }
    setPublishingStory(false);
  };

  const deleteStory = async (storyId: string) => {
    if (!confirm("Excluir este story?")) return;
    const { error } = await sb.from("social_stories").update({ is_active: false }).eq("id", storyId).eq("user_id", profile?.id);
    if (error) {
      toast.error("Não foi possível excluir story.");
      return;
    }
    toast.success("Story removido.");
    await fetchFeed();
    setStoryModalOpen(false);
  };

  const startEditPost = (post: FeedItem) => {
    setEditingPostId(post.id);
    setEditingContent(post.content || "");
  };

  const cancelEditPost = () => {
    setEditingPostId(null);
    setEditingContent("");
  };

  const saveEditPost = async (postId: string) => {
    if (!editingContent.trim()) {
      toast.error("O texto do post não pode ficar vazio.");
      return;
    }
    setSavingEdit(true);
    const { error } = await sb.from("social_posts").update({ content: editingContent.trim() }).eq("id", postId).eq("user_id", profile?.id);
    if (error) {
      toast.error("Não foi possível salvar edição.");
      setSavingEdit(false);
      return;
    }
    setSavingEdit(false);
    cancelEditPost();
    await fetchFeed();
    toast.success("Post atualizado!");
  };

  const deletePost = async (postId: string) => {
    if (!confirm("Excluir este post?")) return;
    const { error } = await sb.from("social_posts").update({ is_active: false }).eq("id", postId).eq("user_id", profile?.id);
    if (error) {
      toast.error("Não foi possível excluir post.");
      return;
    }
    toast.success("Post removido.");
    await fetchFeed();
  };

  const toggleLike = async (post: FeedItem) => {
    if (!profile?.id) return;
    try {
      if (post.liked_by_me) {
        const { error } = await sb.from("social_post_likes").delete().eq("post_id", post.id).eq("user_id", profile.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("social_post_likes").insert({ post_id: post.id, user_id: profile.id });
        if (error) throw error;
      }
      await fetchFeed();
    } catch {
      toast.error("Não foi possível atualizar curtida.");
    }
  };

  const sharePost = async (post: FeedItem) => {
    if (!profile?.id) return;
    const text = [post.author?.nickname ? `${post.author.nickname} postou:` : "Post no Clan Panel:", post.content || "", post.media_url || ""]
      .filter(Boolean)
      .join("\n");
    try {
      if (navigator.share) {
        await navigator.share({ title: "Clan Panel", text });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success("Conteúdo copiado para compartilhar.");
      }
      await sb.from("social_post_shares").upsert({ post_id: post.id, user_id: profile.id }, { onConflict: "post_id,user_id", ignoreDuplicates: true });
      await fetchFeed();
    } catch (err: any) {
      if (err?.name !== "AbortError") toast.error("Não foi possível compartilhar.");
    }
  };

  const openStoryAt = (index: number) => {
    setStoryIndex(index);
    setStoryModalOpen(true);
    setStoryCommentText("");
  };

  const fetchStoryDetails = useCallback(async (storyId: string) => {
    setLoadingStoryDetails(true);
    const [reactionsRes, commentsRes] = await Promise.all([
      sb.from("social_story_reactions").select("story_id, user_id, reaction, created_at").eq("story_id", storyId),
      sb
        .from("social_story_comments")
        .select("id, story_id, user_id, comment, created_at")
        .eq("story_id", storyId)
        .eq("is_active", true)
        .order("created_at", { ascending: true }),
    ]);

    const reactions = (reactionsRes.data || []) as StoryReaction[];
    const commentsRaw = commentsRes.data || [];
    const userIds = Array.from(new Set(commentsRaw.map((c: any) => c.user_id)));
    const usersRes = userIds.length ? await sb.from("users").select("id, nickname, avatar_url, clan").in("id", userIds) : { data: [] };
    const usersMap = new Map<string, FeedUser>((usersRes.data || []).map((u: FeedUser) => [u.id, u]));

    const comments: StoryComment[] = commentsRaw.map((c: any) => ({
      id: c.id,
      story_id: c.story_id,
      user_id: c.user_id,
      comment: c.comment,
      created_at: c.created_at,
      author: usersMap.get(c.user_id) || null,
    }));

    setStoryReactions(reactions);
    setStoryComments(comments);
    setLoadingStoryDetails(false);
  }, [sb]);

  const activeStory = stories[storyIndex] || null;

  useEffect(() => {
    if (!storyModalOpen || !activeStory?.id) return;
    fetchStoryDetails(activeStory.id);
  }, [storyModalOpen, activeStory?.id, fetchStoryDetails]);

  const reactToStory = async (reaction: string) => {
    if (!profile?.id || !activeStory?.id) return;
    const mine = storyReactions.find((r) => r.user_id === profile.id);
    if (mine?.reaction === reaction) {
      await sb.from("social_story_reactions").delete().eq("story_id", activeStory.id).eq("user_id", profile.id);
    } else {
      await sb
        .from("social_story_reactions")
        .upsert({ story_id: activeStory.id, user_id: profile.id, reaction }, { onConflict: "story_id,user_id" });
    }
    await fetchStoryDetails(activeStory.id);
  };

  const sendStoryComment = async () => {
    if (!profile?.id || !activeStory?.id || !storyCommentText.trim()) return;
    setSendingStoryComment(true);
    const { error } = await sb.from("social_story_comments").insert({
      story_id: activeStory.id,
      user_id: profile.id,
      comment: storyCommentText.trim(),
    });
    if (error) {
      toast.error("Erro ao comentar no story.");
      setSendingStoryComment(false);
      return;
    }
    setStoryCommentText("");
    await fetchStoryDetails(activeStory.id);
    setSendingStoryComment(false);
  };

  const sendPostComment = async (postId: string) => {
    if (!profile?.id) return;
    const text = (postCommentInput[postId] || "").trim();
    if (!text) return;
    setSendingPostCommentId(postId);
    const { error } = await sb.from("social_post_comments").insert({
      post_id: postId,
      user_id: profile.id,
      comment: text,
    });
    if (error) {
      toast.error("Erro ao comentar no post.");
      setSendingPostCommentId(null);
      return;
    }
    setPostCommentInput((prev) => ({ ...prev, [postId]: "" }));
    await fetchFeed();
    setSendingPostCommentId(null);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  const myStoryReaction = storyReactions.find((r) => r.user_id === profile?.id)?.reaction || null;
  const reactionCountMap = storyReactions.reduce<Record<string, number>>((acc, r) => {
    acc[r.reaction] = (acc[r.reaction] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      <div className="glass-card p-3 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-display font-extrabold uppercase tracking-wider text-primary">Stories</p>
          <button
            onClick={() => setStoryCreateOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-primary/20 border border-primary/30 text-primary text-xs font-display font-bold flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Criar story
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {stories.length === 0 ? (
            <div className="px-3 py-2 rounded-xl bg-secondary/20 border border-border/30 text-xs text-muted-foreground">Nenhum story ativo</div>
          ) : (
            stories.map((story, idx) => (
              <button
                key={story.id}
                onClick={() => openStoryAt(idx)}
                className="w-[92px] h-[150px] shrink-0 rounded-2xl overflow-hidden border border-border/40 bg-secondary/20 relative text-left"
              >
                {story.media_type === "video" ? (
                  <video src={story.media_url} className="w-full h-full object-cover" muted />
                ) : (
                  <img src={story.media_url} alt={story.author?.nickname || "story"} className="w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute top-2 left-2 w-7 h-7 rounded-full border-2 border-primary overflow-hidden bg-background">
                  {story.author?.avatar_url ? (
                    <img src={story.author.avatar_url} alt={story.author.nickname} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] font-bold">
                      {(story.author?.nickname || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <p className="absolute bottom-2 left-2 right-2 text-[11px] font-bold text-white leading-tight line-clamp-2">
                  {story.author?.nickname || "Jogador"}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="glass-card p-4 space-y-3">
        <p className="text-sm font-display font-extrabold uppercase tracking-wider text-primary">Feed Global</p>
        <textarea
          className="input-modern min-h-[96px] resize-none text-sm"
          placeholder="Compartilhe uma estratégia, recado ou novidade..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPostEmoji((v) => !v)}
            className="px-3 py-1.5 rounded-xl border border-border/40 bg-secondary/20 text-xs font-display font-bold text-muted-foreground hover:text-foreground flex items-center gap-1.5"
          >
            <Smile className="w-3.5 h-3.5" />
            Emoji
          </button>
          {showPostEmoji && (
            <div className="flex flex-wrap gap-1">
              {quickEmojis.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setContent((prev) => `${prev}${emoji}`)}
                  className="w-8 h-8 rounded-lg border border-border/40 bg-secondary/20 text-sm hover:bg-secondary/40"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        {mediaPreview && (
          <div className="rounded-xl border border-border/40 bg-secondary/20 p-2">
            {mediaFile?.type.startsWith("video/") ? (
              <video src={mediaPreview} controls className="w-full max-h-80 rounded-lg" />
            ) : (
              <img src={mediaPreview} alt="preview" className="w-full max-h-80 object-contain rounded-lg" />
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <label className="px-3 py-2 rounded-xl border border-border/40 bg-secondary/25 text-xs font-display font-bold cursor-pointer hover:border-primary/30">
            <input type="file" accept="image/*" className="hidden" onChange={(e) => onSelectMedia(e.target.files?.[0])} />
            <span className="flex items-center gap-1.5">
              <ImagePlus className="w-3.5 h-3.5" /> Foto
            </span>
          </label>
          <label className="px-3 py-2 rounded-xl border border-border/40 bg-secondary/25 text-xs font-display font-bold cursor-pointer hover:border-primary/30">
            <input type="file" accept="video/*" className="hidden" onChange={(e) => onSelectMedia(e.target.files?.[0])} />
            <span className="flex items-center gap-1.5">
              <Video className="w-3.5 h-3.5" /> Vídeo
            </span>
          </label>
          {mediaFile && (
            <button
              onClick={() => {
                setMediaFile(null);
                setMediaPreview(null);
              }}
              className="px-3 py-2 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-xs font-display font-bold"
            >
              Remover mídia
            </button>
          )}
          <button
            onClick={publishPost}
            disabled={publishing}
            className="ml-auto px-4 py-2 rounded-xl bg-primary/20 text-primary border border-primary/30 text-xs font-display font-extrabold uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            {publishing ? "Publicando..." : "Publicar"}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="glass-card p-4 text-sm text-muted-foreground">Carregando feed...</div>
        ) : posts.length === 0 ? (
          <div className="glass-card p-4 text-sm text-muted-foreground">Nenhuma publicação ainda. Seja o primeiro a postar.</div>
        ) : (
          posts.map((post) => {
            const mine = post.user_id === profile?.id;
            const editing = editingPostId === post.id;
            return (
              <div key={post.id} className="glass-card p-4 space-y-3">
                <div className="flex items-center gap-2.5">
                  {post.author?.avatar_url ? (
                    <img src={post.author.avatar_url} alt={post.author.nickname} className="w-10 h-10 rounded-xl object-cover border border-primary/30" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-secondary/50 border border-border/40 flex items-center justify-center text-sm font-bold">
                      {(post.author?.nickname || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-display font-extrabold text-sm truncate">{post.author?.nickname || "Jogador"}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {post.author?.clan || post.clan || "Sem clã"} • {formatDate(post.created_at)}
                    </p>
                  </div>
                  {mine && (
                    <div className="ml-auto flex items-center gap-1">
                      <button
                        onClick={() => startEditPost(post)}
                        className="p-1.5 rounded-lg border border-border/40 text-muted-foreground hover:text-primary"
                        title="Editar post"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deletePost(post.id)}
                        className="p-1.5 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10"
                        title="Excluir post"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {editing ? (
                  <div className="space-y-2">
                    <textarea
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      className="input-modern min-h-[90px] resize-none text-sm"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowEditEmoji((v) => !v)}
                        className="px-3 py-1.5 rounded-xl border border-border/40 bg-secondary/20 text-xs font-display font-bold text-muted-foreground hover:text-foreground flex items-center gap-1.5"
                      >
                        <Smile className="w-3.5 h-3.5" />
                        Emoji
                      </button>
                      {showEditEmoji && (
                        <div className="flex flex-wrap gap-1">
                          {quickEmojis.map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => setEditingContent((prev) => `${prev}${emoji}`)}
                              className="w-8 h-8 rounded-lg border border-border/40 bg-secondary/20 text-sm hover:bg-secondary/40"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={cancelEditPost} className="px-3 py-1.5 rounded-xl border border-border/40 text-xs font-bold text-muted-foreground">
                        Cancelar
                      </button>
                      <button
                        onClick={() => saveEditPost(post.id)}
                        disabled={savingEdit}
                        className="px-3 py-1.5 rounded-xl border border-primary/30 bg-primary/15 text-primary text-xs font-bold flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        {savingEdit ? "Salvando..." : "Salvar"}
                      </button>
                    </div>
                  </div>
                ) : (
                  post.content && <p className="text-sm whitespace-pre-wrap">{post.content}</p>
                )}

                {post.media_url && post.media_type === "image" && (
                  <button
                    type="button"
                    onClick={() => setExpandedFeedImage({ url: post.media_url!, authorName: post.author?.nickname || "Jogador" })}
                    className="block w-full"
                    title="Abrir imagem"
                  >
                    <img
                      src={post.media_url}
                      alt="post"
                      className="w-full rounded-xl border border-border/40 max-h-[480px] object-contain bg-secondary/20 cursor-zoom-in"
                    />
                  </button>
                )}
                {post.media_url && post.media_type === "video" && (
                  <video src={post.media_url} controls className="w-full rounded-xl border border-border/40 max-h-[480px] bg-black/30" />
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleLike(post)}
                    className={`px-3 py-2 rounded-xl border text-xs font-display font-bold flex items-center gap-1.5 ${
                      post.liked_by_me
                        ? "bg-red-500/15 border-red-500/30 text-red-400"
                        : "bg-secondary/25 border-border/40 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${post.liked_by_me ? "fill-current" : ""}`} />
                    Curtir ({post.like_count})
                  </button>
                  <button
                    onClick={() => sharePost(post)}
                    className="px-3 py-2 rounded-xl border border-border/40 bg-secondary/25 text-xs font-display font-bold flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Compartilhar ({post.share_count})
                  </button>
                </div>

                <div className="space-y-2 border-t border-border/30 pt-2">
                  <div className="flex items-center gap-2">
                    <input
                      value={postCommentInput[post.id] || ""}
                      onChange={(e) => setPostCommentInput((prev) => ({ ...prev, [post.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") sendPostComment(post.id);
                      }}
                      placeholder="Comentar no post..."
                      className="input-modern h-9 text-sm"
                    />
                    <button
                      onClick={() => sendPostComment(post.id)}
                      disabled={sendingPostCommentId === post.id || !(postCommentInput[post.id] || "").trim()}
                      className="px-3 py-2 rounded-xl border border-primary/30 bg-primary/15 text-primary text-xs font-bold disabled:opacity-50"
                    >
                      Enviar
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    {(postComments[post.id] || []).length === 0 ? (
                      <p className="text-xs text-muted-foreground">Sem comentários ainda.</p>
                    ) : (
                      (postComments[post.id] || []).map((c) => (
                        <div key={c.id} className="px-2.5 py-1.5 rounded-lg bg-secondary/20 border border-border/30">
                          <div className="flex items-center gap-2">
                            {c.author?.avatar_url ? (
                              <img src={c.author.avatar_url} alt={c.author.nickname || "Jogador"} className="w-6 h-6 rounded-full object-cover border border-primary/30" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-secondary/60 border border-border/40 flex items-center justify-center text-[10px] font-bold">
                                {(c.author?.nickname || "J").charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-[11px] text-primary font-bold leading-none">{c.author?.nickname || "Jogador"}</p>
                              <p className="text-[10px] text-muted-foreground leading-none mt-1">
                                {new Date(c.created_at).toLocaleString("pt-BR", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            </div>
                          </div>
                          <p className="text-xs text-foreground/90 whitespace-pre-wrap mt-1.5">{c.comment}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Dialog open={storyCreateOpen} onOpenChange={setStoryCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Story</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <label className="px-3 py-2 rounded-xl border border-border/40 bg-secondary/25 text-xs font-display font-bold cursor-pointer hover:border-primary/30">
                <input
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setStoryFile(file);
                    setStoryPreview(URL.createObjectURL(file));
                  }}
                />
                <span className="flex items-center gap-1.5">
                  <ImagePlus className="w-3.5 h-3.5" /> Escolher mídia
                </span>
              </label>
            </div>
            {storyPreview && (
              <div className="rounded-xl border border-border/40 bg-secondary/20 p-2">
                {storyFile?.type.startsWith("video/") ? (
                  <video src={storyPreview} controls className="w-full max-h-80 rounded-lg" />
                ) : (
                  <img src={storyPreview} alt="story preview" className="w-full max-h-80 object-contain rounded-lg" />
                )}
              </div>
            )}
            <textarea
              value={storyCaption}
              onChange={(e) => setStoryCaption(e.target.value)}
              placeholder="Legenda (opcional)"
              className="input-modern min-h-[80px] resize-none text-sm"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowStoryEmoji((v) => !v)}
                className="px-3 py-1.5 rounded-xl border border-border/40 bg-secondary/20 text-xs font-display font-bold text-muted-foreground hover:text-foreground flex items-center gap-1.5"
              >
                <Smile className="w-3.5 h-3.5" />
                Emoji
              </button>
              {showStoryEmoji && (
                <div className="flex flex-wrap gap-1">
                  {quickEmojis.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => setStoryCaption((prev) => `${prev}${emoji}`)}
                      className="w-8 h-8 rounded-lg border border-border/40 bg-secondary/20 text-sm hover:bg-secondary/40"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setStoryCreateOpen(false)} className="px-3 py-2 rounded-xl border border-border/40 text-xs font-bold text-muted-foreground">
                Cancelar
              </button>
              <button
                onClick={publishStory}
                disabled={publishingStory}
                className="px-3 py-2 rounded-xl border border-primary/30 bg-primary/15 text-primary text-xs font-bold"
              >
                {publishingStory ? "Publicando..." : "Publicar story"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={storyModalOpen} onOpenChange={setStoryModalOpen}>
        <DialogContent className="max-w-md p-3 [&>button]:hidden">
          {activeStory && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full overflow-hidden border border-primary/40">
                  {activeStory.author?.avatar_url ? (
                    <img src={activeStory.author.avatar_url} alt={activeStory.author.nickname || "story"} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs font-bold">{(activeStory.author?.nickname || "?").charAt(0)}</div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate">{activeStory.author?.nickname || "Jogador"}</p>
                  <p className="text-[11px] text-muted-foreground">{formatDate(activeStory.created_at)}</p>
                </div>
                <div className="ml-auto flex items-center gap-1">
                  {activeStory.mine && (
                    <button
                      onClick={() => deleteStory(activeStory.id)}
                      className="p-1.5 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10"
                      title="Excluir story"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={() => setStoryModalOpen(false)} className="p-1.5 rounded-lg border border-border/40 text-muted-foreground" title="Fechar">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="relative rounded-xl overflow-hidden border border-border/40 bg-secondary/20">
                {activeStory.media_type === "video" ? (
                  <video src={activeStory.media_url} controls autoPlay className="w-full max-h-[70vh] bg-black" />
                ) : (
                  <img src={activeStory.media_url} alt="story" className="w-full max-h-[70vh] object-contain" />
                )}
                <button
                  onClick={() => setStoryIndex((idx) => (idx <= 0 ? stories.length - 1 : idx - 1))}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setStoryIndex((idx) => (idx >= stories.length - 1 ? 0 : idx + 1))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              {activeStory.caption && <p className="text-sm whitespace-pre-wrap">{activeStory.caption}</p>}

              <div className="space-y-2 border-t border-border/30 pt-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {storyReactionEmojis.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => reactToStory(emoji)}
                      className={`px-2.5 py-1.5 rounded-full border text-sm transition-colors ${
                        myStoryReaction === emoji
                          ? "border-primary bg-primary/20 text-primary"
                          : "border-border/40 bg-secondary/20 hover:bg-secondary/40"
                      }`}
                    >
                      {emoji} {reactionCountMap[emoji] ? reactionCountMap[emoji] : ""}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    value={storyCommentText}
                    onChange={(e) => setStoryCommentText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") sendStoryComment();
                    }}
                    placeholder="Enviar mensagem..."
                    className="input-modern h-9 text-sm"
                  />
                  <button
                    onClick={sendStoryComment}
                    disabled={sendingStoryComment || !storyCommentText.trim()}
                    className="px-3 py-2 rounded-xl border border-primary/30 bg-primary/15 text-primary text-xs font-bold disabled:opacity-50"
                  >
                    Enviar
                  </button>
                </div>

                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                  {loadingStoryDetails ? (
                    <p className="text-xs text-muted-foreground">Carregando interações...</p>
                  ) : storyComments.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sem comentários ainda.</p>
                  ) : (
                    storyComments.map((c) => (
                      <div key={c.id} className="px-2.5 py-1.5 rounded-lg bg-secondary/20 border border-border/30">
                        <div className="flex items-center gap-2">
                          {c.author?.avatar_url ? (
                            <img src={c.author.avatar_url} alt={c.author.nickname || "Jogador"} className="w-6 h-6 rounded-full object-cover border border-primary/30" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-secondary/60 border border-border/40 flex items-center justify-center text-[10px] font-bold">
                              {(c.author?.nickname || "J").charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-[11px] text-primary font-bold leading-none">{c.author?.nickname || "Jogador"}</p>
                            <p className="text-[10px] text-muted-foreground leading-none mt-1">
                              {new Date(c.created_at).toLocaleString("pt-BR", {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-foreground/90 whitespace-pre-wrap mt-1.5">{c.comment}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {expandedFeedImage && (
        <div
          className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setExpandedFeedImage(null)}
        >
          <div
            className="relative w-full max-w-5xl animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={expandedFeedImage.url}
              alt={expandedFeedImage.authorName}
              className="w-full max-h-[88vh] object-contain rounded-2xl border border-primary/30 bg-background/60 shadow-2xl"
            />
            <button
              onClick={() => setExpandedFeedImage(null)}
              className="absolute top-3 right-3 p-2 rounded-full border border-border/50 bg-background/80 text-muted-foreground hover:text-foreground"
              title="Fechar"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
