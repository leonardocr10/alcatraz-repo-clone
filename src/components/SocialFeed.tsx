import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Heart, ImagePlus, Send, Share2, Video } from "lucide-react";

type SocialPost = {
  id: string;
  user_id: string;
  clan: string | null;
  content: string;
  media_url: string | null;
  media_type: "image" | "video" | null;
  created_at: string;
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

export function SocialFeed() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [posts, setPosts] = useState<FeedItem[]>([]);
  const [content, setContent] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);

  const sb = useMemo(() => supabase as any, []);

  const fetchFeed = useCallback(async () => {
    if (!profile?.id) return;

    const { data: postRows, error: postError } = await sb
      .from("social_posts")
      .select("id, user_id, clan, content, media_url, media_type, created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(40);

    if (postError) {
      setLoading(false);
      return;
    }

    const rawPosts = (postRows || []) as SocialPost[];
    if (rawPosts.length === 0) {
      setPosts([]);
      setLoading(false);
      return;
    }

    const postIds = rawPosts.map((p) => p.id);
    const userIds = Array.from(new Set(rawPosts.map((p) => p.user_id)));

    const [usersRes, likesRes, sharesRes] = await Promise.all([
      sb.from("users").select("id, nickname, avatar_url, clan").in("id", userIds),
      sb.from("social_post_likes").select("post_id, user_id").in("post_id", postIds),
      sb.from("social_post_shares").select("post_id, user_id").in("post_id", postIds),
    ]);

    const usersMap = new Map<string, FeedUser>((usersRes.data || []).map((u: FeedUser) => [u.id, u]));
    const likes = likesRes.data || [];
    const shares = sharesRes.data || [];

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

  const toggleLike = async (post: FeedItem) => {
    if (!profile?.id) return;
    try {
      if (post.liked_by_me) {
        const { error } = await sb
          .from("social_post_likes")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", profile.id);
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
        await navigator.share({
          title: "Clan Panel",
          text,
        });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success("Conteúdo copiado para compartilhar.");
      }

      await sb
        .from("social_post_shares")
        .upsert({ post_id: post.id, user_id: profile.id }, { onConflict: "post_id,user_id", ignoreDuplicates: true });
      await fetchFeed();
    } catch (err: any) {
      if (err?.name !== "AbortError") toast.error("Não foi possível compartilhar.");
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-3">
      <div className="glass-card p-4 space-y-3">
        <p className="text-sm font-display font-extrabold uppercase tracking-wider text-primary">Feed do Clã</p>
        <textarea
          className="input-modern min-h-[96px] resize-none text-sm"
          placeholder="Compartilhe uma estratégia, recado ou novidade..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />

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
            <span className="flex items-center gap-1.5"><ImagePlus className="w-3.5 h-3.5" /> Foto</span>
          </label>
          <label className="px-3 py-2 rounded-xl border border-border/40 bg-secondary/25 text-xs font-display font-bold cursor-pointer hover:border-primary/30">
            <input type="file" accept="video/*" className="hidden" onChange={(e) => onSelectMedia(e.target.files?.[0])} />
            <span className="flex items-center gap-1.5"><Video className="w-3.5 h-3.5" /> Vídeo</span>
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
          posts.map((post) => (
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
                  <p className="text-[11px] text-muted-foreground">{post.author?.clan || post.clan || "Sem clã"} • {formatDate(post.created_at)}</p>
                </div>
              </div>

              {post.content && <p className="text-sm whitespace-pre-wrap">{post.content}</p>}

              {post.media_url && post.media_type === "image" && (
                <img src={post.media_url} alt="post" className="w-full rounded-xl border border-border/40 max-h-[480px] object-contain bg-secondary/20" />
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
            </div>
          ))
        )}
      </div>
    </div>
  );
}

