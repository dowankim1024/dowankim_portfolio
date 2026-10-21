'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { getPostsByTagPaginated } from '@/lib/blog'
import { BlogPost } from '@/types/blog'
import ViewBadge from '@/components/Blog/ViewBadge'
import { QueryDocumentSnapshot } from 'firebase/firestore'

interface PostListProps {
  initialPosts: BlogPost[]
  tag: string
}

export default function PostList({ initialPosts, tag }: PostListProps) {
  const [posts, setPosts] = useState<BlogPost[]>(initialPosts)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(initialPosts.length === 12) // 초기 데이터가 12개면 다음 페이지가 있을 수 있음
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null)
  const [isFirstLoad, setIsFirstLoad] = useState(true) // 첫 번째 로드인지 확인
  const observerRef = useRef<HTMLDivElement>(null)

  // 다음 페이지 로드
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return

    setLoading(true)
    try {
      let result
      
      // 첫 번째 로드이고 초기 데이터가 12개인 경우
      if (isFirstLoad && initialPosts.length === 12) {
        // 초기 데이터를 다시 가져와서 lastDoc을 얻음 (중복 방지)
        const firstPageResult = await getPostsByTagPaginated(tag, 12)
        if (firstPageResult.lastDoc) {
          // 두 번째 페이지 가져오기
          result = await getPostsByTagPaginated(tag, 12, firstPageResult.lastDoc)
        } else {
          result = { posts: [], lastDoc: null, hasMore: false }
        }
        setIsFirstLoad(false)
      } else {
        // 일반적인 경우
        result = await getPostsByTagPaginated(tag, 12, lastDoc || undefined)
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
  }, [tag, lastDoc, loading, hasMore, isFirstLoad, initialPosts.length])

  // Intersection Observer로 스크롤 감지
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
              href={`/blog/${encodeURIComponent(tag)}/${encodeURIComponent(post.slug || post.id || '')}`}
              className="bg-[#1b1e26] rounded-2xl border border-[rgba(3,232,249,0.2)] transition-all duration-300 no-underline text-inherit block hover:border-[#03e8f9] hover:-translate-y-1 hover:shadow-[0_4px_12px_rgba(3,232,249,0.2)] overflow-hidden"
            >
              {/* 썸네일 이미지 */}
              <div className="relative w-full h-48 bg-black">
                <Image
                  src={thumbnailImage}
                  alt={post.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
              </div>
              
              {/* 제목과 날짜 */}
              <div className="p-6">
                <h2 className="text-xl mb-3 text-white line-clamp-2">{post.title}</h2>
                <p className="text-sm text-[#03e8f9] flex items-center justify-between gap-3">
                  <span>{date.toLocaleDateString('ko-KR')}</span>
                  <ViewBadge count={post.viewCount ?? 0} className="text-white/50" iconClassName="w-3.5 h-3.5" />
                </p>
              </div>
            </Link>
          )
        })}
      </div>
      
      {/* 스크롤 감지용 요소 */}
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

