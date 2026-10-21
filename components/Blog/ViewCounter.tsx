'use client'

import { useEffect, useState } from 'react'
import { incrementPostView } from '@/lib/blog'
import { getCurrentUser } from '@/lib/auth'
import ViewBadge from './ViewBadge'

interface ViewCounterProps {
  postId: string
  initialCount: number
  className?: string
}

const STORAGE_PREFIX = 'viewed:'

const hasViewed = (postId: string): boolean => {
  try {
    return sessionStorage.getItem(STORAGE_PREFIX + postId) === '1'
  } catch {
    return false
  }
}

const setViewed = (postId: string, viewed: boolean) => {
  try {
    if (viewed) sessionStorage.setItem(STORAGE_PREFIX + postId, '1')
    else sessionStorage.removeItem(STORAGE_PREFIX + postId)
  } catch {
    // sessionStorage를 쓸 수 없는 환경이면 무시
  }
}

// 같은 글에 대해 동시에 여러 번 호출돼도(React StrictMode 등) 증가는 한 번만 일어나도록 공유
const inFlight = new Map<string, Promise<boolean>>()

// 조회수를 1 올리고, 실제로 올렸으면 true 반환
const recordView = (postId: string): Promise<boolean> => {
  const existing = inFlight.get(postId)
  if (existing) return existing

  const task = (async () => {
    // 이 브라우저 세션에서 이미 본 글이면 집계하지 않음 (새로고침 연타 방지)
    if (hasViewed(postId)) return false

    // 관리자(로그인 상태)의 조회는 집계하지 않음
    const user = await getCurrentUser()
    if (user) return false

    setViewed(postId, true)
    try {
      await incrementPostView(postId)
      return true
    } catch (error) {
      setViewed(postId, false)
      console.error('조회수 증가 실패:', error)
      return false
    }
  })()

  inFlight.set(postId, task)
  task.finally(() => inFlight.delete(postId))
  return task
}

// 글 상세에서 사용. 서버에서 받은 조회수를 보여주고, 마운트 후 +1 시도
// 클라이언트에서만 실행되므로 OG 미리보기 봇이나 크롤러의 접근은 집계되지 않음
export default function ViewCounter({ postId, initialCount, className = '' }: ViewCounterProps) {
  const [count, setCount] = useState(initialCount)

  useEffect(() => {
    let cancelled = false
    recordView(postId).then(incremented => {
      if (!cancelled && incremented) {
        setCount(current => current + 1)
      }
    })
    return () => {
      cancelled = true
    }
  }, [postId])

  return <ViewBadge count={count} className={className} />
}
