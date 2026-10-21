import { Timestamp } from 'firebase/firestore'

export interface BlogPost {
  id?: string
  title: string
  content: string // 마크다운 텍스트
  images: string[] // Storage URL 배열
  createdAt: Timestamp | Date
  updatedAt: Timestamp | Date
  author: string // 사용자 UID
  tags?: string[]
  published: boolean
  slug?: string // URL 친화적인 제목
  viewCount?: number // 조회수 (방문자가 글을 열 때 +1)
  lastViewedAt?: Timestamp | Date // 마지막 조회 시각
}

export interface BlogPostFormData {
  title: string
  content: string
  images: File[]
  tags: string[]
  published: boolean
}

export interface Project {
  id?: string
  tag: string // 태그 이름 (프로젝트 이름)
  description: string // 프로젝트 소개글
  createdAt: Timestamp | Date
  updatedAt: Timestamp | Date
}

