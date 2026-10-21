'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { getPublishedPostsPaginated } from '@/lib/blog'
import { BlogPost } from '@/types/blog'
import ViewBadge from '@/components/Blog/ViewBadge'
import { QueryDocumentSnapshot } from 'firebase/firestore'

interface AllPostsListProps {
  initialPosts: BlogPost[]
}

export default function AllPostsList({ initialPosts }: AllPostsListProps) {
  const [posts, setPosts] = useState<BlogPost[]>(initialPosts)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(initialPosts.length === 12)
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null)
  const [isFirstLoad, setIsFirstLoad] = useState(true)
  const observerRef = useRef<HTMLDivElement>(null)

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return

    setLoading(true)
    try {
      let result

      if (isFirstLoad && initialPosts.length === 12) {
        const firstPageResult = await getPublishedPostsPaginated(12)
        if (firstPageResult.lastDoc) {
          result = await getPublishedPostsPaginated(12, firstPageResult.lastDoc)
        } else {
          result = { posts: [], lastDoc: null, hasMore: false }
        }
        setIsFirstLoad(false)
      } else {
        result = await getPublishedPostsPaginated(12, lastDoc || undefined)
      }

      if (result.posts.length > 0) {
        setPosts(prev => [...prev, ...result.posts])
        setLastDoc(result.lastDoc)
        setHasMore(result.hasMore)
      } else {
        setHasMore(false)
      }
    } catch (error) {
      console.error('포스트 로드 실패:', error)
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }, [lastDoc, loading, hasMore, isFirstLoad, initialPosts.length])

  useEffect(() => {
    const currentObserver = observerRef.current
    if (!currentObserver || !hasMore || loading) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore()
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(currentObserver)

    return () => {
      observer.disconnect()
    }
  }, [hasMore, loading, loadMore])

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-8">
        {posts.map((post) => {
          const primaryTag = post.tags?.[0] || '기타'
          const thumbnailImage = post.images && post.images.length > 0
            ? post.images[0]
            : '/images/blogs/default_thumbnail.webp'
          const date = post.createdAt instanceof Date
            ? post.createdAt
            : 'toDate' in post.createdAt
              ? (post.createdAt as { toDate: () => Date }).toDate()
              : new Date(post.createdAt as string | number)

          return (
            <Link
              key={post.id}
              href={`/blog/${encodeURIComponent(primaryTag)}/${encodeURIComponent(post.slug || post.id || '')}`}
              className="bg-[#1b1e26] rounded-2xl border border-[rgba(3,232,249,0.2)] transition-all duration-300 no-underline text-inherit block hover:border-[#03e8f9] hover:-translate-y-1 hover:shadow-[0_4px_12px_rgba(3,232,249,0.2)] overflow-hidden"
            >
              <div className="relative w-full h-48 bg-black">
                <Image
                  src={thumbnailImage}
                  alt={post.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
              </div>

              <div className="p-6">
                <h2 className="text-xl mb-3 text-white line-clamp-2">{post.title}</h2>
                <p className="text-sm text-[#03e8f9] mb-3 flex items-center justify-between gap-3">
                  <span>{date.toLocaleDateString('ko-KR')}</span>
                  <ViewBadge count={post.viewCount ?? 0} className="text-white/50" iconClassName="w-3.5 h-3.5" />
                </p>
                {post.tags && post.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {post.tags.map((tag) => (
                      <span
                        key={tag}
                        className="bg-[rgba(3,232,249,0.1)] text-[#03e8f9] px-2 py-0.5 rounded text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Link>
          )
        })}
      </div>

      {hasMore && (
        <div ref={observerRef} className="h-25 flex items-center justify-center mt-8">
          {loading && <p className="text-[#03e8f9] text-base text-center">로딩 중...</p>}
        </div>
      )}

      {!hasMore && posts.length > 0 && (
        <p className="text-white/60 text-base text-center mt-12 p-8">더 이상 포스트가 없습니다.</p>
      )}
    </>
  )
}
