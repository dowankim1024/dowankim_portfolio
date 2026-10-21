'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AuthGuard from '@/components/AuthGuard'
import { getAllPosts, deletePost, seedMissingViewCounts } from '@/lib/blog'
import { logout } from '@/lib/auth'
import { BlogPost } from '@/types/blog'
import ViewBadge from '@/components/Blog/ViewBadge'

type SortBy = 'latest' | 'views' | 'recentlyViewed'

const toDate = (value: Date | { toDate: () => Date } | string | number): Date =>
  value instanceof Date
    ? value
    : typeof value === 'object' && 'toDate' in value
      ? value.toDate()
      : new Date(value)

// "3분 전", "2일 전" 같은 상대 시각
const formatRelative = (date: Date): string => {
  const diffMs = Date.now() - date.getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}시간 전`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}일 전`
  return date.toLocaleDateString('ko-KR')
}

export default function AdminBlogPage() {
  const router = useRouter()
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<SortBy>('latest')
  const [seeding, setSeeding] = useState(false)

  useEffect(() => {
    loadPosts()
  }, [])

  const loadPosts = async () => {
    try {
      const allPosts = await getAllPosts()
      setPosts(allPosts)
      if (allPosts.length === 0) {
        console.warn('포스트가 없거나 권한이 없습니다.')
      }
    } catch (error) {
      console.error('포스트 로드 실패:', error)
      setPosts([]) // 에러 발생 시 빈 배열로 설정
    } finally {
      setLoading(false)
    }
  }

  // 조회수 요약
  const totalViews = useMemo(
    () => posts.reduce((sum, post) => sum + (post.viewCount ?? 0), 0),
    [posts]
  )
  const missingViewCount = useMemo(
    () => posts.filter(post => typeof post.viewCount !== 'number').length,
    [posts]
  )

  const sortedPosts = useMemo(() => {
    const list = [...posts]
    if (sortBy === 'views') {
      list.sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0))
    } else if (sortBy === 'recentlyViewed') {
      list.sort((a, b) => {
        const at = a.lastViewedAt ? toDate(a.lastViewedAt).getTime() : 0
        const bt = b.lastViewedAt ? toDate(b.lastViewedAt).getTime() : 0
        return bt - at
      })
    }
    // 'latest'는 getAllPosts가 이미 최신순으로 줌
    return list
  }, [posts, sortBy])

  const handleDelete = async (post: BlogPost) => {
    if (!post.id) return
    
    if (!confirm(`"${post.title}" 글을 정말 삭제하시겠습니까?`)) {
      return
    }

    try {
      await deletePost(post.id, post.images || [])
      loadPosts()
    } catch (error) {
      console.error('삭제 실패:', error)
      alert('삭제 중 오류가 발생했습니다.')
    }
  }

  // 조회수가 없는 기존 글에 초기값(20~90 무작위) 부여
  const handleSeedViewCounts = async () => {
    if (
      !confirm(
        `조회수가 없는 글 ${missingViewCount}개에 20~90 사이의 초기 조회수를 넣습니다. 진행할까요?`
      )
    ) {
      return
    }

    setSeeding(true)
    try {
      const updated = await seedMissingViewCounts(posts, 20, 90)
      await loadPosts()
      alert(`${updated}개 글에 초기 조회수를 넣었습니다.`)
    } catch (error) {
      console.error('초기 조회수 설정 실패:', error)
      alert('초기 조회수 설정 중 오류가 발생했습니다.')
    } finally {
      setSeeding(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    router.push('/admin/login')
  }

  const sortButtonClass = (active: boolean) =>
    `px-4 py-2 rounded-lg text-sm cursor-pointer transition-all duration-300 border ${
      active
        ? 'bg-[rgba(3,232,249,0.2)] border-[#03e8f9] text-white'
        : 'bg-transparent border-[rgba(3,232,249,0.2)] text-white/70 hover:border-[rgba(3,232,249,0.4)]'
    }`

  return (
    <AuthGuard>
      <div className="min-h-screen bg-[#050a13] text-white pt-32 px-4 pb-16">
        <div className="max-w-[1200px] mx-auto mb-8 flex justify-between items-center flex-wrap gap-4">
          <h1 className="text-4xl text-[#03e8f9]">블로그 관리</h1>
          <div className="flex gap-4">
            <Link href="/admin/blog/write" className="px-6 py-3 rounded-lg font-bold cursor-pointer transition-all duration-300 no-underline inline-block border-none text-base bg-[#03e8f9] text-[#050a13] hover:bg-transparent hover:text-[#03e8f9] hover:border hover:border-[#03e8f9]">
              새 글 작성
            </Link>
            <Link href="/admin/blog/projects" className="px-6 py-3 rounded-lg font-bold cursor-pointer transition-all duration-300 no-underline inline-block border-none text-base bg-transparent text-[#03e8f9] border border-[#03e8f9] hover:bg-[#03e8f9] hover:text-[#050a13]">
              프로젝트 관리
            </Link>
            <button onClick={handleLogout} className="px-6 py-3 rounded-lg font-bold cursor-pointer transition-all duration-300 no-underline inline-block border-none text-base bg-[#fd6413] text-white hover:bg-transparent hover:text-[#fd6413] hover:border hover:border-[#fd6413]">
              로그아웃
            </button>
          </div>
        </div>

        {/* 조회수 요약 + 정렬 */}
        {!loading && posts.length > 0 && (
          <div className="max-w-[1200px] mx-auto mb-8 bg-[#1b1e26] p-6 rounded-2xl border border-[rgba(3,232,249,0.2)] flex justify-between items-center flex-wrap gap-4">
            <div className="flex items-center gap-6 flex-wrap">
              <div>
                <p className="text-sm text-white/60 mb-1">총 조회수</p>
                <p className="text-2xl text-[#03e8f9] font-bold">{totalViews.toLocaleString('ko-KR')}</p>
              </div>
              <div>
                <p className="text-sm text-white/60 mb-1">글 수</p>
                <p className="text-2xl text-white font-bold">{posts.length}</p>
              </div>
              {missingViewCount > 0 && (
                <button
                  onClick={handleSeedViewCounts}
                  disabled={seeding}
                  className="px-4 py-2 rounded-lg text-sm cursor-pointer transition-all duration-300 border border-[#fd6413] text-[#fd6413] bg-transparent hover:bg-[#fd6413] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {seeding ? '설정 중...' : `조회수 없는 글 ${missingViewCount}개에 초기값 넣기`}
                </button>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setSortBy('latest')} className={sortButtonClass(sortBy === 'latest')}>
                최신순
              </button>
              <button onClick={() => setSortBy('views')} className={sortButtonClass(sortBy === 'views')}>
                조회수순
              </button>
              <button onClick={() => setSortBy('recentlyViewed')} className={sortButtonClass(sortBy === 'recentlyViewed')}>
                최근 조회순
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-center text-xl opacity-60 py-16">로딩 중...</p>
        ) : posts.length === 0 ? (
          <p className="text-center text-xl opacity-60 py-16">작성된 글이 없습니다.</p>
        ) : (
          <div className="max-w-[1200px] mx-auto flex flex-col gap-6">
            {sortedPosts.map((post) => (
              <div key={post.id} className="bg-[#1b1e26] p-8 rounded-2xl border border-[rgba(3,232,249,0.2)] flex justify-between items-center gap-8 max-md:flex-col max-md:items-start">
                <div className="flex-1">
                  <h2 className="text-2xl mb-2 text-white">{post.title}</h2>
                  <p className="text-sm text-[#03e8f9] mb-2">
                    {toDate(post.createdAt).toLocaleDateString('ko-KR')}
                  </p>
                  <div className="flex items-center gap-3 flex-wrap mb-3 text-sm text-white/60">
                    <ViewBadge count={post.viewCount ?? 0} className="text-white/80" />
                    {typeof post.viewCount !== 'number' && (
                      <span className="text-[#fd6413]">조회수 미설정</span>
                    )}
                    {post.lastViewedAt && (
                      <span title={toDate(post.lastViewedAt).toLocaleString('ko-KR')}>
                        마지막 조회 {formatRelative(toDate(post.lastViewedAt))}
                      </span>
                    )}
                  </div>
                  <span className={`inline-block px-3 py-1 rounded text-sm font-bold ${post.published ? 'bg-[rgba(3,232,249,0.2)] text-[#03e8f9]' : 'bg-[rgba(253,100,19,0.2)] text-[#fd6413]'}`}>
                    {post.published ? '공개' : '비공개'}
                  </span>
                </div>
                <div className="flex gap-4 max-md:w-full max-md:[&_button]:flex-1 max-md:[&_a]:flex-1">
                  <Link 
                    href={`/admin/blog/edit/${post.id}`}
                    className="px-4 py-2 rounded-lg cursor-pointer transition-all duration-300 border-none text-sm no-underline inline-block bg-[#03e8f9] text-[#050a13] hover:bg-transparent hover:text-[#03e8f9] hover:border hover:border-[#03e8f9]"
                  >
                    수정
                  </Link>
                  <button
                    onClick={() => handleDelete(post)}
                    className="px-4 py-2 rounded-lg cursor-pointer transition-all duration-300 border-none text-sm no-underline inline-block bg-[#fd6413] text-white hover:bg-transparent hover:text-[#fd6413] hover:border hover:border-[#fd6413]"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AuthGuard>
  )
}
